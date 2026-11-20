/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { DeliveryAddress, OrderAndPayment, User, UserRole } from '../types/index.ts';

export type AppRoute =
  | '/login'
  | '/cliente'
  | '/fornecedor'
  | '/fornecedor/pendente'
  | '/admin';

export type Permission =
  | 'client:request_parts'
  | 'client:view_quotes'
  | 'client:checkout'
  | 'client:view_catalogs'
  | 'supplier:view_panel'
  | 'supplier:receive_requests'
  | 'supplier:send_quote'
  | 'supplier:manage_orders'
  | 'supplier:view_catalogs'
  | 'admin:master_control'
  | 'admin:approve_suppliers'
  | 'admin:classify_suppliers'
  | 'admin:manage_users'
  | 'admin:manage_categories'
  | 'admin:manage_catalogs'
  | 'admin:manage_spams'
  | 'admin:view_audit';

/**
 * Matriz estrita de permissões (RBAC) com isolamento completo entre os 3 perfis.
 * Não há vínculo direto obrigatório entre Cliente e Fornecedor na raiz.
 */
export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  cliente: [
    'client:request_parts',
    'client:view_quotes',
    'client:checkout',
    'client:view_catalogs',
  ],
  fornecedor: [
    'supplier:view_panel',
    'supplier:receive_requests',
    'supplier:send_quote',
    'supplier:manage_orders',
    'supplier:view_catalogs',
  ],
  admin: [
    'admin:master_control',
    'admin:approve_suppliers',
    'admin:classify_suppliers',
    'admin:manage_users',
    'admin:manage_categories',
    'admin:manage_catalogs',
    'admin:manage_spams',
    'admin:view_audit',
  ],
};

/**
 * Fornecedor só possui acesso operacional ao painel após:
 * 1. Status aprovado ('ativo') pelo Admin
 * 2. Classificação obrigatória definida pelo Admin (supplierTier)
 */
export function isSupplierClassifiedAndApproved(user: User | null): boolean {
  if (!user || user.role !== 'fornecedor') return false;
  if (user.status !== 'ativo') return false;
  if (!user.supplierTier) return false;
  if (user.isClassifiedByAdmin === false) return false;
  return true;
}

export function isUserActive(user: User | null): boolean {
  if (!user) return false;
  return user.status !== 'bloqueado';
}

export function hasPermission(user: User | null, permission: Permission): boolean {
  if (!user || user.status === 'bloqueado') return false;

  if (user.role === 'cliente') {
    if (user.status !== 'ativo') return false;
    return ROLE_PERMISSIONS.cliente.includes(permission);
  }

  if (user.role === 'fornecedor') {
    if (!isSupplierClassifiedAndApproved(user)) return false;
    return ROLE_PERMISSIONS.fornecedor.includes(permission);
  }

  if (user.role === 'admin') {
    if (user.status !== 'ativo') return false;
    return ROLE_PERMISSIONS.admin.includes(permission);
  }

  return false;
}

export function assertPermission(user: User | null, permission: Permission, actionLabel?: string): void {
  if (!hasPermission(user, permission)) {
    throw new Error(
      `Acesso negado (RBAC)${actionLabel ? ` para ${actionLabel}` : ''}: perfil sem autorização necessária.`
    );
  }
}

export function getDefaultRouteForUser(user: User | null): AppRoute {
  if (!user || user.status === 'bloqueado') {
    return '/login';
  }
  if (user.role === 'cliente') {
    return user.status === 'ativo' ? '/cliente' : '/login';
  }
  if (user.role === 'fornecedor') {
    return isSupplierClassifiedAndApproved(user) ? '/fornecedor' : '/fornecedor/pendente';
  }
  if (user.role === 'admin') {
    return user.status === 'ativo' ? '/admin' : '/login';
  }
  return '/login';
}

export function canAccessRoute(user: User | null, route: AppRoute): boolean {
  if (!user || user.status === 'bloqueado') {
    return route === '/login';
  }

  switch (route) {
    case '/login':
      return false;
    case '/cliente':
      return user.role === 'cliente' && user.status === 'ativo';
    case '/fornecedor':
      return isSupplierClassifiedAndApproved(user);
    case '/fornecedor/pendente':
      return user.role === 'fornecedor' && !isSupplierClassifiedAndApproved(user);
    case '/admin':
      return user.role === 'admin' && user.status === 'ativo';
    default:
      return false;
  }
}

export function canAccessRole(user: User | null, role: UserRole): boolean {
  if (!user || user.status === 'bloqueado') return false;
  return user.role === role;
}

export const TAB_ACTIVE_ROLE_KEY = 'compe_tab_active_role';

