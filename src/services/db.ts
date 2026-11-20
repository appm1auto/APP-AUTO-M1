/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  User,
  Vehicle,
  CatalogPart,
  PartRequest,
  PartRequestExtraPart,
  Quote,
  OrderAndPayment,
  AuditLog,
  Evaluation,
  SpamTriggerConfig,
  CommissionSettings,
  PartCondition,
  AvailabilityType,
  PaymentMethod,
  OrderDeliveryStatus,
  VehicleCategory,
  PartIdentificationType,
  AppCustomizationSettings,
  ManufacturerCatalog,
  SystemTimerSettings,
  ChatMessage,
  AdminCategory,
  SupplierTier,
  SupplierPaymentType,
  DispatchedSpamAlert,
  AlarmEventKey,
  RequestStatusHistoryEntry,
  UserRole,
  SplitTransaction,
  PaymentGatewayProvider,
  SplitPaymentStatus,
  GatewayBankInfo,
  SupplierSpamModality,
  ClientAdsSettings
} from '../types';
import { soundEffects } from './sound';
import { savePdfBlob, deletePdfBlob } from './pdfStorage';
import {
  estimateCoordinatesFromCep,
  isValidCep,
  getCachedRealRouteDistanceKm,
  fetchRealRouteDistanceKm,
  lookupAddressAndGeoByCep,
  cleanCepDigits,
  RealDistanceResult,
} from './geolocation';
import { brPhonesMatch, normalizeBrPhoneDigits } from './phone';
import { apiUrl } from './apiBase';
import {
  DatabaseSchema,
  INITIAL_AUDIT_LOGS,
  INITIAL_CATALOG,
  INITIAL_CATEGORIES,
  INITIAL_CHAT_MESSAGES,
  INITIAL_CLIENT_ADS_SETTINGS,
  INITIAL_COMMISSION_SETTINGS,
  INITIAL_CUSTOMIZATION_SETTINGS,
  INITIAL_MANUFACTURER_CATALOGS,
  INITIAL_ORDERS,
  INITIAL_QUOTES,
  INITIAL_REQUESTS,
  INITIAL_SPAMS_CONFIG,
  INITIAL_SPLIT_TRANSACTIONS,
  INITIAL_SUPPLIER_MODALITIES,
  INITIAL_TIMER_SETTINGS,
  INITIAL_USERS,
  INITIAL_VEHICLES,
  createInitialDatabaseSchema,
  mergeCustomizationSettings as mergeCustomizationFromSeed,
  repairUsersArray,
} from './seedData';

export type { DatabaseSchema };
export {
  INITIAL_CATEGORIES,
  INITIAL_CUSTOMIZATION_SETTINGS,
  INITIAL_TIMER_SETTINGS,
  INITIAL_CHAT_MESSAGES,
  INITIAL_USERS,
  INITIAL_MANUFACTURER_CATALOGS,
};

const STORAGE_KEY = 'm1_auto_db_v4';
const LEGACY_STORAGE_KEY = 'compe_autoparts_db_v3';

