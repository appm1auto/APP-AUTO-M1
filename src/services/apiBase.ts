/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Resolve a URL base para chamadas /api/*.
 * Em deployments integrados (Express + Vite no mesmo host), retorna '' (mesma origem).
 * Caso o frontend seja publicado em domínio separado do backend, defina VITE_API_BASE_URL.
 */
export function getApiBaseUrl(): string {
  try {
    const raw =
      typeof import.meta !== 'undefined' && (import.meta as { env?: Record<string, string | undefined> }).env
        ? (import.meta as { env: Record<string, string | undefined> }).env.VITE_API_BASE_URL
        : '';
    return typeof raw === 'string' ? raw.trim().replace(/\/+$/, '') : '';
  } catch {
    return '';
  }
}

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const base = getApiBaseUrl();
  return base ? `${base}${normalizedPath}` : normalizedPath;
}