export function getPortalTargetFromLocation(): UserRole {
  if (typeof window === 'undefined') return 'cliente';
  const path = window.location.pathname.replace(/\/+$/, '').toLowerCase();
  const hash = window.location.hash.replace(/^#/, '').replace(/\/+$/, '').toLowerCase();
  const queryPortal = new URLSearchParams(window.location.search).get('portal')?.trim().toLowerCase();

  // 1. Caminho explícito da URL tem prioridade máxima (evita que hash antigo de outra aba sobrescreva /admin ou /fornecedor)
  if (path === '/admin' || path.endsWith('/admin') || path.includes('/admin/')) return 'admin';
  if (
    path === '/fornecedor' ||
    path.endsWith('/fornecedor') ||
    path.endsWith('/fornecedor/pendente') ||
    path.includes('/fornecedor/')
  ) {
    return 'fornecedor';
  }
  if (path === '/cliente' || path.endsWith('/cliente') || path.includes('/cliente/')) return 'cliente';

  // 2. Hash route (#/admin, #/fornecedor, #/cliente)
  if (hash === '/admin' || hash === 'admin') return 'admin';
  if (hash === '/fornecedor' || hash === '/fornecedor/pendente' || hash === 'fornecedor') return 'fornecedor';
  if (hash === '/cliente' || hash === 'cliente') return 'cliente';

  // 3. Query param fallback (?portal=admin|fornecedor|cliente)
  if (queryPortal === 'admin') return 'admin';
  if (queryPortal === 'fornecedor') return 'fornecedor';
  if (queryPortal === 'cliente') return 'cliente';

  // 4. Sessão ativa nesta aba (impede que limpeza acidental de hash em '/' feche o perfil aberto)
  try {
    const tabRole = window.sessionStorage?.getItem(TAB_ACTIVE_ROLE_KEY)?.trim().toLowerCase();
    if (tabRole === 'admin' || tabRole === 'fornecedor' || tabRole === 'cliente') {
      return tabRole;
    }
  } catch {
    // ignore
  }

  return 'cliente';
}

export function getIndependentPortalLinks(customOrigin?: string): Record<UserRole, string> {
  const origin =
    customOrigin ||
    (typeof window !== 'undefined' ? window.location.origin : '');
  return {
    cliente: `${origin}/cliente`,
    fornecedor: `${origin}/fornecedor`,
    admin: `${origin}/admin`,
  };
}

export function parseHashRoute(): AppRoute {
  if (typeof window === 'undefined') return '/login';
  const raw = window.location.hash.replace(/^#/, '').trim().toLowerCase();
  if (
    raw === '/cliente' ||
    raw === '/fornecedor' ||
    raw === '/fornecedor/pendente' ||
    raw === '/admin' ||
    raw === '/login'
  ) {
    return raw;
  }
  return '/login';
}

export function syncHashRoute(route: AppRoute, portalTarget?: UserRole): void {
  if (typeof window === 'undefined') return;
  if (route === '/login') {
    const target = portalTarget || getPortalTargetFromLocation();
    const targetHash = `#/${target}`;
    if (window.location.hash !== targetHash) {
      window.history.replaceState(null, '', targetHash);
    }
    return;
  }
  const targetHash = `#${route}`;
  if (window.location.hash !== targetHash) {
    window.history.replaceState(null, '', targetHash);
  }
}

export function getRoleDisplayName(role: UserRole): string {
  switch (role) {
    case 'cliente':
      return 'Cliente';
    case 'fornecedor':
      return 'Fornecedor / Prestador';
    case 'admin':
      return 'Administrador Master';
  }
}

/**
 * Regra de Privacidade:
 * Dados pessoais (nome, razão social, foto/logo, WhatsApp/telefone, CPF/CNPJ, CEP, rua e número)
 * do cliente e do fornecedor SOMENTE ficam visíveis após A CONFIRMAÇÃO DO PAGAMENTO POR PARTE DO
 * FORNECEDOR (confirmação do dinheiro em conta: supplierReceiptConfirmed === true && paymentStatus === 'confirmado').
 * O Administrador sempre tem acesso completo.
 */
export function isOrderIdentityUnlocked(
  order?: Pick<OrderAndPayment, 'paymentStatus' | 'supplierReceiptConfirmed'> | null,
  viewerRole?: UserRole
): boolean {
  if (viewerRole === 'admin') return true;
  return Boolean(
    order &&
      order.paymentStatus === 'confirmado' &&
      order.supplierReceiptConfirmed === true
  );
}

export function getMaskedCounterpartyLabel(
  role: 'cliente' | 'fornecedor',
  id?: string
): string {
  const suffix = id ? id.slice(-4).toUpperCase() : '0000';
  return role === 'fornecedor'
    ? `Fornecedor Certificado #${suffix}`
    : `Cliente Verificado #${suffix}`;
}

export function formatCityNeighborhood(addr?: Partial<DeliveryAddress> | null): string {
  if (!addr) return 'Cidade/Bairro via CEP';
  const neighborhood = addr.neighborhood?.trim();
  const city = addr.city?.trim();
  const state = addr.state?.trim()?.toUpperCase();
  const cityLabel = city ? (state ? `${city}/${state}` : city) : '';
  const parts = [neighborhood, cityLabel].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : 'Localização via KM';
}