// Initial seed data with authentic Brazilian automotive parts ecosystem
// Haversine distance calculator between GPS coordinates
export function calculateDistanceKm(
  coord1?: { lat: number; lng: number },
  coord2?: { lat: number; lng: number }
): number {
  if (
    !coord1 ||
    !coord2 ||
    !Number.isFinite(coord1.lat) ||
    !Number.isFinite(coord1.lng) ||
    !Number.isFinite(coord2.lat) ||
    !Number.isFinite(coord2.lng) ||
    (coord1.lat === 0 && coord1.lng === 0) ||
    (coord2.lat === 0 && coord2.lng === 0)
  ) {
    return Number.POSITIVE_INFINITY; // Sem coordenadas válidas nunca entra no raio local
  }
  const R = 6371; // Earth radius in km
  const dLat = ((coord2.lat - coord1.lat) * Math.PI) / 180;
  const dLng = ((coord2.lng - coord1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((coord1.lat * Math.PI) / 180) *
      Math.cos((coord2.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(1));
}

class DatabaseService {
  private data: DatabaseSchema;
  private listeners: Set<() => void> = new Set();
  private serverRevision = 0;
  private syncInFlight: Promise<void> | null = null;
  private pushTimer: ReturnType<typeof setTimeout> | null = null;
  private pushPending = false;
  private isPushing = false;
  private deletedUserIds = new Set<string>();
  private deletedRequestIds = new Set<string>();
  private deletedOrderIds = new Set<string>();
  private pendingLocalRequests = new Map<string, PartRequest>();
  private pendingLocalQuotes = new Map<string, Quote>();
  private sseSource: EventSource | null = null;
  private sseReconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        // Remove chave legada para impedir que snapshots antigos sobrescrevam o servidor
        localStorage.removeItem(LEGACY_STORAGE_KEY);
      } catch {
        // ignore
      }
    }
    this.data = this.load();
    soundEffects.registerAlarmConfigResolver((key: AlarmEventKey) => {
      return this.getCustomizationSettings().alarmSettings?.[key];
    });
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_KEY && e.newValue) {
          try {
            this.data = this.load();
            this.notify();
          } catch (err) {
            console.error('Error syncing AUTO SHOP DB from storage event:', err);
          }
        }
      });

      // Sincroniza imediatamente com o servidor central e mantém todos os aparelhos atualizados em tempo real
      void this.syncFromServer(true);
      this.connectRealtimeEvents();

      const handleResume = () => {
        if (typeof document === 'undefined' || document.visibilityState === 'visible') {
          void this.checkServerVersionAndSync();
        }
      };
      window.addEventListener('focus', handleResume);
      document.addEventListener('visibilitychange', handleResume);

      setInterval(() => {
        if (typeof document === 'undefined' || document.visibilityState === 'visible') {
          void this.checkServerVersionAndSync();
        }
      }, 2500);
    }
  }

  private connectRealtimeEvents() {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') return;
    if (this.sseSource) {
      this.sseSource.close();
      this.sseSource = null;
    }
    try {
      const es = new EventSource(apiUrl('/api/db/events'));
      this.sseSource = es;
      es.onmessage = (ev) => {
        try {
          const parsed = JSON.parse(ev.data) as { revision?: number };
          if (typeof parsed.revision === 'number' && parsed.revision > this.serverRevision) {
            void this.syncFromServer(true);
          }
        } catch {
          // ignore heartbeat / malformed message
        }
      };
      es.onerror = () => {
        es.close();
        this.sseSource = null;
        if (!this.sseReconnectTimer) {
          this.sseReconnectTimer = setTimeout(() => {
            this.sseReconnectTimer = null;
            this.connectRealtimeEvents();
          }, 4000);
        }
      };
    } catch {
      // Fallback para polling a cada 2.5s
    }
  }

  private mergeCustomizationSettings(incoming?: Partial<AppCustomizationSettings>): AppCustomizationSettings {
    return mergeCustomizationFromSeed(incoming);
  }

  private mergeParsedSchema(parsed: any): DatabaseSchema {
    const loadedCatalogs: ManufacturerCatalog[] = (parsed?.manufacturer_catalogs || [])
      .filter(
        (c: any) =>
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

    const rawUsers: User[] = Array.isArray(parsed?.users) ? parsed.users : INITIAL_USERS;
    const repaired = repairUsersArray(rawUsers, Array.from(this.deletedUserIds));

    const incomingReqs: PartRequest[] = (parsed?.requests || INITIAL_REQUESTS).filter(
      (r: PartRequest) => r?.id && !this.deletedRequestIds.has(r.id)
    );
    const reqMap = new Map<string, PartRequest>();
    incomingReqs.forEach(r => reqMap.set(r.id, r));
    this.pendingLocalRequests.forEach((pendingReq, id) => {
      if (!reqMap.has(id) && !this.deletedRequestIds.has(id)) {
        reqMap.set(id, pendingReq);
      } else if (reqMap.has(id)) {
        this.pendingLocalRequests.delete(id);
      }
    });

    const incomingQuotes: Quote[] = Array.isArray(parsed?.quotes) ? parsed.quotes : INITIAL_QUOTES;
    const quoteMap = new Map<string, Quote>();
    incomingQuotes.forEach(q => {
      if (q?.id) quoteMap.set(q.id, q);
    });
    this.pendingLocalQuotes.forEach((pendingQuote, id) => {
      if (!quoteMap.has(id)) {
        quoteMap.set(id, pendingQuote);
      } else {
        this.pendingLocalQuotes.delete(id);
      }
    });

    return {
      users: repaired.users,
      vehicles: parsed?.vehicles || INITIAL_VEHICLES,
      catalog_parts: parsed?.catalog_parts || INITIAL_CATALOG,
      categories: parsed?.categories && parsed.categories.length > 0 ? parsed.categories : INITIAL_CATEGORIES,
      requests: Array.from(reqMap.values()),
      quotes: Array.from(quoteMap.values()),
      orders_and_payments: (parsed?.orders_and_payments || INITIAL_ORDERS).filter(
        (o: OrderAndPayment) => !this.deletedOrderIds.has(o.id)
      ),
      split_transactions: Array.isArray(parsed?.split_transactions)
        ? parsed.split_transactions
        : INITIAL_SPLIT_TRANSACTIONS,
      spams_config: parsed?.spams_config || INITIAL_SPAMS_CONFIG,
      supplier_modalities:
        Array.isArray(parsed?.supplier_modalities) && parsed.supplier_modalities.length > 0
          ? parsed.supplier_modalities
          : INITIAL_SUPPLIER_MODALITIES,
      client_ads_settings: parsed?.client_ads_settings
        ? {
            ...INITIAL_CLIENT_ADS_SETTINGS,
            ...parsed.client_ads_settings,
            items: Array.isArray(parsed.client_ads_settings.items)
              ? parsed.client_ads_settings.items
              : [],
          }
        : { ...INITIAL_CLIENT_ADS_SETTINGS, items: [] },
      dispatched_spams: parsed?.dispatched_spams || [],
      audit_logs: parsed?.audit_logs || INITIAL_AUDIT_LOGS,
      evaluations: parsed?.evaluations || [],
      commission_settings: parsed?.commission_settings || INITIAL_COMMISSION_SETTINGS,
      customization_settings: this.mergeCustomizationSettings(parsed?.customization_settings),
      manufacturer_catalogs: loadedCatalogs,
      rejected_supplier_requests: parsed?.rejected_supplier_requests || [],
      timer_settings: parsed?.timer_settings || INITIAL_TIMER_SETTINGS,
      chat_messages: parsed?.chat_messages || INITIAL_CHAT_MESSAGES,
    };
  }

  private emitRealtimeDiffEvents(
    prevReqIds: Set<string>,
    prevQuoteIds: Set<string>,
    prevConfirmedOrderIds: Set<string>,
    prevSupplierConfirmedReceiptOrderIds: Set<string>,
    prevChatIds: Set<string>
  ) {
    if (typeof window === 'undefined') return;
    const now = Date.now();
    this.data.requests.forEach(req => {
      if (
        !prevReqIds.has(req.id) &&
        (req.status === 'aguardando_orcamentos' || req.status === 'orcamentos_recebidos') &&
        now - new Date(req.createdAt).getTime() < 30 * 60 * 1000
      ) {
        window.dispatchEvent(new CustomEvent('compe:new_request', { detail: req }));
      }
    });
    this.data.quotes.forEach(quote => {
      if (!prevQuoteIds.has(quote.id)) {
        window.dispatchEvent(new CustomEvent('compe:new_quote', { detail: quote }));
      }
    });
    this.data.orders_and_payments.forEach(order => {
      if (
        order.paymentStatus === 'confirmado' &&
        order.supplierReceiptConfirmed !== true &&
        !prevConfirmedOrderIds.has(order.id)
      ) {
        window.dispatchEvent(new CustomEvent('compe:order_paid', { detail: order }));
      }
      if (
        order.paymentStatus === 'confirmado' &&
        order.supplierReceiptConfirmed === true &&
        !prevSupplierConfirmedReceiptOrderIds.has(order.id)
      ) {
        window.dispatchEvent(new CustomEvent('compe:supplier_confirmed_payment', { detail: order }));
      }
    });
    (this.data.chat_messages || []).forEach(msg => {
      if (
        msg?.id &&
        !prevChatIds.has(msg.id) &&
        now - new Date(msg.createdAt).getTime() < 15 * 60 * 1000
      ) {
        window.dispatchEvent(new CustomEvent('compe:chat_message', { detail: msg }));
      }
    });
  }

  applyServerSnapshot(serverData: unknown, revision?: number): void {
    if (!serverData) return;
    const prevReqIds = new Set(this.data.requests.map(r => r.id));
    const prevQuoteIds = new Set(this.data.quotes.map(q => q.id));
    const prevConfirmedOrderIds = new Set(
      this.data.orders_and_payments
        .filter(o => o.paymentStatus === 'confirmado')
        .map(o => o.id)
    );
    const prevSupplierConfirmedReceiptOrderIds = new Set(
      this.data.orders_and_payments
        .filter(o => o.paymentStatus === 'confirmado' && o.supplierReceiptConfirmed === true)
        .map(o => o.id)
    );
    const prevChatIds = new Set((this.data.chat_messages || []).map(m => m.id));
    this.data = this.mergeParsedSchema(serverData);
    if (typeof revision === 'number' && revision > this.serverRevision) {
      this.serverRevision = revision;
    }
    this.writeLocalCache();
    this.notify();
    this.emitRealtimeDiffEvents(
      prevReqIds,
      prevQuoteIds,
      prevConfirmedOrderIds,
      prevSupplierConfirmedReceiptOrderIds,
      prevChatIds
    );
  }

  private writeLocalCache() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      try {
        if (this.data.audit_logs.length > 80) {
          this.data.audit_logs = this.data.audit_logs.slice(0, 80);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
        }
      } catch (err) {
        console.warn('localStorage indisponível/cheio neste dispositivo; operando com memória + servidor:', err);
      }
    }
  }

  private async checkServerVersionAndSync(): Promise<void> {
    if (typeof window === 'undefined' || this.pushPending || this.isPushing) return;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(apiUrl('/api/db/version'), {
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) return;
      const info = (await res.json()) as { empty?: boolean; revision?: number };
      if (typeof info.revision === 'number' && info.revision > this.serverRevision) {
        await this.syncFromServer(true);
      }
    } catch {
      // Offline ou servidor indisponível momentaneamente
    }
  }

  async syncFromServer(force = false): Promise<void> {
    if (typeof window === 'undefined') return;
    if (this.syncInFlight && !force) return this.syncInFlight;

    const run = async () => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4500);
        const res = await fetch(apiUrl('/api/db'), {
          cache: 'no-store',
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!res.ok) return;

        const payload = (await res.json()) as {
          empty?: boolean;
          revision?: number;
          deletedUserIds?: string[];
          data?: unknown;
        };

        if (Array.isArray(payload.deletedUserIds)) {
          payload.deletedUserIds.forEach(id => this.deletedUserIds.add(id));
        }

        const remoteRevision = typeof payload.revision === 'number' ? payload.revision : 0;
        if (payload.data && (force || remoteRevision > this.serverRevision)) {
          this.applyServerSnapshot(payload.data, remoteRevision);
        }
      } catch {
        // Mantém operação local caso falhe
      } finally {
        this.syncInFlight = null;
      }
    };

    this.syncInFlight = run();
    return this.syncInFlight;
  }

  private cancelPendingPush() {
    if (this.pushTimer) {
      clearTimeout(this.pushTimer);
      this.pushTimer = null;
    }
    this.pushPending = false;
  }

  private schedulePushToServer() {
    if (typeof window === 'undefined') return;
    this.pushPending = true;
    if (this.pushTimer) {
      clearTimeout(this.pushTimer);
    }
    this.pushTimer = setTimeout(() => {
      this.pushTimer = null;
      void this.pushToServerNow();
    }, 50);
  }

  async pushToServerNow(): Promise<void> {
    if (typeof window === 'undefined') return;
    if (this.isPushing) {
      this.pushPending = true;
      return;
    }
    this.isPushing = true;
    this.pushPending = false;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(apiUrl('/api/db'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientRevision: this.serverRevision,
          deletedUserIds: Array.from(this.deletedUserIds),
          deletedRequestIds: Array.from(this.deletedRequestIds),
          deletedOrderIds: Array.from(this.deletedOrderIds),
          data: this.data,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) {
        const result = (await res.json()) as { revision?: number; data?: DatabaseSchema };
        if (typeof result.revision === 'number') {
          this.serverRevision = result.revision;
        }
        if (result.data) {
          this.data = this.mergeParsedSchema(result.data);
          this.writeLocalCache();
          this.notify();
        }
      }
    } catch {
      // Fallback silencioso para localStorage
    } finally {
      this.isPushing = false;
      if (this.pushPending) {
        void this.pushToServerNow();
      }
    }
  }

  private syncUserCreationToServer(user: User) {
    if (typeof window === 'undefined') return;
    void fetch(apiUrl('/api/users'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user),
    })
      .then(async res => {
        if (!res.ok) return;
        const json = (await res.json()) as { revision?: number; data?: DatabaseSchema };
        if (json.data) {
          this.applyServerSnapshot(json.data, json.revision);
        }
      })
      .catch(() => {
        // fallback via pushToServerNow
      });
  }

  private syncUserPatchToServer(userId: string, patch: Partial<User>) {
    if (typeof window === 'undefined') return;
    void fetch(apiUrl(`/api/users/${encodeURIComponent(userId)}`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
      .then(async res => {
        if (!res.ok) return;
        const json = (await res.json()) as { revision?: number };
        if (typeof json.revision === 'number' && json.revision > this.serverRevision) {
          this.serverRevision = json.revision;
        }
      })
      .catch(() => {
        // fallback via pushToServerNow
      });
  }

  private syncUserDeleteToServer(userId: string) {
    if (typeof window === 'undefined') return;
    void fetch(apiUrl(`/api/users/${encodeURIComponent(userId)}`), {
      method: 'DELETE',
    })
      .then(async res => {
        if (!res.ok) return;
        const json = (await res.json()) as { revision?: number };
        if (typeof json.revision === 'number' && json.revision > this.serverRevision) {
          this.serverRevision = json.revision;
        }
      })
      .catch(() => {
        // fallback via pushToServerNow
      });
  }

  private async syncRequestCreationToServer(request: PartRequest): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      const res = await fetch(apiUrl('/api/requests'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ customerId: request.customerId, request }),
      });
      if (!res.ok) {
        this.schedulePushToServer();
        return;
      }
      const json = (await res.json()) as { revision?: number; data?: DatabaseSchema };
      this.pendingLocalRequests.delete(request.id);
      if (json.data) {
        this.applyServerSnapshot(json.data, json.revision);
      }
    } catch {
      this.schedulePushToServer();
    }
  }

  private async syncRequestRetryToServer(requestId: string, customerId: string): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      const res = await fetch(apiUrl(`/api/requests/${encodeURIComponent(requestId)}/retry`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ customerId }),
      });
      if (!res.ok) {
        this.schedulePushToServer();
        return;
      }
      const json = (await res.json()) as { revision?: number; data?: DatabaseSchema };
      if (json.data) {
        this.applyServerSnapshot(json.data, json.revision);
      }
    } catch {
      this.schedulePushToServer();
    }
  }

  private async syncRequestRejectToServer(supplierId: string, requestId: string): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      const res = await fetch(apiUrl(`/api/requests/${encodeURIComponent(requestId)}/reject`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ supplierId }),
      });
      if (res.ok) {
        const json = (await res.json()) as { revision?: number };
        if (typeof json.revision === 'number' && json.revision > this.serverRevision) {
          this.serverRevision = json.revision;
        }
      } else {
        this.schedulePushToServer();
      }
    } catch {
      this.schedulePushToServer();
    }
  }

  private async syncQuoteCreationToServer(quote: Quote): Promise<{ ok: boolean; status: number; message?: string }> {
    if (typeof window === 'undefined') return { ok: true, status: 201 };
    try {
      const res = await fetch(apiUrl('/api/quotes'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ supplierId: quote.supplierId, quote }),
      });
      const json = await this.parseJsonSafe<{
        ok?: boolean;
        message?: string;
        revision?: number;
        data?: DatabaseSchema;
      }>(res);

      if (res.ok && json?.ok) {
        this.pendingLocalQuotes.delete(quote.id);
        if (json.data) {
          this.applyServerSnapshot(json.data, json.revision);
        }
        return { ok: true, status: res.status };
      }

      if (res.status >= 400 && res.status < 500 && res.status !== 404) {
        return {
          ok: false,
          status: res.status,
          message: json?.message || 'Não foi possível enviar a proposta de orçamento.',
        };
      }

      this.schedulePushToServer();
      return { ok: true, status: res.status };
    } catch {
      this.schedulePushToServer();
      return { ok: true, status: 0 };
    }
  }

  private load(): DatabaseSchema {
    if (typeof window === 'undefined') {
      return this.getDefaults();
    }
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return this.mergeParsedSchema(parsed);
      }
    } catch (e) {
      console.error('Error loading AUTO SHOP DB from localStorage:', e);
    }
    return this.getDefaults();
  }

  private getDefaults(): DatabaseSchema {
    return createInitialDatabaseSchema();
  }

  private saveLocalOnly() {
    this.writeLocalCache();
    this.notify();
  }

  private save() {
    this.writeLocalCache();
    this.schedulePushToServer();
    this.notify();
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(fn => fn());
  }

  // --- GETTERS ---
  getUsers(): User[] {
    return this.data.users;
  }

  getUserById(id: string): User | undefined {
    return this.data.users.find(u => u.id === id);
  }

  getUserByPhone(phone: string): User | undefined {
    return this.data.users.find(u => brPhonesMatch(u.phone, phone));
  }

  isUserDeleted(userId: string): boolean {
    return this.deletedUserIds.has(userId);
  }

  getVehicles(userId?: string): Vehicle[] {
    if (!userId) return this.data.vehicles;
    return this.data.vehicles.filter(v => v.userId === userId);
  }

  getCatalog(): CatalogPart[] {
    return this.data.catalog_parts;
  }

  // --- ADMIN CATEGORIES & SUBCATEGORIES CRUD ---
  getCategories(): AdminCategory[] {
    if (!this.data.categories || this.data.categories.length === 0) {
      this.data.categories = INITIAL_CATEGORIES;
    }
    return this.data.categories;
  }

  addCategory(name: string, vehicleType: VehicleCategory | undefined, adminId: string): AdminCategory {
    if (!this.data.categories) {
      this.data.categories = [...INITIAL_CATEGORIES];
    }
    const newCat: AdminCategory = {
      id: `cat_adm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: name.trim(),
      vehicleType: vehicleType || 'carro',
      subcategories: [],
      createdAt: new Date().toISOString(),
    };
    this.data.categories.push(newCat);
    this.logAudit(adminId, 'Criação de Categoria', 'spam_config', newCat.id, `Categoria "${newCat.name}" criada pelo Administrador.`);
    this.save();
    return newCat;
  }

  updateCategory(categoryId: string, updates: { name?: string; vehicleType?: VehicleCategory }, adminId: string) {
    const cat = this.getCategories().find(c => c.id === categoryId);
    if (!cat) return;
    if (updates.name !== undefined) cat.name = updates.name.trim();
    if (updates.vehicleType !== undefined) cat.vehicleType = updates.vehicleType;
    this.logAudit(adminId, 'Edição de Categoria', 'spam_config', categoryId, `Categoria "${cat.name}" atualizada.`);
    this.save();
  }

  deleteCategory(categoryId: string, adminId: string) {
    const cat = this.getCategories().find(c => c.id === categoryId);
    this.data.categories = this.getCategories().filter(c => c.id !== categoryId);
    this.logAudit(adminId, 'Exclusão de Categoria', 'spam_config', categoryId, `Categoria "${cat?.name || categoryId}" removida.`);
    this.save();
  }

  addSubcategory(categoryId: string, name: string, adminId: string) {
    const cat = this.getCategories().find(c => c.id === categoryId);
    if (!cat || !name.trim()) return;
    const sub = {
      id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: name.trim(),
    };
    cat.subcategories.push(sub);
    this.logAudit(adminId, 'Criação de Subcategoria', 'spam_config', categoryId, `Subcategoria "${sub.name}" adicionada em "${cat.name}".`);
    this.save();
    return sub;
  }

  updateSubcategory(categoryId: string, subcategoryId: string, name: string, adminId: string) {
    const cat = this.getCategories().find(c => c.id === categoryId);
    const sub = cat?.subcategories.find(s => s.id === subcategoryId);
    if (!cat || !sub || !name.trim()) return;
    sub.name = name.trim();
    this.logAudit(adminId, 'Edição de Subcategoria', 'spam_config', subcategoryId, `Subcategoria "${sub.name}" atualizada em "${cat.name}".`);
    this.save();
  }

  deleteSubcategory(categoryId: string, subcategoryId: string, adminId: string) {
    const cat = this.getCategories().find(c => c.id === categoryId);
    if (!cat) return;
    const sub = cat.subcategories.find(s => s.id === subcategoryId);
    cat.subcategories = cat.subcategories.filter(s => s.id !== subcategoryId);
    this.logAudit(adminId, 'Exclusão de Subcategoria', 'spam_config', subcategoryId, `Subcategoria "${sub?.name || subcategoryId}" removida de "${cat.name}".`);
    this.save();
  }

  getRequests(includeArchived = false): PartRequest[] {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    let list = this.data.requests;
    if (!includeArchived) {
      list = list.filter(r => new Date(r.createdAt).getTime() >= thirtyDaysAgo);
    }
    return [...list].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  getRequestById(id: string): PartRequest | undefined {
    return this.data.requests.find(r => r.id === id);
  }

  sortQuotesAscending(quotes: Quote[]): Quote[] {
    return [...quotes].sort((a, b) => {
      const priceDiff = (Number(a.totalPrice) || 0) - (Number(b.totalPrice) || 0);
      if (priceDiff !== 0) return priceDiff;
      const partDiff = (Number(a.partPrice) || 0) - (Number(b.partPrice) || 0);
      if (partDiff !== 0) return partDiff;
      return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
    });
  }

  getQuotes(requestId?: string): Quote[] {
    if (!requestId) return this.data.quotes;
    return this.sortQuotesAscending(this.data.quotes.filter(q => q.requestId === requestId));
  }

  getTopQuotesForRequest(requestId: string): Quote[] {
    // Estritamente ordenadas em ordem crescente (menor preço no topo) sem cortar respostas dos fornecedores
    return this.getQuotes(requestId);
  }

  getOrders(includeArchived = false): OrderAndPayment[] {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    let list = this.data.orders_and_payments;
    if (!includeArchived) {
      list = list.filter(o => new Date(o.createdAt).getTime() >= thirtyDaysAgo);
    }
    return [...list].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  // §6 Arquivo Morto (> 30 dias salvo permanentemente no painel do Administrador)
  getArchivedRecords(): { requests: PartRequest[]; orders: OrderAndPayment[] } {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return {
      requests: this.data.requests.filter(r => new Date(r.createdAt).getTime() < thirtyDaysAgo),
      orders: this.data.orders_and_payments.filter(o => new Date(o.createdAt).getTime() < thirtyDaysAgo),
    };
  }

  getOrderById(id: string): OrderAndPayment | undefined {
    return this.data.orders_and_payments.find(o => o.id === id);
  }

  getSplitTransactions(): SplitTransaction[] {
    const list = this.data.split_transactions || [];
    return [...list].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  private async parseJsonSafe<T>(res: Response): Promise<T | null> {
    try {
      const text = await res.text();
      if (!text) return null;
      return JSON.parse(text) as T;
    } catch {
      return null;
    }
  }

  async registerSupplierSubaccountRemote(
    supplierId: string,
    payload: {
      provider?: PaymentGatewayProvider;
      pixKey?: string;
      walletId?: string;
      subaccountId?: string;
      bankInfo?: GatewayBankInfo;
      email?: string;
      actorId?: string;
    }
  ): Promise<{ ok: boolean; message: string; user?: User }> {
    try {
      const res = await fetch(apiUrl('/api/payments/subaccounts'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ supplierId, ...payload }),
      });
      const json = await this.parseJsonSafe<{
        ok?: boolean;
        message?: string;
        user?: User;
        revision?: number;
        data?: DatabaseSchema;
      }>(res);

      if (json && res.ok && json.ok) {
        if (json.data) {
          this.applyServerSnapshot(json.data, json.revision);
        } else {
          await this.syncFromServer(true);
        }
        return {
          ok: true,
          message: json.message || 'Subconta configurada com sucesso!',
          user: json.user,
        };
      }

      if (json && res.status >= 400 && res.status < 500 && res.status !== 404) {
        return {
          ok: false,
          message: json.message || 'Falha ao configurar subconta do fornecedor no gateway.',
        };
      }
    } catch {
      // Continua para atualização local + sincronização
    }

    const updated = this.updateUser(
      supplierId,
      {
        gatewayProvider: payload.provider || 'asaas',
        gatewayPixKey: payload.pixKey?.trim() || undefined,
        bankAccountOrPix: payload.pixKey?.trim() || undefined,
        gatewayWalletId: payload.walletId?.trim() || undefined,
        gatewaySubaccountId: payload.subaccountId?.trim() || undefined,
        gatewayBankInfo: payload.bankInfo,
        gatewayAccountStatus: payload.walletId?.trim()
          ? 'ativa'
          : payload.pixKey?.trim() || payload.bankInfo?.account
          ? 'em_analise'
          : 'nao_configurada',
      },
      payload.actorId || supplierId
    );
    if (!updated) {
      return { ok: false, message: 'Fornecedor não encontrado para configurar subconta.' };
    }
    return {
      ok: true,
      message: 'Dados de subconta salvos localmente e enfileirados para sincronização.',
      user: updated,
    };
  }

  async updateSplitStatusRemote(
    splitId: string,
    status: SplitPaymentStatus,
    adminId: string,
    notes?: string
  ): Promise<{ ok: boolean; message?: string }> {
    try {
      const res = await fetch(apiUrl(`/api/payments/splits/${encodeURIComponent(splitId)}/status`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ status, adminId, notes }),
      });
      const json = await this.parseJsonSafe<{
        ok?: boolean;
        message?: string;
        revision?: number;
        data?: DatabaseSchema;
      }>(res);

      if (json && res.ok && json.ok) {
        if (json.data) {
          this.applyServerSnapshot(json.data, json.revision);
        } else {
          await this.syncFromServer(true);
        }
        return { ok: true };
      }

      if (json && res.status >= 400 && res.status < 500 && res.status !== 404) {
        return { ok: false, message: json.message || 'Não foi possível atualizar o status do split.' };
      }
    } catch {
      // Fallback local abaixo
    }

    const splitTx = (this.data.split_transactions || []).find(s => s.id === splitId);
    if (!splitTx) {
      return { ok: false, message: 'Transação de split não encontrada.' };
    }
    const nowIso = new Date().toISOString();
    splitTx.status = status;
    splitTx.updatedAt = nowIso;
    if (notes !== undefined) splitTx.notes = notes;
    if (status === 'repassado') splitTx.transferredAt = nowIso;

    const linkedOrder = this.data.orders_and_payments.find(o => o.id === splitTx.orderId);
    if (linkedOrder) {
      linkedOrder.splitStatus = status;
      if (status === 'repassado') {
        linkedOrder.supplierReceiptConfirmed = true;
        linkedOrder.supplierReceiptConfirmedAt = linkedOrder.supplierReceiptConfirmedAt || nowIso;
      } else if (status === 'estornado') {
        linkedOrder.paymentStatus = 'estornado';
      }
    }
    this.save();
    return { ok: true };
  }

  async createOrderWithSplit(
    customerId: string,
    quoteId: string,
    paymentMethod: PaymentMethod,
    preferredProvider?: PaymentGatewayProvider
  ): Promise<OrderAndPayment> {
    try {
      const res = await fetch(apiUrl('/api/orders'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          customerId,
          quoteId,
          paymentMethod,
          preferredProvider,
        }),
      });
      const json = await this.parseJsonSafe<{
        ok?: boolean;
        message?: string;
        order?: OrderAndPayment;
        revision?: number;
        data?: DatabaseSchema;
      }>(res);
      if (res.ok && json?.ok && json.order) {
        if (json.data) {
          this.applyServerSnapshot(json.data, json.revision);
        } else {
          await this.syncFromServer(true);
        }
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('compe:order_paid', { detail: json.order }));
        }
        return json.order;
      }
      if (json && res.status >= 400 && res.status < 500 && res.status !== 404) {
        throw new Error(json.message || 'Falha ao processar pagamento com split.');
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('pago')) {
        throw err;
      }
      // Fallback local somente se o servidor estiver temporariamente inacessível
    }
    return this.createOrder(customerId, quoteId, paymentMethod);
  }

  getSpamsConfig(): SpamTriggerConfig[] {
    return this.data.spams_config;
  }

  getAuditLogs(): AuditLog[] {
    return [...this.data.audit_logs].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  getCommissionSettings(): CommissionSettings {
    return this.data.commission_settings;
  }

  getCustomizationSettings(): AppCustomizationSettings {
    return this.mergeCustomizationSettings(this.data.customization_settings);
  }

  updateCustomizationSettings(settings: Partial<AppCustomizationSettings>, adminId: string): AppCustomizationSettings {
    this.data.customization_settings = this.mergeCustomizationSettings({
      ...(this.data.customization_settings || INITIAL_CUSTOMIZATION_SETTINGS),
      ...settings,
    });

    if (typeof document !== 'undefined' && settings.faviconUrl !== undefined) {
      const fav = settings.faviconUrl || '/assets/aistudio/M1_AUTO_LOGO_3c381c58.jpg';
      let link = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = fav;
    }

    this.logAudit(
      adminId,
      'Personalização de Logotipo, Favicon, Fontes, Cores e Textos Atualizada',
      'spam_config',
      'customization',
      `Fonte: ${this.data.customization_settings.fontFamily}, Cor: ${this.data.customization_settings.primaryBrandColor}, Logo: ${this.data.customization_settings.logoUrl ? 'Personalizado' : 'Padrão'}`
    );
    this.save();
    return this.data.customization_settings;
  }

  resetCustomizationSettings(adminId: string): AppCustomizationSettings {
    this.data.customization_settings = { ...INITIAL_CUSTOMIZATION_SETTINGS };
    this.logAudit(
      adminId,
      'Restauração de Textos e Cores Oficiais',
      'spam_config',
      'customization',
      'Fontes, cores e textos restaurados para o padrão oficial AUTO SHOP'
    );
    this.save();
    return this.data.customization_settings;
  }

  getEvaluations(): Evaluation[] {
    return this.data.evaluations;
  }

  // --- ACTIONS & AUDITING ---

  logAudit(
    userId: string,
    action: string,
    entityType: AuditLog['entityType'],
    entityId: string,
    details: string
  ) {
    const user = this.getUserById(userId);
    const newLog: AuditLog = {
      id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      userId,
      userPhone: user ? user.phone : 'sistema',
      userRole: user ? user.role : 'admin',
      action,
      entityType,
      entityId,
      details,
      ipAddress: '189.28.140.' + Math.floor(Math.random() * 200 + 10),
    };
    this.data.audit_logs.unshift(newLog);
    this.save();
  }

  // User Registration & Status
  createUser(userData: Omit<User, 'id' | 'createdAt' | 'lastLogin'>, skipRemotePost = false): User {
    const isPendingSupplier = userData.role === 'fornecedor' && userData.status !== 'ativo';
    const hasExplicitCoords = Boolean(userData.coordinates || userData.address?.coordinates);
    const resolvedCoords =
      userData.coordinates ||
      userData.address?.coordinates ||
      (isValidCep(userData.address?.cep)
        ? estimateCoordinatesFromCep(userData.address?.cep, userData.address?.state)
        : undefined);
    const resolvedPrecision: User['coordinatesPrecision'] = hasExplicitCoords
      ? userData.coordinatesPrecision || userData.address?.coordinatesPrecision || 'exact_cep'
      : isValidCep(userData.address?.cep)
      ? 'cep_prefix'
      : undefined;
    const normalizedAddress = userData.address
      ? {
          ...userData.address,
          coordinates: userData.address.coordinates || resolvedCoords,
          coordinatesPrecision: userData.address.coordinatesPrecision || resolvedPrecision,
        }
      : undefined;

    const canonicalPhone = normalizeBrPhoneDigits(userData.phone) || userData.phone.replace(/\D/g, '');
    const newUser: User = {
      ...userData,
      phone: canonicalPhone,
      address: normalizedAddress,
      coordinates: resolvedCoords,
      coordinatesPrecision: resolvedPrecision,
      password: userData.password,
      isAvailableForOrders: isPendingSupplier ? false : userData.isAvailableForOrders,
      isClassifiedByAdmin:
        userData.role === 'fornecedor'
          ? Boolean(userData.supplierTier && userData.status === 'ativo' && userData.isClassifiedByAdmin !== false)
          : undefined,
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
    };
    this.deletedUserIds.delete(newUser.id);
    this.data.users.push(newUser);
    this.logAudit(newUser.id, 'Cadastro de Usuário', 'user', newUser.id, `Novo usuário (${newUser.role}) cadastrado: ${newUser.name}.`);
    this.save();
    if (!skipRemotePost) {
      this.syncUserCreationToServer(newUser);
    }
    if (
      isValidCep(newUser.address?.cep) &&
      newUser.coordinatesPrecision !== 'gps' &&
      newUser.coordinatesPrecision !== 'exact_cep'
    ) {
      void this.hydrateUserCepCoordinates(newUser.id);
    }
    return newUser;
  }

  async hydrateUserCepCoordinates(userId: string): Promise<void> {
    const user = this.getUserById(userId);
    if (!user || !user.address?.cep || !isValidCep(user.address.cep)) return;
    if (user.coordinatesPrecision === 'gps') return;
    const geo = await lookupAddressAndGeoByCep(user.address.cep);
    if (geo.success && geo.coordinatesPrecision === 'exact_cep') {
      const current = this.getUserById(userId);
      if (!current || current.coordinatesPrecision === 'gps') return;
      current.coordinates = geo.coordinates;
      current.coordinatesPrecision = 'exact_cep';
      if (current.address) {
        current.address.coordinates = geo.coordinates;
        current.address.coordinatesPrecision = 'exact_cep';
      }
      this.save();
      this.syncUserPatchToServer(userId, {
        coordinates: current.coordinates,
        coordinatesPrecision: 'exact_cep',
        address: current.address,
      });
    }
  }

  updateUser(userId: string, data: Partial<User>, adminId?: string): User | undefined {
    const user = this.getUserById(userId);
    if (!user) return undefined;
    const prevCep = cleanCepDigits(user.address?.cep);
    const nextCep = data.address?.cep ? cleanCepDigits(data.address.cep) : prevCep;
    const cepChanged = Boolean(data.address?.cep && nextCep !== prevCep);

    Object.assign(user, data);
    if (data.address?.coordinates) {
      user.coordinates = data.address.coordinates;
      user.coordinatesPrecision = data.coordinatesPrecision || data.address.coordinatesPrecision || 'exact_cep';
    } else if (data.coordinates && user.address) {
      user.address.coordinates = data.coordinates;
      user.coordinatesPrecision = data.coordinatesPrecision || 'exact_cep';
      user.address.coordinatesPrecision = user.coordinatesPrecision;
    } else if (cepChanged && isValidCep(user.address?.cep)) {
      const geo = estimateCoordinatesFromCep(user.address?.cep, user.address?.state);
      user.coordinates = geo;
      user.coordinatesPrecision = 'cep_prefix';
      if (user.address) {
        user.address.coordinates = geo;
        user.address.coordinatesPrecision = 'cep_prefix';
      }
    } else if (!user.coordinates && isValidCep(user.address?.cep)) {
      const geo = estimateCoordinatesFromCep(user.address?.cep, user.address?.state);
      user.coordinates = geo;
      user.coordinatesPrecision = 'cep_prefix';
      if (user.address) {
        user.address.coordinates = geo;
        user.address.coordinatesPrecision = 'cep_prefix';
      }
    }
    this.logAudit(
      adminId || userId,
      'Edição de Dados de Usuário',
      'user',
      userId,
      `Dados do usuário ${user.name} (${user.role}) foram atualizados no sistema.`
    );
    this.save();
    this.syncUserPatchToServer(userId, {
      ...data,
      coordinates: user.coordinates,
      coordinatesPrecision: user.coordinatesPrecision,
      address: user.address,
    });
    if (
      isValidCep(user.address?.cep) &&
      (cepChanged || (user.coordinatesPrecision !== 'gps' && user.coordinatesPrecision !== 'exact_cep'))
    ) {
      void this.hydrateUserCepCoordinates(userId);
    }
    return user;
  }

  updateUserGpsCoordinates(
    userId: string,
    coords: { lat: number; lng: number }
  ): User | undefined {
    const user = this.getUserById(userId);
    if (!user) return undefined;
    user.coordinates = { lat: Number(coords.lat.toFixed(5)), lng: Number(coords.lng.toFixed(5)) };
    user.coordinatesPrecision = 'gps';
    user.gpsVerifiedAt = new Date().toISOString();
    if (user.address) {
      user.address.coordinates = { ...user.coordinates };
      user.address.coordinatesPrecision = 'gps';
    }
    this.save();
    this.syncUserPatchToServer(userId, {
      coordinates: user.coordinates,
      coordinatesPrecision: 'gps',
      gpsVerifiedAt: user.gpsVerifiedAt,
      address: user.address,
    });
    return user;
  }

  deleteUser(userId: string, adminId?: string): boolean {
    const index = this.data.users.findIndex(u => u.id === userId);
    if (index === -1) return false;
    const deletedUser = this.data.users[index];
    this.deletedUserIds.add(userId);
    this.data.users.splice(index, 1);
    this.logAudit(
      adminId || 'sistema',
      'Exclusão de Usuário',
      'user',
      userId,
      `Usuário ${deletedUser.name} (${deletedUser.role}) foi removido permanentemente do banco de dados.`
    );
    this.save();
    this.syncUserDeleteToServer(userId);
    return true;
  }

  // Versões atômicas aguardáveis para criação, edição, exclusão e importação de usuários
  async createUserRemote(
    userData: Omit<User, 'id' | 'createdAt' | 'lastLogin'>,
    adminId?: string
  ): Promise<{ ok: boolean; user?: User; message?: string }> {
    const cleanPhone = normalizeBrPhoneDigits(userData.phone) || userData.phone.replace(/\D/g, '');
    const cleanDoc = (userData.document || '').replace(/\D/g, '');
    const dupPhone = this.data.users.find(u => brPhonesMatch(u.phone, cleanPhone));
    if (dupPhone) {
      return { ok: false, message: 'Já existe uma conta cadastrada com este celular.' };
    }
    if (cleanDoc.length >= 11) {
      const dupDoc = this.data.users.find(u => (u.document || '').replace(/\D/g, '') === cleanDoc);
      if (dupDoc) {
        return { ok: false, message: 'Já existe uma conta cadastrada com este CPF/CNPJ.' };
      }
    }

    const tempUser = this.createUser(userData, true);
    if (adminId) {
      this.logAudit(adminId, 'Cadastro Central de Usuário', 'user', tempUser.id, `Admin cadastrou ${tempUser.name} (${tempUser.role}).`);
    }

    if (typeof window === 'undefined') {
      return { ok: true, user: tempUser };
    }

    try {
      this.cancelPendingPush();
      const res = await fetch(apiUrl('/api/users'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        cache: 'no-store',
        body: JSON.stringify(tempUser),
      });
      const json = await this.parseJsonSafe<{
        ok?: boolean;
        message?: string;
        user?: User;
        revision?: number;
        data?: DatabaseSchema;
      }>(res);

      if (res.status === 409 || (res.status >= 400 && res.status < 500 && res.status !== 404)) {
        // Reverte item otimista se servidor rejeitou duplicidade ou dados inválidos
        this.data.users = this.data.users.filter(u => u.id !== tempUser.id);
        this.saveLocalOnly();
        return { ok: false, message: json?.message || 'Não foi possível criar o usuário no servidor.' };
      }

      if (res.ok && json?.ok) {
        if (json.data) {
          this.applyServerSnapshot(json.data, json.revision);
        }
        return { ok: true, user: json.user || this.getUserById(tempUser.id) || tempUser };
      }
    } catch {
      // Fallback para PUT /api/db
    }

    await this.pushToServerNow();
    return { ok: true, user: this.getUserById(tempUser.id) || tempUser };
  }

  async updateUserRemote(
    userId: string,
    data: Partial<User>,
    adminId?: string
  ): Promise<{ ok: boolean; user?: User; message?: string }> {
    const existing = this.getUserById(userId);
    if (!existing) {
      return { ok: false, message: 'Usuário não encontrado.' };
    }

    if (typeof window !== 'undefined') {
      try {
        this.cancelPendingPush();
        const res = await fetch(apiUrl(`/api/users/${encodeURIComponent(userId)}`), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          cache: 'no-store',
          body: JSON.stringify(data),
        });
        const json = await this.parseJsonSafe<{
          ok?: boolean;
          message?: string;
          user?: User;
          revision?: number;
          data?: DatabaseSchema;
        }>(res);

        if (res.status >= 400 && res.status < 500 && res.status !== 404) {
          return { ok: false, message: json?.message || 'Erro ao atualizar usuário.' };
        }

        if (res.ok && json?.ok) {
          if (json.data) {
            this.applyServerSnapshot(json.data, json.revision);
          } else {
            const updatedLocal = this.updateUser(userId, data, adminId);
            if (typeof json.revision === 'number' && json.revision > this.serverRevision) {
              this.serverRevision = json.revision;
            }
            return { ok: true, user: json.user || updatedLocal };
          }
          if (adminId) {
            this.logAudit(adminId, 'Edição de Dados de Usuário', 'user', userId, `Dados de ${json.user?.name || existing.name} atualizados.`);
          }
          return { ok: true, user: json.user || this.getUserById(userId) };
        }
      } catch {
        // fallback abaixo
      }
    }

    const updated = this.updateUser(userId, data, adminId);
    await this.pushToServerNow();
    return { ok: true, user: updated };
  }

  async deleteUserRemote(userId: string, adminId?: string): Promise<{ ok: boolean; message?: string }> {
    const removed = this.deleteUser(userId, adminId);
    if (!removed) {
      return { ok: false, message: 'Usuário não encontrado.' };
    }
    if (typeof window !== 'undefined') {
      try {
        this.cancelPendingPush();
        const res = await fetch(apiUrl(`/api/users/${encodeURIComponent(userId)}`), {
          method: 'DELETE',
          cache: 'no-store',
        });
        const json = await this.parseJsonSafe<{ ok?: boolean; revision?: number }>(res);
        if (res.ok && typeof json?.revision === 'number' && json.revision > this.serverRevision) {
          this.serverRevision = json.revision;
        }
        return { ok: true };
      } catch {
        // fallback
      }
    }
    await this.pushToServerNow();
    return { ok: true };
  }

  async importUsersRemote(
    rows: Array<Record<string, unknown>>,
    mode: 'skip_duplicates' | 'update_existing',
    actorId?: string
  ): Promise<{
    ok: boolean;
    message?: string;
    createdCount: number;
    updatedCount: number;
    skippedDuplicates: number;
    errors: Array<{ row: number; name?: string; phone?: string; reason: string }>;
    duplicateDetails: Array<{ row: number; name?: string; phone?: string; reason: string }>;
  }> {
    try {
      this.cancelPendingPush();
      const res = await fetch(apiUrl('/api/users/import'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ rows, mode, actorId }),
      });
      const json = await this.parseJsonSafe<{
        ok?: boolean;
        message?: string;
        createdCount?: number;
        updatedCount?: number;
        skippedDuplicates?: number;
        errors?: Array<{ row: number; name?: string; phone?: string; reason: string }>;
        duplicateDetails?: Array<{ row: number; name?: string; phone?: string; reason: string }>;
        revision?: number;
        data?: DatabaseSchema;
      }>(res);

      if (!res.ok || !json?.ok) {
        return {
          ok: false,
          message: json?.message || 'Falha ao importar planilha de usuários.',
          createdCount: 0,
          updatedCount: 0,
          skippedDuplicates: 0,
          errors: json?.errors || [],
          duplicateDetails: json?.duplicateDetails || [],
        };
      }

      if (json.data) {
        this.applyServerSnapshot(json.data, json.revision);
      }

      return {
        ok: true,
        createdCount: json.createdCount || 0,
        updatedCount: json.updatedCount || 0,
        skippedDuplicates: json.skippedDuplicates || 0,
        errors: json.errors || [],
        duplicateDetails: json.duplicateDetails || [],
      };
    } catch {
      return {
        ok: false,
        message: 'Erro de conexão com o servidor durante a importação da planilha.',
        createdCount: 0,
        updatedCount: 0,
        skippedDuplicates: 0,
        errors: [],
        duplicateDetails: [],
      };
    }
  }

  updateUserStatus(userId: string, status: User['status'], adminId: string) {
    const user = this.getUserById(userId);
    if (!user) return;
    const oldStatus = user.status;
    user.status = status;
    this.logAudit(adminId, `Alteração de Status de Usuário (${oldStatus} -> ${status})`, 'user', userId, `Admin alterou status do usuário ${user.name}`);
    this.save();
    this.syncUserPatchToServer(userId, { status });
  }

  // --- COMUNICAÇÃO & MENSAGENS (CHAT COM INTERCESSÃO DO ADMIN) ---
  getChatMessages(filter?: { requestId?: string; orderId?: string }): ChatMessage[] {
    let list = this.data.chat_messages || INITIAL_CHAT_MESSAGES;
    if (filter?.requestId) {
      list = list.filter(m => m.requestId === filter.requestId);
    }
    if (filter?.orderId) {
      list = list.filter(m => m.orderId === filter.orderId);
    }
    return [...list].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  private async syncChatMessageToServer(newMsg: ChatMessage): Promise<{ ok: boolean; chatMessage?: ChatMessage; message?: string }> {
    if (typeof window === 'undefined') return { ok: true, chatMessage: newMsg };
    try {
      this.cancelPendingPush();
      const res = await fetch(apiUrl('/api/chat/messages'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        cache: 'no-store',
        body: JSON.stringify(newMsg),
      });
      const json = await this.parseJsonSafe<{
        ok?: boolean;
        message?: string;
        chatMessage?: ChatMessage;
        revision?: number;
        data?: DatabaseSchema;
      }>(res);
      if (res.ok && json?.ok) {
        if (json.data) {
          this.applyServerSnapshot(json.data, json.revision);
        }
        return { ok: true, chatMessage: json.chatMessage || newMsg };
      }
      if (res.status >= 400 && res.status < 500 && res.status !== 404) {
        return { ok: false, message: json?.message || 'Erro ao enviar mensagem.' };
      }
    } catch {
      // fallback abaixo
    }
    this.schedulePushToServer();
    return { ok: true, chatMessage: newMsg };
  }

  sendChatMessage(msg: Omit<ChatMessage, 'id' | 'createdAt'>): ChatMessage {
    if (!this.data.chat_messages) {
      this.data.chat_messages = [...INITIAL_CHAT_MESSAGES];
    }
    const newMsg: ChatMessage = {
      ...msg,
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      readByUserIds: [msg.senderId],
      createdAt: new Date().toISOString(),
    };
    this.data.chat_messages.push(newMsg);
    this.logAudit(
      newMsg.senderId,
      newMsg.isSac ? 'Abertura / Mensagem de SAC' : newMsg.isAdminIntervention ? 'Intercessão Administrativa em Mensagem' : 'Envio de Mensagem no Chat',
      'chat',
      newMsg.orderId || newMsg.requestId || 'geral',
      `${newMsg.isSac ? '[SAC] ' : ''}Mensagem enviada por ${newMsg.senderName} (${newMsg.senderRole}): ${newMsg.message.slice(0, 60)}`
    );
    this.saveLocalOnly();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('compe:chat_message', { detail: newMsg }));
    }
    void this.syncChatMessageToServer(newMsg);
    return newMsg;
  }

  async sendChatMessageRemote(msg: Omit<ChatMessage, 'id' | 'createdAt'>): Promise<{ ok: boolean; chatMessage: ChatMessage; message?: string }> {
    const newMsg = this.sendChatMessage(msg);
    const res = await this.syncChatMessageToServer(newMsg);
    return {
      ok: res.ok,
      chatMessage: res.chatMessage || newMsg,
      message: res.message,
    };
  }

  markThreadAsRead(userId: string, filter: { requestId?: string; orderId?: string; isSac?: boolean }) {
    if (!this.data.chat_messages || !userId) return;
    let changed = false;
    this.data.chat_messages.forEach(m => {
      const matches =
        (filter.isSac && m.isSac) ||
        (filter.orderId && m.orderId === filter.orderId) ||
        (filter.requestId && m.requestId === filter.requestId);
      if (matches) {
        if (!m.readByUserIds) m.readByUserIds = [];
        if (!m.readByUserIds.includes(userId)) {
          m.readByUserIds.push(userId);
          changed = true;
        }
      }
    });
    if (changed) {
      this.saveLocalOnly();
      if (typeof window !== 'undefined') {
        void fetch(apiUrl('/api/chat/read'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, ...filter }),
        })
          .then(res => res.json())
          .then((json: { ok?: boolean; revision?: number }) => {
            if (json?.ok && typeof json.revision === 'number' && json.revision > this.serverRevision) {
              this.serverRevision = json.revision;
            }
          })
          .catch(() => {
            this.schedulePushToServer();
          });
      }
    }
  }

  markAllAdminMessagesRead(adminId: string) {
    if (!this.data.chat_messages || !adminId) return;
    let changed = false;
    this.data.chat_messages.forEach(m => {
      if (!m.readByUserIds) m.readByUserIds = [];
      if (!m.readByUserIds.includes(adminId)) {
        m.readByUserIds.push(adminId);
        changed = true;
      }
    });
    if (changed) {
      this.save();
    }
  }

  getUnreadChatCountForOrder(
    userId: string,
    requestId?: string,
    orderId?: string,
    onlySac = false
  ): number {
    if (!userId) return 0;
    const list = this.data.chat_messages || [];
    return list.filter(m => {
      const matches =
        (orderId && m.orderId === orderId) ||
        (requestId && m.requestId === requestId);
      if (!matches) return false;
      if (onlySac && !m.isSac) return false;
      if (m.senderId === userId) return false;
      return !m.readByUserIds || !m.readByUserIds.includes(userId);
    }).length;
  }

  getUnreadChatCountForUser(userId: string, role: User['role'], onlySac = false): number {
    if (!userId) return 0;
    const list = this.data.chat_messages || [];
    if (role === 'admin') {
      return list.filter(m => {
        if (onlySac && !m.isSac) return false;
        if (m.senderId === userId) return false;
        return !m.readByUserIds || !m.readByUserIds.includes(userId);
      }).length;
    }

    const userOrders = this.data.orders_and_payments.filter(o =>
      role === 'cliente' ? o.customerId === userId : o.supplierId === userId
    );
    const userRequests =
      role === 'cliente'
        ? this.data.requests.filter(r => r.customerId === userId)
        : this.data.requests.filter(r =>
            this.data.quotes.some(q => q.requestId === r.id && q.supplierId === userId)
          );

    const allowedOrderIds = new Set(userOrders.map(o => o.id));
    const allowedRequestIds = new Set([
      ...userOrders.map(o => o.requestId),
      ...userRequests.map(r => r.id),
    ]);

    return list.filter(m => {
      if (onlySac && !m.isSac) return false;
      if (m.senderId === userId) return false;
      if (m.readByUserIds?.includes(userId)) return false;
      if (m.recipientId === userId) return true;
      if (m.orderId && allowedOrderIds.has(m.orderId)) return true;
      if (m.requestId && allowedRequestIds.has(m.requestId)) return true;
      return false;
    }).length;
  }

  setSupplierAvailability(supplierId: string, isAvailable: boolean) {
    const user = this.getUserById(supplierId);
    if (!user || user.role !== 'fornecedor') return;
    user.isAvailableForOrders = isAvailable;
    this.logAudit(supplierId, `Disponibilidade Alterada (${isAvailable ? 'Online' : 'Offline'})`, 'user', supplierId, 'Fornecedor ligou/desligou recebimento de pedidos');
    this.save();
    this.syncUserPatchToServer(supplierId, { isAvailableForOrders: isAvailable });
  }

  setSupplierRadius(supplierId: string, radiusKm: number) {
    const user = this.getUserById(supplierId);
    if (!user || user.role !== 'fornecedor') return;
    user.serviceRadiusKm = radiusKm;
    this.logAudit(
      supplierId,
      'Raio de Atendimento Atualizado pelo Admin',
      'user',
      supplierId,
      `Fornecedor configurou raio de atuação para ${radiusKm === 0 ? 'Sem Limite (Brasil Inteiro)' : `${radiusKm} km`}`
    );
    this.save();
    this.syncUserPatchToServer(supplierId, { serviceRadiusKm: radiusKm });
  }

  isRequestPaid(requestId: string): boolean {
    if (!requestId) return false;
    const req = this.getRequestById(requestId);
    if (req?.status === 'finalizado') return true;
    return (this.data.orders_and_payments || []).some(
      o => o.requestId === requestId && o.paymentStatus === 'confirmado'
    );
  }

  private createStatusHistoryEntry(
    stage: string,
    details: string,
    actorRole: UserRole | 'sistema',
    actorName?: string,
    extra?: { radiusKm?: number; attemptNumber?: number }
  ): RequestStatusHistoryEntry {
    return {
      id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      stage,
      details,
      actorRole,
      actorName,
      radiusKm: extra?.radiusKm,
      attemptNumber: extra?.attemptNumber,
    };
  }

  private appendRequestHistory(
    req: PartRequest | undefined,
    stage: string,
    details: string,
    actorRole: UserRole | 'sistema',
    actorName?: string,
    extra?: { radiusKm?: number; attemptNumber?: number }
  ) {
    if (!req) return;
    if (!req.statusHistory) req.statusHistory = [];
    req.statusHistory.unshift(
      this.createStatusHistoryEntry(stage, details, actorRole, actorName, extra)
    );
  }

  private appendOrderHistory(
    order: OrderAndPayment | undefined,
    stage: string,
    details: string,
    actorRole: UserRole | 'sistema',
    actorName?: string
  ) {
    if (!order) return;
    if (!order.statusHistory) order.statusHistory = [];
    order.statusHistory.unshift(
      this.createStatusHistoryEntry(stage, details, actorRole, actorName)
    );
  }

  isSupplierMatchingRequestCategory(supplier: User, req: PartRequest): boolean {
    const normalizeTxt = (val?: string) =>
      (val || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();

    const isWildcardSub = (normVal: string) =>
      !normVal ||
      normVal === 'outro' ||
      normVal === 'outros' ||
      normVal === 'geral' ||
      normVal === 'todas' ||
      normVal === 'nao sei' ||
      normVal === 'nao sei informar' ||
      normVal === 'outros / nao sei informar' ||
      normVal.includes('nao sei informar');

    const adminCats = this.getCategories();
    const adminCatNameSet = new Set(adminCats.map(c => normalizeTxt(c.name)));

    const hasEquip = Boolean(supplier.equipmentTypesSupplied && supplier.equipmentTypesSupplied.length > 0);
    const hasCatIds = Boolean(supplier.supplierCategoryIds && supplier.supplierCategoryIds.length > 0);
    const hasCatNames = Boolean(supplier.categoriesSupplied && supplier.categoriesSupplied.length > 0);

    // 1) Validação de Categoria / Tipo de Equipamento
    if (hasCatIds || hasEquip || hasCatNames) {
      const matchCatId =
        hasCatIds && req.categoryId ? supplier.supplierCategoryIds!.includes(req.categoryId) : false;

      const reqCatFromAdmin = req.categoryId
        ? adminCats.find(c => c.id === req.categoryId)
        : adminCats.find(c => normalizeTxt(c.name) === normalizeTxt(req.categoryName));

      const matchEquip = hasEquip
        ? supplier.equipmentTypesSupplied!.includes(req.vehicleType) ||
          (reqCatFromAdmin?.vehicleType ? supplier.equipmentTypesSupplied!.includes(reqCatFromAdmin.vehicleType) : false)
        : false;

      const normReqCat = normalizeTxt(req.categoryName || reqCatFromAdmin?.name);
      const matchCatName =
        hasCatNames && normReqCat
          ? supplier.categoriesSupplied!.some(c => {
              const normC = normalizeTxt(c);
              return normC === normReqCat || normC.includes(normReqCat) || normReqCat.includes(normC);
            })
          : false;

      // Se o fornecedor possui categorias explícitas do Admin e o chamado especificou uma categoria válida do Admin
      if (hasCatIds && reqCatFromAdmin) {
        if (!matchCatId && !matchCatName && !matchEquip) {
          return false;
        }
      } else if (!matchCatId && !matchEquip && !matchCatName) {
        return false;
      }
    }

    // 2) Validação de Subcategoria (considera subcategoriesSupplied OU subcategorias legadas em categoriesSupplied)
    const explicitSubs = (supplier.subcategoriesSupplied || []).filter(Boolean);
    const legacySubsFromCategories =
      explicitSubs.length === 0 && hasCatNames
        ? (supplier.categoriesSupplied || []).filter(c => !adminCatNameSet.has(normalizeTxt(c)))
        : [];
    const effectiveSupSubs = explicitSubs.length > 0 ? explicitSubs : legacySubsFromCategories;

    if (effectiveSupSubs.length > 0) {
      const candidateReqSubs = new Set<string>();
      if (req.partSubcategory) candidateReqSubs.add(normalizeTxt(req.partSubcategory));
      if (req.partCategory) candidateReqSubs.add(normalizeTxt(req.partCategory));

      // Também extrai subcategorias de solicitações com múltiplas peças (Categoria: Cat (Subcat))
      if (req.description) {
        const regex = /Categoria:\s*[^()\n]+\(([^()\n]+)\)/gi;
        let m: RegExpExecArray | null;
        while ((m = regex.exec(req.description)) !== null) {
          if (m[1]) candidateReqSubs.add(normalizeTxt(m[1]));
        }
      }

      const concreteReqSubs = Array.from(candidateReqSubs).filter(s => !isWildcardSub(s));
      if (concreteReqSubs.length > 0) {
        const subMatch = effectiveSupSubs.some(supSub => {
          const normSupSub = normalizeTxt(supSub);
          if (!normSupSub || isWildcardSub(normSupSub)) return true;
          return concreteReqSubs.some(
            normReqSub =>
              normSupSub === normReqSub ||
              normSupSub.includes(normReqSub) ||
              normReqSub.includes(normSupSub)
          );
        });
        if (!subMatch) {
          return false;
        }
      }
    }

    return true;
  }

  getRequestsForSupplier(supplierId: string): PartRequest[] {
    const supplier = this.getUserById(supplierId);
    if (!supplier || supplier.role !== 'fornecedor') return [];

    // Regra estrita (RBAC): apenas fornecedores aprovados, classificados pelo Admin e online recebem solicitações
    if (
      supplier.status !== 'ativo' ||
      !supplier.supplierTier ||
      supplier.isClassifiedByAdmin === false ||
      supplier.isAvailableForOrders === false
    ) {
      return [];
    }

    const now = Date.now();
    // Solicitações ativas: nunca finalizadas, canceladas, sem_fornecedor ou pagas
    const active = this.data.requests.filter(
      r =>
        r.status !== 'finalizado' &&
        r.status !== 'cancelado' &&
        r.status !== 'sem_fornecedor' &&
        !this.isRequestPaid(r.id)
    );

    // Filter out requests specifically rejected by this supplier
    const notRejected = active.filter(r => {
      if (!this.data.rejected_supplier_requests) return true;
      return !this.data.rejected_supplier_requests.some(
        rej => rej.supplierId === supplierId && rej.requestId === r.id
      );
    });

    // Se o cliente já comprou, a solicitação encerra e SOME da tela deste fornecedor
    const notPurchased = notRejected.filter(r => {
      const order = this.data.orders_and_payments?.find(o => o.requestId === r.id);
      if (order) return false;
      return true;
    });

    // Filtragem por Categorias e Subcategorias / Tipo de Equipamento cadastrado no perfil do fornecedor
    const matchingEquipment = notPurchased.filter(r =>
      this.isSupplierMatchingRequestCategory(supplier, r)
    );

    const tier = supplier.supplierTier || 'opcao_2';
    const timers = this.getTimerSettings();
    const configuredTimeoutMs = Math.max(1, timers.supplierResponseTimeoutMinutes || 16) * 60 * 1000;

    return matchingEquipment.filter(r => {
      const attemptStart = new Date(r.lastAttemptAt || r.createdAt).getTime();
      const attemptEnd = new Date(r.attemptExpiresAt || r.expiresAt).getTime();

      // Validação estrita do Raio de Atuação definido pelo Admin com base no CEP/GPS do Cliente vs CEP/GPS do Fornecedor
      if (!this.isSupplierWithinRequestRadius(supplier, r)) {
        return false;
      }

      // 3ª OPÇÃO: Sem limite de tempo até o chamado ser encerrado/pago
      if (tier === 'opcao_3') {
        return true;
      }

      // Validação de janela considerando prazo da tentativa e cronômetro configurado pelo Admin
      if (Number.isFinite(attemptEnd)) {
        return now <= attemptEnd;
      }
      return now <= attemptStart + configuredTimeoutMs;
    });
  }

  // Fonte única de verdade para coordenadas geográficas do Fornecedor (cadastro/CEP)
  getSupplierCoordinates(supplier?: User | null): { lat: number; lng: number } | undefined {
    if (!supplier) return undefined;
    if (
      supplier.coordinates &&
      Number.isFinite(supplier.coordinates.lat) &&
      Number.isFinite(supplier.coordinates.lng) &&
      !(supplier.coordinates.lat === 0 && supplier.coordinates.lng === 0)
    ) {
      return supplier.coordinates;
    }
    if (
      supplier.address?.coordinates &&
      Number.isFinite(supplier.address.coordinates.lat) &&
      Number.isFinite(supplier.address.coordinates.lng) &&
      !(supplier.address.coordinates.lat === 0 && supplier.address.coordinates.lng === 0)
    ) {
      return supplier.address.coordinates;
    }
    if (isValidCep(supplier.address?.cep)) {
      return estimateCoordinatesFromCep(supplier.address?.cep, supplier.address?.state);
    }
    return undefined;
  }

  // Fonte única de verdade para coordenadas geográficas do Pedido (CEP de entrega do Cliente)
  getRequestCoordinates(req?: PartRequest | null): { lat: number; lng: number } | undefined {
    if (!req) return undefined;
    if (
      req.deliveryAddress?.coordinates &&
      Number.isFinite(req.deliveryAddress.coordinates.lat) &&
      Number.isFinite(req.deliveryAddress.coordinates.lng) &&
      !(req.deliveryAddress.coordinates.lat === 0 && req.deliveryAddress.coordinates.lng === 0)
    ) {
      return req.deliveryAddress.coordinates;
    }
    if (isValidCep(req.deliveryAddress?.cep)) {
      return estimateCoordinatesFromCep(req.deliveryAddress.cep, req.deliveryAddress.state);
    }
    return undefined;
  }

  // Retorna detalhes completos da distância REAL entre CEP do Fornecedor e CEP de entrega do Cliente
  getDistanceDetailsSupplierToRequest(
    supplier?: User | null,
    req?: PartRequest | null
  ): {
    distanceKm: number;
    durationMin?: number;
    source: 'rota_real' | 'linha_reta';
    supplierCep?: string;
    deliveryCep?: string;
  } | null {
    const supplierCoords = this.getSupplierCoordinates(supplier);
    const reqCoords = this.getRequestCoordinates(req);
    if (!supplierCoords || !reqCoords) return null;

    const cachedRoute: RealDistanceResult | null = getCachedRealRouteDistanceKm(supplierCoords, reqCoords);
    if (cachedRoute && Number.isFinite(cachedRoute.distanceKm)) {
      return {
        distanceKm: cachedRoute.distanceKm,
        durationMin: cachedRoute.durationMin,
        source: cachedRoute.source,
        supplierCep: supplier?.address?.cep,
        deliveryCep: req?.deliveryAddress?.cep,
      };
    }

    const straightDist = calculateDistanceKm(supplierCoords, reqCoords);
    if (!Number.isFinite(straightDist)) return null;
    return {
      distanceKm: straightDist,
      source: 'linha_reta',
      supplierCep: supplier?.address?.cep,
      deliveryCep: req?.deliveryAddress?.cep,
    };
  }

  // Calcula distância real (km) entre CEP/localização do Fornecedor e CEP de entrega do Cliente
  getDistanceSupplierToRequestKm(supplier?: User | null, req?: PartRequest | null): number | null {
    const details = this.getDistanceDetailsSupplierToRequest(supplier, req);
    return details ? details.distanceKm : null;
  }

  // Hidrata coordenadas reais (logradouro/CEP) e rota real de condução (OSRM) em segundo plano
  private hydratedPairs = new Set<string>();
  async hydrateRealDistanceForPair(supplierId?: string, requestId?: string): Promise<void> {
    if (!supplierId || !requestId) return;
    const key = `${supplierId}:${requestId}`;
    if (this.hydratedPairs.has(key)) return;
    this.hydratedPairs.add(key);

    const supplier = this.getUserById(supplierId);
    const req = this.getRequestById(requestId);
    if (!supplier || !req) return;

    let changed = false;

    const supplierNeedsExactCep =
      supplier.address?.cep &&
      isValidCep(supplier.address.cep) &&
      (!supplier.coordinates ||
        (supplier.coordinatesPrecision !== 'gps' && supplier.coordinatesPrecision !== 'exact_cep'));

    if (supplierNeedsExactCep && supplier.address?.cep) {
      const geoSup = await lookupAddressAndGeoByCep(supplier.address.cep);
      if (geoSup.success && geoSup.coordinatesPrecision === 'exact_cep') {
        supplier.coordinates = geoSup.coordinates;
        supplier.coordinatesPrecision = 'exact_cep';
        supplier.address = {
          ...supplier.address,
          coordinates: geoSup.coordinates,
          coordinatesPrecision: 'exact_cep',
        };
        changed = true;
      }
    }

    const reqNeedsExactCep =
      req.deliveryAddress?.cep &&
      isValidCep(req.deliveryAddress.cep) &&
      (!req.deliveryAddress.coordinates ||
        (req.deliveryAddress.coordinatesPrecision !== 'gps' &&
          req.deliveryAddress.coordinatesPrecision !== 'exact_cep'));

    if (reqNeedsExactCep && req.deliveryAddress?.cep) {
      const geoReq = await lookupAddressAndGeoByCep(req.deliveryAddress.cep);
      if (geoReq.success && geoReq.coordinatesPrecision === 'exact_cep') {
        req.deliveryAddress.coordinates = geoReq.coordinates;
        req.deliveryAddress.coordinatesPrecision = 'exact_cep';
        changed = true;
      }
    }

    const supCoords = this.getSupplierCoordinates(supplier);
    const reqCoords = this.getRequestCoordinates(req);
    if (supCoords && reqCoords) {
      const routeRes = await fetchRealRouteDistanceKm(supCoords, reqCoords);
      if (routeRes) {
        changed = true;
      }
    }

    if (changed) {
      this.saveLocalOnly();
      this.notify();
    }
  }

  // Valida estritamente se o Fornecedor está dentro do perímetro de raio definido pelo Admin
  // Quando o cliente clica em REFAZER SOLICITAÇÃO (autoExpanded), respeita o raio expandido (100 -> 200 -> 500 km)
  isSupplierWithinRequestRadius(supplier?: User | null, req?: PartRequest | null): boolean {
    if (!supplier || !req) return false;
    const configuredRadius = supplier.serviceRadiusKm !== undefined ? supplier.serviceRadiusKm : 50;
    // Somente quando o Admin configura explicitamente 0 (Sem Limite), atende todo o Brasil
    if (configuredRadius === 0) return true;
    const isExpandedSearch = Boolean(req.autoExpanded || (req.searchAttempt && req.searchAttempt > 1));
    const effectiveRadius = isExpandedSearch
      ? Math.max(configuredRadius, req.searchRadiusKm || 50)
      : configuredRadius;
    const dist = this.getDistanceSupplierToRequestKm(supplier, req);
    if (dist === null) return false;
    return dist <= effectiveRadius;
  }

  rejectSupplierRequest(supplierId: string, requestId: string) {
    if (!this.data.rejected_supplier_requests) {
      this.data.rejected_supplier_requests = [];
    }
    const exists = this.data.rejected_supplier_requests.some(
      r => r.supplierId === supplierId && r.requestId === requestId
    );
    if (!exists) {
      this.data.rejected_supplier_requests.push({ supplierId, requestId });
      const req = this.getRequestById(requestId);
      const user = this.getUserById(supplierId);
      this.data.audit_logs.unshift({
        id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toISOString(),
        userId: supplierId,
        userPhone: user?.phone || 'sistema',
        userRole: user?.role || 'fornecedor',
        action: 'Solicitação Recusada pelo Fornecedor',
        entityType: 'request',
        entityId: requestId,
        details: `Fornecedor optou por RECUSAR a solicitação ${req?.requestNumber || requestId}. Chamado encerrado e fechado na tela.`,
        ipAddress: 'dispositivo-fornecedor',
      });
      this.saveLocalOnly();
      void this.syncRequestRejectToServer(supplierId, requestId);
    }
  }

  // --- CONTROLE DE TEMPOS DE SPAM E CHAMADOS (§2 & §3) ---
  getTimerSettings(): SystemTimerSettings {
    return this.data.timer_settings || INITIAL_TIMER_SETTINGS;
  }

  updateTimerSettings(settings: Partial<SystemTimerSettings>, adminId: string): SystemTimerSettings {
    this.data.timer_settings = {
      ...(this.data.timer_settings || INITIAL_TIMER_SETTINGS),
      ...settings,
    };

    // Sincroniza os templates de SPAM com os minutos configurados
    if (settings.supplierResponseTimeoutMinutes) {
      const spamOpp = this.data.spams_config.find(s => s.type === 'nova_oportunidade');
      if (spamOpp) {
        spamOpp.countdownSeconds = settings.supplierResponseTimeoutMinutes * 60;
      }
    }
    if (settings.clientApprovalTimeoutMinutes) {
      const spamQuote = this.data.spams_config.find(s => s.type === 'orcamento_recebido');
      if (spamQuote) {
        spamQuote.countdownSeconds = settings.clientApprovalTimeoutMinutes * 60;
      }
    }

    this.logAudit(
      adminId,
      'Configuração de Tempos do SPAM e Chamados Atualizada',
      'spam_config',
      'timer_settings',
      `Fornecedor: ${this.data.timer_settings.supplierResponseTimeoutMinutes} min · Cliente: ${this.data.timer_settings.clientApprovalTimeoutMinutes} min`
    );
    this.save();
    return this.data.timer_settings;
  }

  // --- AUTORIZAÇÃO E CLASSIFICAÇÃO DE FORNECEDORES (§3 / RBAC) ---
  authorizeSupplier(
    supplierId: string,
    adminId: string,
    classification?: {
      supplierTier?: SupplierTier;
      serviceRadiusKm?: number;
      commissionRateOverride?: number;
      supplierPaymentType?: SupplierPaymentType;
      supplierModalityId?: string;
      supplierClassificationEscrita?: string;
      supplierClassificationCondicao?: string;
      supplierClassificationPercent?: number;
    }
  ) {
    const admin = this.getUserById(adminId);
    if (!admin || admin.role !== 'admin' || admin.status !== 'ativo') {
      throw new Error('Acesso negado (RBAC): somente um Administrador ativo pode autorizar e classificar fornecedores.');
    }

    const user = this.getUserById(supplierId);
    if (!user || user.role !== 'fornecedor') return;

    const assignedTier: SupplierTier = classification?.supplierTier || user.supplierTier || 'opcao_2';
    user.supplierTier = assignedTier;
    user.isClassifiedByAdmin = true;
    user.approvedAt = new Date().toISOString();
    user.approvedByAdminId = adminId;
    if (classification?.serviceRadiusKm !== undefined) {
      user.serviceRadiusKm = classification.serviceRadiusKm;
    }
    if (classification?.commissionRateOverride !== undefined) {
      user.commissionRateOverride = classification.commissionRateOverride;
    }
    if (classification?.supplierPaymentType !== undefined) {
      user.supplierPaymentType = classification.supplierPaymentType;
    }
    if (classification?.supplierModalityId !== undefined) {
      user.supplierModalityId = classification.supplierModalityId;
    }
    if (classification?.supplierClassificationEscrita !== undefined) {
      user.supplierClassificationEscrita = classification.supplierClassificationEscrita;
    }
    if (classification?.supplierClassificationCondicao !== undefined) {
      user.supplierClassificationCondicao = classification.supplierClassificationCondicao;
    }
    if (classification?.supplierClassificationPercent !== undefined) {
      user.supplierClassificationPercent = classification.supplierClassificationPercent;
      user.commissionRateOverride = classification.supplierClassificationPercent;
    }
    user.status = 'ativo';
    user.isAvailableForOrders = true;

    const tierLabel =
      user.supplierClassificationEscrita ||
      (assignedTier === 'opcao_1' ? '1ª Opção' : assignedTier === 'opcao_2' ? '2ª Opção' : '3ª Opção');
    const radiusLabel =
      user.serviceRadiusKm === 0 ? 'Sem Limite' : `${user.serviceRadiusKm ?? 50} km`;

    this.logAudit(
      adminId,
      'Autorização e Classificação de Fornecedor',
      'user',
      supplierId,
      `Fornecedor ${user.companyName || user.name} (CNPJ: ${user.document}) autorizado e classificado como ${tierLabel} (Raio: ${radiusLabel}) pelo Admin.`
    );
    this.save();
    this.syncUserPatchToServer(supplierId, {
      supplierTier: user.supplierTier,
      supplierModalityId: user.supplierModalityId,
      supplierClassificationEscrita: user.supplierClassificationEscrita,
      supplierClassificationCondicao: user.supplierClassificationCondicao,
      supplierClassificationPercent: user.supplierClassificationPercent,
      isClassifiedByAdmin: user.isClassifiedByAdmin,
      approvedAt: user.approvedAt,
      approvedByAdminId: user.approvedByAdminId,
      serviceRadiusKm: user.serviceRadiusKm,
      commissionRateOverride: user.commissionRateOverride,
      supplierPaymentType: user.supplierPaymentType,
      status: user.status,
      isAvailableForOrders: user.isAvailableForOrders,
    });
  }

  rejectSupplierApplication(supplierId: string, adminId: string, reason?: string) {
    const user = this.getUserById(supplierId);
    if (!user) return;
    user.status = 'bloqueado';
    user.isAvailableForOrders = false;
    this.logAudit(
      adminId,
      'Recusa de Cadastro de Fornecedor',
      'user',
      supplierId,
      `Cadastro do fornecedor ${user.companyName || user.name} foi recusado pelo administrador. Motivo: ${reason || 'Documentação não aprovada'}`
    );
    this.save();
    this.syncUserPatchToServer(supplierId, {
      status: 'bloqueado',
      isAvailableForOrders: false,
    });
  }

  // --- CANCELAMENTO E EXCLUSÃO DE SOLICITAÇÕES E PEDIDOS (§3) ---
  cancelRequest(requestId: string, adminId: string, reason?: string) {
    const req = this.getRequestById(requestId);
    if (!req) return;
    const admin = this.getUserById(adminId);
    req.status = 'cancelado';
    req.closedReason = 'cancelado_usuario';
    this.appendRequestHistory(
      req,
      'Chamado Cancelado',
      reason || 'Cancelado pelo Administrador',
      admin?.role || 'admin',
      admin?.name
    );
    this.logAudit(
      adminId,
      'Cancelamento de Solicitação',
      'request',
      requestId,
      `Solicitação ${req.requestNumber} cancelada pelo administrador. Motivo: ${reason || 'Ação Administrativa'}`
    );
    this.save();
  }

  deleteRequest(requestId: string, adminId: string) {
    const req = this.getRequestById(requestId);
    const reqNum = req?.requestNumber || requestId;
    this.deletedRequestIds.add(requestId);
    this.data.requests = this.data.requests.filter(r => r.id !== requestId);
    // Também remove orçamentos associados
    this.data.quotes = this.data.quotes.filter(q => q.requestId !== requestId);
    this.logAudit(
      adminId,
      'Exclusão Permanente de Solicitação',
      'request',
      requestId,
      `Solicitação ${reqNum} e seus respectivos orçamentos foram excluídos permanentemente da base de dados pelo administrador.`
    );
    this.save();
  }

  cancelOrder(orderId: string, adminId: string, reason?: string) {
    const order = this.getOrderById(orderId);
    if (!order) return;
    order.paymentStatus = 'estornado';
    this.logAudit(
      adminId,
      'Cancelamento e Estorno de Pedido',
      'order',
      orderId,
      `Pedido ${order.orderNumber} cancelado e estornado pelo administrador. Motivo: ${reason || 'Ação Administrativa'}`
    );
    this.save();
  }

  deleteOrder(orderId: string, adminId: string) {
    const order = this.getOrderById(orderId);
    const num = order?.orderNumber || orderId;
    this.deletedOrderIds.add(orderId);
    this.data.orders_and_payments = this.data.orders_and_payments.filter(o => o.id !== orderId);
    this.logAudit(
      adminId,
      'Exclusão Permanente de Pedido',
      'order',
      orderId,
      `Pedido ${num} excluído permanentemente da base de dados pelo administrador.`
    );
    this.save();
  }

  // --- PDF MANUFACTURER CATALOGS HUB ---
  private normalizeCategoryToken(value?: string): string {
    if (!value) return '';
    const v = value.toLowerCase().trim();
    if (v === 'todos' || v === 'todas as categorias' || v === 'all') return 'todos';
    if (v === 'carro' || v.includes('carros') || v.includes('passeio') || v.includes('veículos') || v.includes('veiculos')) return 'carro';
    if (v === 'moto' || v.includes('motos')) return 'moto';
    if (v === 'caminhao' || v.includes('caminhões') || v.includes('caminhoes') || v.includes('diesel')) return 'caminhao';
    if (v === 'agricola' || v.includes('agrícola') || v.includes('agricola')) return 'agricola';
    if (v === 'industrial' || v.includes('industriais')) return 'industrial';
    if (v === 'outros' || v.includes('universal') || v.includes('linha leve')) return 'outros';
    return v;
  }

  getManufacturerCatalogs(search?: string, category?: string): ManufacturerCatalog[] {
    let list = this.data.manufacturer_catalogs || [];

    if (category && category !== 'todos' && category !== 'Todas as Categorias') {
      const targetNorm = this.normalizeCategoryToken(category);
      const targetRaw = category.toLowerCase().trim();
      list = list.filter(c => {
        const catRaw = (c.category || '').toLowerCase().trim();
        const catNorm = this.normalizeCategoryToken(c.category);
        return catRaw === targetRaw || catNorm === targetNorm || catNorm === 'todos';
      });
    }

    if (search && search.trim() !== '') {
      const q = search.toLowerCase().trim();
      list = list.filter(c =>
        (c.manufacturer && c.manufacturer.toLowerCase().includes(q)) ||
        (c.title && c.title.toLowerCase().includes(q)) ||
        (c.compatibleModels && c.compatibleModels.toLowerCase().includes(q)) ||
        (c.description && c.description.toLowerCase().includes(q)) ||
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.fileName && c.fileName.toLowerCase().includes(q))
      );
    }

    return list;
  }

  // Alias para uso direto no painel do administrador e apps
  getCatalogs(): ManufacturerCatalog[] {
    return this.getManufacturerCatalogs();
  }

  saveCatalog(catalogData: {
    id?: string;
    name: string;
    category: string;
    fileName: string;
    fileSize: string;
    uploadDate?: string;
    adminId?: string;
    file?: File | null;
  }): ManufacturerCatalog {
    const id = catalogData.id || `cat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const hasFile = Boolean(catalogData.file);
    const newCatalog: ManufacturerCatalog = {
      id,
      manufacturer: catalogData.name,
      title: catalogData.name,
      category: catalogData.category,
      compatibleModels: 'Todos os modelos compatíveis na linha',
      description: `Manual e catálogo técnico de autopeças em PDF - ${catalogData.category}.`,
      fileSize: catalogData.fileSize,
      pdfUrl: hasFile ? `indexeddb://${id}` : '#',
      pdfFileName: catalogData.fileName,
      uploadedAt: new Date().toISOString(),
      downloadsCount: 0,
      hasRealPdf: hasFile,
      name: catalogData.name,
      fileName: catalogData.fileName,
      uploadDate: catalogData.uploadDate || new Date().toLocaleDateString('pt-BR'),
    };

    if (catalogData.file) {
      savePdfBlob(id, catalogData.file).catch(err =>
        console.error('Erro ao salvar binário do catálogo PDF:', err)
      );
    }

    if (!this.data.manufacturer_catalogs) {
      this.data.manufacturer_catalogs = [];
    }
    this.data.manufacturer_catalogs.unshift(newCatalog);
    this.logAudit(
      catalogData.adminId || 'usr_admin_1',
      'Upload de Catálogo PDF de Fabricante',
      'spam_config',
      newCatalog.id,
      `Novo catálogo anexado pelo admin: ${newCatalog.manufacturer} (${newCatalog.fileSize})`
    );
    this.save();
    return newCatalog;
  }

  deleteCatalog(catalogId: string, adminId?: string) {
    this.deleteManufacturerCatalog(catalogId, adminId || 'usr_admin_1');
  }

  addManufacturerCatalog(
    catalogData: Omit<ManufacturerCatalog, 'id' | 'uploadedAt' | 'downloadsCount'>,
    adminId: string,
    file?: File | null
  ): ManufacturerCatalog {
    const id = `cat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const hasFile = Boolean(file);
    const newCatalog: ManufacturerCatalog = {
      ...catalogData,
      id,
      pdfUrl: hasFile ? `indexeddb://${id}` : catalogData.pdfUrl,
      hasRealPdf: hasFile || Boolean(catalogData.hasRealPdf),
      uploadedAt: new Date().toISOString(),
      downloadsCount: 0,
      name: catalogData.title || catalogData.manufacturer,
      fileName: catalogData.pdfFileName || `${catalogData.manufacturer.toLowerCase().replace(/\s+/g, '-')}-catalogo.pdf`,
      uploadDate: new Date().toLocaleDateString('pt-BR'),
    };

    if (file) {
      savePdfBlob(id, file).catch(err =>
        console.error('Erro ao salvar binário do catálogo PDF:', err)
      );
    }

    if (!this.data.manufacturer_catalogs) {
      this.data.manufacturer_catalogs = [];
    }
    this.data.manufacturer_catalogs.unshift(newCatalog);
    this.logAudit(
      adminId,
      'Upload de Catálogo PDF de Fabricante',
      'spam_config',
      newCatalog.id,
      `Novo catálogo anexado: ${newCatalog.manufacturer} - ${newCatalog.title} (${newCatalog.fileSize})`
    );
    this.save();
    return newCatalog;
  }

  updateCatalog(
    catalogId: string,
    updates: {
      manufacturer?: string;
      title?: string;
      name?: string;
      category?: string;
      compatibleModels?: string;
      description?: string;
    },
    adminId: string,
    newFile?: File | null
  ): ManufacturerCatalog | undefined {
    if (!this.data.manufacturer_catalogs) return undefined;
    const cat = this.data.manufacturer_catalogs.find(c => c.id === catalogId);
    if (!cat) return undefined;

    if (updates.title !== undefined || updates.name !== undefined) {
      const nextTitle = (updates.title ?? updates.name ?? cat.title).trim();
      cat.title = nextTitle;
      cat.name = nextTitle;
    }
    if (updates.manufacturer !== undefined) {
      cat.manufacturer = updates.manufacturer.trim();
    }
    if (updates.category !== undefined) {
      cat.category = updates.category;
    }
    if (updates.compatibleModels !== undefined) {
      cat.compatibleModels = updates.compatibleModels;
    }
    if (updates.description !== undefined) {
      cat.description = updates.description;
    }

    if (newFile) {
      cat.fileSize = `${(newFile.size / 1024 / 1024).toFixed(2)} MB`;
      cat.pdfFileName = newFile.name;
      cat.fileName = newFile.name;
      cat.pdfUrl = `indexeddb://${cat.id}`;
      cat.hasRealPdf = true;
      cat.uploadDate = new Date().toLocaleDateString('pt-BR');
      savePdfBlob(cat.id, newFile).catch(err =>
        console.error('Erro ao substituir binário do catálogo PDF:', err)
      );
    }

    this.logAudit(
      adminId,
      'Edição de Catálogo PDF',
      'spam_config',
      catalogId,
      `Catálogo atualizado pelo Administrador: ${cat.manufacturer} - ${cat.title}`
    );
    this.save();
    return cat;
  }

  deleteManufacturerCatalog(catalogId: string, adminId: string) {
    if (!this.data.manufacturer_catalogs) return;
    const cat = this.data.manufacturer_catalogs.find(c => c.id === catalogId);
    this.data.manufacturer_catalogs = this.data.manufacturer_catalogs.filter(c => c.id !== catalogId);
    deletePdfBlob(catalogId).catch(err =>
      console.error('Erro ao remover PDF do IndexedDB:', err)
    );
    this.logAudit(
      adminId,
      'Exclusão de Catálogo PDF',
      'spam_config',
      catalogId,
      `Catálogo removido: ${cat?.title || cat?.name || catalogId}`
    );
    this.save();
  }

  incrementCatalogDownload(catalogId: string) {
    if (!this.data.manufacturer_catalogs) return;
    const cat = this.data.manufacturer_catalogs.find(c => c.id === catalogId);
    if (cat) {
      cat.downloadsCount = (cat.downloadsCount || 0) + 1;
      this.save();
    }
  }

  // --- CENTRAL MEDIA & PHOTO ARCHIVE DATABASE ---
  getAllMediaArchive(): Array<{
    id: string;
    sourceType: 'request' | 'quote' | 'order';
    sourceId: string;
    type: 'solicitacao' | 'cotacao' | 'embalagem';
    mediaUrl: string;
    title: string;
    subtitle: string;
    date: string;
    referenceNumber: string;
    authorName: string;
  }> {
    const items: Array<{
      id: string;
      sourceType: 'request' | 'quote' | 'order';
      sourceId: string;
      type: 'solicitacao' | 'cotacao' | 'embalagem';
      mediaUrl: string;
      title: string;
      subtitle: string;
      date: string;
      referenceNumber: string;
      authorName: string;
    }> = [];

    // Photos from requests (Principal até 5 + Peças Adicionais até 3 cada)
    this.data.requests.forEach(req => {
      const mainList =
        req.mediaUrls && req.mediaUrls.length > 0
          ? req.mediaUrls
          : req.mediaUrl
          ? [req.mediaUrl]
          : [];
      mainList.forEach((url, idx) => {
        if (!url) return;
        items.push({
          id: idx === 0 ? `media_req_${req.id}` : `media_req_${req.id}_main_${idx}`,
          sourceType: 'request',
          sourceId: idx === 0 ? req.id : `${req.id}::main::${idx}`,
          type: 'solicitacao',
          mediaUrl: url,
          title: idx === 0 ? req.partName : `${req.partName} (Foto ${idx + 1})`,
          subtitle: `${req.vehicleBrand} ${req.vehicleModel} (${req.vehicleYear})`,
          date: req.createdAt,
          referenceNumber: req.requestNumber,
          authorName: req.customerName,
        });
      });
      (req.extraParts || []).forEach(ep => {
        (ep.mediaUrls || []).forEach((url, idx) => {
          if (!url) return;
          items.push({
            id: `media_req_${req.id}_extra_${ep.id}_${idx}`,
            sourceType: 'request',
            sourceId: `${req.id}::extra::${ep.id}::${idx}`,
            type: 'solicitacao',
            mediaUrl: url,
            title: `${ep.partName} (Peça adicional · Foto ${idx + 1})`,
            subtitle: `${req.vehicleBrand} ${req.vehicleModel} (${req.vehicleYear})`,
            date: req.createdAt,
            referenceNumber: req.requestNumber,
            authorName: req.customerName,
          });
        });
      });
    });

    // Photos from quotes
    this.data.quotes.forEach(quo => {
      if (quo.photoUrl) {
        const req = this.getRequestById(quo.requestId);
        items.push({
          id: `media_quo_${quo.id}`,
          sourceType: 'quote',
          sourceId: quo.id,
          type: 'cotacao',
          mediaUrl: quo.photoUrl,
          title: `${quo.brand} - ${req?.partName || 'Peça'}`,
          subtitle: `Condição: ${quo.condition.toUpperCase()} · R$ ${quo.totalPrice.toFixed(2)}`,
          date: quo.createdAt,
          referenceNumber: req?.requestNumber || quo.id,
          authorName: quo.supplierName,
        });
      }
    });

    // Photos from packaged shipments
    this.data.orders_and_payments.forEach(ord => {
      if (ord.packagedPhotoUrl) {
        items.push({
          id: `media_ord_${ord.id}`,
          sourceType: 'order',
          sourceId: ord.id,
          type: 'embalagem',
          mediaUrl: ord.packagedPhotoUrl,
          title: `Pacote Expedido: ${ord.partName}`,
          subtitle: `Transporte: ${ord.trackingCarrier || 'Express'} · Rastreio: ${ord.trackingCode || ord.orderNumber}`,
          date: ord.createdAt,
          referenceNumber: ord.orderNumber,
          authorName: 'Fornecedor Credenciado',
        });
      }
    });

    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  updateMediaArchiveItem(
    sourceType: 'request' | 'quote' | 'order',
    sourceId: string,
    updates: { title?: string; mediaUrl?: string },
    adminId: string
  ) {
    if (sourceType === 'request') {
      if (sourceId.includes('::extra::')) {
        const [reqId, , extraId, idxStr] = sourceId.split('::');
        const idx = Number(idxStr) || 0;
        const req = this.data.requests.find(r => r.id === reqId);
        const ep = req?.extraParts?.find(e => e.id === extraId);
        if (!req || !ep) return;
        if (updates.title !== undefined) ep.partName = updates.title;
        if (updates.mediaUrl !== undefined) {
          ep.mediaUrls = ep.mediaUrls ? [...ep.mediaUrls] : [];
          ep.mediaUrls[idx] = updates.mediaUrl;
        }
        this.logAudit(adminId, 'Edição de Mídia de Solicitação', 'request', reqId, `Imagem/título atualizado em ${req.requestNumber}.`);
      } else if (sourceId.includes('::main::')) {
        const [reqId, , idxStr] = sourceId.split('::');
        const idx = Number(idxStr) || 0;
        const req = this.data.requests.find(r => r.id === reqId);
        if (!req) return;
        if (updates.title !== undefined) req.partName = updates.title;
        if (updates.mediaUrl !== undefined) {
          req.mediaUrls = req.mediaUrls ? [...req.mediaUrls] : req.mediaUrl ? [req.mediaUrl] : [];
          req.mediaUrls[idx] = updates.mediaUrl;
          if (idx === 0) req.mediaUrl = updates.mediaUrl;
        }
        this.logAudit(adminId, 'Edição de Mídia de Solicitação', 'request', reqId, `Imagem #${idx + 1}/título atualizado em ${req.requestNumber}.`);
      } else {
        const req = this.data.requests.find(r => r.id === sourceId);
        if (!req) return;
        if (updates.title !== undefined) req.partName = updates.title;
        if (updates.mediaUrl !== undefined) {
          req.mediaUrl = updates.mediaUrl;
          if (req.mediaUrls && req.mediaUrls.length > 0) {
            req.mediaUrls[0] = updates.mediaUrl;
          } else {
            req.mediaUrls = [updates.mediaUrl];
          }
        }
        this.logAudit(adminId, 'Edição de Mídia de Solicitação', 'request', sourceId, `Imagem/título atualizado em ${req.requestNumber}.`);
      }
    } else if (sourceType === 'quote') {
      const quo = this.data.quotes.find(q => q.id === sourceId);
      if (!quo) return;
      if (updates.title !== undefined) quo.brand = updates.title;
      if (updates.mediaUrl !== undefined) quo.photoUrl = updates.mediaUrl;
      this.logAudit(adminId, 'Edição de Mídia de Cotação', 'quote', sourceId, `Imagem/título atualizado na cotação ${quo.id}.`);
    } else if (sourceType === 'order') {
      const ord = this.data.orders_and_payments.find(o => o.id === sourceId);
      if (!ord) return;
      if (updates.title !== undefined) ord.partName = updates.title;
      if (updates.mediaUrl !== undefined) ord.packagedPhotoUrl = updates.mediaUrl;
      this.logAudit(adminId, 'Edição de Mídia de Embalagem', 'order', sourceId, `Imagem/título atualizado no pedido ${ord.orderNumber}.`);
    }
    this.save();
  }

  deleteMediaArchiveItem(
    sourceType: 'request' | 'quote' | 'order',
    sourceId: string,
    adminId: string
  ) {
    if (sourceType === 'request') {
      if (sourceId.includes('::extra::')) {
        const [reqId, , extraId, idxStr] = sourceId.split('::');
        const idx = Number(idxStr) || 0;
        const req = this.data.requests.find(r => r.id === reqId);
        const ep = req?.extraParts?.find(e => e.id === extraId);
        if (!req || !ep || !ep.mediaUrls) return;
        ep.mediaUrls.splice(idx, 1);
        this.logAudit(adminId, 'Exclusão de Foto de Solicitação', 'request', reqId, `Foto de peça adicional removida da solicitação ${req.requestNumber}.`);
      } else if (sourceId.includes('::main::')) {
        const [reqId, , idxStr] = sourceId.split('::');
        const idx = Number(idxStr) || 0;
        const req = this.data.requests.find(r => r.id === reqId);
        if (!req) return;
        if (req.mediaUrls && req.mediaUrls.length > idx) {
          req.mediaUrls.splice(idx, 1);
          req.mediaUrl = req.mediaUrls[0] || undefined;
        }
        this.logAudit(adminId, 'Exclusão de Foto de Solicitação', 'request', reqId, `Foto #${idx + 1} removida da solicitação ${req.requestNumber}.`);
      } else {
        const req = this.data.requests.find(r => r.id === sourceId);
        if (!req) return;
        if (req.mediaUrls && req.mediaUrls.length > 0) {
          req.mediaUrls.shift();
          req.mediaUrl = req.mediaUrls[0] || undefined;
        } else {
          req.mediaUrl = undefined;
        }
        this.logAudit(adminId, 'Exclusão de Foto de Solicitação', 'request', sourceId, `Foto removida da solicitação ${req.requestNumber}.`);
      }
    } else if (sourceType === 'quote') {
      const quo = this.data.quotes.find(q => q.id === sourceId);
      if (!quo) return;
      quo.photoUrl = '';
      this.logAudit(adminId, 'Exclusão de Foto de Cotação', 'quote', sourceId, `Foto removida da cotação ${quo.id}.`);
    } else if (sourceType === 'order') {
      const ord = this.data.orders_and_payments.find(o => o.id === sourceId);
      if (!ord) return;
      ord.packagedPhotoUrl = undefined;
      this.logAudit(adminId, 'Exclusão de Foto de Embalagem', 'order', sourceId, `Foto removida do pedido ${ord.orderNumber}.`);
    }
    this.save();
  }


  // Vehicles
  addVehicle(vehicle: Omit<Vehicle, 'id' | 'createdAt'>): Vehicle {
    const newVeh: Vehicle = {
      ...vehicle,
      id: `veh_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
    };
    this.data.vehicles.push(newVeh);
    this.logAudit(vehicle.userId, 'Veículo Cadastrado', 'user', vehicle.userId, `${newVeh.brand} ${newVeh.model} ${newVeh.year}`);
    this.save();
    return newVeh;
  }

  private buildPartRequestLocally(
    customerId: string,
    data: {
      vehicleType: VehicleCategory;
      vehicleBrand: string;
      vehicleModel: string;
      vehicleYear: number;
      vehicleEngine?: string;
      vehiclePlate?: string;
      vehicleChassi?: string;
      partIdentificationType: PartIdentificationType;
      partName: string;
      partCategory: string;
      categoryId?: string;
      categoryName?: string;
      partSubcategory?: string;
      oemCode?: string;
      description?: string;
      mediaUrl?: string;
      mediaUrls?: string[];
      mediaType?: 'photo' | 'video';
      extraParts?: PartRequestExtraPart[];
      deliveryAddress: PartRequest['deliveryAddress'];
      clientGpsVerified?: boolean;
    }
  ): PartRequest {
    const customer = this.getUserById(customerId);
    const requestNumber = `CMP-${Math.floor(10000 + Math.random() * 90000)}`;
    const timers = this.getTimerSettings();
    const initialWindowMinutes = Math.max(1, timers.supplierResponseTimeoutMinutes || 16);

    const resolvedCoords =
      data.deliveryAddress.coordinates ||
      (isValidCep(data.deliveryAddress.cep)
        ? estimateCoordinatesFromCep(data.deliveryAddress.cep, data.deliveryAddress.state)
        : undefined);
    const resolvedPrecision: PartRequest['deliveryAddress']['coordinatesPrecision'] = data.clientGpsVerified
      ? 'gps'
      : data.deliveryAddress.coordinates
      ? data.deliveryAddress.coordinatesPrecision || 'exact_cep'
      : isValidCep(data.deliveryAddress.cep)
      ? 'cep_prefix'
      : undefined;

    if (data.clientGpsVerified && resolvedCoords && customer) {
      customer.coordinates = { ...resolvedCoords };
      customer.coordinatesPrecision = 'gps';
      customer.gpsVerifiedAt = new Date().toISOString();
    }

    const resolvedDeliveryAddress = {
      ...data.deliveryAddress,
      coordinates: resolvedCoords,
      coordinatesPrecision: resolvedPrecision,
    };

    const normalizedMediaUrls = Array.isArray(data.mediaUrls)
      ? data.mediaUrls.filter(Boolean).slice(0, 5)
      : data.mediaUrl
      ? [data.mediaUrl]
      : [];
    const normalizedExtraParts = Array.isArray(data.extraParts)
      ? data.extraParts.map(ep => ({
          ...ep,
          mediaUrls: Array.isArray(ep.mediaUrls) ? ep.mediaUrls.filter(Boolean).slice(0, 3) : [],
        }))
      : undefined;

    const nowIso = new Date().toISOString();
    const expiresIso = new Date(Date.now() + initialWindowMinutes * 60 * 1000).toISOString();
    const attemptExpiresIso = expiresIso;

    const newRequest: PartRequest = {
      id: `req_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      requestNumber,
      customerId,
      customerName: customer ? customer.name : 'Cliente Anônimo',
      customerPhone: customer ? customer.phone : '',
      ...data,
      mediaUrl: normalizedMediaUrls[0] || data.mediaUrl,
      mediaUrls: normalizedMediaUrls,
      extraParts: normalizedExtraParts,
      deliveryAddress: resolvedDeliveryAddress,
      status: 'aguardando_orcamentos',
      createdAt: nowIso,
      lastAttemptAt: nowIso,
      expiresAt: expiresIso,
      attemptExpiresAt: attemptExpiresIso,
      clientExpiresAt: new Date(Date.now() + timers.clientApprovalTimeoutMinutes * 60 * 1000).toISOString(),
      searchRadiusKm: 50,
      autoExpanded: false,
      searchAttempt: 1,
      maxSearchAttempts: 4,
      clientGpsVerified: Boolean(data.clientGpsVerified),
      statusHistory: [
        this.createStatusHistoryEntry(
          'Solicitação Criada (Tentativa 1/4)',
          `Cliente solicitou "${data.partName}". Raio inicial: 50 km (${data.clientGpsVerified ? 'GPS Ativo + CEP' : 'CEP'}). Prazo: ${initialWindowMinutes} min.`,
          'cliente',
          customer?.name,
          { radiusKm: 50, attemptNumber: 1 }
        ),
      ],
      priorityLevel: 1,
    };

    this.pendingLocalRequests.set(newRequest.id, newRequest);
    this.data.requests.unshift(newRequest);
    this.data.audit_logs.unshift({
      id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: nowIso,
      userId: customerId,
      userPhone: customer?.phone || 'sistema',
      userRole: customer?.role || 'cliente',
      action: 'Nova Solicitação de Peça',
      entityType: 'request',
      entityId: newRequest.id,
      details: `Solicitação ${requestNumber} criada (Tentativa 1/4 · Raio 50 km): ${newRequest.partName} para ${newRequest.vehicleBrand} ${newRequest.vehicleModel}. ${data.clientGpsVerified ? 'GPS ativo confirmado.' : 'Localização via CEP.'}`,
      ipAddress: 'dispositivo-cliente',
    });
    this.saveLocalOnly();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('compe:new_request', { detail: newRequest }));
    }
    return newRequest;
  }

  // Part Request Creation (Flow 4.1) - Síncrono com persistência atômica imediata
  createPartRequest(
    customerId: string,
    data: {
      vehicleType: VehicleCategory;
      vehicleBrand: string;
      vehicleModel: string;
      vehicleYear: number;
      vehicleEngine?: string;
      vehiclePlate?: string;
      vehicleChassi?: string;
      partIdentificationType: PartIdentificationType;
      partName: string;
      partCategory: string;
      categoryId?: string;
      categoryName?: string;
      partSubcategory?: string;
      oemCode?: string;
      description?: string;
      mediaUrl?: string;
      mediaUrls?: string[];
      mediaType?: 'photo' | 'video';
      extraParts?: PartRequestExtraPart[];
      deliveryAddress: PartRequest['deliveryAddress'];
      clientGpsVerified?: boolean;
    }
  ): PartRequest {
    const newRequest = this.buildPartRequestLocally(customerId, data);
    void this.syncRequestCreationToServer(newRequest);
    return newRequest;
  }

  // Part Request Creation assíncrona garantindo entrega ao servidor antes de prosseguir
  async createPartRequestRemote(
    customerId: string,
    data: {
      vehicleType: VehicleCategory;
      vehicleBrand: string;
      vehicleModel: string;
      vehicleYear: number;
      vehicleEngine?: string;
      vehiclePlate?: string;
      vehicleChassi?: string;
      partIdentificationType: PartIdentificationType;
      partName: string;
      partCategory: string;
      categoryId?: string;
      categoryName?: string;
      partSubcategory?: string;
      oemCode?: string;
      description?: string;
      mediaUrl?: string;
      mediaUrls?: string[];
      mediaType?: 'photo' | 'video';
      extraParts?: PartRequestExtraPart[];
      deliveryAddress: PartRequest['deliveryAddress'];
      clientGpsVerified?: boolean;
    }
  ): Promise<PartRequest> {
    const newRequest = this.buildPartRequestLocally(customerId, data);
    await this.syncRequestCreationToServer(newRequest);
    return this.getRequestById(newRequest.id) || newRequest;
  }

  // Verifica e processa solicitações que venceram 16 minutos sem orçamento (em 4 tentativas encerra como NENHUM FORNECEDOR DISPONÍVEL)
  processExpiredRequests(): boolean {
    const now = Date.now();
    let changed = false;

    this.data.requests.forEach(req => {
      if (req.status !== 'aguardando_orcamentos') return;
      if (this.isRequestPaid(req.id)) return;

      const reqQuotes = this.data.quotes.filter(q => q.requestId === req.id);
      if (reqQuotes.length > 0) return;

      const targetIso = req.attemptExpiresAt || req.expiresAt;
      if (!targetIso) return;
      const targetMs = new Date(targetIso).getTime();
      if (!Number.isFinite(targetMs) || now < targetMs) return;

      const currentAttempt = req.searchAttempt || 1;
      const maxAttempts = req.maxSearchAttempts || 4;

      if (currentAttempt >= maxAttempts) {
        req.status = 'sem_fornecedor';
        req.closedReason = 'nenhum_fornecedor_disponivel';
        this.appendRequestHistory(
          req,
          'Encerrado: NENHUM FORNECEDOR DISPONÍVEL',
          `0 OFERTAS RECEBIDAS após ${maxAttempts} solicitações (raio até ${req.searchRadiusKm} km). Chamado encerrado automaticamente.`,
          'sistema',
          'Robô AUTO SHOP',
          { radiusKm: req.searchRadiusKm, attemptNumber: currentAttempt }
        );
        this.logAudit(
          'sistema',
          'Chamado Encerrado: NENHUM FORNECEDOR DISPONÍVEL',
          'request',
          req.id,
          `Solicitação ${req.requestNumber} encerrada com 0 ofertas recebidas após ${maxAttempts} tentativas (até ${req.searchRadiusKm} km).`
        );
        changed = true;
      } else {
        const alreadyLogged = (req.statusHistory || []).some(
          h => h.attemptNumber === currentAttempt && h.stage.includes('16 min sem orçamento')
        );
        if (!alreadyLogged) {
          this.appendRequestHistory(
            req,
            `Prazo de 16 min sem orçamento (Tentativa ${currentAttempt}/${maxAttempts})`,
            'Nenhuma proposta recebida em 16 minutos. Cliente liberado para clicar em REFAZER SOLICITAÇÃO.',
            'sistema',
            'Robô AUTO SHOP',
            { radiusKm: req.searchRadiusKm, attemptNumber: currentAttempt }
          );
          this.logAudit(
            'sistema',
            'Aviso 16 Minutos Sem Orçamento',
            'request',
            req.id,
            `Solicitação ${req.requestNumber} atingiu 16 minutos na tentativa ${currentAttempt}/${maxAttempts} sem cotações. Aguardando cliente clicar em REFAZER SOLICITAÇÃO.`
          );
          changed = true;
        }
      }
    });

    if (changed) {
      this.save();
    }
    return changed;
  }

  // Cliente clica em REFAZER SOLICITAÇÃO após 16 min sem orçamento: dobra raio para +100 km, +200 km até +500 km (máx 4 tentativas)
  retryExpiredRequest(
    requestId: string,
    customerId: string
  ): { success: boolean; closed: boolean; message: string; request?: PartRequest } {
    const req = this.getRequestById(requestId);
    if (!req) {
      return { success: false, closed: false, message: 'Solicitação não encontrada.' };
    }
    if (req.customerId !== customerId) {
      return { success: false, closed: false, message: 'Permissão negada.' };
    }
    if (this.isRequestPaid(req.id) || req.status === 'finalizado') {
      return { success: false, closed: true, message: 'Esta solicitação já possui compra paga.', request: req };
    }

    const existingQuotes = this.getQuotes(req.id);
    if (existingQuotes.length > 0) {
      return {
        success: false,
        closed: false,
        message: 'Esta solicitação já recebeu orçamentos e não precisa ser refeita.',
        request: req,
      };
    }

    const currentAttempt = req.searchAttempt || 1;
    const maxAttempts = req.maxSearchAttempts || 4;

    if (currentAttempt >= maxAttempts || req.status === 'sem_fornecedor') {
      req.status = 'sem_fornecedor';
      req.closedReason = 'nenhum_fornecedor_disponivel';
      this.appendRequestHistory(
        req,
        'Encerrado: NENHUM FORNECEDOR DISPONÍVEL',
        'Limite máximo de 4 solicitações atingido com 0 ofertas recebidas.',
        'sistema',
        'Robô AUTO SHOP',
        { radiusKm: req.searchRadiusKm, attemptNumber: currentAttempt }
      );
      this.save();
      return {
        success: false,
        closed: true,
        message: 'NENHUM FORNECEDOR DISPONÍVEL após 4 tentativas (0 ofertas recebidas).',
        request: req,
      };
    }

    const nextAttempt = currentAttempt + 1;
    const radiusByAttempt: Record<number, number> = {
      1: 50,
      2: 100,
      3: 200,
      4: 500,
    };
    const nextRadius = radiusByAttempt[nextAttempt] || 500;
    const nowIso = new Date().toISOString();
    const timers = this.getTimerSettings();
    const windowMinutes = Math.max(1, timers.supplierResponseTimeoutMinutes || 16);
    const nextWindowIso = new Date(Date.now() + windowMinutes * 60 * 1000).toISOString();

    req.searchAttempt = nextAttempt;
    req.maxSearchAttempts = maxAttempts;
    req.searchRadiusKm = nextRadius;
    req.autoExpanded = true;
    req.status = 'aguardando_orcamentos';
    req.lastAttemptAt = nowIso;
    req.expiresAt = nextWindowIso;
    req.attemptExpiresAt = nextWindowIso;

    // Libera fornecedores distantes que eventualmente recusaram ou expiraram na janela menor
    if (this.data.rejected_supplier_requests) {
      this.data.rejected_supplier_requests = this.data.rejected_supplier_requests.filter(
        r => r.requestId !== req.id
      );
    }

    const customer = this.getUserById(customerId);
    this.appendRequestHistory(
      req,
      `REFAZER SOLICITAÇÃO · Tentativa ${nextAttempt}/${maxAttempts} (+${nextRadius} km)`,
      `Cliente solicitou nova busca de fornecedores mais distantes. Raio ampliado para ${nextRadius} km por mais 16 minutos.`,
      'cliente',
      customer?.name,
      { radiusKm: nextRadius, attemptNumber: nextAttempt }
    );

    this.data.audit_logs.unshift({
      id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: nowIso,
      userId: customerId,
      userPhone: customer?.phone || 'sistema',
      userRole: customer?.role || 'cliente',
      action: `Refazer Solicitação (${nextAttempt}/${maxAttempts} · ${nextRadius} km)`,
      entityType: 'request',
      entityId: req.id,
      details: `Cliente clicou em REFAZER SOLICITAÇÃO para ${req.requestNumber}. Raio dobrado/ampliado automaticamente para ${nextRadius} km.`,
      ipAddress: 'dispositivo-cliente',
    });

    this.saveLocalOnly();
    void this.syncRequestRetryToServer(req.id, customerId);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('compe:new_request', { detail: req }));
    }

    return {
      success: true,
      closed: false,
      message: `Nova solicitação enviada (${nextAttempt}/${maxAttempts}) buscando fornecedores em até ${nextRadius} km!`,
      request: req,
    };
  }

  private buildAndStoreQuoteLocally(
    supplierId: string,
    data: {
      requestId: string;
      availability?: AvailabilityType;
      condition?: PartCondition;
      brand?: string;
      partCode?: string;
      partPrice: number;
      shippingPrice?: number;
      deliveryDays?: number;
      deliveryHours?: number;
      shippingMethod?: string;
      technicalDetails?: string;
      warrantyDays?: number;
      observations?: string;
      photoUrl?: string;
    }
  ): Quote {
    const supplier = this.getUserById(supplierId);
    if (!supplier) throw new Error('Fornecedor não encontrado');

    const req = this.getRequestById(data.requestId);
    if (!req) throw new Error('Solicitação não encontrada');

    if (
      this.isRequestPaid(req.id) ||
      req.status === 'finalizado' ||
      req.status === 'cancelado' ||
      req.status === 'sem_fornecedor'
    ) {
      throw new Error('Esta solicitação já foi comprada/paga ou encerrada e não aceita novos orçamentos.');
    }

    const tier = supplier.supplierTier || 'opcao_2';
    const condition = data.condition || 'nova';
    const availability = data.availability || 'estoque';
    const partPrice = Number(data.partPrice);
    const shippingPrice = Number(data.shippingPrice) || 0;

    if (!Number.isFinite(partPrice) || partPrice <= 0) {
      throw new Error('Informe um valor válido maior que zero para a peça.');
    }
    if (!Number.isFinite(shippingPrice) || shippingPrice < 0) {
      throw new Error('Valor de entrega/frete inválido.');
    }

    const totalPrice = Number((partPrice + shippingPrice).toFixed(2));
    const resolvedPhotoUrl =
      (data.photoUrl && data.photoUrl.trim()) ||
      req.mediaUrl ||
      this.getCustomizationSettings().defaultPartImageUrl ||
      '/assets/aistudio/M1_AUTO_LOGO_3c381c58.jpg';

    const distDetails = this.getDistanceDetailsSupplierToRequest(supplier, req);
    const nowIso = new Date().toISOString();

    const newQuote: Quote = {
      id: `quo_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      requestId: data.requestId,
      supplierId,
      supplierName: supplier.companyName || supplier.name,
      supplierPhone: supplier.phone,
      supplierRating: supplier.rating || 4.8,
      supplierTier: tier,
      supplierLogoUrl:
        tier === 'opcao_3'
          ? supplier.avatarUrl || '/assets/aistudio/M1_AUTO_LOGO_3c381c58.jpg'
          : undefined,
      availability,
      condition,
      distanceKm: distDetails?.distanceKm,
      distanceSource: distDetails?.source,
      brand: data.brand?.trim() || (tier === 'opcao_1' ? 'Genuína / Original' : 'Peça Qualificada'),
      partCode: data.partCode || req.oemCode || '',
      partPrice: Number(partPrice.toFixed(2)),
      shippingPrice: Number(shippingPrice.toFixed(2)),
      totalPrice,
      deliveryDays: Math.max(1, Number(data.deliveryDays) || 1),
      deliveryHours: data.deliveryHours,
      shippingMethod: data.shippingMethod || (tier === 'opcao_1' ? 'Motoboy Express Local' : 'Transportadora'),
      technicalDetails: data.technicalDetails,
      warrantyDays: Number(data.warrantyDays) || 90,
      observations: data.observations,
      photoUrl: resolvedPhotoUrl,
      status: 'pendente',
      createdAt: nowIso,
    };

    this.pendingLocalQuotes.set(newQuote.id, newQuote);
    this.data.quotes.push(newQuote);

    // Atualiza status da solicitação para 'orcamentos_recebidos' e o cronômetro do cliente
    if (req.status === 'aguardando_orcamentos') {
      req.status = 'orcamentos_recebidos';
    }
    const timers = this.getTimerSettings();
    req.clientExpiresAt = new Date(Date.now() + timers.clientApprovalTimeoutMinutes * 60 * 1000).toISOString();

    this.appendRequestHistory(
      req,
      'Orçamento Recebido do Fornecedor',
      `${supplier.companyName || supplier.name} cotou R$ ${totalPrice.toFixed(2)} (${distDetails ? `${distDetails.distanceKm.toFixed(1)} km` : 'distância CEP'})`,
      'fornecedor',
      supplier.companyName || supplier.name,
      { radiusKm: req.searchRadiusKm, attemptNumber: req.searchAttempt || 1 }
    );

    this.data.audit_logs.unshift({
      id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: nowIso,
      userId: supplierId,
      userPhone: supplier.phone,
      userRole: supplier.role,
      action: 'Envio de Orçamento',
      entityType: 'quote',
      entityId: newQuote.id,
      details: `Orçamento de R$ ${totalPrice.toFixed(2)} (${tier.toUpperCase()}) enviado para a solicitação ${req.requestNumber}. Aguardando aceite do cliente.`,
      ipAddress: 'dispositivo-fornecedor',
    });

    this.saveLocalOnly();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('compe:new_quote', { detail: newQuote }));
    }
    return newQuote;
  }

  // Supplier Quote Submission (Flow 5) - Síncrono com persistência atômica imediata
  submitQuote(
    supplierId: string,
    data: {
      requestId: string;
      availability?: AvailabilityType;
      condition?: PartCondition;
      brand?: string;
      partCode?: string;
      partPrice: number;
      shippingPrice?: number;
      deliveryDays?: number;
      deliveryHours?: number;
      shippingMethod?: string;
      technicalDetails?: string;
      warrantyDays?: number;
      observations?: string;
      photoUrl?: string;
    }
  ): Quote {
    const newQuote = this.buildAndStoreQuoteLocally(supplierId, data);
    void this.syncQuoteCreationToServer(newQuote);
    return newQuote;
  }

  // Supplier Quote Submission assíncrona garantindo entrega ao servidor sem retornos
  async submitQuoteRemote(
    supplierId: string,
    data: {
      requestId: string;
      availability?: AvailabilityType;
      condition?: PartCondition;
      brand?: string;
      partCode?: string;
      partPrice: number;
      shippingPrice?: number;
      deliveryDays?: number;
      deliveryHours?: number;
      shippingMethod?: string;
      technicalDetails?: string;
      warrantyDays?: number;
      observations?: string;
      photoUrl?: string;
    }
  ): Promise<Quote> {
    const newQuote = this.buildAndStoreQuoteLocally(supplierId, data);
    const syncRes = await this.syncQuoteCreationToServer(newQuote);
    if (!syncRes.ok) {
      // Reverte estado otimista local se o servidor rejeitou por regra de negócio (ex: já pago)
      this.pendingLocalQuotes.delete(newQuote.id);
      this.data.quotes = this.data.quotes.filter(q => q.id !== newQuote.id);
      this.saveLocalOnly();
      throw new Error(syncRes.message || 'Erro ao enviar orçamento para o cliente.');
    }
    return this.data.quotes.find(q => q.id === newQuote.id) || newQuote;
  }

  // Create Order with Split Payment (Flow 4.3)
  createOrder(
    customerId: string,
    quoteId: string,
    paymentMethod: PaymentMethod
  ): OrderAndPayment {
    const quote = this.data.quotes.find(q => q.id === quoteId);
    if (!quote) throw new Error('Orçamento não encontrado');
    const req = this.getRequestById(quote.requestId);
    if (!req) throw new Error('Solicitação não encontrada');
    if (this.isRequestPaid(req.id)) {
      throw new Error('Este pedido já foi comprado e pago.');
    }
    const customer = this.getUserById(customerId);
    const supplier = this.getUserById(quote.supplierId);

    // Commission rate: check supplier override or general
    const rate = supplier?.commissionRateOverride ?? this.data.commission_settings.generalCommissionPercent;
    const totalAmount = quote.totalPrice;
    const platformCommissionAmount = Number(((quote.partPrice * rate) / 100).toFixed(2));
    const supplierTransferAmount = Number((totalAmount - platformCommissionAmount).toFixed(2));

    // Generate secure 4-digit PIN for client delivery reception
    const pinDeliveryCode = Math.floor(1000 + Math.random() * 9000).toString();
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const seq = (this.data.orders_and_payments.length + 1).toString().padStart(8, '0');
    const orderNumber = `${yy}.${mm}.${seq}`;

    const nfeNumber = `NF-e Emitida: ${Math.floor(1000 + Math.random() * 9000)} - Série 1`;
    const nfeSerie = '1';
    const nfeKey = `352602${supplier?.document.replace(/\D/g, '').padEnd(14, '0')}55001${orderNumber.replace(/\D/g, '').padStart(9, '0')}100${pinDeliveryCode}`;

    const pixCode = `00020126580014br.gov.bcb.pix0136autoshop-gateway-${orderNumber.toLowerCase()}520400005303986540${totalAmount.toFixed(2).length}${totalAmount.toFixed(2)}5802BR5917AUTO SHOP PLATAF6009SAO PAULO62070503***63047A8F`;

    const paidTimestamp = new Date().toISOString();
    const supplierWalletId = supplier?.gatewayWalletId || `wallet_${supplier?.gatewayProvider || 'asaas'}_${supplier?.id || 'parceiro'}`;
    const gatewayProvider = supplier?.gatewayProvider || 'asaas';
    const gatewayChargeId = `chg_local_${Date.now().toString(36)}`;

    const newOrder: OrderAndPayment = {
      id: `ord_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      orderNumber,
      requestId: req.id,
      quoteId: quote.id,
      customerId,
      supplierId: quote.supplierId,
      partName: req.partName,
      vehicleSummary: `${req.vehicleBrand} ${req.vehicleModel} ${req.vehicleYear}`,
      partPrice: quote.partPrice,
      shippingPrice: quote.shippingPrice,
      totalAmount,
      platformCommissionRate: rate,
      platformCommissionAmount,
      supplierTransferAmount,
      paymentMethod,
      paymentStatus: 'confirmado',
      pixCode,
      nfeKey,
      nfeNumber,
      nfeSerie,
      pinDeliveryCode,
      deliveryStatus: 'compra_confirmada',
      supplierTier: quote.supplierTier || supplier?.supplierTier || 'opcao_2',
      supplierPaymentType: supplier?.supplierPaymentType || 'compe_split',
      cancellationPenaltyNotice: '< ATENÇÃO: A PARTIR DAQUI NÃO SERÁ POSSÍVEL CANCELAR, O CANCELAMENTO ACARRETARÁ EM PAGAMENTO DE TAXA PARA A AUTO SHOP E CUSTOS COM AS TRANSAÇÕES BANCÁRIAS >',
      deliveryAddress: { ...req.deliveryAddress },
      supplierReceiptConfirmed: false,
      gatewayProvider,
      gatewayChargeId,
      splitStatus: 'dividido_pago',
      splitBreakdown: {
        provider: gatewayProvider,
        platformWalletId: 'wallet_master_autoshop_001',
        platformFeePercent: rate,
        platformAmount: platformCommissionAmount,
        supplierWalletId,
        supplierSubaccountId: supplier?.gatewaySubaccountId,
        supplierAmount: supplierTransferAmount,
        gatewaySplitId: `spl_${gatewayChargeId}`,
        processedAt: paidTimestamp,
      },
      createdAt: paidTimestamp,
      paidAt: paidTimestamp,
      statusHistory: [
        this.createStatusHistoryEntry(
          'Compra Paga · Movida para Histórico de Compras',
          `Pagamento ${paymentMethod.toUpperCase()} confirmado (R$ ${totalAmount.toFixed(2)}). Pedido ${orderNumber} enviado ao fornecedor ${supplier?.companyName || supplier?.name || ''}.`,
          'cliente',
          customer?.name
        ),
      ],
    };

    // Mark quote as accepted, others for same request as rejected
    this.data.quotes.forEach(q => {
      if (q.requestId === req.id) {
        q.status = q.id === quote.id ? 'aceito' : 'rejeitado';
      }
    });

    req.status = 'finalizado';
    req.closedReason = 'pedido_pago';
    this.appendRequestHistory(
      req,
      'Pedido Comprado e Pago (Saiu das Solicitações)',
      `Pedido ${orderNumber} pago via ${paymentMethod.toUpperCase()} por R$ ${totalAmount.toFixed(2)}. Solicitação encerrada para novos orçamentos.`,
      'cliente',
      customer?.name,
      { radiusKm: req.searchRadiusKm, attemptNumber: req.searchAttempt || 1 }
    );

    this.data.orders_and_payments.unshift(newOrder);
    if (!this.data.split_transactions) this.data.split_transactions = [];
    this.data.split_transactions.unshift({
      id: `spl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      orderId: newOrder.id,
      orderNumber,
      requestId: req.id,
      customerId,
      supplierId: quote.supplierId,
      supplierName: supplier?.companyName || supplier?.name || quote.supplierName,
      supplierDocument: supplier?.document,
      gatewayProvider,
      gatewayChargeId,
      supplierWalletId,
      supplierSubaccountId: supplier?.gatewaySubaccountId,
      platformWalletId: 'wallet_master_autoshop_001',
      paymentMethod,
      grossAmount: totalAmount,
      platformFeePercent: rate,
      platformAmount: platformCommissionAmount,
      supplierNetAmount: supplierTransferAmount,
      status: 'dividido_pago',
      notes: 'Split registrado com sucesso.',
      createdAt: paidTimestamp,
      updatedAt: paidTimestamp,
    });

    this.logAudit(
      customerId,
      'Compra Realizada e Pagamento Confirmado',
      'order',
      newOrder.id,
      `Pedido ${orderNumber} criado e pago via ${paymentMethod.toUpperCase()}. Total: R$ ${totalAmount.toFixed(2)} (Split: R$ ${platformCommissionAmount.toFixed(2)} AUTO SHOP / R$ ${supplierTransferAmount.toFixed(2)} Fornecedor). PIN seguro gerado: ${pinDeliveryCode}. NF-e emitida: ${nfeNumber}.`
    );
    this.save();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('compe:order_paid', { detail: newOrder }));
    }
    return newOrder;
  }

  confirmSupplierSaleReceipt(orderId: string, supplierId: string): OrderAndPayment {
    const order = this.getOrderById(orderId);
    if (!order) throw new Error('Pedido não encontrado');
    if (order.supplierId !== supplierId) throw new Error('Permissão negada');

    const supplier = this.getUserById(supplierId);
    const req = this.getRequestById(order.requestId);

    order.supplierReceiptConfirmed = true;
    order.supplierReceiptConfirmedAt = new Date().toISOString();

    this.appendOrderHistory(
      order,
      'Recebimento Confirmado em Conta pelo Fornecedor',
      `${supplier?.companyName || supplier?.name || 'Fornecedor'} confirmou o valor em conta e liberou separação.`,
      'fornecedor',
      supplier?.companyName || supplier?.name
    );
    this.appendRequestHistory(
      req,
      'Fornecedor Confirmou Recebimento em Conta',
      `Pedido ${order.orderNumber} confirmado em conta para separação e envio.`,
      'fornecedor',
      supplier?.companyName || supplier?.name
    );

    this.logAudit(
      supplierId,
      'Confirmação de Recebimento em Conta pelo Fornecedor',
      'payment',
      orderId,
      `Fornecedor confirmou o recebimento em conta do pedido ${order.orderNumber} (R$ ${order.supplierTransferAmount.toFixed(2)} / Total R$ ${order.totalAmount.toFixed(2)}) e liberou para separação e envio.`
    );
    this.save();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('compe:supplier_confirmed_payment', { detail: order }));
      void fetch(apiUrl(`/api/orders/${encodeURIComponent(orderId)}/confirm-receipt`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supplierId }),
      })
        .then(async res => {
          if (!res.ok) return;
          const json = await this.parseJsonSafe<{ revision?: number; data?: DatabaseSchema }>(res);
          if (json?.data) {
            this.applyServerSnapshot(json.data, json.revision);
          }
        })
        .catch(() => {
          // fallback já enviado via save()
        });
    }
    return order;
  }

  // Client or Supplier confirms receipt by attaching photo of delivered/received piece
  confirmDeliveryByPhoto(orderId: string, photoUrl: string, userId: string): OrderAndPayment {
    const order = this.getOrderById(orderId);
    if (!order) throw new Error('Pedido não encontrado');

    const actor = this.getUserById(userId);
    const req = this.getRequestById(order.requestId);

    order.clientConfirmationPhotoUrl = photoUrl;
    order.deliveryStatus = 'entregue';
    order.deliveredAt = new Date().toISOString();

    this.appendOrderHistory(
      order,
      'Recebido e Entregue (Foto Comprovante)',
      `Pedido ${order.orderNumber} confirmado como entregue por foto.`,
      actor?.role || 'cliente',
      actor?.name
    );
    this.appendRequestHistory(
      req,
      'Pedido Entregue (Foto Comprovante)',
      `Pedido ${order.orderNumber} finalizado e entregue ao cliente.`,
      actor?.role || 'cliente',
      actor?.name
    );

    this.logAudit(
      userId,
      'Entrega Concluída com Foto Comprovante',
      'order',
      orderId,
      `Baixa de entrega efetuada para o pedido ${order.orderNumber} via foto de conferência do produto entregue. Repasse financeiro liberado.`
    );
    this.save();
    return order;
  }

  confirmClientDeliveryWithPhoto(orderId: string, photoUrl: string, customerId: string): OrderAndPayment {
    return this.confirmDeliveryByPhoto(orderId, photoUrl, customerId);
  }

  // Supplier updates delivery status and NF-e details
  updateOrderDelivery(
    orderId: string,
    supplierId: string,
    updates: {
      deliveryStatus: OrderDeliveryStatus;
      packagedPhotoUrl?: string;
      trackingCarrier?: string;
      trackingCode?: string;
      motoboyName?: string;
      motoboyPhone?: string;
      motoboyVehicle?: string;
      nfeNumber?: string;
      nfeSerie?: string;
    }
  ) {
    const order = this.getOrderById(orderId);
    if (!order) throw new Error('Pedido não encontrado');
    if (order.supplierId !== supplierId) throw new Error('Permissão negada');

    const supplier = this.getUserById(supplierId);
    const req = this.getRequestById(order.requestId);

    if (updates.packagedPhotoUrl) order.packagedPhotoUrl = updates.packagedPhotoUrl;
    if (updates.trackingCarrier) order.trackingCarrier = updates.trackingCarrier;
    if (updates.trackingCode) order.trackingCode = updates.trackingCode;
    if (updates.motoboyName) order.motoboyName = updates.motoboyName;
    if (updates.motoboyPhone) order.motoboyPhone = updates.motoboyPhone;
    if (updates.motoboyVehicle) order.motoboyVehicle = updates.motoboyVehicle;
    if (updates.nfeNumber) {
      const serie = updates.nfeSerie || order.nfeSerie || '1';
      order.nfeSerie = serie;
      order.nfeNumber = updates.nfeNumber.includes('Série')
        ? updates.nfeNumber
        : `NF-e Emitida: ${updates.nfeNumber} - Série ${serie}`;
    }
    order.deliveryStatus = updates.deliveryStatus;

    const stageLabel =
      updates.deliveryStatus === 'peca_separada'
        ? 'Peça Separada & Embalada'
        : updates.deliveryStatus === 'a_caminho'
        ? 'Encomenda Despachada · A Caminho'
        : updates.deliveryStatus === 'entregue'
        ? 'Pedido Entregue'
        : `Status: ${updates.deliveryStatus}`;

    this.appendOrderHistory(
      order,
      stageLabel,
      `Pedido ${order.orderNumber} atualizado para ${updates.deliveryStatus}. ${order.trackingCarrier || ''} ${order.trackingCode || ''}`.trim(),
      'fornecedor',
      supplier?.companyName || supplier?.name
    );
    this.appendRequestHistory(
      req,
      stageLabel,
      `Pedido ${order.orderNumber}: ${updates.deliveryStatus}. ${order.trackingCarrier || ''} ${order.trackingCode || ''}`.trim(),
      'fornecedor',
      supplier?.companyName || supplier?.name
    );

    this.logAudit(
      supplierId,
      `Atualização de Entrega: ${updates.deliveryStatus}`,
      'order',
      orderId,
      `Fornecedor atualizou status do pedido ${order.orderNumber} para ${updates.deliveryStatus}. Motoboy: ${updates.motoboyName || ''} (${updates.motoboyVehicle || ''}). NF-e: ${order.nfeNumber || 'Não informada'}. Rastreio: ${order.trackingCarrier} ${order.trackingCode || ''}`
    );
    this.save();
  }

  // Validation of 4-digit PIN for Delivery Confirmation (CRITICAL RULE §4.4 & §8)
  validateDeliveryPin(
    orderId: string,
    submittedPin: string,
    validatorUserId: string
  ): { success: boolean; message: string } {
    const order = this.getOrderById(orderId);
    if (!order) return { success: false, message: 'Pedido não encontrado' };

    if (order.pinDeliveryCode !== submittedPin.trim()) {
      this.logAudit(
        validatorUserId,
        'Tentativa Inválida de Validação de PIN',
        'pin_validation',
        orderId,
        `Tentativa incorreta com PIN "${submittedPin}" para o pedido ${order.orderNumber}`
      );
      return { success: false, message: 'PIN de entrega incorreto. Solicite o código de 4 dígitos ao cliente.' };
    }

    const validator = this.getUserById(validatorUserId);
    const req = this.getRequestById(order.requestId);

    order.deliveryStatus = 'entregue';
    order.pinValidatedAt = new Date().toISOString();
    order.deliveredAt = new Date().toISOString();

    this.appendOrderHistory(
      order,
      'Entregue e Recebido (PIN Validado)',
      `PIN ${submittedPin} validado! Pedido ${order.orderNumber} recebido e repasse liberado.`,
      validator?.role || 'fornecedor',
      validator?.companyName || validator?.name
    );
    this.appendRequestHistory(
      req,
      'Entrega Validada com PIN (Concluído)',
      `PIN ${submittedPin} validado no pedido ${order.orderNumber}.`,
      validator?.role || 'fornecedor',
      validator?.companyName || validator?.name
    );

    // Release supplier transfer
    this.logAudit(
      validatorUserId,
      'PIN de Entrega Validado com Sucesso',
      'pin_validation',
      orderId,
      `PIN "${submittedPin}" validado! Pedido ${order.orderNumber} marcado como ENTREGUE. Repasse de R$ ${order.supplierTransferAmount.toFixed(2)} liberado ao fornecedor.`
    );
    this.save();
    return { success: true, message: 'PIN validado com sucesso! Pedido entregue e repasse liberado.' };
  }

  // Customer Evaluation
  submitEvaluation(orderId: string, customerId: string, rating: number, comment?: string) {
    const order = this.getOrderById(orderId);
    if (!order) throw new Error('Pedido não encontrado');

    const newEval: Evaluation = {
      id: `eval_${Date.now()}`,
      orderId,
      customerId,
      supplierId: order.supplierId,
      rating,
      comment,
      createdAt: new Date().toISOString(),
    };

    this.data.evaluations.push(newEval);
    order.customerRatingId = newEval.id;

    // Recalculate supplier average rating
    const supplier = this.getUserById(order.supplierId);
    if (supplier) {
      const allSupplierEvals = this.data.evaluations.filter(e => e.supplierId === supplier.id);
      const totalScore = allSupplierEvals.reduce((acc, curr) => acc + curr.rating, 0);
      supplier.rating = Number((totalScore / allSupplierEvals.length).toFixed(1));
      supplier.totalRatings = allSupplierEvals.length;
    }

    this.logAudit(customerId, 'Avaliação Enviada', 'order', orderId, `Avaliação de ${rating} estrelas para o fornecedor.`);
    this.save();
  }

  // Admin SPAM configuration update / create / delete
  updateSpamConfig(configId: string, updates: Partial<SpamTriggerConfig>, adminId: string) {
    const config = this.data.spams_config.find(c => c.id === configId);
    if (!config) return;
    Object.assign(config, updates);
    this.logAudit(adminId, 'Configuração de SPAM Atualizada', 'spam_config', configId, `Admin alterou template de SPAM: ${config.title}`);
    this.save();
  }

  addSpamConfig(configData: Omit<SpamTriggerConfig, 'id'>, adminId: string): SpamTriggerConfig {
    const newConfig: SpamTriggerConfig = {
      ...configData,
      id: `spam_custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    };
    this.data.spams_config.push(newConfig);
    this.logAudit(adminId, 'Criação de Novo Template de SPAM', 'spam_config', newConfig.id, `Admin criou novo template de SPAM: ${newConfig.title}`);
    this.save();
    return newConfig;
  }

  deleteSpamConfig(configId: string, adminId: string): boolean {
    const target = this.data.spams_config.find(c => c.id === configId);
    if (!target) return false;
    this.data.spams_config = this.data.spams_config.filter(c => c.id !== configId);
    this.logAudit(adminId, 'Exclusão de Template de SPAM', 'spam_config', configId, `Admin excluiu template de SPAM: ${target.title}`);
    this.save();
    return true;
  }

  // Admin Directed SPAM & Recados Direcionados
  dispatchDirectedSpam(
    config: SpamTriggerConfig,
    adminId: string,
    message?: string,
    targetedUserIds?: string[]
  ): DispatchedSpamAlert {
    if (!this.data.dispatched_spams) {
      this.data.dispatched_spams = [];
    }
    const resolvedMessage = message ?? config.targetedMessage ?? config.subtitle;
    const resolvedUsers =
      targetedUserIds !== undefined
        ? targetedUserIds
        : config.targetedAudienceFilter === 'specific'
        ? config.targetedUserIds
        : undefined;

    const alert: DispatchedSpamAlert = {
      id: `dsp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      config: {
        ...config,
        targetedNoticeEnabled: true,
        targetedMessage: resolvedMessage,
      },
      targetAudience: config.targetAudience,
      targetedUserIds: resolvedUsers && resolvedUsers.length > 0 ? resolvedUsers : undefined,
      message: resolvedMessage,
      createdByAdminId: adminId,
      createdAt: new Date().toISOString(),
      acknowledgedByUserIds: [],
    };
    this.data.dispatched_spams.unshift(alert);
    this.logAudit(
      adminId,
      'Disparo de SPAM / Recado Direcionado',
      'spam_config',
      alert.id,
      `Admin enviou SPAM "${config.title}" para ${config.targetAudience.toUpperCase()}${
        alert.targetedUserIds ? ` (${alert.targetedUserIds.length} usuário(s) específico(s))` : ' (todos)'
      }.`
    );
    this.save();
    return alert;
  }

  getPendingDispatchedSpamForUser(user: User | null): DispatchedSpamAlert | null {
    if (!user || user.status === 'bloqueado') return null;
    const list = this.data.dispatched_spams || [];
    const maxAgeMs = 7 * 24 * 60 * 60 * 1000;
    return (
      list.find((item) => {
        if (item.targetAudience !== user.role) return false;
        if (item.acknowledgedByUserIds?.includes(user.id)) return false;
        if (Date.now() - new Date(item.createdAt).getTime() > maxAgeMs) return false;
        if (item.targetedUserIds && item.targetedUserIds.length > 0) {
          return item.targetedUserIds.includes(user.id);
        }
        return true;
      }) || null
    );
  }

  acknowledgeDispatchedSpam(alertId: string, userId: string) {
    if (!this.data.dispatched_spams) return;
    const item = this.data.dispatched_spams.find(d => d.id === alertId);
    if (!item) return;
    if (!item.acknowledgedByUserIds) item.acknowledgedByUserIds = [];
    if (!item.acknowledgedByUserIds.includes(userId)) {
      item.acknowledgedByUserIds.push(userId);
      this.save();
    }
  }

  // Admin Edit/Delete helpers for Requests, Orders & Audit Logs
  updateRequest(requestId: string, updates: Partial<PartRequest>, adminId: string): PartRequest | undefined {
    const req = this.getRequestById(requestId);
    if (!req) return undefined;
    Object.assign(req, updates);
    this.logAudit(adminId, 'Edição Administrativa de Solicitação', 'request', requestId, `Chamado ${req.requestNumber} editado pelo Admin.`);
    this.save();
    return req;
  }

  updateOrder(orderId: string, updates: Partial<OrderAndPayment>, adminId: string): OrderAndPayment | undefined {
    const ord = this.getOrderById(orderId);
    if (!ord) return undefined;
    Object.assign(ord, updates);
    this.logAudit(adminId, 'Edição Administrativa de Pedido', 'order', orderId, `Pedido ${ord.orderNumber} editado pelo Admin.`);
    this.save();
    return ord;
  }

  updateAuditLog(logId: string, updates: Partial<Pick<AuditLog, 'action' | 'details'>>, adminId: string): AuditLog | undefined {
    const log = this.data.audit_logs.find(l => l.id === logId);
    if (!log) return undefined;
    if (updates.action !== undefined) log.action = updates.action;
    if (updates.details !== undefined) log.details = updates.details;
    this.logAudit(adminId, 'Edição de Registro de Auditoria', 'spam_config', logId, `Registro de auditoria ${logId} editado.`);
    this.save();
    return log;
  }

  deleteAuditLog(logId: string, adminId: string): boolean {
    const existing = this.data.audit_logs.find(l => l.id === logId);
    if (!existing) return false;
    this.data.audit_logs = this.data.audit_logs.filter(l => l.id !== logId);
    this.logAudit(adminId, 'Exclusão de Registro de Auditoria', 'spam_config', logId, `Registro ${logId} excluído pelo Admin.`);
    this.save();
    return true;
  }

  // Admin Commission Settings update
  updateCommissionSettings(settings: Partial<CommissionSettings>, adminId: string) {
    Object.assign(this.data.commission_settings, settings);
    this.logAudit(adminId, 'Configurações de Comissão e Repasse Atualizadas', 'spam_config', 'settings', `Comissão geral ajustada para ${this.data.commission_settings.generalCommissionPercent}%`);
    this.save();
  }

  // Auto-expand search radius if empty after 16 minutes (Rule §6)
  expandSearchRadius(requestId: string, adminId?: string) {
    const req = this.getRequestById(requestId);
    if (!req) return;
    const nextRadius =
      req.searchRadiusKm < 100
        ? 100
        : req.searchRadiusKm < 200
        ? 200
        : Math.min(500, req.searchRadiusKm + 100);
    req.searchRadiusKm = nextRadius;
    req.autoExpanded = true;
    const nowIso = new Date().toISOString();
    const extIso = new Date(Date.now() + 16 * 60 * 1000).toISOString();
    req.lastAttemptAt = nowIso;
    req.expiresAt = extIso;
    req.attemptExpiresAt = extIso;
    const admin = adminId ? this.getUserById(adminId) : undefined;
    this.appendRequestHistory(
      req,
      `Expansão Manual de Raio (${req.searchRadiusKm} km)`,
      `Administrador ampliou o raio da solicitação ${req.requestNumber} para ${req.searchRadiusKm} km.`,
      admin?.role || 'admin',
      admin?.name,
      { radiusKm: req.searchRadiusKm, attemptNumber: req.searchAttempt || 1 }
    );
    this.logAudit(
      adminId || 'sistema',
      'Expansão de Raio de Busca de Fornecedores',
      'request',
      requestId,
      `Raio da solicitação ${req.requestNumber} expandido para ${req.searchRadiusKm} km.`
    );
    this.save();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('compe:new_request', { detail: req }));
    }
  }

  // --- CLASSIFICAÇÃO / MODALIDADE DE SPAM DO FORNECEDOR (ADMIN CRUD) ---
  getSupplierModalities(): SupplierSpamModality[] {
    if (!this.data.supplier_modalities || this.data.supplier_modalities.length === 0) {
      this.data.supplier_modalities = [...INITIAL_SUPPLIER_MODALITIES];
    }
    return this.data.supplier_modalities;
  }

  saveSupplierModality(
    modalityData: Omit<SupplierSpamModality, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
    adminId: string
  ): SupplierSpamModality {
    if (!this.data.supplier_modalities) {
      this.data.supplier_modalities = [...INITIAL_SUPPLIER_MODALITIES];
    }
    const nowIso = new Date().toISOString();
    const cleanEscrita = modalityData.escrita.trim();
    const cleanCondicao = modalityData.condicao.trim();
    const cleanPercent = Number.isFinite(Number(modalityData.porcentagem))
      ? Math.max(0, Math.min(100, Number(modalityData.porcentagem)))
      : 10;

    if (modalityData.id) {
      const existing = this.data.supplier_modalities.find(m => m.id === modalityData.id);
      if (existing) {
        existing.escrita = cleanEscrita;
        existing.condicao = cleanCondicao;
        existing.porcentagem = cleanPercent;
        existing.baseTier = modalityData.baseTier;
        existing.updatedAt = nowIso;

        // Mantém fornecedores vinculados atualizados com a classificação editada
        this.data.users.forEach(u => {
          if (u.role === 'fornecedor' && u.supplierModalityId === existing.id) {
            u.supplierClassificationEscrita = existing.escrita;
            u.supplierClassificationCondicao = existing.condicao;
            u.supplierClassificationPercent = existing.porcentagem;
            u.commissionRateOverride = existing.porcentagem;
            u.supplierTier = existing.baseTier;
          }
        });

        this.logAudit(
          adminId,
          'Edição de Classificação / Modalidade de SPAM do Fornecedor',
          'spam_config',
          existing.id,
          `Modalidade "${existing.escrita}" (${existing.porcentagem}%): ${existing.condicao}`
        );
        this.save();
        return existing;
      }
    }

    const created: SupplierSpamModality = {
      id: `mod_custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      escrita: cleanEscrita,
      condicao: cleanCondicao,
      porcentagem: cleanPercent,
      baseTier: modalityData.baseTier || 'opcao_2',
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    this.data.supplier_modalities.push(created);
    this.logAudit(
      adminId,
      'Criação de Classificação / Modalidade de SPAM do Fornecedor',
      'spam_config',
      created.id,
      `Modalidade "${created.escrita}" (${created.porcentagem}%): ${created.condicao}`
    );
    this.save();
    return created;
  }

  deleteSupplierModality(modalityId: string, adminId: string): boolean {
    const list = this.getSupplierModalities();
    const target = list.find(m => m.id === modalityId);
    if (!target) return false;
    this.data.supplier_modalities = list.filter(m => m.id !== modalityId);
    this.logAudit(
      adminId,
      'Exclusão de Classificação / Modalidade de SPAM do Fornecedor',
      'spam_config',
      modalityId,
      `Modalidade "${target.escrita}" removida pelo Administrador.`
    );
    this.save();
    return true;
  }

  // --- ANÚNCIOS PARA CLIENTES (TELA INICIAL 3s + RODAPÉ PROGRAMÁVEL) ---
  getClientAdsSettings(): ClientAdsSettings {
    if (!this.data.client_ads_settings) {
      this.data.client_ads_settings = { ...INITIAL_CLIENT_ADS_SETTINGS, items: [] };
    }
    return {
      ...INITIAL_CLIENT_ADS_SETTINGS,
      ...this.data.client_ads_settings,
      items: Array.isArray(this.data.client_ads_settings.items)
        ? this.data.client_ads_settings.items
        : [],
    };
  }

  updateClientAdsSettings(settings: Partial<ClientAdsSettings>, adminId: string): ClientAdsSettings {
    const current = this.getClientAdsSettings();
    const updated: ClientAdsSettings = {
      ...current,
      ...settings,
      items: Array.isArray(settings.items) ? settings.items : current.items,
      updatedAt: new Date().toISOString(),
    };
    this.data.client_ads_settings = updated;
    this.logAudit(
      adminId,
      'Atualização de Anúncios para Clientes',
      'spam_config',
      'client_ads_settings',
      `Modo rodapé: ${updated.footerMode} (${updated.intervalSeconds}s) · Abertura ${updated.showOnStartupSplash ? `${updated.startupSplashSeconds}s` : 'desativada'} · ${updated.items.length} anúncio(s).`
    );
    this.saveLocalOnly();

    if (typeof window !== 'undefined') {
      this.cancelPendingPush();
      void fetch(apiUrl('/api/admin/client-ads'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      })
        .then(res => res.json())
        .then((json: { ok?: boolean; revision?: number; data?: DatabaseSchema; client_ads_settings?: ClientAdsSettings }) => {
          if (json?.ok && json.data) {
            this.applyServerSnapshot(json.data, json.revision);
          } else if (json?.ok && typeof json.revision === 'number') {
            this.serverRevision = Math.max(this.serverRevision, json.revision);
          }
        })
        .catch(() => {
          this.schedulePushToServer();
        });
    }

    return updated;
  }

  async updateClientAdsSettingsRemote(
    settings: Partial<ClientAdsSettings>,
    adminId: string
  ): Promise<{ ok: boolean; settings: ClientAdsSettings; message?: string }> {
    const current = this.getClientAdsSettings();
    const updated: ClientAdsSettings = {
      ...current,
      ...settings,
      items: Array.isArray(settings.items) ? settings.items : current.items,
      updatedAt: new Date().toISOString(),
    };
    this.data.client_ads_settings = updated;
    this.logAudit(
      adminId,
      'Atualização de Anúncios para Clientes',
      'spam_config',
      'client_ads_settings',
      `Exibição: ${updated.enabled ? 'ATIVA' : 'DESATIVADA'} · Rodapé: ${updated.footerMode} (${updated.intervalSeconds}s) · ${updated.items.length} anúncio(s).`
    );
    this.saveLocalOnly();

    if (typeof window !== 'undefined') {
      try {
        this.cancelPendingPush();
        const res = await fetch(apiUrl('/api/admin/client-ads'), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          cache: 'no-store',
          body: JSON.stringify(updated),
        });
        const json = await this.parseJsonSafe<{
          ok?: boolean;
          message?: string;
          revision?: number;
          client_ads_settings?: ClientAdsSettings;
          data?: DatabaseSchema;
        }>(res);
        if (res.ok && json?.ok) {
          if (json.data) {
            this.applyServerSnapshot(json.data, json.revision);
          } else if (typeof json.revision === 'number') {
            this.serverRevision = Math.max(this.serverRevision, json.revision);
          }
          return { ok: true, settings: json.client_ads_settings || this.getClientAdsSettings() };
        }
        return { ok: false, settings: this.getClientAdsSettings(), message: json?.message || 'Erro ao salvar anúncios.' };
      } catch {
        await this.pushToServerNow();
      }
    }

    return { ok: true, settings: this.getClientAdsSettings() };
  }

  // Compressão rápida e upload atômico para fotos de solicitações e chat
  async compressAndUploadImageFile(
    file: File,
    maxDim = 1280,
    quality = 0.82
  ): Promise<{ ok: boolean; url?: string; message?: string }> {
    let uploadTarget = file;
    if (typeof window !== 'undefined' && file.type.startsWith('image/') && !file.type.includes('svg')) {
      try {
        const compressed = await new Promise<File | null>(resolve => {
          const reader = new FileReader();
          reader.onload = () => {
            const img = new Image();
            img.onload = () => {
              let { width, height } = img;
              if (width > maxDim || height > maxDim) {
                const ratio = Math.min(maxDim / width, maxDim / height);
                width = Math.max(1, Math.round(width * ratio));
                height = Math.max(1, Math.round(height * ratio));
              }
              const canvas = document.createElement('canvas');
              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              if (!ctx) {
                resolve(null);
                return;
              }
              ctx.drawImage(img, 0, 0, width, height);
              canvas.toBlob(
                blob => {
                  if (!blob) {
                    resolve(null);
                    return;
                  }
                  const outName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
                  resolve(new File([blob], outName, { type: 'image/jpeg' }));
                },
                'image/jpeg',
                quality
              );
            };
            img.onerror = () => resolve(null);
            img.src = String(reader.result || '');
          };
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(file);
        });
        if (compressed && compressed.size < file.size) {
          uploadTarget = compressed;
        }
      } catch {
        // Fallback para arquivo original
      }
    }
    const res = await this.uploadSharedMediaFile(uploadTarget);
    return { ok: res.ok, url: res.url, message: res.message };
  }

  // --- UPLOAD / REMOÇÃO DE MATERIAIS DO ADMIN (PDF, IMAGEM, VÍDEO) ---
  async uploadSharedMediaFile(file: File): Promise<{
    ok: boolean;
    url?: string;
    fileName?: string;
    mimeType?: string;
    sizeBytes?: number;
    message?: string;
  }> {
    try {
      const res = await fetch(apiUrl('/api/media/upload'), {
        method: 'POST',
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
          'X-File-Name': encodeURIComponent(file.name),
          'X-File-Type': file.type || 'application/octet-stream',
        },
        body: file,
      });
      const json = await this.parseJsonSafe<{
        ok?: boolean;
        message?: string;
        url?: string;
        fileName?: string;
        mimeType?: string;
        sizeBytes?: number;
        file?: { url: string; fileName: string; mimeType: string; sizeBytes: number };
      }>(res);
      const uploadedUrl = json?.file?.url || json?.url;
      if (res.ok && json?.ok && uploadedUrl) {
        return {
          ok: true,
          url: uploadedUrl,
          fileName: json.file?.fileName || json.fileName || file.name,
          mimeType: json.file?.mimeType || json.mimeType || file.type,
          sizeBytes: json.file?.sizeBytes || json.sizeBytes || file.size,
        };
      }
      if (json?.message) {
        return { ok: false, message: json.message };
      }
    } catch {
      // Fallback para data URL caso arquivo seja pequeno
    }

    if (file.size <= 4 * 1024 * 1024) {
      const dataUrl = await new Promise<string | null>(resolve => {
        const reader = new FileReader();
        reader.onload = ev => resolve(typeof ev.target?.result === 'string' ? ev.target.result : null);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      });
      if (dataUrl) {
        return {
          ok: true,
          url: dataUrl,
          fileName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
        };
      }
    }

    return {
      ok: false,
      message: 'Falha ao enviar arquivo para o servidor. Verifique o tamanho (máx 50MB) e a conexão.',
    };
  }

  async deleteSharedMediaFile(url?: string): Promise<void> {
    if (!url) return;
    const match = url.match(/\/api\/media\/([^/?#]+)/);
    if (!match?.[1]) return;
    try {
      await fetch(apiUrl(`/api/media/${encodeURIComponent(match[1])}`), {
        method: 'DELETE',
      });
    } catch {
      // ignore
    }
  }

  // Reset database to default demo state
  resetToDefaults() {
    this.data = this.getDefaults();
    this.save();
  }
}

export const db = new DatabaseService();
