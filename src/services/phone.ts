/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Normaliza números de celular brasileiros vindos de teclados móveis,
 * autocompletar (+55), código de longa distância (0 + DDD) ou colagem do WhatsApp.
 */
export function normalizeBrPhoneDigits(raw?: string | null): string {
  if (!raw) return '';
  let digits = String(raw).replace(/\D/g, '');

  // Remove prefixo internacional +55 / 55 quando o usuário cola número completo (12 ou 13 dígitos)
  if (digits.length >= 12 && digits.startsWith('55')) {
    digits = digits.slice(2);
  }

  // Remove dígito zero de operadora/DDD (ex: 011987654321 -> 11987654321)
  if (digits.length >= 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  // Limita a 11 dígitos padrão BR (DDD + 9 + 8 dígitos)
  if (digits.length > 11) {
    digits = digits.slice(0, 11);
  }

  return digits;
}

/**
 * Formata celular brasileiro para exibição e digitação suave em Android/iOS/Desktop.
 */
export function formatBrPhone(raw?: string | null): string {
  const digits = normalizeBrPhoneDigits(raw);
  if (!digits) return '';
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

/**
 * Compara dois telefones normalizando +55, zero à esquerda e variação opcional do 9º dígito.
 */
export function brPhonesMatch(a?: string | null, b?: string | null): boolean {
  const na = normalizeBrPhoneDigits(a);
  const nb = normalizeBrPhoneDigits(b);
  if (!na || !nb) return false;
  if (na === nb) return true;

  // Fallback para celular antigo salvo sem o 9º dígito (10 dígitos) vs com 9º dígito (11 dígitos)
  if (
    na.length === 11 &&
    nb.length === 10 &&
    na.slice(0, 2) === nb.slice(0, 2) &&
    na[2] === '9' &&
    na.slice(3) === nb.slice(2)
  ) {
    return true;
  }
  if (
    nb.length === 11 &&
    na.length === 10 &&
    na.slice(0, 2) === nb.slice(0, 2) &&
    nb[2] === '9' &&
    nb.slice(3) === na.slice(2)
  ) {
    return true;
  }

  return false;
}
