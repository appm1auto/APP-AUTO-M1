/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import {
  createInitialDatabaseSchema,
  INITIAL_CLIENT_ADS_SETTINGS,
  mergeCustomizationSettings,
  repairUsersArray,
} from './src/services/seedData.ts';
import type { DatabaseSchema } from './src/services/seedData.ts';
import { brPhonesMatch, normalizeBrPhoneDigits } from './src/services/phone.ts';
import {
  calculateHaversineKm,
  cleanCepDigits,
  estimateCoordinatesFromCep,
  formatCep,
  isValidCep,
} from './src/services/geolocation.ts';
import type { GeoCoordinates } from './src/services/geolocation.ts';
import { getRoleDisplayName, isSupplierClassifiedAndApproved } from './src/services/rbac.ts';
import {
  createGatewayChargeWithSplit,
  createOrUpdateGatewaySubaccount,
  getGatewayConfigStatus,
} from './src/services/paymentGateway.ts';
import type {
  AuditLog,
  DeliveryAddress,
  GatewayBankInfo,
  OrderAndPayment,
  OrderDeliveryStatus,
  PartRequest,
  PaymentGatewayProvider,
  PaymentMethod,
  Quote,
  RequestStatusHistoryEntry,
  SplitPaymentStatus,
  SplitTransaction,
  SupplierPaymentType,
  User,
  UserRole,
} from './src/types/index.ts';

const PORT = Number(process.env.PORT || 3000);
const ROOT_DIR = process.cwd();
const DATA_DIR = path.join(ROOT_DIR, '.data');
const DB_FILE = path.join(DATA_DIR, 'compe-db.json');
const GEO_CACHE_FILE = path.join(DATA_DIR, 'geo-cache.json');
const CATALOGS_DIR = path.join(DATA_DIR, 'catalogs');
const MEDIA_DIR = path.join(DATA_DIR, 'user-materials');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const DIST_INDEX = path.join(DIST_DIR, 'index.html');

interface PersistedEnvelope {
  revision: number;
  updatedAt: string;
  deletedUserIds?: string[];
  deletedRequestIds?: string[];
  deletedOrderIds?: string[];
  data: DatabaseSchema;
}

const sseClients = new Set<Response>();

