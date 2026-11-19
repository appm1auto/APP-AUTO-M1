/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  User,
  UserRole,
  PersonType,
  DeliveryAddress,
  VehicleCategory,
  PaymentGatewayProvider,
  GatewayBankInfo,
  SupplierPaymentType,
} from '../types';
import { db } from './db';
import { getPortalTargetFromLocation, getRoleDisplayName, isSupplierClassifiedAndApproved, TAB_ACTIVE_ROLE_KEY } from './rbac';
import { estimateCoordinatesFromCep, formatCep, isValidCep } from './geolocation';
import { normalizeBrPhoneDigits, brPhonesMatch } from './phone';
import { apiUrl } from './apiBase';

const SESSION_STORAGE_KEY = 'compe_auth_session_v1';
const LEGACY_SESSION_KEY = 'compe_current_user_id';
const ALL_ROLES: UserRole[] = ['cliente', 'fornecedor', 'admin'];

function getRoleSessionStorageKey(role: UserRole): string {
  return `${SESSION_STORAGE_KEY}_${role}`;
}

interface StoredSession {
  userId: string;
  role: UserRole;
  sessionToken: string;
  issuedAt: string;
  userSnapshot?: User;
}

function safeReadStorage(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const val = window.localStorage?.getItem(key);
    if (val) return val;
  } catch {
    // fallback to sessionStorage
  }
  try {
    return window.sessionStorage?.getItem(key) || null;
  } catch {
    return null;
  }
}

function safeWriteStorage(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage?.setItem(key, value);
  } catch {
    // ignore quota/private mode error
  }
  try {
    window.sessionStorage?.setItem(key, value);
  } catch {
    // ignore
  }
}

function safeRemoveStorage(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage?.removeItem(key);
  } catch {
    // ignore
  }
  try {
    window.sessionStorage?.removeItem(key);
  } catch {
    // ignore
  }
}

class AuthService {
  private sessions: Partial<Record<UserRole, { userId: string; sessionToken: string; userSnapshot?: User }>> = {};
  private pendingRestores: Partial<Record<UserRole, StoredSession>> = {};
  private listeners: Set<() => void> = new Set();
  private pendingSmsCode: { phone: string; code: string; expiresAt: number; tempUserData?: Partial<User> } | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      // Remove sessão legada insegura se existir
      if (safeReadStorage(LEGACY_SESSION_KEY)) {
        safeRemoveStorage(LEGACY_SESSION_KEY);
      }

      // Migra sessão antiga única (se existir) para a chave isolada do seu respectivo perfil
      const legacySingle = safeReadStorage(SESSION_STORAGE_KEY);
      if (legacySingle) {
        try {
          const parsed = JSON.parse(legacySingle) as StoredSession;
          if (parsed?.userId && parsed.sessionToken && parsed.role && ALL_ROLES.includes(parsed.role)) {
            if (!safeReadStorage(getRoleSessionStorageKey(parsed.role))) {
              safeWriteStorage(getRoleSessionStorageKey(parsed.role), legacySingle);
            }
          }
        } catch {
          // ignore
        }
        safeRemoveStorage(SESSION_STORAGE_KEY);
      }

      // Hidrata sessão independente de cada portal (cliente / fornecedor / admin)
      // Mantém o perfil aberto continuamente até que o usuário clique em Sair / Fechar
      for (const role of ALL_ROLES) {
        const key = getRoleSessionStorageKey(role);
        const raw = safeReadStorage(key);
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw) as StoredSession;
          const user = parsed?.userId ? db.getUserById(parsed.userId) : undefined;
          if (
            user &&
            parsed.sessionToken &&
            user.role === role &&
            parsed.role === role &&
            user.status !== 'bloqueado'
          ) {
            this.sessions[role] = {
              userId: user.id,
              sessionToken: parsed.sessionToken,
              userSnapshot: user,
            };
          } else if (
            parsed?.userId &&
            parsed.sessionToken &&
            parsed.role === role &&
            !db.isUserDeleted(parsed.userId)
          ) {
            if (
              parsed.userSnapshot &&
              parsed.userSnapshot.id === parsed.userId &&
              parsed.userSnapshot.role === role &&
              parsed.userSnapshot.status !== 'bloqueado'
            ) {
              this.sessions[role] = {
                userId: parsed.userId,
                sessionToken: parsed.sessionToken,
                userSnapshot: parsed.userSnapshot,
              };
            }
            this.pendingRestores[role] = parsed;
          } else {
            safeRemoveStorage(key);
          }
        } catch {
          safeRemoveStorage(key);
        }
      }

      db.subscribe(() => {
        let updatedAny = false;
        for (const role of ALL_ROLES) {
          const pending = this.pendingRestores[role];
          if (pending) {
            const user = db.getUserById(pending.userId);
            if (user && user.role === role && user.status !== 'bloqueado') {
              this.sessions[role] = {
                userId: user.id,
                sessionToken: pending.sessionToken,
                userSnapshot: user,
              };
              delete this.pendingRestores[role];
              updatedAny = true;
            } else if (db.isUserDeleted(pending.userId) || user?.status === 'bloqueado') {
              delete this.sessions[role];
              delete this.pendingRestores[role];
              safeRemoveStorage(getRoleSessionStorageKey(role));
              updatedAny = true;
            }
          } else if (this.sessions[role]) {
            const liveUser = db.getUserById(this.sessions[role]!.userId);
            if (liveUser) {
              if (liveUser.status === 'bloqueado' || liveUser.role !== role) {
                delete this.sessions[role];
                safeRemoveStorage(getRoleSessionStorageKey(role));
                updatedAny = true;
              } else {
                this.sessions[role]!.userSnapshot = liveUser;
              }
            } else if (db.isUserDeleted(this.sessions[role]!.userId)) {
              delete this.sessions[role];
              safeRemoveStorage(getRoleSessionStorageKey(role));
              updatedAny = true;
            }
          }
        }
        if (updatedAny) {
          this.notify();
        }
      });
    }
  }

  private persistSession(user: User) {
    const token = `tok_${Date.now()}_${Math.random().toString(36).substring(2, 12)}`;
    const snapshot = { ...user };
    this.sessions[user.role] = { userId: user.id, sessionToken: token, userSnapshot: snapshot };
    delete this.pendingRestores[user.role];
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage?.setItem(TAB_ACTIVE_ROLE_KEY, user.role);
      } catch {
        // ignore
      }
      const payload: StoredSession = {
        userId: user.id,
        role: user.role,
        sessionToken: token,
        issuedAt: new Date().toISOString(),
        userSnapshot: snapshot,
      };
      safeWriteStorage(getRoleSessionStorageKey(user.role), JSON.stringify(payload));
    }
  }

  getCurrentUser(portalRole?: UserRole): User | null {
    const targetRole = portalRole || getPortalTargetFromLocation();
    const active = this.sessions[targetRole];
    if (!active) return null;
    if (db.isUserDeleted(active.userId)) return null;

    const user = db.getUserById(active.userId);
    if (user) {
      if (user.role !== targetRole || user.status === 'bloqueado') {
        return null;
      }
      active.userSnapshot = user;
      return user;
    }

    // Fallback seguro durante sincronizações transitórias de rede: nunca fecha o perfil aberto inesperadamente
    if (
      active.userSnapshot &&
      active.userSnapshot.role === targetRole &&
      active.userSnapshot.status !== 'bloqueado'
    ) {
      return active.userSnapshot;
    }
    return null;
  }

  isAuthenticated(portalRole?: UserRole): boolean {
    return this.getCurrentUser(portalRole) !== null;
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(fn => fn());
  }

  // Request SMS / WhatsApp Verification Code (somente Cliente ou Fornecedor)
  requestVerificationCode(phone: string, tempUserData?: Partial<User>): { code: string; channel: 'SMS' | 'WhatsApp' } {
    const cleanPhone = normalizeBrPhoneDigits(phone);
    const safeTemp = tempUserData
      ? {
          ...tempUserData,
          role: tempUserData.role === 'fornecedor' ? ('fornecedor' as UserRole) : ('cliente' as UserRole),
        }
      : undefined;

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    this.pendingSmsCode = {
      phone: cleanPhone,
      code,
      expiresAt: Date.now() + 5 * 60 * 1000,
      tempUserData: safeTemp,
    };
    return {
      code,
      channel: cleanPhone.startsWith('11') || cleanPhone.length === 11 ? 'WhatsApp' : 'SMS',
    };
  }

  getPendingCode() {
    return this.pendingSmsCode;
  }

  verifyCode(phone: string, inputCode: string): { success: boolean; message: string; user?: User } {
    const cleanPhone = normalizeBrPhoneDigits(phone);
    if (!this.pendingSmsCode || this.pendingSmsCode.phone !== cleanPhone) {
      return { success: false, message: 'Nenhum código pendente para este número. Solicite novamente.' };
    }

    if (Date.now() > this.pendingSmsCode.expiresAt) {
      return { success: false, message: 'Código expirado. Por favor, solicite um novo código.' };
    }

    if (this.pendingSmsCode.code !== inputCode.trim()) {
      return { success: false, message: 'Código de verificação incorreto. Tente novamente.' };
    }

    let user = db.getUserByPhone(cleanPhone);

    if (!user && this.pendingSmsCode.tempUserData) {
      const temp = this.pendingSmsCode.tempUserData;
      const safeRole: UserRole = temp.role === 'fornecedor' ? 'fornecedor' : 'cliente';
      if (!temp.password || temp.password.trim().length < 4) {
        return { success: false, message: 'Senha inválida para concluir o cadastro.' };
      }
      user = db.createUser({
        phone: cleanPhone,
        password: temp.password.trim(),
        name: temp.name || 'Novo Usuário',
        email: temp.email || '',
        role: safeRole,
        personType: temp.personType || 'PF',
        document: temp.document || '',
        companyName: temp.companyName,
        categoriesSupplied: safeRole === 'fornecedor' ? (temp.categoriesSupplied || []) : [],
        serviceRadiusKm: safeRole === 'fornecedor' ? (temp.serviceRadiusKm || 50) : 0,
        citiesCovered: temp.citiesCovered || ['São Paulo'],
        status: safeRole === 'fornecedor' ? 'pendente' : 'ativo',
        isClassifiedByAdmin: safeRole === 'fornecedor' ? false : undefined,
        isAvailableForOrders: safeRole === 'fornecedor' ? false : undefined,
        rating: 5.0,
        totalRatings: 0,
        totalSales: 0,
      });
    }

    if (!user) {
      return { success: false, message: 'Usuário não encontrado e dados de cadastro incompletos.' };
    }

    if (user.status === 'bloqueado') {
      return { success: false, message: 'Sua conta está bloqueada pela administração da AUTO SHOP. Entre em contato com o suporte.' };
    }

    this.persistSession(user);
    this.pendingSmsCode = null;
    db.logAudit(user.id, 'Login Realizado com Sucesso (SMS/WhatsApp)', 'user', user.id, `Acesso validado para ${user.name}`);
    this.notify();
    return { success: true, message: 'Login realizado com sucesso!', user };
  }

  private async safeParseJson<T>(res: Response): Promise<{ json: T | null; rawText: string }> {
    const rawText = await res.text();
    if (!rawText) return { json: null, rawText: '' };
    try {
      return { json: JSON.parse(rawText) as T, rawText };
    } catch {
      return { json: null, rawText };
    }
  }

  private async tryLoginEndpoint(
    endpoint: string,
    phone: string,
    password: string,
    expectedRole?: UserRole
  ): Promise<{
    handled: boolean;
    result?: {
      success: boolean;
      message: string;
      user?: User;
      pendingApproval?: boolean;
      actualRole?: UserRole;
      portalMismatch?: boolean;
    };
  }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch(apiUrl(endpoint), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          phone,
          password: password.trim(),
          expectedRole,
        }),
        signal: controller.signal,
      });

      const { json } = await this.safeParseJson<{
        ok?: boolean;
        message?: string;
        user?: User;
        pendingApproval?: boolean;
        actualRole?: UserRole;
        revision?: number;
        data?: unknown;
      }>(res);

      // Se a rota não existir neste servidor (404 / 405 / 501 / HTML SPA fallback), permite fallback
      const isMissingRoute =
        !json ||
        res.status === 404 ||
        res.status === 405 ||
        res.status === 501 ||
        json.message === 'Endpoint de API não encontrado.';

      if (isMissingRoute) {
        return { handled: false };
      }

      if (!res.ok || !json.ok || !json.user) {
        const mismatch = Boolean(
          json.actualRole && expectedRole && json.actualRole !== expectedRole
        );
        return {
          handled: true,
          result: {
            success: false,
            actualRole: json.actualRole,
            portalMismatch: mismatch,
            message: json.message || 'Celular ou senha inválidos.',
          },
        };
      }

      if (json.data) {
        db.applyServerSnapshot(json.data, json.revision);
      } else {
        await db.syncFromServer(true);
      }

      const syncedUser = db.getUserById(json.user.id) || json.user;
      this.persistSession(syncedUser);
      this.notify();

      return {
        handled: true,
        result: {
          success: true,
          pendingApproval: json.pendingApproval,
          message: json.message || `Bem-vindo(a), ${syncedUser.name}!`,
          user: syncedUser,
        },
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Login autoritativo direto no servidor compartilhado (/api/auth/login -> fallback /api/login -> /api/db + local).
   * Garante acesso de Clientes, Fornecedores e Admin em qualquer aparelho externo.
   */
  async loginWithPasswordRemote(
    phone: string,
    password: string,
    expectedRole?: UserRole
  ): Promise<{
    success: boolean;
    message: string;
    user?: User;
    pendingApproval?: boolean;
    actualRole?: UserRole;
    portalMismatch?: boolean;
  }> {
    const cleanPhone = normalizeBrPhoneDigits(phone);
    if (!cleanPhone || cleanPhone.length < 10) {
      return { success: false, message: 'Informe um número de celular válido com DDD.' };
    }

    if (!password || password.trim().length < 4) {
      return { success: false, message: 'Informe sua senha válida (mínimo 4 caracteres).' };
    }

    for (const endpoint of ['/api/auth/login', '/api/login']) {
      try {
        const attempt = await this.tryLoginEndpoint(endpoint, cleanPhone, password, expectedRole);
        if (attempt.handled && attempt.result) {
          return attempt.result;
        }
      } catch {
        // Continua para o próximo endpoint ou fallback
      }
    }

    // Fallback: sincroniza banco compartilhado e autentica localmente
    await db.syncFromServer(true);
    return this.loginWithPassword(phone, password, expectedRole);
  }

  /**
   * Login estrito por Celular + Senha com validação de perfil (RBAC).
   * Sem senha padrão ou acesso sem credenciais válidas.
   */
  loginWithPassword(
    phone: string,
    password: string,
    expectedRole?: UserRole
  ): {
    success: boolean;
    message: string;
    user?: User;
    pendingApproval?: boolean;
    actualRole?: UserRole;
    portalMismatch?: boolean;
  } {
    const cleanPhone = normalizeBrPhoneDigits(phone);
    if (!cleanPhone || cleanPhone.length < 10) {
      return { success: false, message: 'Informe um número de celular válido com DDD.' };
    }

    if (!password || password.trim().length < 4) {
      return { success: false, message: 'Informe sua senha válida (mínimo 4 caracteres).' };
    }

    const user = db.getUserByPhone(cleanPhone);
    if (!user || !user.password) {
      return { success: false, message: 'Celular ou senha inválidos.' };
    }

    if (user.password.trim() !== password.trim()) {
      db.logAudit(
        user.id,
        'Tentativa de Login Falha (Senha Inválida)',
        'user',
        user.id,
        `Tentativa de acesso com senha incorreta para o celular ${cleanPhone}`
      );
      return { success: false, message: 'Celular ou senha inválidos.' };
    }

    if (user.status === 'bloqueado') {
      return {
        success: false,
        message: 'Sua conta está bloqueada pela administração da AUTO SHOP. Entre em contato com o suporte.',
      };
    }

    if (expectedRole && user.role !== expectedRole) {
      db.logAudit(
        user.id,
        'Bloqueio RBAC: Tentativa de Acesso em Portal Incorreto',
        'user',
        user.id,
        `Perfil ${user.role.toUpperCase()} tentou autenticar no portal ${expectedRole.toUpperCase()}`
      );
      return {
        success: false,
        actualRole: user.role,
        portalMismatch: true,
        message: `Acesso negado (RBAC): esta conta pertence ao perfil "${getRoleDisplayName(user.role)}" e não possui permissão no portal "${getRoleDisplayName(expectedRole)}".`,
      };
    }

    db.updateUser(user.id, { lastLogin: new Date().toISOString() }, user.id);
    this.persistSession(user);

    const pendingApproval = user.role === 'fornecedor' && !isSupplierClassifiedAndApproved(user);
    db.logAudit(
      user.id,
      'Login Realizado com Celular e Senha',
      'user',
      user.id,
      `Acesso autenticado para ${user.name} (${user.role.toUpperCase()})${pendingApproval ? ' [Aguardando Homologação/Classificação]' : ''}`
    );
    this.notify();

    return {
      success: true,
      pendingApproval,
      message: pendingApproval
        ? 'Login realizado. Seu cadastro de fornecedor aguarda autorização e classificação do Administrador.'
        : `Bem-vindo(a), ${user.name}!`,
      user,
    };
  }

  private buildNormalizedUserPayload(
    data: Parameters<AuthService['registerWithPassword']>[0],
    cleanPhone: string,
    normalizedAddress: DeliveryAddress,
    resolvedCoords: { lat: number; lng: number } | undefined
  ): User {
    const isSupplier = data.role === 'fornecedor';
    const gatewayPixKey = isSupplier ? data.gatewayPixKey?.trim() || undefined : undefined;
    const gatewayWalletId = isSupplier ? data.gatewayWalletId?.trim() || undefined : undefined;
    const gatewayBankInfo = isSupplier ? data.gatewayBankInfo : undefined;
    const gatewayProvider: PaymentGatewayProvider | undefined = isSupplier
      ? data.gatewayProvider === 'mercadopago'
        ? 'mercadopago'
        : 'asaas'
      : undefined;
    const nowIso = new Date().toISOString();

    return {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      phone: cleanPhone,
      name: data.name.trim(),
      email: '',
      role: data.role,
      password: data.password.trim(),
      personType: data.personType || (data.document.replace(/\D/g, '').length > 11 ? 'PJ' : 'PF'),
      document: data.document.trim(),
      companyName: isSupplier ? (data.companyName?.trim() || data.name.trim()) : undefined,
      avatarUrl: data.avatarUrl || '',
      address: normalizedAddress,
      coordinates: resolvedCoords,
      supplierCategoryIds: isSupplier ? (data.supplierCategoryIds || []) : [],
      categoriesSupplied: isSupplier ? (data.categoriesSupplied || []) : [],
      subcategoriesSupplied: isSupplier ? (data.subcategoriesSupplied || []) : [],
      equipmentTypesSupplied: isSupplier ? (data.equipmentTypesSupplied || ['carro']) : undefined,
      serviceRadiusKm: isSupplier ? (data.serviceRadiusKm ?? 50) : 0,
      citiesCovered: normalizedAddress.city ? [normalizedAddress.city] : ['São Paulo'],
      status: isSupplier ? 'pendente' : 'ativo',
      supplierTier: undefined,
      isClassifiedByAdmin: isSupplier ? false : undefined,
      isAvailableForOrders: false,
      supplierPaymentType: isSupplier ? (data.supplierPaymentType || 'compe_split') : undefined,
      bankAccountOrPix: gatewayPixKey,
      gatewayProvider,
      gatewayPixKey,
      gatewayWalletId,
      gatewayBankInfo,
      gatewayAccountStatus: isSupplier
        ? gatewayWalletId
          ? 'ativa'
          : gatewayPixKey || gatewayBankInfo?.account
          ? 'em_analise'
          : 'nao_configurada'
        : undefined,
      rating: 5.0,
      totalRatings: 0,
      totalSales: 0,
      createdAt: nowIso,
      lastLogin: nowIso,
    };
  }

  private async tryRegisterEndpoint(
    endpoint: string,
    payload: Record<string, unknown>,
    isSupplier: boolean
  ): Promise<{
    handled: boolean;
    result?: {
      success: boolean;
      message: string;
      user?: User;
      pendingApproval?: boolean;
      portalMismatch?: boolean;
    };
  }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const res = await fetch(apiUrl(endpoint), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        cache: 'no-store',
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (res.status === 413) {
        return {
          handled: true,
          result: {
            success: false,
            message: 'A foto enviada é muito grande. Tente enviar uma imagem menor ou cadastrar sem foto.',
          },
        };
      }

      const { json } = await this.safeParseJson<{
        ok?: boolean;
        message?: string;
        pendingApproval?: boolean;
        user?: User;
        revision?: number;
        data?: unknown;
      }>(res);

      // Rota ausente / proxy estático / HTML fallback (404, 405, 501 ou 200 HTML sem JSON): tenta fallback
      const isMissingRoute =
        !json ||
        res.status === 404 ||
        res.status === 405 ||
        res.status === 501 ||
        json.message === 'Endpoint de API não encontrado.';

      if (isMissingRoute) {
        return { handled: false };
      }

      if (!res.ok || !json.ok || !json.user) {
        return {
          handled: true,
          result: {
            success: false,
            message: json.message || 'Não foi possível concluir o cadastro no servidor.',
          },
        };
      }

      if (json.data) {
        db.applyServerSnapshot(json.data, json.revision);
      } else {
        await db.syncFromServer(true);
      }

      const registeredUser = db.getUserById(json.user.id) || json.user;
      this.persistSession(registeredUser);
      this.notify();

      return {
        handled: true,
        result: {
          success: true,
          pendingApproval: json.pendingApproval ?? isSupplier,
          message:
            json.message ||
            (isSupplier
              ? 'Cadastro enviado e salvo no servidor! O Administrador precisa aprovar e classificar seu perfil antes da liberação do painel.'
              : 'Cadastro de Cliente realizado e salvo com sucesso! Bem-vindo à AUTO SHOP.'),
          user: registeredUser,
        },
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private async registerWithFallbackChain(
    data: Parameters<AuthService['registerWithPassword']>[0],
    cleanPhone: string,
    normalizedAddress: DeliveryAddress,
    resolvedCoords: { lat: number; lng: number } | undefined
  ): Promise<{
    success: boolean;
    message: string;
    user?: User;
    pendingApproval?: boolean;
    portalMismatch?: boolean;
  }> {
    const isSupplier = data.role === 'fornecedor';

    // 1. Verifica duplicidade no servidor compartilhado se /api/users ou /api/db estiver acessível
    try {
      const usersRes = await fetch(apiUrl('/api/users'), {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      const { json: usersJson } = await this.safeParseJson<{ ok?: boolean; users?: User[] }>(usersRes);
      if (usersRes.ok && Array.isArray(usersJson?.users)) {
        const dup = usersJson.users.find(u => brPhonesMatch(u.phone, cleanPhone));
        if (dup) {
          return {
            success: false,
            message: 'Já existe uma conta cadastrada com este celular. Faça login com sua senha.',
          };
        }
      }
    } catch {
      // ignora se /api/users não estiver disponível
    }

    await db.syncFromServer(true);
    if (db.getUserByPhone(cleanPhone)) {
      return {
        success: false,
        message: 'Já existe uma conta cadastrada com este celular. Faça login com sua senha.',
      };
    }

    // 2. Fallback para POST /api/users (compatível com versões anteriores do backend)
    const fallbackUser = this.buildNormalizedUserPayload(data, cleanPhone, normalizedAddress, resolvedCoords);
    try {
      const res = await fetch(apiUrl('/api/users'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        cache: 'no-store',
        body: JSON.stringify(fallbackUser),
      });

      if (res.status === 413) {
        return {
          success: false,
          message: 'A foto enviada é muito grande. Tente enviar uma imagem menor ou cadastrar sem foto.',
        };
      }

      const { json } = await this.safeParseJson<{
        ok?: boolean;
        message?: string;
        user?: User;
        revision?: number;
        data?: unknown;
      }>(res);

      if (json && res.status === 409) {
        return {
          success: false,
          message: json.message || 'Já existe uma conta cadastrada com este celular. Faça login com sua senha.',
        };
      }

      if (res.ok && json?.ok && json.user) {
        if (json.data) {
          db.applyServerSnapshot(json.data, json.revision);
        } else {
          await db.syncFromServer(true);
        }
        const synced = db.getUserById(json.user.id) || json.user;
        this.persistSession(synced);
        this.notify();
        return {
          success: true,
          pendingApproval: isSupplier,
          message: isSupplier
            ? 'Cadastro enviado e salvo no servidor! O Administrador precisa aprovar e classificar seu perfil antes da liberação do painel.'
            : 'Cadastro de Cliente realizado e salvo no servidor com sucesso! Bem-vindo à AUTO SHOP.',
          user: synced,
        };
      }
    } catch {
      // Continua para fallback final local + PUT /api/db
    }

    // 3. Fallback final resiliente: registra localmente + sincroniza via PUT /api/db
    const localRes = this.registerWithPassword({
      ...data,
      phone: cleanPhone,
      address: normalizedAddress,
    });

    if (localRes.success) {
      try {
        await db.pushToServerNow();
      } catch {
        // Persistência local garantida mesmo offline/estático; sincronizará ao reconectar
      }
    }

    return localRes;
  }

  /**
   * Cadastro direto no banco compartilhado do servidor (/api/auth/register -> /api/register -> /api/users -> /api/db).
   * Garante que qualquer aparelho externo (IP local, preview ou domínio publicado) conclua o cadastro sem erro 404.
   */
  async registerWithPasswordRemote(data: {
    name: string;
    phone: string;
    password: string;
    role: UserRole;
    document: string;
    companyName?: string;
    address?: DeliveryAddress;
    avatarUrl?: string;
    personType?: PersonType;
    equipmentTypesSupplied?: VehicleCategory[];
    supplierCategoryIds?: string[];
    categoriesSupplied?: string[];
    subcategoriesSupplied?: string[];
    serviceRadiusKm?: number;
    gatewayProvider?: PaymentGatewayProvider;
    gatewayPixKey?: string;
    gatewayWalletId?: string;
    gatewayBankInfo?: GatewayBankInfo;
    supplierPaymentType?: SupplierPaymentType;
  }): Promise<{
    success: boolean;
    message: string;
    user?: User;
    pendingApproval?: boolean;
    portalMismatch?: boolean;
  }> {
    if (data.role !== 'cliente' && data.role !== 'fornecedor') {
      return {
        success: false,
        portalMismatch: true,
        message: 'Acesso negado (RBAC): cadastro público permitido apenas para Cliente ou Fornecedor.',
      };
    }

    const cleanPhone = normalizeBrPhoneDigits(data.phone);
    if (!cleanPhone || cleanPhone.length < 10) {
      return { success: false, message: 'Número de telefone celular inválido (DDD + número).' };
    }

    if (!data.password || data.password.trim().length < 4) {
      return { success: false, message: 'Crie uma senha de no mínimo 4 caracteres.' };
    }

    if (!data.name || data.name.trim().length < 2) {
      return { success: false, message: 'Informe seu nome completo ou Razão Social.' };
    }

    if (!data.document || data.document.replace(/\D/g, '').length < 11) {
      return { success: false, message: 'Informe um CPF ou CNPJ válido.' };
    }

    const isSupplier = data.role === 'fornecedor';

    if (isSupplier && !isValidCep(data.address?.cep)) {
      return {
        success: false,
        message: 'CEP válido (8 dígitos) é obrigatório no cadastro do Fornecedor para definir a geolocalização e o raio de atuação dos chamados.',
      };
    }

    if (!data.address || !isValidCep(data.address.cep) || !data.address.city?.trim() || !data.address.state?.trim()) {
      return { success: false, message: 'Preencha o endereço com CEP válido (8 dígitos), Cidade e UF.' };
    }

    const resolvedCoords =
      data.address.coordinates ||
      (isValidCep(data.address.cep)
        ? estimateCoordinatesFromCep(data.address.cep, data.address.state)
        : undefined);

    const normalizedAddress: DeliveryAddress = {
      ...data.address,
      street: data.address.street?.trim() || 'Área Urbana (CEP)',
      number: data.address.number?.trim() || 'S/N',
      neighborhood: data.address.neighborhood?.trim() || 'Centro',
      city: data.address.city.trim(),
      state: data.address.state.trim().toUpperCase(),
      cep: formatCep(data.address.cep),
      coordinates: resolvedCoords,
    };

    const requestPayload = {
      ...data,
      phone: cleanPhone,
      password: data.password.trim(),
      address: normalizedAddress,
    };

    for (const endpoint of ['/api/auth/register', '/api/register']) {
      try {
        const attempt = await this.tryRegisterEndpoint(endpoint, requestPayload, isSupplier);
        if (attempt.handled && attempt.result) {
          return attempt.result;
        }
      } catch {
        // Em falha de rede, timeout ou 404/HTML de proxy externo, segue para fallback completo
      }
    }

    return this.registerWithFallbackChain(data, cleanPhone, normalizedAddress, resolvedCoords);
  }

  /**
   * Cadastro público restrito a Cliente (liberado direto) e Fornecedor (aprovação + classificação prévia do Admin).
   * Bloqueia criação pública de contas Administrador.
   */
  registerWithPassword(data: {
    name: string;
    phone: string;
    password: string;
    role: UserRole;
    document: string;
    companyName?: string;
    address?: DeliveryAddress;
    avatarUrl?: string;
    personType?: PersonType;
    equipmentTypesSupplied?: VehicleCategory[];
    supplierCategoryIds?: string[];
    categoriesSupplied?: string[];
    subcategoriesSupplied?: string[];
    serviceRadiusKm?: number;
    gatewayProvider?: PaymentGatewayProvider;
    gatewayPixKey?: string;
    gatewayWalletId?: string;
    gatewayBankInfo?: GatewayBankInfo;
    supplierPaymentType?: SupplierPaymentType;
  }): { success: boolean; message: string; user?: User; pendingApproval?: boolean } {
    if (data.role !== 'cliente' && data.role !== 'fornecedor') {
      return {
        success: false,
        message: 'Acesso negado (RBAC): cadastro público permitido apenas para Cliente ou Fornecedor.',
      };
    }

    const cleanPhone = normalizeBrPhoneDigits(data.phone);
    if (!cleanPhone || cleanPhone.length < 10) {
      return { success: false, message: 'Número de telefone celular inválido (DDD + número).' };
    }

    if (!data.password || data.password.trim().length < 4) {
      return { success: false, message: 'Crie uma senha de no mínimo 4 caracteres.' };
    }

    if (!data.name || data.name.trim().length < 2) {
      return { success: false, message: 'Informe seu nome completo ou Razão Social.' };
    }

    if (!data.document || data.document.replace(/\D/g, '').length < 11) {
      return { success: false, message: 'Informe um CPF ou CNPJ válido.' };
    }

    const isSupplier = data.role === 'fornecedor';

    if (isSupplier && !isValidCep(data.address?.cep)) {
      return {
        success: false,
        message: 'CEP válido (8 dígitos) é obrigatório no cadastro do Fornecedor para definir a geolocalização e o raio de atuação dos chamados.',
      };
    }

    if (!data.address || !isValidCep(data.address.cep) || !data.address.city?.trim() || !data.address.state?.trim()) {
      return { success: false, message: 'Preencha o endereço com CEP válido (8 dígitos), Cidade e UF.' };
    }

    const existing = db.getUserByPhone(cleanPhone);
    if (existing) {
      return { success: false, message: 'Já existe uma conta cadastrada com este celular. Faça login com sua senha.' };
    }

    const resolvedCoords =
      data.address.coordinates ||
      (isValidCep(data.address.cep)
        ? estimateCoordinatesFromCep(data.address.cep, data.address.state)
        : undefined);

    const normalizedAddress: DeliveryAddress = {
      ...data.address,
      street: data.address.street?.trim() || 'Área Urbana (CEP)',
      number: data.address.number?.trim() || 'S/N',
      neighborhood: data.address.neighborhood?.trim() || 'Centro',
      city: data.address.city.trim(),
      state: data.address.state.trim().toUpperCase(),
      cep: formatCep(data.address.cep),
      coordinates: resolvedCoords,
    };

    const newUser = db.createUser({
      phone: cleanPhone,
      name: data.name.trim(),
      email: '',
      role: data.role,
      password: data.password.trim(),
      personType: data.personType || (data.document.replace(/\D/g, '').length > 11 ? 'PJ' : 'PF'),
      document: data.document.trim(),
      companyName: isSupplier ? (data.companyName?.trim() || data.name.trim()) : undefined,
      avatarUrl: data.avatarUrl || '',
      address: normalizedAddress,
      coordinates: resolvedCoords,
      supplierCategoryIds: isSupplier ? (data.supplierCategoryIds || []) : [],
      categoriesSupplied: isSupplier
        ? (data.categoriesSupplied && data.categoriesSupplied.length > 0 ? data.categoriesSupplied : [])
        : [],
      subcategoriesSupplied: isSupplier ? (data.subcategoriesSupplied || []) : [],
      equipmentTypesSupplied: isSupplier ? (data.equipmentTypesSupplied || ['carro']) : undefined,
      serviceRadiusKm: isSupplier ? (data.serviceRadiusKm ?? 50) : 0,
      citiesCovered: normalizedAddress.city ? [normalizedAddress.city] : ['São Paulo'],
      status: isSupplier ? 'pendente' : 'ativo',
      supplierTier: undefined,
      isClassifiedByAdmin: isSupplier ? false : undefined,
      isAvailableForOrders: false,
      supplierPaymentType: isSupplier ? (data.supplierPaymentType || 'compe_split') : undefined,
      bankAccountOrPix: isSupplier ? data.gatewayPixKey?.trim() : undefined,
      gatewayProvider: isSupplier ? (data.gatewayProvider || 'asaas') : undefined,
      gatewayPixKey: isSupplier ? data.gatewayPixKey?.trim() : undefined,
      gatewayWalletId: isSupplier ? data.gatewayWalletId?.trim() : undefined,
      gatewayBankInfo: isSupplier ? data.gatewayBankInfo : undefined,
      gatewayAccountStatus: isSupplier
        ? data.gatewayWalletId?.trim()
          ? 'ativa'
          : data.gatewayPixKey?.trim() || data.gatewayBankInfo?.account
          ? 'em_analise'
          : 'nao_configurada'
        : undefined,
      rating: 5.0,
      totalRatings: 0,
      totalSales: 0,
    });

    this.persistSession(newUser);
    this.notify();

    return {
      success: true,
      pendingApproval: isSupplier,
      message: isSupplier
        ? 'Cadastro enviado! O Administrador precisa aprovar e classificar seu perfil antes da liberação do painel.'
        : 'Cadastro de Cliente realizado e liberado com sucesso! Bem-vindo à AUTO SHOP.',
      user: newUser,
    };
  }

  logout(portalRole?: UserRole) {
    const targetRole = portalRole || getPortalTargetFromLocation();
    const active = this.sessions[targetRole];
    if (active?.userId) {
      db.logAudit(active.userId, 'Logout de Usuário', 'user', active.userId, 'Sessão encerrada com segurança');
    }
    delete this.sessions[targetRole];
    delete this.pendingRestores[targetRole];
    safeRemoveStorage(getRoleSessionStorageKey(targetRole));
    safeRemoveStorage(SESSION_STORAGE_KEY);
    safeRemoveStorage(LEGACY_SESSION_KEY);
    if (typeof window !== 'undefined') {
      try {
        if (window.sessionStorage?.getItem(TAB_ACTIVE_ROLE_KEY) === targetRole) {
          window.sessionStorage.removeItem(TAB_ACTIVE_ROLE_KEY);
        }
      } catch {
        // ignore
      }
    }
    this.notify();
  }
}

export const auth = new AuthService();