function broadcastDbUpdate(revision: number, updatedAt: string, reason = 'sync') {
  const payload = `data: ${JSON.stringify({ revision, updatedAt, reason })}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

function ensureDataDirs() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(CATALOGS_DIR)) {
    fs.mkdirSync(CATALOGS_DIR, { recursive: true });
  }
  if (!fs.existsSync(MEDIA_DIR)) {
    fs.mkdirSync(MEDIA_DIR, { recursive: true });
  }
}

function normalizeSchemaData(raw: Partial<DatabaseSchema> | undefined, deletedUserIds: string[] = [], deletedRequestIds: string[] = [], deletedOrderIds: string[] = []): { data: DatabaseSchema; changed: boolean } {
  const base = createInitialDatabaseSchema();
  let changed = !raw;

  const delReqSet = new Set(deletedRequestIds);
  const delOrdSet = new Set(deletedOrderIds);

  const repairedUsersRes = repairUsersArray(raw?.users, deletedUserIds);
  if (repairedUsersRes.changed) changed = true;

  const rawCatalogs = Array.isArray(raw?.manufacturer_catalogs) ? raw!.manufacturer_catalogs : [];
  const filteredCatalogs = rawCatalogs.filter(
    c =>
      c?.id &&
      !c.id.startsWith('cat_nakata_') &&
      !c.id.startsWith('cat_bosch_') &&
      !c.id.startsWith('cat_frasle_') &&
      !c.id.startsWith('cat_cofap_') &&
      !c.id.startsWith('cat_mahle_') &&
      !c.id.startsWith('cat_cummins_') &&
      !c.id.startsWith('cat_honda_') &&
      !c.id.startsWith('cat_caterpillar_')
  );
  if (filteredCatalogs.length !== rawCatalogs.length) changed = true;

  const requests = (Array.isArray(raw?.requests) ? raw!.requests : base.requests).filter(r => r?.id && !delReqSet.has(r.id));
  const orders = (Array.isArray(raw?.orders_and_payments) ? raw!.orders_and_payments : base.orders_and_payments).filter(o => o?.id && !delOrdSet.has(o.id));

  const data: DatabaseSchema = {
    users: repairedUsersRes.users,
    vehicles: Array.isArray(raw?.vehicles) ? raw!.vehicles : base.vehicles,
    catalog_parts: Array.isArray(raw?.catalog_parts) && raw!.catalog_parts.length > 0 ? raw!.catalog_parts : base.catalog_parts,
    categories: Array.isArray(raw?.categories) && raw!.categories.length > 0 ? raw!.categories : base.categories,
    requests,
    quotes: Array.isArray(raw?.quotes) ? raw!.quotes : base.quotes,
    orders_and_payments: orders,
    split_transactions: Array.isArray(raw?.split_transactions)
      ? raw!.split_transactions
      : base.split_transactions || [],
    spams_config: Array.isArray(raw?.spams_config) && raw!.spams_config.length > 0 ? raw!.spams_config : base.spams_config,
    supplier_modalities:
      Array.isArray(raw?.supplier_modalities) && raw!.supplier_modalities.length > 0
        ? raw!.supplier_modalities
        : base.supplier_modalities || [],
    client_ads_settings: raw?.client_ads_settings
      ? {
          ...INITIAL_CLIENT_ADS_SETTINGS,
          ...raw.client_ads_settings,
          items: Array.isArray(raw.client_ads_settings.items) ? raw.client_ads_settings.items : [],
        }
      : { ...INITIAL_CLIENT_ADS_SETTINGS, items: [] },
    dispatched_spams: Array.isArray(raw?.dispatched_spams) ? raw!.dispatched_spams : [],
    audit_logs: Array.isArray(raw?.audit_logs) ? raw!.audit_logs : base.audit_logs,
    evaluations: Array.isArray(raw?.evaluations) ? raw!.evaluations : [],
    commission_settings: raw?.commission_settings || base.commission_settings,
    customization_settings: mergeCustomizationSettings(raw?.customization_settings),
    manufacturer_catalogs: filteredCatalogs,
    rejected_supplier_requests: Array.isArray(raw?.rejected_supplier_requests) ? raw!.rejected_supplier_requests : [],
    timer_settings: raw?.timer_settings || base.timer_settings,
    chat_messages: Array.isArray(raw?.chat_messages) ? raw!.chat_messages : base.chat_messages,
  };

  return { data, changed };
}

function writeDbEnvelope(envelope: PersistedEnvelope) {
  ensureDataDirs();
  const uniqueSuffix = `${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
  const tempFile = `${DB_FILE}.${uniqueSuffix}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(envelope), 'utf-8');
  fs.renameSync(tempFile, DB_FILE);
}

function ensureDbEnvelope(): PersistedEnvelope {
  ensureDataDirs();
  if (!fs.existsSync(DB_FILE)) {
    const initial: PersistedEnvelope = {
      revision: 1,
      updatedAt: new Date().toISOString(),
      deletedUserIds: [],
      deletedRequestIds: [],
      deletedOrderIds: [],
      data: createInitialDatabaseSchema(),
    };
    writeDbEnvelope(initial);
    return initial;
  }

  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as PersistedEnvelope;
    if (parsed && typeof parsed === 'object' && parsed.data && typeof parsed.revision === 'number') {
      const deletedUserIds = Array.isArray(parsed.deletedUserIds) ? parsed.deletedUserIds : [];
      const deletedRequestIds = Array.isArray(parsed.deletedRequestIds) ? parsed.deletedRequestIds : [];
      const deletedOrderIds = Array.isArray(parsed.deletedOrderIds) ? parsed.deletedOrderIds : [];
      const normalized = normalizeSchemaData(parsed.data, deletedUserIds, deletedRequestIds, deletedOrderIds);

      if (normalized.changed) {
        const updated: PersistedEnvelope = {
          revision: parsed.revision + 1,
          updatedAt: new Date().toISOString(),
          deletedUserIds,
          deletedRequestIds,
          deletedOrderIds,
          data: normalized.data,
        };
        writeDbEnvelope(updated);
        return updated;
      }

      return {
        revision: parsed.revision,
        updatedAt: parsed.updatedAt,
        deletedUserIds,
        deletedRequestIds,
        deletedOrderIds,
        data: normalized.data,
      };
    }
  } catch (err) {
    console.error('Erro ao ler banco compartilhado, restaurando padrão inicial:', err);
  }

  const fallback: PersistedEnvelope = {
    revision: 1,
    updatedAt: new Date().toISOString(),
    deletedUserIds: [],
    deletedRequestIds: [],
    deletedOrderIds: [],
    data: createInitialDatabaseSchema(),
  };
  writeDbEnvelope(fallback);
  return fallback;
}

function mergeById<T extends { id: string }>(
  serverArr: T[],
  clientArr: T[],
  deletedIds: Set<string>,
  clientIsNewer: boolean,
  preferLatestItem?: (serverItem: T, clientItem: T) => T
): T[] {
  const resultMap = new Map<string, T>();

  if (clientIsNewer) {
    // Client is at current server revision: keep any server-created record not in client unless deleted,
    // and let client additions/updates prevail
    for (const s of serverArr) {
      if (s?.id && !deletedIds.has(s.id)) {
        resultMap.set(s.id, s);
      }
    }
    for (const c of clientArr) {
      if (c?.id && !deletedIds.has(c.id)) {
        const existing = resultMap.get(c.id);
        resultMap.set(c.id, existing && preferLatestItem ? preferLatestItem(existing, c) : c);
      }
    }
  } else {
    // Stale client revision: preserve ALL server records first, only add new items created offline by client
    for (const c of clientArr) {
      if (c?.id && !deletedIds.has(c.id)) {
        resultMap.set(c.id, c);
      }
    }
    for (const s of serverArr) {
      if (s?.id && !deletedIds.has(s.id)) {
        const clientItem = resultMap.get(s.id);
        resultMap.set(s.id, clientItem && preferLatestItem ? preferLatestItem(s, clientItem) : s);
      }
    }
  }

  return Array.from(resultMap.values());
}

function mergeUsers(serverUsers: User[], clientUsers: User[], deletedIds: Set<string>, clientIsNewer: boolean): User[] {
  return mergeById<User>(serverUsers, clientUsers, deletedIds, clientIsNewer, (srv, cli) => {
    const merged = clientIsNewer ? { ...srv, ...cli } : { ...cli, ...srv };
    // Never wipe an existing password on server with empty/undefined
    if (!merged.password && srv.password) {
      merged.password = srv.password;
    }
    // Keep the most recent login timestamp
    const srvLogin = srv.lastLogin ? new Date(srv.lastLogin).getTime() : 0;
    const cliLogin = cli.lastLogin ? new Date(cli.lastLogin).getTime() : 0;
    if (srvLogin > cliLogin) {
      merged.lastLogin = srv.lastLogin;
    } else if (cliLogin > srvLogin) {
      merged.lastLogin = cli.lastLogin;
    }
    // Preserva materiais compartilhados pelo Admin (nunca apaga acidentalmente por cliente desatualizado)
    if (clientIsNewer) {
      merged.adminSharedMaterials = cli.adminSharedMaterials ?? srv.adminSharedMaterials;
    } else {
      merged.adminSharedMaterials = srv.adminSharedMaterials ?? cli.adminSharedMaterials;
    }
    return merged;
  });
}

function sortQuotesLowestPriceFirst(quotes: Quote[]): Quote[] {
  return [...quotes].sort((a, b) => {
    const priceDiff = (Number(a.totalPrice) || 0) - (Number(b.totalPrice) || 0);
    if (priceDiff !== 0) return priceDiff;
    const partDiff = (Number(a.partPrice) || 0) - (Number(b.partPrice) || 0);
    if (partDiff !== 0) return partDiff;
    return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
  });
}

function mergeStatusHistory(
  srvHist?: RequestStatusHistoryEntry[],
  cliHist?: RequestStatusHistoryEntry[]
): RequestStatusHistoryEntry[] | undefined {
  const combined = [...(srvHist || []), ...(cliHist || [])];
  if (combined.length === 0) return undefined;
  const byId = new Map<string, RequestStatusHistoryEntry>();
  for (const item of combined) {
    if (item?.id && !byId.has(item.id)) {
      byId.set(item.id, item);
    }
  }
  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

const REQUEST_STATUS_RANK: Record<PartRequest['status'], number> = {
  aguardando_orcamentos: 1,
  orcamentos_recebidos: 2,
  em_negociacao: 3,
  sem_fornecedor: 4,
  cancelado: 5,
  finalizado: 6,
};

function mergeRequestsMonotonic(
  srvReqs: PartRequest[],
  cliReqs: PartRequest[],
  deletedIds: Set<string>,
  clientIsNewer: boolean
): PartRequest[] {
  return mergeById<PartRequest>(srvReqs, cliReqs, deletedIds, clientIsNewer, (srv, cli) => {
    const base = clientIsNewer ? { ...srv, ...cli } : { ...cli, ...srv };
    const srvAttempt = srv.searchAttempt || 1;
    const cliAttempt = cli.searchAttempt || 1;

    // Se houve refazer solicitação (searchAttempt maior), preserva tentativa/raio maiores
    if (srvAttempt > cliAttempt) {
      base.searchAttempt = srv.searchAttempt;
      base.searchRadiusKm = Math.max(srv.searchRadiusKm || 50, cli.searchRadiusKm || 50);
      base.autoExpanded = Boolean(srv.autoExpanded || cli.autoExpanded);
      base.lastAttemptAt = srv.lastAttemptAt;
      base.expiresAt = srv.expiresAt;
      base.attemptExpiresAt = srv.attemptExpiresAt;
      if (srv.status === 'aguardando_orcamentos' && cli.status === 'sem_fornecedor') {
        base.status = srv.status;
        base.closedReason = undefined;
      }
    } else if (cliAttempt > srvAttempt) {
      base.searchAttempt = cli.searchAttempt;
      base.searchRadiusKm = Math.max(srv.searchRadiusKm || 50, cli.searchRadiusKm || 50);
      base.autoExpanded = Boolean(srv.autoExpanded || cli.autoExpanded);
      base.lastAttemptAt = cli.lastAttemptAt;
      base.expiresAt = cli.expiresAt;
      base.attemptExpiresAt = cli.attemptExpiresAt;
      if (cli.status === 'aguardando_orcamentos' && srv.status === 'sem_fornecedor') {
        base.status = cli.status;
        base.closedReason = undefined;
      }
    } else {
      // Mesma tentativa: status nunca regride
      const srvRank = REQUEST_STATUS_RANK[srv.status] || 0;
      const cliRank = REQUEST_STATUS_RANK[cli.status] || 0;
      const winner = srvRank >= cliRank ? srv : cli;
      base.status = winner.status;
      if (winner.closedReason) base.closedReason = winner.closedReason;
    }

    // Nunca reverte finalizado
    if (srv.status === 'finalizado' || cli.status === 'finalizado') {
      base.status = 'finalizado';
      base.closedReason = 'pedido_pago';
    }

    // Preserva clientExpiresAt mais recente se não finalizado
    const srvClientExp = srv.clientExpiresAt ? new Date(srv.clientExpiresAt).getTime() : 0;
    const cliClientExp = cli.clientExpiresAt ? new Date(cli.clientExpiresAt).getTime() : 0;
    if (srvClientExp > cliClientExp) base.clientExpiresAt = srv.clientExpiresAt;
    else if (cliClientExp > srvClientExp) base.clientExpiresAt = cli.clientExpiresAt;

    base.statusHistory = mergeStatusHistory(srv.statusHistory, cli.statusHistory);
    return base;
  });
}

function mergeQuotesSafe(
  srvQuotes: Quote[],
  cliQuotes: Quote[],
  deletedIds: Set<string>,
  clientIsNewer: boolean
): Quote[] {
  return mergeById<Quote>(srvQuotes, cliQuotes, deletedIds, clientIsNewer, (srv, cli) => {
    const merged = clientIsNewer ? { ...srv, ...cli } : { ...cli, ...srv };
    // Se aceito ou rejeitado no servidor ou cliente, nunca regride para pendente
    if (srv.status === 'aceito' || cli.status === 'aceito') {
      merged.status = 'aceito';
    } else if (srv.status === 'rejeitado' || cli.status === 'rejeitado') {
      merged.status = 'rejeitado';
    }
    return merged;
  });
}

const ORDER_DELIVERY_RANK: Record<OrderDeliveryStatus, number> = {
  compra_confirmada: 1,
  peca_separada: 2,
  a_caminho: 3,
  entregue: 4,
};

function mergeOrdersSafe(
  srvOrders: OrderAndPayment[],
  cliOrders: OrderAndPayment[],
  deletedIds: Set<string>,
  clientIsNewer: boolean
): OrderAndPayment[] {
  return mergeById<OrderAndPayment>(srvOrders, cliOrders, deletedIds, clientIsNewer, (srv, cli) => {
    const merged = clientIsNewer ? { ...srv, ...cli } : { ...cli, ...srv };
    // Confirmação de pagamento na conta do fornecedor NUNCA regride para false
    if (srv.supplierReceiptConfirmed || cli.supplierReceiptConfirmed) {
      merged.supplierReceiptConfirmed = true;
      merged.supplierReceiptConfirmedAt =
        srv.supplierReceiptConfirmedAt || cli.supplierReceiptConfirmedAt || new Date().toISOString();
    }
    // Status de entrega nunca regride
    const srvDelRank = ORDER_DELIVERY_RANK[srv.deliveryStatus] || 0;
    const cliDelRank = ORDER_DELIVERY_RANK[cli.deliveryStatus] || 0;
    merged.deliveryStatus = srvDelRank >= cliDelRank ? srv.deliveryStatus : cli.deliveryStatus;
    if (srv.packagedPhotoUrl && !merged.packagedPhotoUrl) merged.packagedPhotoUrl = srv.packagedPhotoUrl;
    if (srv.clientConfirmationPhotoUrl && !merged.clientConfirmationPhotoUrl) {
      merged.clientConfirmationPhotoUrl = srv.clientConfirmationPhotoUrl;
    }
    if (srv.pinValidatedAt && !merged.pinValidatedAt) merged.pinValidatedAt = srv.pinValidatedAt;
    if (srv.deliveredAt && !merged.deliveredAt) merged.deliveredAt = srv.deliveredAt;
    return merged;
  });
}

function appendServerAudit(
  data: DatabaseSchema,
  user: User | undefined,
  userId: string,
  action: string,
  entityType: AuditLog['entityType'],
  entityId: string,
  details: string,
  ipAddress?: string
) {
  const log: AuditLog = {
    id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
    userId,
    userPhone: user?.phone || 'sistema',
    userRole: user?.role || 'cliente',
    action,
    entityType,
    entityId,
    details,
    ipAddress: ipAddress || 'servidor-central',
  };
  data.audit_logs.unshift(log);
  if (data.audit_logs.length > 500) {
    data.audit_logs = data.audit_logs.slice(0, 500);
  }
}

function sanitizeCatalogId(rawId: string): string {
  return rawId.replace(/[^a-zA-Z0-9_-]/g, '');
}

interface ServerGeoCacheEntry {
  cep: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  coordinates: GeoCoordinates;
  coordinatesPrecision: 'exact_cep';
  source: string;
  cachedAt: string;
}

const serverGeoMemCache = new Map<string, ServerGeoCacheEntry>();
let serverGeoCacheLoaded = false;

function loadServerGeoCache() {
  if (serverGeoCacheLoaded) return;
  serverGeoCacheLoaded = true;
  try {
    if (fs.existsSync(GEO_CACHE_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(GEO_CACHE_FILE, 'utf-8')) as Record<string, ServerGeoCacheEntry>;
      const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
      for (const [k, v] of Object.entries(parsed || {})) {
        if (
          v &&
          v.coordinatesPrecision === 'exact_cep' &&
          v.coordinates &&
          Number.isFinite(v.coordinates.lat) &&
          Number.isFinite(v.coordinates.lng) &&
          new Date(v.cachedAt || 0).getTime() > cutoff
        ) {
          serverGeoMemCache.set(k, v);
        }
      }
    }
  } catch {
    // ignore corrupt geo cache
  }
}

function persistServerGeoCacheEntry(cleanCep: string, entry: ServerGeoCacheEntry) {
  serverGeoMemCache.set(cleanCep, entry);
  try {
    ensureDataDirs();
    const obj: Record<string, ServerGeoCacheEntry> = {};
    for (const [k, v] of serverGeoMemCache.entries()) {
      obj[k] = v;
    }
    fs.writeFileSync(GEO_CACHE_FILE, JSON.stringify(obj), 'utf-8');
  } catch {
    // ignore cache write failure
  }
}

async function serverFetchJson(url: string, timeoutMs = 3500): Promise<any | null> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'AUTO-SHOP-Geo/1.0 (https://auto.m1br.com.br)',
        Accept: 'application/json',
      },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(id);
  }
}

async function resolveExactCepGeoOnServer(
  rawCep?: string,
  hints?: { street?: string; neighborhood?: string; city?: string; state?: string }
): Promise<{
  ok: boolean;
  cep: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  coordinates: GeoCoordinates;
  coordinatesPrecision: 'exact_cep' | 'cep_prefix';
  source: string;
}> {
  loadServerGeoCache();
  const clean = cleanCepDigits(rawCep);
  const formatted = formatCep(clean);

  if (clean.length !== 8) {
    return {
      ok: false,
      cep: formatted,
      street: hints?.street || '',
      neighborhood: hints?.neighborhood || '',
      city: hints?.city || '',
      state: hints?.state || '',
      coordinates: estimateCoordinatesFromCep(clean, hints?.state),
      coordinatesPrecision: 'cep_prefix',
      source: 'cep_prefix',
    };
  }

  const cached = serverGeoMemCache.get(clean);
  if (cached) {
    return {
      ok: true,
      cep: formatted,
      street: cached.street || hints?.street || '',
      neighborhood: cached.neighborhood || hints?.neighborhood || '',
      city: cached.city || hints?.city || '',
      state: cached.state || hints?.state || '',
      coordinates: cached.coordinates,
      coordinatesPrecision: 'exact_cep',
      source: cached.source,
    };
  }

  let street = hints?.street?.trim() || '';
  let neighborhood = hints?.neighborhood?.trim() || '';
  let city = hints?.city?.trim() || '';
  let state = hints?.state?.trim() || '';
  let coords: GeoCoordinates | null = null;
  let source = 'cep_prefix';

  // 1. BrasilAPI v2
  const brData = await serverFetchJson(`https://brasilapi.com.br/api/cep/v2/${clean}`, 3600);
  if (brData && !brData.errors) {
    street = street || brData.street || '';
    neighborhood = neighborhood || brData.neighborhood || '';
    city = city || brData.city || '';
    state = state || brData.state || '';
    const lat = Number(brData?.location?.coordinates?.latitude);
    const lng = Number(brData?.location?.coordinates?.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0) {
      coords = { lat: Number(lat.toFixed(5)), lng: Number(lng.toFixed(5)) };
      source = 'brasilapi';
    }
  }

  // 2. AwesomeAPI CEP (fornece lat/lng exatos para quase todos os CEPs do Brasil)
  if (!coords || !city || !state) {
    const awData = await serverFetchJson(`https://cep.awesomeapi.com.br/json/${clean}`, 3600);
    if (awData && !awData.status && !awData.code) {
      street = street || awData.address || awData.address_name || '';
      neighborhood = neighborhood || awData.district || '';
      city = city || awData.city || '';
      state = state || awData.state || '';
      const lat = Number(awData.lat);
      const lng = Number(awData.lng);
      if (!coords && Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0) {
        coords = { lat: Number(lat.toFixed(5)), lng: Number(lng.toFixed(5)) };
        source = 'awesomeapi';
      }
    }
  }

  // 3. ViaCEP para completar logradouro/bairro/cidade/UF
  if (!city || !state || !street) {
    const vcData = await serverFetchJson(`https://viacep.com.br/ws/${clean}/json/`, 3500);
    if (vcData && !vcData.erro) {
      street = street || vcData.logradouro || '';
      neighborhood = neighborhood || vcData.bairro || '';
      city = city || vcData.localidade || '';
      state = state || vcData.uf || '';
    }
  }

  // 4. Nominatim OSM (estruturado e livre com User-Agent válido)
  if (!coords && street && city && state) {
    const nomStruct = await serverFetchJson(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&street=${encodeURIComponent(street)}&city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}`,
      3500
    );
    if (Array.isArray(nomStruct) && nomStruct.length > 0) {
      const lat = Number(nomStruct[0].lat);
      const lng = Number(nomStruct[0].lon);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        coords = { lat: Number(lat.toFixed(5)), lng: Number(lng.toFixed(5)) };
        source = 'nominatim_street';
      }
    }
    if (!coords) {
      const q = `${street}, ${neighborhood ? neighborhood + ', ' : ''}${city}, ${state}, Brasil`;
      const nomFree = await serverFetchJson(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(q)}`,
        3200
      );
      if (Array.isArray(nomFree) && nomFree.length > 0) {
        const lat = Number(nomFree[0].lat);
        const lng = Number(nomFree[0].lon);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          coords = { lat: Number(lat.toFixed(5)), lng: Number(lng.toFixed(5)) };
          source = 'nominatim_street';
        }
      }
    }
  }

  if (!coords) {
    const nomCep = await serverFetchJson(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&postalcode=${clean}`,
      3000
    );
    if (Array.isArray(nomCep) && nomCep.length > 0) {
      const lat = Number(nomCep[0].lat);
      const lng = Number(nomCep[0].lon);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        coords = { lat: Number(lat.toFixed(5)), lng: Number(lng.toFixed(5)) };
        source = 'nominatim_cep';
      }
    }
  }

  if (!coords && city && state) {
    const q = [street || neighborhood, city, state, 'Brasil'].filter(Boolean).join(', ');
    const photon = await serverFetchJson(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=1`, 3000);
    const [lng, lat] = photon?.features?.[0]?.geometry?.coordinates || [];
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      coords = { lat: Number(Number(lat).toFixed(5)), lng: Number(Number(lng).toFixed(5)) };
      source = 'photon';
    }
  }

  if (!coords && city && state) {
    const q = neighborhood ? `${neighborhood}, ${city}, ${state}, Brasil` : `${city}, ${state}, Brasil`;
    const nomCity = await serverFetchJson(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(q)}`,
      3000
    );
    if (Array.isArray(nomCity) && nomCity.length > 0) {
      const lat = Number(nomCity[0].lat);
      const lng = Number(nomCity[0].lon);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        coords = { lat: Number(lat.toFixed(5)), lng: Number(lng.toFixed(5)) };
        source = 'nominatim_city';
      }
    }
  }

  if (coords && source !== 'cep_prefix') {
    persistServerGeoCacheEntry(clean, {
      cep: formatted,
      street,
      neighborhood,
      city,
      state,
      coordinates: coords,
      coordinatesPrecision: 'exact_cep',
      source,
      cachedAt: new Date().toISOString(),
    });
    return {
      ok: true,
      cep: formatted,
      street,
      neighborhood,
      city,
      state,
      coordinates: coords,
      coordinatesPrecision: 'exact_cep',
      source,
    };
  }

  return {
    ok: Boolean(city || state),
    cep: formatted,
    street,
    neighborhood,
    city,
    state,
    coordinates: estimateCoordinatesFromCep(clean, state),
    coordinatesPrecision: 'cep_prefix',
    source: 'cep_prefix',
  };
}

async function computeRouteDistanceOnServer(
  from: GeoCoordinates,
  to: GeoCoordinates
): Promise<{ distanceKm: number; durationMin?: number; source: 'rota_real' | 'linha_reta' }> {
  const straight = calculateHaversineKm(from, to);
  if (!Number.isFinite(straight)) {
    return { distanceKm: Number.POSITIVE_INFINITY, source: 'linha_reta' };
  }
  if (straight <= 0.1) {
    return { distanceKm: 0.1, durationMin: 1, source: 'rota_real' };
  }
  const osrmData = await serverFetchJson(
    `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false`,
    3800
  );
  const route = osrmData?.routes?.[0];
  if (route && Number.isFinite(route.distance)) {
    return {
      distanceKm: Number(Math.max(0.1, route.distance / 1000).toFixed(1)),
      durationMin: Number.isFinite(route.duration) ? Math.max(1, Math.round(route.duration / 60)) : undefined,
      source: 'rota_real',
    };
  }
  return { distanceKm: straight, source: 'linha_reta' };
}

async function startServer() {
  ensureDataDirs();
  // Inicializa e higieniza o banco central compartilhado no boot do servidor
  ensureDbEnvelope();

  const app = express();
  app.set('trust proxy', true);

  // CORS completo para permitir acesso de celulares/tablets via IP local, preview ou domínio externo
  app.use('/api', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control');
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  app.get('/api/health', (_req, res) => {
    const env = ensureDbEnvelope();
    res.json({
      ok: true,
      revision: env.revision,
      usersCount: env.data.users.length,
      timestamp: new Date().toISOString(),
    });
  });

  // Stream SSE em tempo real para atualizar Admin e demais aparelhos imediatamente quando houver novo cadastro
  app.get('/api/db/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const env = ensureDbEnvelope();
    res.write(`data: ${JSON.stringify({ revision: env.revision, updatedAt: env.updatedAt, reason: 'connected' })}\n\n`);
    sseClients.add(res);

    const keepAlive = setInterval(() => {
      try {
        res.write(': ping\n\n');
      } catch {
        clearInterval(keepAlive);
        sseClients.delete(res);
      }
    }, 20000);

    req.on('close', () => {
      clearInterval(keepAlive);
      sseClients.delete(res);
    });
  });

  app.get('/api/db/version', (_req, res) => {
    const env = ensureDbEnvelope();
    res.json({
      empty: false,
      revision: env.revision,
      updatedAt: env.updatedAt,
      usersCount: env.data.users.length,
    });
  });

  app.get('/api/db', (_req, res) => {
    const env = ensureDbEnvelope();
    res.json({
      empty: false,
      revision: env.revision,
      updatedAt: env.updatedAt,
      deletedUserIds: env.deletedUserIds || [],
      data: env.data,
    });
  });

  // Endpoint dedicado para listar todos os usuários centralizados
  app.get('/api/users', (_req, res) => {
    const env = ensureDbEnvelope();
    res.json({
      ok: true,
      revision: env.revision,
      updatedAt: env.updatedAt,
      users: env.data.users,
    });
  });

  // Endpoints centrais de Geolocalização exata por CEP e distância real de rota (OSRM)
  app.get('/api/geo/cep/:cep', async (req, res) => {
    try {
      const geo = await resolveExactCepGeoOnServer(req.params.cep);
      res.json(geo);
    } catch (err) {
      console.error('Erro ao resolver CEP no servidor:', err);
      res.status(500).json({ ok: false, message: 'Erro ao consultar geolocalização do CEP.' });
    }
  });

  app.post('/api/geo/distance', express.json({ limit: '1mb' }), async (req, res) => {
    try {
      const body = req.body as {
        fromCoords?: GeoCoordinates;
        toCoords?: GeoCoordinates;
        fromCep?: string;
        toCep?: string;
      };
      let from = body.fromCoords;
      let to = body.toCoords;

      if ((!from || !Number.isFinite(from.lat) || !Number.isFinite(from.lng)) && isValidCep(body.fromCep)) {
        const resolved = await resolveExactCepGeoOnServer(body.fromCep);
        from = resolved.coordinates;
      }
      if ((!to || !Number.isFinite(to.lat) || !Number.isFinite(to.lng)) && isValidCep(body.toCep)) {
        const resolved = await resolveExactCepGeoOnServer(body.toCep);
        to = resolved.coordinates;
      }
      if (!from || !to) {
        res.status(400).json({ ok: false, message: 'Informe coordenadas ou CEPs válidos para calcular a distância.' });
        return;
      }
      const dist = await computeRouteDistanceOnServer(from, to);
      res.json({ ok: true, from, to, ...dist });
    } catch (err) {
      console.error('Erro ao calcular distância no servidor:', err);
      res.status(500).json({ ok: false, message: 'Erro interno ao calcular distância.' });
    }
  });

  // Endpoint autoritativo de CADASTRO direto no servidor central (Cliente ou Fornecedor)
  const handleRegisterUser = async (req: Request, res: Response) => {
    try {
      const body = req.body as {
        name?: string;
        companyName?: string;
        phone?: string;
        password?: string;
        role?: UserRole;
        document?: string;
        personType?: 'PF' | 'PJ';
        address?: DeliveryAddress;
        avatarUrl?: string;
        supplierCategoryIds?: string[];
        categoriesSupplied?: string[];
        subcategoriesSupplied?: string[];
        equipmentTypesSupplied?: User['equipmentTypesSupplied'];
        serviceRadiusKm?: number;
        gatewayProvider?: PaymentGatewayProvider;
        gatewayPixKey?: string;
        gatewayWalletId?: string;
        gatewayBankInfo?: GatewayBankInfo;
        supplierPaymentType?: SupplierPaymentType;
        coordinatesPrecision?: User['coordinatesPrecision'];
      };

      if (body.role !== 'cliente' && body.role !== 'fornecedor') {
        res.status(403).json({
          ok: false,
          message: 'Acesso negado (RBAC): cadastro público permitido apenas para Cliente ou Fornecedor.',
        });
        return;
      }

      const cleanPhone = normalizeBrPhoneDigits(body.phone);
      if (!cleanPhone || cleanPhone.length < 10) {
        res.status(400).json({ ok: false, message: 'Número de telefone celular inválido (DDD + número).' });
        return;
      }

      const password = (body.password || '').trim();
      if (password.length < 4) {
        res.status(400).json({ ok: false, message: 'Crie uma senha de no mínimo 4 caracteres.' });
        return;
      }

      const name = (body.name || '').trim();
      if (name.length < 2) {
        res.status(400).json({ ok: false, message: 'Informe seu nome completo ou Razão Social.' });
        return;
      }

      const document = (body.document || '').trim();
      if (document.replace(/\D/g, '').length < 11) {
        res.status(400).json({ ok: false, message: 'Informe um CPF ou CNPJ válido.' });
        return;
      }

      const isSupplier = body.role === 'fornecedor';
      if (isSupplier && !isValidCep(body.address?.cep)) {
        res.status(400).json({
          ok: false,
          message: 'CEP válido (8 dígitos) é obrigatório no cadastro do Fornecedor para definir a geolocalização e o raio de atuação dos chamados.',
        });
        return;
      }

      if (!body.address || !isValidCep(body.address.cep) || !body.address.city?.trim() || !body.address.state?.trim()) {
        res.status(400).json({
          ok: false,
          message: 'Preencha o endereço com CEP válido (8 dígitos), Cidade e UF.',
        });
        return;
      }

      const envPre = ensureDbEnvelope();
      const existingPre = envPre.data.users.find(u => brPhonesMatch(u.phone, cleanPhone));
      if (existingPre) {
        res.status(409).json({
          ok: false,
          message: 'Já existe uma conta cadastrada com este celular. Faça login com sua senha.',
        });
        return;
      }

      let resolvedCoords = body.address.coordinates;
      let resolvedPrecision: User['coordinatesPrecision'] =
        body.coordinatesPrecision || body.address.coordinatesPrecision;

      if (
        !resolvedCoords ||
        (resolvedPrecision !== 'gps' && resolvedPrecision !== 'exact_cep')
      ) {
        const cepGeo = await resolveExactCepGeoOnServer(body.address.cep, {
          street: body.address.street,
          neighborhood: body.address.neighborhood,
          city: body.address.city,
          state: body.address.state,
        });
        resolvedCoords = cepGeo.coordinates;
        resolvedPrecision = cepGeo.coordinatesPrecision;
      }

      const normalizedAddress: DeliveryAddress = {
        ...body.address,
        street: body.address.street?.trim() || 'Área Urbana (CEP)',
        number: body.address.number?.trim() || 'S/N',
        neighborhood: body.address.neighborhood?.trim() || 'Centro',
        city: body.address.city.trim(),
        state: body.address.state.trim().toUpperCase(),
        cep: formatCep(body.address.cep),
        coordinates: resolvedCoords,
        coordinatesPrecision: resolvedPrecision,
      };

      const env = ensureDbEnvelope();
      const existing = env.data.users.find(u => brPhonesMatch(u.phone, cleanPhone));
      if (existing) {
        res.status(409).json({
          ok: false,
          message: 'Já existe uma conta cadastrada com este celular. Faça login com sua senha.',
        });
        return;
      }

      const gatewayPixKey = isSupplier ? body.gatewayPixKey?.trim() || undefined : undefined;
      const gatewayWalletId = isSupplier ? body.gatewayWalletId?.trim() || undefined : undefined;
      const gatewayBankInfo = isSupplier ? body.gatewayBankInfo : undefined;
      const gatewayProvider: PaymentGatewayProvider | undefined = isSupplier
        ? body.gatewayProvider === 'mercadopago'
          ? 'mercadopago'
          : 'asaas'
        : undefined;
      const gatewayAccountStatus = isSupplier
        ? gatewayWalletId
          ? 'ativa'
          : gatewayPixKey || gatewayBankInfo?.account
          ? 'em_analise'
          : 'nao_configurada'
        : undefined;

      const nowIso = new Date().toISOString();
      const newUser: User = {
        id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        phone: cleanPhone,
        name,
        email: '',
        role: body.role,
        password,
        personType: body.personType || (document.replace(/\D/g, '').length > 11 ? 'PJ' : 'PF'),
        document,
        companyName: isSupplier ? (body.companyName?.trim() || name) : undefined,
        avatarUrl: body.avatarUrl || '',
        address: normalizedAddress,
        coordinates: resolvedCoords,
        coordinatesPrecision: resolvedPrecision,
        supplierCategoryIds: isSupplier ? (body.supplierCategoryIds || []) : [],
        categoriesSupplied: isSupplier ? (body.categoriesSupplied || []) : [],
        subcategoriesSupplied: isSupplier ? (body.subcategoriesSupplied || []) : [],
        equipmentTypesSupplied: isSupplier ? (body.equipmentTypesSupplied || ['carro']) : undefined,
        serviceRadiusKm: isSupplier ? (body.serviceRadiusKm ?? 50) : 0,
        citiesCovered: normalizedAddress.city ? [normalizedAddress.city] : ['São Paulo'],
        status: isSupplier ? 'pendente' : 'ativo',
        supplierTier: undefined,
        isClassifiedByAdmin: isSupplier ? false : undefined,
        isAvailableForOrders: false,
        supplierPaymentType: isSupplier ? (body.supplierPaymentType || 'compe_split') : undefined,
        bankAccountOrPix: gatewayPixKey,
        gatewayProvider,
        gatewayPixKey,
        gatewayWalletId,
        gatewayBankInfo,
        gatewayAccountStatus,
        rating: 5.0,
        totalRatings: 0,
        totalSales: 0,
        createdAt: nowIso,
        lastLogin: nowIso,
      };

      env.data.users.push(newUser);
      env.deletedUserIds = (env.deletedUserIds || []).filter(id => id !== newUser.id);
      appendServerAudit(
        env.data,
        newUser,
        newUser.id,
        'Cadastro de Usuário',
        'user',
        newUser.id,
        `Novo usuário (${newUser.role}) cadastrado via aparelho externo: ${newUser.name}.${
          isSupplier && gatewayPixKey ? ` Chave de recebimento gateway (${gatewayProvider}): ${gatewayPixKey}.` : ''
        }`,
        req.ip
      );

      env.revision += 1;
      env.updatedAt = nowIso;
      writeDbEnvelope(env);
      broadcastDbUpdate(env.revision, env.updatedAt, 'user_registered');

      res.status(201).json({
        ok: true,
        pendingApproval: isSupplier,
        message: isSupplier
          ? 'Cadastro enviado e salvo no servidor! O Administrador precisa aprovar e classificar seu perfil antes da liberação do painel.'
          : 'Cadastro de Cliente realizado e salvo no servidor com sucesso! Bem-vindo à AUTO SHOP.',
        user: newUser,
        revision: env.revision,
        updatedAt: env.updatedAt,
        data: env.data,
      });
    } catch (err) {
      console.error('Erro ao registrar usuário no backend:', err);
      res.status(500).json({ ok: false, message: 'Erro interno ao gravar usuário no banco de dados.' });
    }
  };

  app.post('/api/auth/register', express.json({ limit: '10mb' }), (req, res) => {
    void handleRegisterUser(req, res);
  });
  app.post('/api/register', express.json({ limit: '10mb' }), (req, res) => {
    void handleRegisterUser(req, res);
  });

  // Endpoint autoritativo de LOGIN direto contra o banco compartilhado do servidor
  const handleLoginUser = (req: Request, res: Response) => {
    try {
      const body = req.body as { phone?: string; password?: string; expectedRole?: UserRole };
      const cleanPhone = normalizeBrPhoneDigits(body.phone);
      if (!cleanPhone || cleanPhone.length < 10) {
        res.status(400).json({ ok: false, message: 'Informe um número de celular válido com DDD.' });
        return;
      }

      const password = (body.password || '').trim();
      if (password.length < 4) {
        res.status(400).json({ ok: false, message: 'Informe sua senha válida (mínimo 4 caracteres).' });
        return;
      }

      const env = ensureDbEnvelope();
      const user = env.data.users.find(u => brPhonesMatch(u.phone, cleanPhone));

      if (!user || !user.password) {
        res.status(401).json({ ok: false, message: 'Celular ou senha inválidos.' });
        return;
      }

      if (user.password.trim() !== password) {
        appendServerAudit(
          env.data,
          user,
          user.id,
          'Tentativa de Login Falha (Senha Inválida)',
          'user',
          user.id,
          `Tentativa de acesso com senha incorreta para o celular ${cleanPhone}`,
          req.ip
        );
        env.revision += 1;
        env.updatedAt = new Date().toISOString();
        writeDbEnvelope(env);
        res.status(401).json({ ok: false, message: 'Celular ou senha inválidos.' });
        return;
      }

      if (user.status === 'bloqueado') {
        res.status(403).json({
          ok: false,
          message: 'Sua conta está bloqueada pela administração da AUTO SHOP. Entre em contato com o suporte.',
        });
        return;
      }

      if (body.expectedRole && user.role !== body.expectedRole) {
        appendServerAudit(
          env.data,
          user,
          user.id,
          'Bloqueio RBAC: Tentativa de Acesso em Portal Incorreto',
          'user',
          user.id,
          `Perfil ${user.role.toUpperCase()} tentou autenticar no portal ${body.expectedRole.toUpperCase()}`,
          req.ip
        );
        env.revision += 1;
        env.updatedAt = new Date().toISOString();
        writeDbEnvelope(env);
        res.status(403).json({
          ok: false,
          actualRole: user.role,
          message: `Acesso negado (RBAC): esta conta pertence ao perfil "${getRoleDisplayName(user.role)}" e não possui permissão no portal "${getRoleDisplayName(body.expectedRole)}".`,
        });
        return;
      }

      const nowIso = new Date().toISOString();
      user.lastLogin = nowIso;
      const pendingApproval = user.role === 'fornecedor' && !isSupplierClassifiedAndApproved(user);

      appendServerAudit(
        env.data,
        user,
        user.id,
        'Login Realizado com Celular e Senha',
        'user',
        user.id,
        `Acesso autenticado para ${user.name} (${user.role.toUpperCase()})${pendingApproval ? ' [Aguardando Homologação/Classificação]' : ''}`,
        req.ip
      );

      env.revision += 1;
      env.updatedAt = nowIso;
      writeDbEnvelope(env);
      broadcastDbUpdate(env.revision, env.updatedAt, 'user_login');

      res.json({
        ok: true,
        pendingApproval,
        message: pendingApproval
          ? 'Login realizado. Seu cadastro de fornecedor aguarda autorização e classificação do Administrador.'
          : `Bem-vindo(a), ${user.name}!`,
        user,
        revision: env.revision,
        updatedAt: env.updatedAt,
        data: env.data,
      });
    } catch (err) {
      console.error('Erro no login no backend:', err);
      res.status(500).json({ ok: false, message: 'Erro interno ao autenticar no servidor.' });
    }
  };

  app.post('/api/auth/login', express.json({ limit: '1mb' }), handleLoginUser);
  app.post('/api/login', express.json({ limit: '1mb' }), handleLoginUser);

  // Endpoint administrativo/sistema para criar usuário diretamente no servidor
  app.post('/api/users', express.json({ limit: '10mb' }), async (req, res) => {
    try {
      const userData = req.body as User;
      if (!userData || !userData.phone || !userData.name) {
        res.status(400).json({ ok: false, message: 'Dados inválidos para criação de usuário.' });
        return;
      }
      const envPre = ensureDbEnvelope();
      const cleanPhone = normalizeBrPhoneDigits(userData.phone) || userData.phone.replace(/\D/g, '');
      const duplicatePre = envPre.data.users.find(u => brPhonesMatch(u.phone, cleanPhone));
      if (duplicatePre) {
        res.status(409).json({ ok: false, message: 'Já existe uma conta cadastrada com este celular. Faça login com sua senha.' });
        return;
      }

      let resolvedCoords = userData.coordinates || userData.address?.coordinates;
      let resolvedPrecision = userData.coordinatesPrecision || userData.address?.coordinatesPrecision;
      if (
        isValidCep(userData.address?.cep) &&
        (!resolvedCoords || (resolvedPrecision !== 'gps' && resolvedPrecision !== 'exact_cep'))
      ) {
        const cepGeo = await resolveExactCepGeoOnServer(userData.address?.cep, {
          street: userData.address?.street,
          neighborhood: userData.address?.neighborhood,
          city: userData.address?.city,
          state: userData.address?.state,
        });
        resolvedCoords = cepGeo.coordinates;
        resolvedPrecision = cepGeo.coordinatesPrecision;
      }

      const env = ensureDbEnvelope();
      const duplicate = env.data.users.find(u => brPhonesMatch(u.phone, cleanPhone));
      if (duplicate) {
        res.status(409).json({ ok: false, message: 'Já existe uma conta cadastrada com este celular. Faça login com sua senha.' });
        return;
      }

      const newUser: User = {
        ...userData,
        id: userData.id || `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        phone: cleanPhone,
        coordinates: resolvedCoords,
        coordinatesPrecision: resolvedPrecision,
        address: userData.address
          ? {
              ...userData.address,
              coordinates: userData.address.coordinates || resolvedCoords,
              coordinatesPrecision: userData.address.coordinatesPrecision || resolvedPrecision,
            }
          : undefined,
        createdAt: userData.createdAt || new Date().toISOString(),
        lastLogin: userData.lastLogin || new Date().toISOString(),
      };
      env.data.users.push(newUser);
      env.deletedUserIds = (env.deletedUserIds || []).filter(id => id !== newUser.id);
      env.revision += 1;
      env.updatedAt = new Date().toISOString();
      writeDbEnvelope(env);
      broadcastDbUpdate(env.revision, env.updatedAt, 'user_created');
      res.status(201).json({ ok: true, user: newUser, revision: env.revision, updatedAt: env.updatedAt, data: env.data });
    } catch (err) {
      console.error('Erro ao criar usuário via /api/users:', err);
      res.status(500).json({ ok: false, message: 'Erro ao salvar usuário no servidor.' });
    }
  });

  // Atualização atômica de usuário (status, classificação, raio, GPS, dados, materiais compartilhados)
  app.patch('/api/users/:id', express.json({ limit: '20mb' }), async (req, res) => {
    try {
      const targetId = req.params.id;
      const updates = req.body as Partial<User>;

      let cepGeoResult: Awaited<ReturnType<typeof resolveExactCepGeoOnServer>> | null = null;
      if (updates.address?.cep && isValidCep(updates.address.cep) && updates.coordinatesPrecision !== 'gps') {
        cepGeoResult = await resolveExactCepGeoOnServer(updates.address.cep, {
          street: updates.address.street,
          neighborhood: updates.address.neighborhood,
          city: updates.address.city,
          state: updates.address.state,
        });
      }

      const env = ensureDbEnvelope();
      const target = env.data.users.find(u => u.id === targetId);
      if (!target) {
        res.status(404).json({ ok: false, message: 'Usuário não encontrado.' });
        return;
      }

      const prevCep = cleanCepDigits(target.address?.cep);
      const nextCep = updates.address?.cep ? cleanCepDigits(updates.address.cep) : prevCep;
      Object.assign(target, updates);
      if (updates.phone) {
        target.phone = normalizeBrPhoneDigits(updates.phone) || updates.phone.replace(/\D/g, '');
      }
      if (
        cepGeoResult &&
        (nextCep !== prevCep || !target.coordinates || (target.coordinatesPrecision !== 'gps' && cepGeoResult.coordinatesPrecision === 'exact_cep'))
      ) {
        target.coordinates = cepGeoResult.coordinates;
        target.coordinatesPrecision = cepGeoResult.coordinatesPrecision;
        if (target.address) {
          target.address.coordinates = cepGeoResult.coordinates;
          target.address.coordinatesPrecision = cepGeoResult.coordinatesPrecision;
        }
      }
      env.revision += 1;
      env.updatedAt = new Date().toISOString();
      writeDbEnvelope(env);
      broadcastDbUpdate(env.revision, env.updatedAt, 'user_updated');
      res.json({ ok: true, user: target, revision: env.revision, updatedAt: env.updatedAt });
    } catch (err) {
      console.error('Erro ao atualizar usuário via PATCH /api/users/:id:', err);
      res.status(500).json({ ok: false, message: 'Erro ao atualizar usuário no servidor.' });
    }
  });

  // Exclusão atômica de usuário pelo Admin
  app.delete('/api/users/:id', (req, res) => {
    try {
      const targetId = req.params.id;
      const env = ensureDbEnvelope();
      const idx = env.data.users.findIndex(u => u.id === targetId);
      if (idx === -1) {
        res.status(404).json({ ok: false, message: 'Usuário não encontrado.' });
        return;
      }
      env.data.users.splice(idx, 1);
      const delSet = new Set(env.deletedUserIds || []);
      delSet.add(targetId);
      env.deletedUserIds = Array.from(delSet);
      env.revision += 1;
      env.updatedAt = new Date().toISOString();
      writeDbEnvelope(env);
      broadcastDbUpdate(env.revision, env.updatedAt, 'user_deleted');
      res.json({ ok: true, revision: env.revision, updatedAt: env.updatedAt });
    } catch (err) {
      console.error('Erro ao excluir usuário:', err);
      res.status(500).json({ ok: false, message: 'Erro ao excluir usuário.' });
    }
  });

  // ============================================================================
  // ROTAS ATÔMICAS DE CHAMADOS (SOLICITAÇÕES) E PROPOSTAS DE ORÇAMENTO
  // Garante entrega imediata Cliente <-> Fornecedor sem erros e sem retornos
  // ============================================================================

  // Criação atômica de solicitação do Cliente -> notifica fornecedores via SSE
  app.post('/api/requests', express.json({ limit: '20mb' }), async (req, res) => {
    try {
      const body = req.body as Partial<PartRequest> & { customerId?: string; request?: PartRequest };
      const incomingReq = body.request || (body as PartRequest);
      const customerId = body.customerId || incomingReq?.customerId;

      if (!customerId || !incomingReq || !incomingReq.partName || !incomingReq.deliveryAddress) {
        res.status(400).json({ ok: false, message: 'Dados incompletos para criar a solicitação.' });
        return;
      }

      let resolvedCoords = incomingReq.deliveryAddress.coordinates;
      let resolvedPrecision: DeliveryAddress['coordinatesPrecision'] = incomingReq.clientGpsVerified
        ? 'gps'
        : incomingReq.deliveryAddress.coordinatesPrecision;

      if (
        !incomingReq.clientGpsVerified &&
        isValidCep(incomingReq.deliveryAddress.cep) &&
        (!resolvedCoords || resolvedPrecision !== 'exact_cep')
      ) {
        const cepGeo = await resolveExactCepGeoOnServer(incomingReq.deliveryAddress.cep, {
          street: incomingReq.deliveryAddress.street,
          neighborhood: incomingReq.deliveryAddress.neighborhood,
          city: incomingReq.deliveryAddress.city,
          state: incomingReq.deliveryAddress.state,
        });
        resolvedCoords = cepGeo.coordinates;
        resolvedPrecision = cepGeo.coordinatesPrecision;
      } else if (!resolvedCoords && isValidCep(incomingReq.deliveryAddress.cep)) {
        resolvedCoords = estimateCoordinatesFromCep(
          incomingReq.deliveryAddress.cep,
          incomingReq.deliveryAddress.state
        );
        resolvedPrecision = 'cep_prefix';
      }

      const env = ensureDbEnvelope();
      const nowIso = new Date().toISOString();

      // Idempotência: se o mesmo ID já existe no servidor, retorna imediatamente sem duplicar
      if (incomingReq.id) {
        const existing = env.data.requests.find(r => r.id === incomingReq.id);
        if (existing) {
          res.status(200).json({
            ok: true,
            request: existing,
            revision: env.revision,
            updatedAt: env.updatedAt,
            data: env.data,
          });
          return;
        }
      }

      const customer = env.data.users.find(u => u.id === customerId);
      const timers = env.data.timer_settings || {
        supplierResponseTimeoutMinutes: 16,
        clientApprovalTimeoutMinutes: 1440,
      };
      const initialWindowMinutes = Math.max(1, timers.supplierResponseTimeoutMinutes || 16);

      if (incomingReq.clientGpsVerified && resolvedCoords && customer) {
        customer.coordinates = { ...resolvedCoords };
        customer.coordinatesPrecision = 'gps';
        customer.gpsVerifiedAt = nowIso;
      }

      const requestId =
        incomingReq.id || `req_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const requestNumber =
        incomingReq.requestNumber || `CMP-${Math.floor(10000 + Math.random() * 90000)}`;

      const newRequest: PartRequest = {
        ...incomingReq,
        id: requestId,
        requestNumber,
        customerId,
        customerName: customer?.name || incomingReq.customerName || 'Cliente AUTO SHOP',
        customerPhone: customer?.phone || incomingReq.customerPhone || '',
        deliveryAddress: {
          ...incomingReq.deliveryAddress,
          cep: formatCep(incomingReq.deliveryAddress.cep || ''),
          coordinates: resolvedCoords,
          coordinatesPrecision: resolvedPrecision,
        },
        status: 'aguardando_orcamentos',
        createdAt: incomingReq.createdAt || nowIso,
        lastAttemptAt: incomingReq.lastAttemptAt || nowIso,
        expiresAt:
          incomingReq.expiresAt ||
          new Date(Date.now() + initialWindowMinutes * 60 * 1000).toISOString(),
        attemptExpiresAt:
          incomingReq.attemptExpiresAt ||
          new Date(Date.now() + initialWindowMinutes * 60 * 1000).toISOString(),
        clientExpiresAt:
          incomingReq.clientExpiresAt ||
          new Date(Date.now() + (timers.clientApprovalTimeoutMinutes || 1440) * 60 * 1000).toISOString(),
        searchRadiusKm: incomingReq.searchRadiusKm || 50,
        autoExpanded: Boolean(incomingReq.autoExpanded),
        searchAttempt: incomingReq.searchAttempt || 1,
        maxSearchAttempts: incomingReq.maxSearchAttempts || 4,
        clientGpsVerified: Boolean(incomingReq.clientGpsVerified),
        priorityLevel: incomingReq.priorityLevel || 1,
        statusHistory:
          incomingReq.statusHistory && incomingReq.statusHistory.length > 0
            ? incomingReq.statusHistory
            : [
                {
                  id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                  timestamp: nowIso,
                  stage: 'Solicitação Criada (Tentativa 1/4)',
                  details: `Cliente solicitou "${incomingReq.partName}". Raio inicial: ${incomingReq.searchRadiusKm || 50} km. Prazo: 16 min.`,
                  actorRole: 'cliente',
                  actorName: customer?.name || incomingReq.customerName,
                  radiusKm: incomingReq.searchRadiusKm || 50,
                  attemptNumber: 1,
                },
              ],
      };

      env.deletedRequestIds = (env.deletedRequestIds || []).filter(id => id !== newRequest.id);
      env.data.requests.unshift(newRequest);

      appendServerAudit(
        env.data,
        customer,
        customerId,
        'Nova Solicitação de Peça',
        'request',
        newRequest.id,
        `Solicitação ${newRequest.requestNumber} criada (Tentativa ${newRequest.searchAttempt}/4 · Raio ${newRequest.searchRadiusKm} km): ${newRequest.partName} para ${newRequest.vehicleBrand} ${newRequest.vehicleModel}.`,
        req.ip
      );

      env.revision += 1;
      env.updatedAt = nowIso;
      writeDbEnvelope(env);
      broadcastDbUpdate(env.revision, env.updatedAt, 'request_created');

      res.status(201).json({
        ok: true,
        request: newRequest,
        revision: env.revision,
        updatedAt: env.updatedAt,
        data: env.data,
      });
    } catch (err) {
      console.error('Erro ao criar solicitação via POST /api/requests:', err);
      res.status(500).json({ ok: false, message: 'Erro interno ao gravar solicitação no servidor.' });
    }
  });

  // Refazer solicitação expirada (amplia raio 50 -> 100 -> 200 -> 500 km) atomicamente no servidor
  app.post('/api/requests/:id/retry', express.json({ limit: '1mb' }), (req, res) => {
    try {
      const requestId = req.params.id;
      const body = req.body as { customerId?: string };
      const env = ensureDbEnvelope();
      const targetReq = env.data.requests.find(r => r.id === requestId);
      if (!targetReq) {
        res.status(404).json({ ok: false, message: 'Solicitação não encontrada.' });
        return;
      }
      if (body.customerId && targetReq.customerId !== body.customerId) {
        res.status(403).json({ ok: false, message: 'Permissão negada para refazer esta solicitação.' });
        return;
      }
      const isPaid =
        targetReq.status === 'finalizado' ||
        env.data.orders_and_payments.some(o => o.requestId === targetReq.id && o.paymentStatus === 'confirmado');
      if (isPaid) {
        res.status(409).json({ ok: false, message: 'Esta solicitação já foi paga e finalizada.', request: targetReq });
        return;
      }
      const existingQuotes = env.data.quotes.filter(q => q.requestId === targetReq.id);
      if (existingQuotes.length > 0) {
        res.status(200).json({
          ok: true,
          alreadyQuoted: true,
          message: 'Esta solicitação já recebeu propostas de fornecedores.',
          request: targetReq,
          revision: env.revision,
          data: env.data,
        });
        return;
      }

      const currentAttempt = targetReq.searchAttempt || 1;
      const maxAttempts = targetReq.maxSearchAttempts || 4;
      const nowIso = new Date().toISOString();

      if (currentAttempt >= maxAttempts || targetReq.status === 'sem_fornecedor') {
        targetReq.status = 'sem_fornecedor';
        targetReq.closedReason = 'nenhum_fornecedor_disponivel';
        env.revision += 1;
        env.updatedAt = nowIso;
        writeDbEnvelope(env);
        broadcastDbUpdate(env.revision, env.updatedAt, 'request_closed_no_supplier');
        res.json({
          ok: false,
          closed: true,
          message: 'NENHUM FORNECEDOR DISPONÍVEL após 4 tentativas (0 ofertas recebidas).',
          request: targetReq,
          revision: env.revision,
          data: env.data,
        });
        return;
      }

      const nextAttempt = currentAttempt + 1;
      const radiusByAttempt: Record<number, number> = { 1: 50, 2: 100, 3: 200, 4: 500 };
      const nextRadius = radiusByAttempt[nextAttempt] || 500;
      const nextWindowIso = new Date(Date.now() + 16 * 60 * 1000).toISOString();

      targetReq.searchAttempt = nextAttempt;
      targetReq.maxSearchAttempts = maxAttempts;
      targetReq.searchRadiusKm = nextRadius;
      targetReq.autoExpanded = true;
      targetReq.status = 'aguardando_orcamentos';
      targetReq.closedReason = undefined;
      targetReq.lastAttemptAt = nowIso;
      targetReq.expiresAt = nextWindowIso;
      targetReq.attemptExpiresAt = nextWindowIso;

      if (env.data.rejected_supplier_requests) {
        env.data.rejected_supplier_requests = env.data.rejected_supplier_requests.filter(
          r => r.requestId !== targetReq.id
        );
      }

      const customer = env.data.users.find(u => u.id === targetReq.customerId);
      targetReq.statusHistory = [
        {
          id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          timestamp: nowIso,
          stage: `REFAZER SOLICITAÇÃO · Tentativa ${nextAttempt}/${maxAttempts} (+${nextRadius} km)`,
          details: `Cliente solicitou nova busca de fornecedores mais distantes. Raio ampliado para ${nextRadius} km por mais 16 minutos.`,
          actorRole: 'cliente',
          actorName: customer?.name || targetReq.customerName,
          radiusKm: nextRadius,
          attemptNumber: nextAttempt,
        },
        ...(targetReq.statusHistory || []),
      ];

      appendServerAudit(
        env.data,
        customer,
        targetReq.customerId,
        `Refazer Solicitação (${nextAttempt}/${maxAttempts} · ${nextRadius} km)`,
        'request',
        targetReq.id,
        `Raio ampliado para ${nextRadius} km na tentativa ${nextAttempt}/${maxAttempts}.`,
        req.ip
      );

      env.revision += 1;
      env.updatedAt = nowIso;
      writeDbEnvelope(env);
      broadcastDbUpdate(env.revision, env.updatedAt, 'request_retried');

      res.json({
        ok: true,
        closed: false,
        message: `Nova solicitação enviada (${nextAttempt}/${maxAttempts}) buscando fornecedores em até ${nextRadius} km!`,
        request: targetReq,
        revision: env.revision,
        updatedAt: env.updatedAt,
        data: env.data,
      });
    } catch (err) {
      console.error('Erro ao refazer solicitação:', err);
      res.status(500).json({ ok: false, message: 'Erro interno ao refazer solicitação.' });
    }
  });

  // Recusa atômica de chamado pelo Fornecedor
  app.post('/api/requests/:id/reject', express.json({ limit: '1mb' }), (req, res) => {
    try {
      const requestId = req.params.id;
      const body = req.body as { supplierId?: string };
      if (!body.supplierId) {
        res.status(400).json({ ok: false, message: 'Informe supplierId.' });
        return;
      }
      const env = ensureDbEnvelope();
      if (!env.data.rejected_supplier_requests) {
        env.data.rejected_supplier_requests = [];
      }
      const exists = env.data.rejected_supplier_requests.some(
        r => r.supplierId === body.supplierId && r.requestId === requestId
      );
      if (!exists) {
        env.data.rejected_supplier_requests.push({ supplierId: body.supplierId, requestId });
        const supplier = env.data.users.find(u => u.id === body.supplierId);
        const targetReq = env.data.requests.find(r => r.id === requestId);
        appendServerAudit(
          env.data,
          supplier,
          body.supplierId,
          'Solicitação Recusada pelo Fornecedor',
          'request',
          requestId,
          `Fornecedor optou por RECUSAR a solicitação ${targetReq?.requestNumber || requestId}.`,
          req.ip
        );
        env.revision += 1;
        env.updatedAt = new Date().toISOString();
        writeDbEnvelope(env);
        broadcastDbUpdate(env.revision, env.updatedAt, 'request_rejected');
      }
      res.json({ ok: true, revision: env.revision, updatedAt: env.updatedAt });
    } catch (err) {
      console.error('Erro ao registrar recusa do fornecedor:', err);
      res.status(500).json({ ok: false, message: 'Erro ao registrar recusa.' });
    }
  });

  // Envio atômico de proposta de orçamento (Fornecedor -> Cliente) sem erros e sem retornos
  app.post('/api/quotes', express.json({ limit: '15mb' }), async (req, res) => {
    try {
      const body = req.body as Partial<Quote> & { supplierId?: string; quote?: Partial<Quote> };
      const incomingQuote = body.quote || body;
      const supplierId = body.supplierId || incomingQuote?.supplierId;
      const requestId = incomingQuote?.requestId;

      if (!supplierId || !requestId) {
        res.status(400).json({ ok: false, message: 'Informe supplierId e requestId para enviar a proposta.' });
        return;
      }

      const envPre = ensureDbEnvelope();
      const nowIso = new Date().toISOString();

      // Idempotência: se a mesma proposta já foi salva por ID, retorna sucesso imediato
      if (incomingQuote.id) {
        const existingQuote = envPre.data.quotes.find(q => q.id === incomingQuote.id);
        if (existingQuote) {
          res.status(200).json({
            ok: true,
            quote: existingQuote,
            quotesForRequest: sortQuotesLowestPriceFirst(
              envPre.data.quotes.filter(q => q.requestId === requestId)
            ),
            revision: envPre.revision,
            updatedAt: envPre.updatedAt,
            data: envPre.data,
          });
          return;
        }
      }

      const supplierPre = envPre.data.users.find(u => u.id === supplierId && u.role === 'fornecedor');
      if (!supplierPre) {
        res.status(404).json({ ok: false, message: 'Fornecedor não encontrado no servidor.' });
        return;
      }

      const partRequestPre = envPre.data.requests.find(r => r.id === requestId);
      if (!partRequestPre) {
        res.status(404).json({ ok: false, message: 'Solicitação não encontrada no servidor.' });
        return;
      }

      let computedDistanceKm = incomingQuote.distanceKm;
      let computedDistanceSource = incomingQuote.distanceSource;
      let supExactGeo: Awaited<ReturnType<typeof resolveExactCepGeoOnServer>> | null = null;
      let reqExactGeo: Awaited<ReturnType<typeof resolveExactCepGeoOnServer>> | null = null;

      const supNeedsUpgrade =
        !supplierPre.coordinates ||
        (supplierPre.coordinatesPrecision !== 'gps' && supplierPre.coordinatesPrecision !== 'exact_cep');
      const reqNeedsUpgrade =
        !partRequestPre.deliveryAddress?.coordinates ||
        (partRequestPre.deliveryAddress?.coordinatesPrecision !== 'gps' &&
          partRequestPre.deliveryAddress?.coordinatesPrecision !== 'exact_cep');

      if (supNeedsUpgrade && isValidCep(supplierPre.address?.cep)) {
        supExactGeo = await resolveExactCepGeoOnServer(supplierPre.address?.cep, supplierPre.address);
      }
      if (reqNeedsUpgrade && isValidCep(partRequestPre.deliveryAddress?.cep)) {
        reqExactGeo = await resolveExactCepGeoOnServer(
          partRequestPre.deliveryAddress?.cep,
          partRequestPre.deliveryAddress
        );
      }

      const supCoords = supExactGeo?.coordinates || supplierPre.coordinates || supplierPre.address?.coordinates;
      const reqCoords =
        reqExactGeo?.coordinates ||
        partRequestPre.deliveryAddress?.coordinates;

      if (supCoords && reqCoords && (computedDistanceKm === undefined || supExactGeo || reqExactGeo)) {
        const routeDist = await computeRouteDistanceOnServer(supCoords, reqCoords);
        if (Number.isFinite(routeDist.distanceKm)) {
          computedDistanceKm = routeDist.distanceKm;
          computedDistanceSource = routeDist.source;
        }
      }

      const env = ensureDbEnvelope();
      const supplier = env.data.users.find(u => u.id === supplierId && u.role === 'fornecedor')!;
      const partRequest = env.data.requests.find(r => r.id === requestId)!;

      if (supExactGeo && supExactGeo.coordinatesPrecision === 'exact_cep') {
        supplier.coordinates = supExactGeo.coordinates;
        supplier.coordinatesPrecision = 'exact_cep';
        if (supplier.address) {
          supplier.address.coordinates = supExactGeo.coordinates;
          supplier.address.coordinatesPrecision = 'exact_cep';
        }
      }
      if (reqExactGeo && reqExactGeo.coordinatesPrecision === 'exact_cep' && partRequest.deliveryAddress) {
        partRequest.deliveryAddress.coordinates = reqExactGeo.coordinates;
        partRequest.deliveryAddress.coordinatesPrecision = 'exact_cep';
      }

      const isAlreadyPaid =
        partRequest.status === 'finalizado' ||
        env.data.orders_and_payments.some(o => o.requestId === partRequest.id && o.paymentStatus === 'confirmado');
      if (isAlreadyPaid || partRequest.status === 'cancelado' || partRequest.status === 'sem_fornecedor') {
        res.status(409).json({
          ok: false,
          message: 'Esta solicitação já foi comprada/paga ou encerrada e não aceita novos orçamentos.',
        });
        return;
      }

      const partPrice = Number(incomingQuote.partPrice);
      const shippingPrice = Number(incomingQuote.shippingPrice) || 0;
      if (!Number.isFinite(partPrice) || partPrice <= 0) {
        res.status(400).json({ ok: false, message: 'Informe um valor de peça maior que zero (R$).' });
        return;
      }
      if (!Number.isFinite(shippingPrice) || shippingPrice < 0) {
        res.status(400).json({ ok: false, message: 'Taxa de entrega inválida.' });
        return;
      }

      const totalPrice = Number((partPrice + shippingPrice).toFixed(2));
      const tier = supplier.supplierTier || 'opcao_2';
      const condition = incomingQuote.condition || 'nova';
      const resolvedPhoto =
        (incomingQuote.photoUrl && incomingQuote.photoUrl.trim()) ||
        partRequest.mediaUrl ||
        env.data.customization_settings?.defaultPartImageUrl ||
        '/assets/aistudio/M1_AUTO_LOGO_3c381c58.jpg';

      const newQuote: Quote = {
        id: incomingQuote.id || `quo_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        requestId,
        supplierId,
        supplierName: supplier.companyName || supplier.name,
        supplierPhone: supplier.phone,
        supplierRating: supplier.rating || 4.8,
        supplierTier: tier,
        supplierLogoUrl:
          tier === 'opcao_3'
            ? supplier.avatarUrl || '/assets/aistudio/M1_AUTO_LOGO_3c381c58.jpg'
            : undefined,
        availability: incomingQuote.availability || 'estoque',
        condition,
        distanceKm: computedDistanceKm,
        distanceSource: computedDistanceSource,
        brand: incomingQuote.brand?.trim() || (tier === 'opcao_1' ? 'Genuína / Original' : 'Peça Qualificada'),
        partCode: incomingQuote.partCode || partRequest.oemCode || '',
        partPrice: Number(partPrice.toFixed(2)),
        shippingPrice: Number(shippingPrice.toFixed(2)),
        totalPrice,
        deliveryDays: Math.max(1, Number(incomingQuote.deliveryDays) || 1),
        deliveryHours: incomingQuote.deliveryHours,
        shippingMethod:
          incomingQuote.shippingMethod || (tier === 'opcao_1' ? 'Motoboy Express Local' : 'Transportadora'),
        technicalDetails: incomingQuote.technicalDetails,
        warrantyDays: Number(incomingQuote.warrantyDays) || 90,
        observations: incomingQuote.observations,
        photoUrl: resolvedPhoto,
        status: 'pendente',
        createdAt: incomingQuote.createdAt || nowIso,
      };

      env.data.quotes.push(newQuote);

      if (partRequest.status === 'aguardando_orcamentos') {
        partRequest.status = 'orcamentos_recebidos';
      }
      const clientWindowMinutes = env.data.timer_settings?.clientApprovalTimeoutMinutes || 1440;
      partRequest.clientExpiresAt = new Date(Date.now() + clientWindowMinutes * 60 * 1000).toISOString();

      partRequest.statusHistory = [
        {
          id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          timestamp: nowIso,
          stage: 'Orçamento Recebido do Fornecedor',
          details: `${supplier.companyName || supplier.name} cotou R$ ${totalPrice.toFixed(2)} (${
            newQuote.distanceKm !== undefined ? `${newQuote.distanceKm.toFixed(1)} km` : 'distância CEP'
          }).`,
          actorRole: 'fornecedor',
          actorName: supplier.companyName || supplier.name,
          radiusKm: partRequest.searchRadiusKm,
          attemptNumber: partRequest.searchAttempt || 1,
        },
        ...(partRequest.statusHistory || []),
      ];

      appendServerAudit(
        env.data,
        supplier,
        supplierId,
        'Envio de Orçamento',
        'quote',
        newQuote.id,
        `Proposta de R$ ${totalPrice.toFixed(2)} (${tier.toUpperCase()}) enviada para a solicitação ${partRequest.requestNumber}. Aguardando aceite do cliente.`,
        req.ip
      );

      env.revision += 1;
      env.updatedAt = nowIso;
      writeDbEnvelope(env);
      broadcastDbUpdate(env.revision, env.updatedAt, 'quote_created');

      res.status(201).json({
        ok: true,
        quote: newQuote,
        quotesForRequest: sortQuotesLowestPriceFirst(
          env.data.quotes.filter(q => q.requestId === requestId)
        ),
        revision: env.revision,
        updatedAt: env.updatedAt,
        data: env.data,
      });
    } catch (err) {
      console.error('Erro ao registrar proposta de orçamento via POST /api/quotes:', err);
      res.status(500).json({ ok: false, message: 'Erro interno ao enviar proposta de orçamento.' });
    }
  });

  // Consulta de propostas ordenadas estritamente do menor para o maior preço
  app.get('/api/requests/:id/quotes', (req, res) => {
    const env = ensureDbEnvelope();
    const quotes = sortQuotesLowestPriceFirst(
      env.data.quotes.filter(q => q.requestId === req.params.id)
    );
    res.json({ ok: true, requestId: req.params.id, quotes, revision: env.revision });
  });

  // PUT /api/db com merge inteligente por ID (NUNCA sobrescreve cadastros feitos por outros aparelhos)
  app.put('/api/db', express.json({ limit: '25mb' }), (req, res) => {
    try {
      const incoming = req.body as {
        data?: Partial<DatabaseSchema>;
        clientRevision?: number;
        deletedUserIds?: string[];
        deletedRequestIds?: string[];
        deletedOrderIds?: string[];
      };

      if (!incoming || !incoming.data || typeof incoming.data !== 'object') {
        res.status(400).json({ error: 'Payload inválido para /api/db' });
        return;
      }

      const current = ensureDbEnvelope();
      const clientRevision = typeof incoming.clientRevision === 'number' ? incoming.clientRevision : 0;
      const clientIsNewer = clientRevision >= current.revision;

      const delUserSet = new Set([
        ...(current.deletedUserIds || []),
        ...(Array.isArray(incoming.deletedUserIds) ? incoming.deletedUserIds : []),
      ]);
      const delReqSet = new Set([
        ...(current.deletedRequestIds || []),
        ...(Array.isArray(incoming.deletedRequestIds) ? incoming.deletedRequestIds : []),
      ]);
      const delOrdSet = new Set([
        ...(current.deletedOrderIds || []),
        ...(Array.isArray(incoming.deletedOrderIds) ? incoming.deletedOrderIds : []),
      ]);

      const inc = incoming.data;
      const srv = current.data;

      const mergedRaw: DatabaseSchema = {
        users: mergeUsers(srv.users, Array.isArray(inc.users) ? inc.users : [], delUserSet, clientIsNewer),
        vehicles: mergeById(srv.vehicles, Array.isArray(inc.vehicles) ? inc.vehicles : [], new Set(), clientIsNewer),
        catalog_parts: Array.isArray(inc.catalog_parts) && inc.catalog_parts.length > 0 && clientIsNewer ? inc.catalog_parts : srv.catalog_parts,
        categories: mergeById(srv.categories, Array.isArray(inc.categories) ? inc.categories : [], new Set(), clientIsNewer),
        requests: mergeRequestsMonotonic(srv.requests, Array.isArray(inc.requests) ? inc.requests : [], delReqSet, clientIsNewer),
        quotes: mergeQuotesSafe(srv.quotes, Array.isArray(inc.quotes) ? inc.quotes : [], new Set(), clientIsNewer),
        orders_and_payments: mergeOrdersSafe(
          srv.orders_and_payments,
          Array.isArray(inc.orders_and_payments) ? inc.orders_and_payments : [],
          delOrdSet,
          clientIsNewer
        ),
        split_transactions: mergeById(
          srv.split_transactions || [],
          Array.isArray(inc.split_transactions) ? inc.split_transactions : [],
          new Set(),
          clientIsNewer
        ),
        spams_config: clientIsNewer && Array.isArray(inc.spams_config) && inc.spams_config.length > 0 ? inc.spams_config : srv.spams_config,
        supplier_modalities:
          clientIsNewer && Array.isArray(inc.supplier_modalities)
            ? inc.supplier_modalities
            : srv.supplier_modalities || [],
        client_ads_settings: (() => {
          const srvAds = srv.client_ads_settings || { ...INITIAL_CLIENT_ADS_SETTINGS, items: [] };
          const incAds = inc.client_ads_settings;
          if (!incAds) return srvAds;
          const srvTs = srvAds.updatedAt ? new Date(srvAds.updatedAt).getTime() : 0;
          const incTs = incAds.updatedAt ? new Date(incAds.updatedAt).getTime() : 0;
          if (incTs > srvTs) return incAds;
          if (srvTs > incTs) return srvAds;
          return clientIsNewer ? incAds : srvAds;
        })(),
        dispatched_spams: mergeById(srv.dispatched_spams || [], Array.isArray(inc.dispatched_spams) ? inc.dispatched_spams : [], new Set(), clientIsNewer),
        audit_logs: mergeById(srv.audit_logs, Array.isArray(inc.audit_logs) ? inc.audit_logs : [], new Set(), clientIsNewer).slice(0, 500),
        evaluations: mergeById(srv.evaluations, Array.isArray(inc.evaluations) ? inc.evaluations : [], new Set(), clientIsNewer),
        commission_settings: clientIsNewer && inc.commission_settings ? inc.commission_settings : srv.commission_settings,
        customization_settings: mergeCustomizationSettings(
          clientIsNewer && inc.customization_settings ? inc.customization_settings : srv.customization_settings
        ),
        manufacturer_catalogs: mergeById(srv.manufacturer_catalogs, Array.isArray(inc.manufacturer_catalogs) ? inc.manufacturer_catalogs : [], new Set(), clientIsNewer),
        rejected_supplier_requests: Array.from(
          new Map(
            [...(srv.rejected_supplier_requests || []), ...(Array.isArray(inc.rejected_supplier_requests) ? inc.rejected_supplier_requests : [])].map(
              item => [`${item.supplierId}:${item.requestId}`, item]
            )
          ).values()
        ),
        timer_settings: clientIsNewer && inc.timer_settings ? inc.timer_settings : srv.timer_settings,
        chat_messages: mergeById(srv.chat_messages, Array.isArray(inc.chat_messages) ? inc.chat_messages : [], new Set(), clientIsNewer),
      };

      const normalized = normalizeSchemaData(
        mergedRaw,
        Array.from(delUserSet),
        Array.from(delReqSet),
        Array.from(delOrdSet)
      );

      const nextEnvelope: PersistedEnvelope = {
        revision: current.revision + 1,
        updatedAt: new Date().toISOString(),
        deletedUserIds: Array.from(delUserSet),
        deletedRequestIds: Array.from(delReqSet),
        deletedOrderIds: Array.from(delOrdSet),
        data: normalized.data,
      };
      writeDbEnvelope(nextEnvelope);
      broadcastDbUpdate(nextEnvelope.revision, nextEnvelope.updatedAt, 'db_merged');

      res.json({
        ok: true,
        revision: nextEnvelope.revision,
        updatedAt: nextEnvelope.updatedAt,
        data: nextEnvelope.data,
      });
    } catch (err) {
      console.error('Erro ao salvar banco compartilhado:', err);
      res.status(500).json({ error: 'Falha ao persistir dados no servidor' });
    }
  });

  app.put('/api/admin/client-ads', express.json({ limit: '25mb' }), (req, res) => {
    try {
      const incoming = req.body as Partial<DatabaseSchema['client_ads_settings']>;
      if (!incoming || typeof incoming !== 'object') {
        res.status(400).json({ ok: false, message: 'Configuração de anúncios inválida.' });
        return;
      }

      const current = ensureDbEnvelope();
      const prevAds = current.data.client_ads_settings || { ...INITIAL_CLIENT_ADS_SETTINGS, items: [] };
      const mergedAds = {
        ...INITIAL_CLIENT_ADS_SETTINGS,
        ...prevAds,
        ...incoming,
        items: Array.isArray(incoming.items) ? incoming.items : prevAds.items || [],
        updatedAt: new Date().toISOString(),
      };

      const normalized = normalizeSchemaData(
        {
          ...current.data,
          client_ads_settings: mergedAds,
        },
        current.deletedUserIds || [],
        current.deletedRequestIds || [],
        current.deletedOrderIds || []
      );

      const nextEnvelope: PersistedEnvelope = {
        revision: current.revision + 1,
        updatedAt: new Date().toISOString(),
        deletedUserIds: current.deletedUserIds || [],
        deletedRequestIds: current.deletedRequestIds || [],
        deletedOrderIds: current.deletedOrderIds || [],
        data: normalized.data,
      };

      writeDbEnvelope(nextEnvelope);
      broadcastDbUpdate(nextEnvelope.revision, nextEnvelope.updatedAt, 'client_ads_updated');

      res.json({
        ok: true,
        revision: nextEnvelope.revision,
        updatedAt: nextEnvelope.updatedAt,
        client_ads_settings: nextEnvelope.data.client_ads_settings,
      });
    } catch (err) {
      console.error('Erro ao salvar anúncios dos clientes:', err);
      res.status(500).json({ ok: false, message: 'Falha ao gravar anúncios no servidor.' });
    }
  });

  app.post(
    '/api/catalogs/:id/pdf',
    express.raw({ type: ['application/pdf', 'application/octet-stream'], limit: '50mb' }),
    (req, res) => {
      const safeId = sanitizeCatalogId(req.params.id || '');
      if (!safeId || !Buffer.isBuffer(req.body) || req.body.length === 0) {
        res.status(400).json({ error: 'Arquivo PDF inválido ou vazio.' });
        return;
      }
      try {
        ensureDataDirs();
        const targetPath = path.join(CATALOGS_DIR, `${safeId}.pdf`);
        fs.writeFileSync(targetPath, req.body);
        res.json({ ok: true, id: safeId, size: req.body.length });
      } catch (err) {
        console.error('Erro ao salvar PDF no servidor:', err);
        res.status(500).json({ error: 'Erro ao gravar PDF no servidor.' });
      }
    }
  );

  app.get('/api/catalogs/:id/pdf', (req, res) => {
    const safeId = sanitizeCatalogId(req.params.id || '');
    if (!safeId) {
      res.status(400).send('ID inválido');
      return;
    }
    const targetPath = path.join(CATALOGS_DIR, `${safeId}.pdf`);
    if (!fs.existsSync(targetPath)) {
      res.status(404).send('Catálogo PDF não encontrado no servidor.');
      return;
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(targetPath);
  });

  app.delete('/api/catalogs/:id/pdf', (req, res) => {
    const safeId = sanitizeCatalogId(req.params.id || '');
    if (safeId) {
      const targetPath = path.join(CATALOGS_DIR, `${safeId}.pdf`);
      if (fs.existsSync(targetPath)) {
        try {
          fs.unlinkSync(targetPath);
        } catch {
          // ignore
        }
      }
    }
    res.json({ ok: true });
  });

  // Upload/Visualização/Download de PDFs, Imagens e Vídeos compartilhados pelo Admin com Fornecedores/Usuários
  app.post(
    '/api/media/upload',
    express.raw({ type: '*/*', limit: '50mb' }),
    (req, res) => {
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        res.status(400).json({ ok: false, message: 'Arquivo vazio ou inválido.' });
        return;
      }
      try {
        ensureDataDirs();
        const rawName = String(req.query.filename || req.header('x-file-name') || 'arquivo');
        let decodedName = rawName;
        try {
          decodedName = decodeURIComponent(rawName);
        } catch {
          decodedName = rawName;
        }
        const safeName = decodedName.replace(/[/\\?%*:|"<>]/g, '_').slice(0, 140) || 'arquivo';
        const rawMime = String(req.query.mimetype || req.header('x-file-type') || req.header('content-type') || 'application/octet-stream').split(';')[0].trim();
        const mediaId = `med_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const binPath = path.join(MEDIA_DIR, `${mediaId}.bin`);
        const metaPath = path.join(MEDIA_DIR, `${mediaId}.meta.json`);
        fs.writeFileSync(binPath, req.body);
        fs.writeFileSync(
          metaPath,
          JSON.stringify({
            id: mediaId,
            fileName: safeName,
            mimeType: rawMime || 'application/octet-stream',
            sizeBytes: req.body.length,
            createdAt: new Date().toISOString(),
          }),
          'utf-8'
        );
        res.status(201).json({
          ok: true,
          id: mediaId,
          url: `/api/media/${mediaId}`,
          fileName: safeName,
          mimeType: rawMime || 'application/octet-stream',
          sizeBytes: req.body.length,
        });
      } catch (err) {
        console.error('Erro ao salvar mídia do usuário no servidor:', err);
        res.status(500).json({ ok: false, message: 'Erro ao gravar arquivo no servidor.' });
      }
    }
  );

  app.get('/api/media/:id', (req, res) => {
    const safeId = sanitizeCatalogId(req.params.id || '');
    if (!safeId) {
      res.status(400).send('ID inválido');
      return;
    }
    const binPath = path.join(MEDIA_DIR, `${safeId}.bin`);
    const metaPath = path.join(MEDIA_DIR, `${safeId}.meta.json`);
    if (!fs.existsSync(binPath)) {
      res.status(404).send('Arquivo não encontrado no servidor.');
      return;
    }
    let meta: { fileName?: string; mimeType?: string } = {};
    if (fs.existsSync(metaPath)) {
      try {
        meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
      } catch {
        // ignore
      }
    }
    const stat = fs.statSync(binPath);
    const totalSize = stat.size;
    const mimeType = meta.mimeType || 'application/octet-stream';
    const fileName = (meta.fileName || `${safeId}.bin`).replace(/"/g, '');
    const isDownload = req.query.download === '1' || req.query.download === 'true';

    res.setHeader('Content-Type', mimeType);
    res.setHeader(
      'Content-Disposition',
      `${isDownload ? 'attachment' : 'inline'}; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
    );
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'no-store');

    const range = req.headers.range;
    if (range && !isDownload) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;
      if (Number.isFinite(start) && Number.isFinite(end) && start >= 0 && end < totalSize && start <= end) {
        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${totalSize}`);
        res.setHeader('Content-Length', String(end - start + 1));
        fs.createReadStream(binPath, { start, end }).pipe(res);
        return;
      }
    }

    res.setHeader('Content-Length', String(totalSize));
    fs.createReadStream(binPath).pipe(res);
  });

  app.delete('/api/media/:id', (req, res) => {
    const safeId = sanitizeCatalogId(req.params.id || '');
    if (safeId) {
      const binPath = path.join(MEDIA_DIR, `${safeId}.bin`);
      const metaPath = path.join(MEDIA_DIR, `${safeId}.meta.json`);
      if (fs.existsSync(binPath)) {
        try {
          fs.unlinkSync(binPath);
        } catch {
          // ignore
        }
      }
      if (fs.existsSync(metaPath)) {
        try {
          fs.unlinkSync(metaPath);
        } catch {
          // ignore
        }
      }
    }
    res.json({ ok: true });
  });

  // ============================================================================
  // ROTAS DE SPLIT DE PAGAMENTO E GESTÃO DE SUBCONTAS (ASAAS / MERCADO PAGO)
  // ============================================================================

  // Status da integração e credenciais configuradas (sem expor chaves secretas)
  app.get('/api/payments/gateway-config', (_req, res) => {
    res.json({
      ok: true,
      config: getGatewayConfigStatus(),
    });
  });

  // Lista subcontas e carteiras recebedoras de fornecedores/prestadores
  app.get('/api/payments/subaccounts', (_req, res) => {
    const env = ensureDbEnvelope();
    const suppliers = env.data.users
      .filter(u => u.role === 'fornecedor')
      .map(u => ({
        id: u.id,
        name: u.name,
        companyName: u.companyName || u.name,
        document: u.document,
        phone: u.phone,
        status: u.status,
        commissionRateOverride: u.commissionRateOverride,
        supplierPaymentType: u.supplierPaymentType || 'compe_split',
        gatewayProvider: u.gatewayProvider || 'asaas',
        gatewayWalletId: u.gatewayWalletId || '',
        gatewaySubaccountId: u.gatewaySubaccountId || '',
        gatewayAccountStatus: u.gatewayAccountStatus || 'nao_configurada',
        gatewayPixKey: u.gatewayPixKey || u.bankAccountOrPix || '',
        gatewayBankInfo: u.gatewayBankInfo,
        gatewaySubaccountCreatedAt: u.gatewaySubaccountCreatedAt,
      }));
    res.json({
      ok: true,
      config: getGatewayConfigStatus(),
      subaccounts: suppliers,
    });
  });

  // Handler reutilizável para criação/atualização de subconta de fornecedor
  const handleUpsertSupplierSubaccount = async (req: Request, res: Response, supplierIdFromParam?: string) => {
    try {
      const body = req.body as {
        supplierId?: string;
        userId?: string;
        actorId?: string;
        provider?: PaymentGatewayProvider;
        pixKey?: string;
        walletId?: string;
        subaccountId?: string;
        bankInfo?: GatewayBankInfo;
        email?: string;
      };
      const targetId = supplierIdFromParam || body.supplierId || body.userId;
      if (!targetId) {
        res.status(400).json({ ok: false, message: 'Informe o ID do fornecedor para configurar a subconta.' });
        return;
      }

      const env = ensureDbEnvelope();
      const supplier = env.data.users.find(u => u.id === targetId && u.role === 'fornecedor');
      if (!supplier) {
        res.status(404).json({ ok: false, message: 'Fornecedor não encontrado.' });
        return;
      }

      const result = await createOrUpdateGatewaySubaccount(supplier, {
        provider: body.provider,
        pixKey: body.pixKey,
        walletId: body.walletId,
        subaccountId: body.subaccountId,
        bankInfo: body.bankInfo,
        email: body.email,
      });

      const nowIso = new Date().toISOString();
      supplier.gatewayProvider = result.provider;
      if (result.walletId) supplier.gatewayWalletId = result.walletId;
      if (result.subaccountId) supplier.gatewaySubaccountId = result.subaccountId;
      supplier.gatewayAccountStatus = result.status;
      if (result.pixKey) {
        supplier.gatewayPixKey = result.pixKey;
        supplier.bankAccountOrPix = result.pixKey;
      }
      if (result.bankInfo) supplier.gatewayBankInfo = result.bankInfo;
      if (!supplier.gatewaySubaccountCreatedAt) {
        supplier.gatewaySubaccountCreatedAt = nowIso;
      }

      const actor = env.data.users.find(u => u.id === (body.actorId || targetId)) || supplier;
      appendServerAudit(
        env.data,
        actor,
        actor.id,
        'Configuração de Subconta / Carteira Split',
        'payment',
        supplier.id,
        `Subconta ${result.provider.toUpperCase()} (${result.status}) atualizada para ${supplier.companyName || supplier.name}. WalletId: ${result.walletId || 'pendente'}.`,
        req.ip
      );

      env.revision += 1;
      env.updatedAt = nowIso;
      writeDbEnvelope(env);
      broadcastDbUpdate(env.revision, env.updatedAt, 'subaccount_updated');

      res.json({
        ok: result.ok,
        message: result.message,
        subaccount: result,
        user: supplier,
        revision: env.revision,
        updatedAt: env.updatedAt,
        data: env.data,
      });
    } catch (err) {
      console.error('Erro ao configurar subconta do fornecedor:', err);
      res.status(500).json({ ok: false, message: 'Erro interno ao configurar subconta no gateway.' });
    }
  };

  app.post('/api/payments/subaccounts', express.json({ limit: '2mb' }), (req, res) => {
    void handleUpsertSupplierSubaccount(req, res);
  });

  app.post('/api/suppliers/:id/subaccount', express.json({ limit: '2mb' }), (req, res) => {
    void handleUpsertSupplierSubaccount(req, res, req.params.id);
  });

  // Histórico de pagamentos divididos (Splits)
  app.get('/api/payments/splits', (_req, res) => {
    const env = ensureDbEnvelope();
    const splits = [...(env.data.split_transactions || [])].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    res.json({
      ok: true,
      config: getGatewayConfigStatus(),
      splits,
    });
  });

  // Atualização administrativa de status de split / repasse
  app.patch('/api/payments/splits/:id/status', express.json({ limit: '1mb' }), (req, res) => {
    try {
      const splitId = req.params.id;
      const body = req.body as {
        status?: SplitPaymentStatus;
        notes?: string;
        adminId?: string;
      };
      const allowedStatuses: SplitPaymentStatus[] = [
        'pendente',
        'processando',
        'dividido_pago',
        'repassado',
        'erro',
        'estornado',
      ];
      if (!body.status || !allowedStatuses.includes(body.status)) {
        res.status(400).json({ ok: false, message: 'Status de split inválido.' });
        return;
      }

      const env = ensureDbEnvelope();
      const splits = env.data.split_transactions || [];
      const splitTx = splits.find(s => s.id === splitId);
      if (!splitTx) {
        res.status(404).json({ ok: false, message: 'Transação de split não encontrada.' });
        return;
      }

      const nowIso = new Date().toISOString();
      splitTx.status = body.status;
      splitTx.updatedAt = nowIso;
      if (body.notes !== undefined) splitTx.notes = body.notes;
      if (body.status === 'repassado') {
        splitTx.transferredAt = nowIso;
      }

      const linkedOrder = env.data.orders_and_payments.find(o => o.id === splitTx.orderId);
      if (linkedOrder) {
        linkedOrder.splitStatus = body.status;
        if (linkedOrder.splitBreakdown && body.status === 'repassado') {
          linkedOrder.splitBreakdown.transferredAt = nowIso;
        }
        if (body.status === 'repassado') {
          linkedOrder.supplierReceiptConfirmed = true;
          linkedOrder.supplierReceiptConfirmedAt = linkedOrder.supplierReceiptConfirmedAt || nowIso;
        } else if (body.status === 'estornado') {
          linkedOrder.paymentStatus = 'estornado';
        }
      }

      const adminUser = env.data.users.find(u => u.id === body.adminId) || env.data.users.find(u => u.role === 'admin');
      appendServerAudit(
        env.data,
        adminUser,
        adminUser?.id || 'usr_admin_1',
        'Atualização de Status do Split',
        'payment',
        splitTx.id,
        `Status do Split do pedido ${splitTx.orderNumber} alterado para "${body.status.toUpperCase()}" (Fornecedor: ${splitTx.supplierName}).`,
        req.ip
      );

      env.revision += 1;
      env.updatedAt = nowIso;
      writeDbEnvelope(env);
      broadcastDbUpdate(env.revision, env.updatedAt, 'split_updated');

      res.json({
        ok: true,
        split: splitTx,
        order: linkedOrder,
        revision: env.revision,
        updatedAt: env.updatedAt,
        data: env.data,
      });
    } catch (err) {
      console.error('Erro ao atualizar status do split:', err);
      res.status(500).json({ ok: false, message: 'Erro ao atualizar status do split.' });
    }
  });

  // Criação autoritativa de Pedido + Cobrança com Split Automático no Gateway
  const handleCreateOrderWithSplit = async (req: Request, res: Response) => {
    try {
      const body = req.body as {
        customerId?: string;
        quoteId?: string;
        paymentMethod?: PaymentMethod;
        preferredProvider?: PaymentGatewayProvider;
      };

      if (!body.customerId || !body.quoteId) {
        res.status(400).json({ ok: false, message: 'Informe customerId e quoteId para gerar a cobrança.' });
        return;
      }

      const env = ensureDbEnvelope();
      const quote = env.data.quotes.find(q => q.id === body.quoteId);
      if (!quote) {
        res.status(404).json({ ok: false, message: 'Orçamento selecionado não encontrado.' });
        return;
      }

      const partRequest = env.data.requests.find(r => r.id === quote.requestId);
      if (!partRequest) {
        res.status(404).json({ ok: false, message: 'Solicitação de peça não encontrada.' });
        return;
      }

      if (partRequest.status === 'finalizado') {
        const existingOrder = env.data.orders_and_payments.find(
          o => o.requestId === partRequest.id && o.paymentStatus === 'confirmado'
        );
        if (existingOrder) {
          res.status(409).json({
            ok: false,
            message: 'Este pedido já foi pago e finalizado anteriormente.',
            order: existingOrder,
          });
          return;
        }
      }

      const customer = env.data.users.find(u => u.id === body.customerId);
      const supplier = env.data.users.find(u => u.id === quote.supplierId);
      if (!customer || !supplier) {
        res.status(404).json({ ok: false, message: 'Cliente ou fornecedor do orçamento não localizado.' });
        return;
      }

      const commissionSettings = env.data.commission_settings;
      const commissionPercent =
        supplier.commissionRateOverride !== undefined
          ? supplier.commissionRateOverride
          : commissionSettings.categoryCommissions[partRequest.partCategory] ??
            commissionSettings.generalCommissionPercent ??
            10;

      const paymentMethod: PaymentMethod = body.paymentMethod || 'pix';
      const nowIso = new Date().toISOString();
      const nowDate = new Date();
      const seqNum = (env.data.orders_and_payments.length + 1).toString().padStart(8, '0');
      const yearStr = nowDate.getFullYear().toString().slice(-2);
      const monthStr = (nowDate.getMonth() + 1).toString().padStart(2, '0');
      const orderNumber = `${yearStr}.${monthStr}.${seqNum}`;

      const chargeResult = await createGatewayChargeWithSplit({
        orderNumber,
        totalAmount: quote.totalPrice,
        partPrice: quote.partPrice,
        shippingPrice: quote.shippingPrice,
        commissionPercent,
        paymentMethod,
        customer,
        supplier,
        description: `AUTO SHOP · Pedido ${orderNumber} · ${partRequest.partName} (${partRequest.vehicleBrand} ${partRequest.vehicleModel})`,
        preferredProvider: body.preferredProvider,
      });

      // Atualiza carteira do fornecedor caso tenha sido provisionada automaticamente no split
      if (!supplier.gatewayWalletId && chargeResult.splitBreakdown.supplierWalletId) {
        supplier.gatewayProvider = chargeResult.provider;
        supplier.gatewayWalletId = chargeResult.splitBreakdown.supplierWalletId;
        supplier.gatewaySubaccountId = chargeResult.splitBreakdown.supplierSubaccountId;
        supplier.gatewayAccountStatus = 'ativa';
        supplier.gatewaySubaccountCreatedAt = supplier.gatewaySubaccountCreatedAt || nowIso;
      }

      const pinDeliveryCode = Math.floor(1000 + Math.random() * 9000).toString();
      const cleanDoc = (supplier.document || '').replace(/\D/g, '').padStart(14, '0').slice(0, 14);
      const nfeKey = `3526${cleanDoc}550010000${seqNum}1`;
      const nfeNumber = `NF-e Emitida: ${seqNum.slice(-6)} - Série 1`;

      const orderId = `ord_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const newOrder: OrderAndPayment = {
        id: orderId,
        orderNumber,
        requestId: partRequest.id,
        quoteId: quote.id,
        customerId: customer.id,
        supplierId: supplier.id,
        partName: partRequest.partName,
        vehicleSummary: `${partRequest.vehicleBrand} ${partRequest.vehicleModel} ${partRequest.vehicleYear}`,
        partPrice: quote.partPrice,
        shippingPrice: quote.shippingPrice,
        totalAmount: quote.totalPrice,
        platformCommissionRate: chargeResult.splitBreakdown.platformFeePercent,
        platformCommissionAmount: chargeResult.splitBreakdown.platformAmount,
        supplierTransferAmount: chargeResult.splitBreakdown.supplierAmount,
        paymentMethod,
        paymentStatus: 'confirmado',
        pixCode: chargeResult.pixCode,
        nfeKey,
        nfeNumber,
        nfeSerie: '1',
        pinDeliveryCode,
        deliveryStatus: 'compra_confirmada',
        supplierTier: supplier.supplierTier,
        supplierPaymentType: supplier.supplierPaymentType || 'compe_split',
        cancellationPenaltyNotice:
          '< ATENÇÃO: A PARTIR DAQUI NÃO SERÁ POSSÍVEL CANCELAR, O CANCELAMENTO ACARRETARÁ EM PAGAMENTO DE TAXA PARA A AUTO SHOP E CUSTOS COM AS TRANSAÇÕES BANCÁRIAS >',
        deliveryAddress: partRequest.deliveryAddress,
        supplierReceiptConfirmed: false,
        gatewayProvider: chargeResult.provider,
        gatewayChargeId: chargeResult.chargeId,
        gatewayInvoiceUrl: chargeResult.invoiceUrl,
        splitStatus: chargeResult.splitStatus,
        splitBreakdown: chargeResult.splitBreakdown,
        createdAt: nowIso,
        paidAt: nowIso,
      };

      const splitTransaction: SplitTransaction = {
        id: `spl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        orderId: newOrder.id,
        orderNumber,
        requestId: partRequest.id,
        customerId: customer.id,
        supplierId: supplier.id,
        supplierName: supplier.companyName || supplier.name,
        supplierDocument: supplier.document,
        gatewayProvider: chargeResult.provider,
        gatewayChargeId: chargeResult.chargeId,
        supplierWalletId: chargeResult.splitBreakdown.supplierWalletId,
        supplierSubaccountId: chargeResult.splitBreakdown.supplierSubaccountId,
        platformWalletId: chargeResult.splitBreakdown.platformWalletId,
        paymentMethod,
        grossAmount: quote.totalPrice,
        platformFeePercent: chargeResult.splitBreakdown.platformFeePercent,
        platformAmount: chargeResult.splitBreakdown.platformAmount,
        supplierNetAmount: chargeResult.splitBreakdown.supplierAmount,
        status: chargeResult.splitStatus,
        splitPayload: chargeResult.splitBreakdown.rawGatewayPayload,
        notes: chargeResult.message,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      env.data.orders_and_payments.unshift(newOrder);
      env.data.split_transactions = [splitTransaction, ...(env.data.split_transactions || [])];

      // Atualiza status da solicitação e cotações
      partRequest.status = 'finalizado';
      partRequest.closedReason = 'pedido_pago';
      partRequest.statusHistory = [
        ...(partRequest.statusHistory || []),
        {
          id: `hist_${Date.now()}_paid`,
          timestamp: nowIso,
          stage: 'Pedido Pago com Split no Gateway',
          details: `Pedido ${orderNumber} pago (${paymentMethod.toUpperCase()}). Taxa AUTO SHOP: R$ ${chargeResult.splitBreakdown.platformAmount.toFixed(2)} · Repasse Wallet ${chargeResult.splitBreakdown.supplierWalletId}: R$ ${chargeResult.splitBreakdown.supplierAmount.toFixed(2)}.`,
          actorRole: 'cliente',
          actorName: customer.name,
        },
      ];

      env.data.quotes.forEach(q => {
        if (q.requestId === partRequest.id) {
          q.status = q.id === quote.id ? 'aceito' : 'rejeitado';
        }
      });

      supplier.totalSales = (supplier.totalSales || 0) + 1;

      appendServerAudit(
        env.data,
        customer,
        customer.id,
        'Pagamento com Split Automático Confirmado',
        'payment',
        newOrder.id,
        `Pedido ${orderNumber} pago via ${paymentMethod.toUpperCase()} (${chargeResult.provider.toUpperCase()} ${chargeResult.mode}). Total: R$ ${quote.totalPrice.toFixed(2)} · Comissão AUTO SHOP: R$ ${chargeResult.splitBreakdown.platformAmount.toFixed(2)} (${chargeResult.splitBreakdown.platformFeePercent}%) · Repasse carteira ${chargeResult.splitBreakdown.supplierWalletId}: R$ ${chargeResult.splitBreakdown.supplierAmount.toFixed(2)}.`,
        req.ip
      );

      env.revision += 1;
      env.updatedAt = nowIso;
      writeDbEnvelope(env);
      broadcastDbUpdate(env.revision, env.updatedAt, 'order_split_created');

      res.status(201).json({
        ok: true,
        order: newOrder,
        split: splitTransaction,
        gateway: {
          mode: chargeResult.mode,
          provider: chargeResult.provider,
          chargeId: chargeResult.chargeId,
          invoiceUrl: chargeResult.invoiceUrl,
        },
        revision: env.revision,
        updatedAt: env.updatedAt,
        data: env.data,
      });
    } catch (err) {
      console.error('Erro ao criar pedido com split de pagamento:', err);
      res.status(500).json({ ok: false, message: 'Erro interno ao processar cobrança com split.' });
    }
  };

  app.post('/api/orders', express.json({ limit: '2mb' }), (req, res) => {
    void handleCreateOrderWithSplit(req, res);
  });

  app.post('/api/payments/charges', express.json({ limit: '2mb' }), (req, res) => {
    void handleCreateOrderWithSplit(req, res);
  });

  // Confirmação atômica pelo fornecedor de que o pagamento caiu em sua conta (libera fluxo do cliente imediatamente)
  app.post('/api/orders/:id/confirm-receipt', express.json({ limit: '1mb' }), (req, res) => {
    try {
      const orderId = req.params.id;
      const body = req.body as { supplierId?: string };
      const env = ensureDbEnvelope();
      const order = env.data.orders_and_payments.find(o => o.id === orderId);
      if (!order) {
        res.status(404).json({ ok: false, message: 'Pedido não encontrado no servidor.' });
        return;
      }
      if (body.supplierId && order.supplierId !== body.supplierId) {
        res.status(403).json({ ok: false, message: 'Apenas o fornecedor responsável pelo pedido pode confirmar o recebimento.' });
        return;
      }

      const nowIso = new Date().toISOString();
      if (!order.supplierReceiptConfirmed) {
        order.supplierReceiptConfirmed = true;
        order.supplierReceiptConfirmedAt = nowIso;

        const supplier = env.data.users.find(u => u.id === order.supplierId);
        const linkedRequest = env.data.requests.find(r => r.id === order.requestId);
        if (linkedRequest) {
          linkedRequest.statusHistory = [
            {
              id: `hist_${Date.now()}_sup_conf`,
              timestamp: nowIso,
              stage: 'Fornecedor Confirmou Pagamento em Conta',
              details: `Fornecedor confirmou o recebimento líquido de R$ ${order.supplierTransferAmount.toFixed(2)} do pedido ${order.orderNumber}. Seguindo para separação e envio ao cliente.`,
              actorRole: 'fornecedor',
              actorName: supplier?.companyName || supplier?.name || 'Fornecedor',
            },
            ...(linkedRequest.statusHistory || []),
          ];
        }

        appendServerAudit(
          env.data,
          supplier,
          order.supplierId,
          'Confirmação de Recebimento de Venda pelo Fornecedor',
          'payment',
          order.id,
          `Fornecedor confirmou recebimento do pedido ${order.orderNumber} (R$ ${order.supplierTransferAmount.toFixed(2)}). Pedido liberado para separação e envio ao cliente.`,
          req.ip
        );

        env.revision += 1;
        env.updatedAt = nowIso;
        writeDbEnvelope(env);
        broadcastDbUpdate(env.revision, env.updatedAt, 'order_receipt_confirmed');
      }

      res.json({
        ok: true,
        order,
        revision: env.revision,
        updatedAt: env.updatedAt,
        data: env.data,
      });
    } catch (err) {
      console.error('Erro ao confirmar recebimento pelo fornecedor:', err);
      res.status(500).json({ ok: false, message: 'Erro interno ao confirmar recebimento.' });
    }
  });

  // Webhook para confirmação assíncrona de pagamento e split (Asaas / Mercado Pago)
  app.post('/api/payments/webhook/:provider', express.json({ limit: '2mb' }), (req, res) => {
    try {
      const configuredToken = (process.env.PAYMENT_WEBHOOK_TOKEN || '').trim();
      if (configuredToken) {
        const provided =
          req.header('asaas-access-token') ||
          req.header('x-webhook-token') ||
          (req.header('authorization') || '').replace(/^Bearer\s+/i, '').trim() ||
          String(req.query.token || '');
        if (provided !== configuredToken) {
          res.status(401).json({ ok: false, message: 'Token de webhook inválido.' });
          return;
        }
      }

      const provider = req.params.provider;
      const body = req.body as {
        event?: string;
        action?: string;
        payment?: { id?: string; externalReference?: string; status?: string };
        data?: { id?: string };
        chargeId?: string;
        status?: SplitPaymentStatus;
      };

      const chargeId = body.payment?.id || body.data?.id || body.chargeId;
      const externalRef = body.payment?.externalReference;
      if (!chargeId && !externalRef) {
        res.status(400).json({ ok: false, message: 'Payload de webhook sem identificador de cobrança.' });
        return;
      }

      const env = ensureDbEnvelope();
      const splitTx = (env.data.split_transactions || []).find(
        s => (chargeId && s.gatewayChargeId === chargeId) || (externalRef && s.orderNumber === externalRef)
      );
      const order = env.data.orders_and_payments.find(
        o => (chargeId && o.gatewayChargeId === chargeId) || (externalRef && o.orderNumber === externalRef)
      );

      if (!splitTx && !order) {
        res.status(404).json({ ok: false, message: 'Pedido/Split correspondente não encontrado.' });
        return;
      }

      const ev = (body.event || body.action || body.payment?.status || '').toUpperCase();
      let nextSplitStatus: SplitPaymentStatus = body.status || 'dividido_pago';
      if (ev.includes('REFUND') || ev.includes('CHARGEDBACK') || ev.includes('CANCEL')) {
        nextSplitStatus = 'estornado';
      } else if (ev.includes('TRANSFER') || ev.includes('REPASS')) {
        nextSplitStatus = 'repassado';
      }

      const nowIso = new Date().toISOString();
      if (splitTx) {
        splitTx.status = nextSplitStatus;
        splitTx.updatedAt = nowIso;
        if (nextSplitStatus === 'repassado') splitTx.transferredAt = nowIso;
      }
      if (order) {
        order.splitStatus = nextSplitStatus;
        if (nextSplitStatus === 'estornado') {
          order.paymentStatus = 'estornado';
        } else {
          order.paymentStatus = 'confirmado';
          order.paidAt = order.paidAt || nowIso;
        }
      }

      appendServerAudit(
        env.data,
        undefined,
        'sistema',
        `Webhook Gateway (${provider.toUpperCase()})`,
        'payment',
        splitTx?.id || order?.id || 'webhook',
        `Evento ${ev || 'SYNC'} recebido. Split atualizado para ${nextSplitStatus.toUpperCase()}.`,
        req.ip
      );

      env.revision += 1;
      env.updatedAt = nowIso;
      writeDbEnvelope(env);
      broadcastDbUpdate(env.revision, env.updatedAt, 'payment_webhook');

      res.json({ ok: true, splitStatus: nextSplitStatus });
    } catch (err) {
      console.error('Erro no processamento de webhook:', err);
      res.status(500).json({ ok: false, message: 'Erro interno no webhook de pagamento.' });
    }
  });

  // Garante que qualquer rota /api/* desconhecida ou erro de payload (ex: JSON inválido/grande) retorne JSON limpo e nunca HTML
  app.use('/api', (_req, res) => {
    res.status(404).json({ ok: false, message: 'Endpoint de API não encontrado.' });
  });

  app.use('/api', (err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Erro na camada /api:', err);
    if (err?.type === 'entity.too.large') {
      res.status(413).json({
        ok: false,
        message: 'Os dados enviados (ex: foto de perfil) excedem o limite permitido. Tente uma imagem menor.',
      });
      return;
    }
    res.status(err?.status || 400).json({
      ok: false,
      message: err?.message || 'Requisição inválida para o banco de dados.',
    });
  });

  const isDev = process.env.COMPE_DEV === '1' || (process.env.NODE_ENV !== 'production' && !fs.existsSync(DIST_INDEX));

  if (isDev) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use('/src/assets', express.static(path.join(ROOT_DIR, 'src', 'assets')));
    app.use(
      express.static(DIST_DIR, {
        index: false,
        setHeaders: (res, filePath) => {
          if (
            filePath.endsWith('.html') ||
            filePath.endsWith('sw.js') ||
            filePath.endsWith('registerSW.js') ||
            filePath.endsWith('manifest.webmanifest')
          ) {
            res.setHeader('Cache-Control', 'no-store, must-revalidate');
          }
        },
      })
    );
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-store, must-revalidate');
      res.sendFile(DIST_INDEX);
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AUTO SHOP server running at http://0.0.0.0:${PORT} (${isDev ? 'dev' : 'prod'})`);
  });
}

startServer().catch((err) => {
  console.error('Falha crítica ao iniciar servidor AUTO SHOP:', err);
  process.exit(1);
});
