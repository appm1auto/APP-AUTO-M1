/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface GeoCoordinates {
  lat: number;
  lng: number;
}

export interface CepLookupResult {
  success: boolean;
  cep: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  coordinates: GeoCoordinates;
  coordinatesPrecision: 'gps' | 'exact_cep' | 'cep_prefix';
  source:
    | 'server_geo'
    | 'brasilapi'
    | 'awesomeapi'
    | 'nominatim_street'
    | 'nominatim_cep'
    | 'nominatim_city'
    | 'photon'
    | 'cep_prefix';
  error?: string;
}

export interface RealDistanceResult {
  distanceKm: number;
  durationMin?: number;
  source: 'rota_real' | 'linha_reta';
}

export function cleanCepDigits(cep?: string): string {
  return (cep || '').replace(/\D/g, '').slice(0, 8);
}

export function formatCep(value: string): string {
  const clean = cleanCepDigits(value);
  if (clean.length <= 5) return clean;
  return `${clean.slice(0, 5)}-${clean.slice(5)}`;
}

export function isValidCep(cep?: string): boolean {
  return cleanCepDigits(cep).length === 8;
}

// Mapa de coordenadas reais por prefixo de 2 dígitos do CEP brasileiro (01 a 99)
// Garante cálculo real de distância entre regiões mesmo quando APIs externas estão offline.
const CEP2_COORDINATES: Record<string, GeoCoordinates> = {
  // Grande São Paulo (01-09)
  '01': { lat: -23.5505, lng: -46.6333 }, // Centro SP
  '02': { lat: -23.4852, lng: -46.6256 }, // Zona Norte SP
  '03': { lat: -23.5432, lng: -46.5553 }, // Zona Leste SP
  '04': { lat: -23.6226, lng: -46.6435 }, // Zona Sul SP
  '05': { lat: -23.5408, lng: -46.7279 }, // Zona Oeste SP
  '06': { lat: -23.5162, lng: -46.8359 }, // Osasco / Barueri / Carapicuíba
  '07': { lat: -23.4543, lng: -46.5337 }, // Guarulhos / Mairiporã
  '08': { lat: -23.5189, lng: -46.3658 }, // Itaquera / Suzano / Mogi
  '09': { lat: -23.6666, lng: -46.5322 }, // Santo André / SBC / São Caetano
  // Interior e Litoral SP (11-19)
  '11': { lat: -23.9608, lng: -46.3336 }, // Santos / Baixada Santista (~72km de SP)
  '12': { lat: -23.1791, lng: -45.8872 }, // São José dos Campos / Vale do Paraíba (~95km de SP)
  '13': { lat: -22.9099, lng: -47.0626 }, // Campinas / Jundiaí / Piracicaba (~95km de SP)
  '14': { lat: -21.1704, lng: -47.8103 }, // Ribeirão Preto / Franca (~315km de SP)
  '15': { lat: -20.8113, lng: -49.3758 }, // São José do Rio Preto (~440km de SP)
  '16': { lat: -21.2089, lng: -50.4328 }, // Araçatuba (~520km de SP)
  '17': { lat: -22.3145, lng: -49.0587 }, // Bauru / Marília (~330km de SP)
  '18': { lat: -23.5015, lng: -47.4526 }, // Sorocaba (~90km de SP)
  '19': { lat: -22.1256, lng: -51.3889 }, // Presidente Prudente (~555km de SP)
  // Rio de Janeiro (20-28)
  '20': { lat: -22.9068, lng: -43.1729 }, // Rio Centro
  '21': { lat: -22.8717, lng: -43.3106 }, // Rio Zona Norte
  '22': { lat: -22.9711, lng: -43.2189 }, // Rio Zona Sul / Barra
  '23': { lat: -22.9022, lng: -43.5594 }, // Zona Oeste RJ
  '24': { lat: -22.8832, lng: -43.1034 }, // Niterói / São Gonçalo
  '25': { lat: -22.5050, lng: -43.1785 }, // Petrópolis / Região Serrana
  '26': { lat: -22.7592, lng: -43.4511 }, // Nova Iguaçu / Baixada Fluminense
  '27': { lat: -22.5231, lng: -44.1042 }, // Volta Redonda / Sul Fluminense
  '28': { lat: -21.7545, lng: -41.3244 }, // Campos / Região dos Lagos
  // Espírito Santo (29)
  '29': { lat: -20.3155, lng: -40.3128 }, // Vitória
  // Minas Gerais (30-39)
  '30': { lat: -19.9167, lng: -43.9345 }, // Belo Horizonte
  '31': { lat: -19.8692, lng: -43.9636 }, // BH Pampulha / Venda Nova
  '32': { lat: -19.9632, lng: -44.0537 }, // Contagem / Betim
  '33': { lat: -19.6254, lng: -43.8906 }, // Lagoa Santa / Vespasiano
  '34': { lat: -20.0642, lng: -43.8458 }, // Nova Lima / Sabará
  '35': { lat: -19.4658, lng: -42.5367 }, // Ipatinga / Gov. Valadares
  '36': { lat: -21.7642, lng: -43.3496 }, // Juiz de Fora
  '37': { lat: -21.5514, lng: -45.4303 }, // Varginha / Pouso Alegre
  '38': { lat: -18.9186, lng: -48.2772 }, // Uberlândia / Uberaba
  '39': { lat: -16.7282, lng: -43.8638 }, // Montes Claros
  // Bahia (40-48) e Sergipe (49)
  '40': { lat: -12.9714, lng: -38.5014 }, // Salvador
  '41': { lat: -12.9425, lng: -38.4317 }, // Salvador Pituba/Itapuã
  '42': { lat: -12.8891, lng: -38.3082 }, // Lauro de Freitas / Camaçari
  '44': { lat: -12.2664, lng: -38.9663 }, // Feira de Santana
  '45': { lat: -14.8615, lng: -40.8442 }, // Vitória da Conquista / Ilhéus
  '46': { lat: -14.2314, lng: -42.7753 }, // Guanambi / Brumado
  '47': { lat: -12.1489, lng: -44.9968 }, // Barreiras
  '48': { lat: -9.4162, lng: -40.5033 }, // Juazeiro
  '49': { lat: -10.9472, lng: -37.0731 }, // Aracaju
  // Pernambuco (50-56), Alagoas (57), Paraíba (58), RN (59)
  '50': { lat: -8.0476, lng: -34.8770 }, // Recife
  '51': { lat: -8.1200, lng: -34.9060 }, // Recife Zona Sul
  '52': { lat: -8.0190, lng: -34.9120 }, // Recife Zona Norte
  '53': { lat: -8.0089, lng: -34.8553 }, // Olinda / Paulista
  '54': { lat: -8.1617, lng: -34.9347 }, // Jaboatão
  '55': { lat: -8.2828, lng: -35.9758 }, // Caruaru / Garanhuns
  '56': { lat: -9.3891, lng: -40.5030 }, // Petrolina
  '57': { lat: -9.6498, lng: -35.7089 }, // Maceió
  '58': { lat: -7.1195, lng: -34.8450 }, // João Pessoa / Campina Grande
  '59': { lat: -5.7945, lng: -35.2110 }, // Natal
  // Ceará (60-63), Piauí (64), Maranhão (65), Pará/Norte (66-69)
  '60': { lat: -3.7319, lng: -38.5267 }, // Fortaleza
  '61': { lat: -3.8617, lng: -38.6267 }, // Maracanaú / Caucaia
  '62': { lat: -3.6880, lng: -40.3497 }, // Sobral
  '63': { lat: -7.2131, lng: -39.3153 }, // Juazeiro do Norte
  '64': { lat: -5.0920, lng: -42.8038 }, // Teresina
  '65': { lat: -2.5307, lng: -44.3068 }, // São Luís
  '66': { lat: -1.4558, lng: -48.4902 }, // Belém
  '67': { lat: -1.3656, lng: -48.3722 }, // Ananindeua
  '68': { lat: -2.4431, lng: -54.7083 }, // Santarém / Marabá
  '69': { lat: -3.1190, lng: -60.0217 }, // Manaus / Região Norte
  // Centro-Oeste & Tocantins (70-79)
  '70': { lat: -15.7975, lng: -47.8919 }, // Brasília DF
  '71': { lat: -15.8364, lng: -47.9810 }, // Brasília Sul / Taguatinga
  '72': { lat: -15.8267, lng: -48.1089 }, // Ceilândia / Entorno DF
  '73': { lat: -15.6494, lng: -47.6540 }, // Planaltina / Formosa
  '74': { lat: -16.6869, lng: -49.2648 }, // Goiânia
  '75': { lat: -16.3285, lng: -48.9534 }, // Anápolis / Rio Verde
  '76': { lat: -15.9329, lng: -50.1419 }, // Interior GO
  '77': { lat: -10.1840, lng: -48.3336 }, // Palmas TO
  '78': { lat: -15.6014, lng: -56.0979 }, // Cuiabá MT
  '79': { lat: -20.4697, lng: -54.6201 }, // Campo Grande MS
  // Sul (80-99)
  '80': { lat: -25.4284, lng: -49.2733 }, // Curitiba
  '81': { lat: -25.4852, lng: -49.2935 }, // Curitiba Sul
  '82': { lat: -25.3947, lng: -49.2421 }, // Curitiba Norte
  '83': { lat: -25.5317, lng: -49.2031 }, // São José dos Pinhais / RMC
  '84': { lat: -25.0916, lng: -50.1668 }, // Ponta Grossa
  '85': { lat: -24.9555, lng: -53.4552 }, // Cascavel / Foz do Iguaçu
  '86': { lat: -23.3045, lng: -51.1696 }, // Londrina
  '87': { lat: -23.4205, lng: -51.9333 }, // Maringá
  '88': { lat: -27.5954, lng: -48.5480 }, // Florianópolis / Litoral SC
  '89': { lat: -26.3044, lng: -48.8487 }, // Joinville / Blumenau / Oeste SC
  '90': { lat: -30.0346, lng: -51.2177 }, // Porto Alegre
  '91': { lat: -30.0156, lng: -51.1489 }, // Porto Alegre Zona Leste/Norte
  '92': { lat: -29.9189, lng: -51.1781 }, // Canoas / Esteio
  '93': { lat: -29.7604, lng: -51.1480 }, // São Leopoldo / Novo Hamburgo
  '94': { lat: -29.9442, lng: -50.9917 }, // Gravataí / Cachoeirinha
  '95': { lat: -29.1678, lng: -51.1794 }, // Caxias do Sul / Serra Gaúcha
  '96': { lat: -31.7654, lng: -52.3376 }, // Pelotas / Rio Grande
  '97': { lat: -29.6842, lng: -53.8069 }, // Santa Maria
  '98': { lat: -28.2992, lng: -54.2631 }, // Santo Ângelo / Ijuí
  '99': { lat: -28.2628, lng: -52.4067 }, // Passo Fundo
};

const UF_COORDINATES: Record<string, GeoCoordinates> = {
  SP: { lat: -23.5505, lng: -46.6333 },
  RJ: { lat: -22.9068, lng: -43.1729 },
  MG: { lat: -19.9167, lng: -43.9345 },
  ES: { lat: -20.3155, lng: -40.3128 },
  PR: { lat: -25.4284, lng: -49.2733 },
  SC: { lat: -27.5954, lng: -48.548 },
  RS: { lat: -30.0346, lng: -51.2177 },
  BA: { lat: -12.9714, lng: -38.5014 },
  SE: { lat: -10.9472, lng: -37.0731 },
  AL: { lat: -9.6498, lng: -35.7089 },
  PE: { lat: -8.0476, lng: -34.877 },
  PB: { lat: -7.1195, lng: -34.845 },
  RN: { lat: -5.7945, lng: -35.211 },
  CE: { lat: -3.7319, lng: -38.5267 },
  PI: { lat: -5.092, lng: -42.8038 },
  MA: { lat: -2.5307, lng: -44.3068 },
  PA: { lat: -1.4558, lng: -48.4902 },
  AP: { lat: 0.0349, lng: -51.0694 },
  AM: { lat: -3.119, lng: -60.0217 },
  RR: { lat: 2.8235, lng: -60.6758 },
  AC: { lat: -9.9754, lng: -67.8249 },
  RO: { lat: -8.7612, lng: -63.9004 },
  TO: { lat: -10.184, lng: -48.3336 },
  DF: { lat: -15.7975, lng: -47.8919 },
  GO: { lat: -16.6869, lng: -49.2648 },
  MT: { lat: -15.6014, lng: -56.0979 },
  MS: { lat: -20.4697, lng: -54.6201 },
};

/**
 * Estima coordenadas geográficas regionais a partir dos 2 primeiros dígitos do CEP brasileiro
 * e micro-deslocamento determinístico dentro da região do CEP.
 */
export function estimateCoordinatesFromCep(cep?: string, stateUf?: string): GeoCoordinates {
  const clean = cleanCepDigits(cep);
  const uf = (stateUf || '').toUpperCase().trim();
  const prefix2 = clean.slice(0, 2);

  let base: GeoCoordinates | undefined = CEP2_COORDINATES[prefix2];

  if (!base && clean.length >= 1) {
    const firstDigit = clean[0];
    if (firstDigit === '0' || firstDigit === '1') base = UF_COORDINATES.SP;
    else if (firstDigit === '2') base = UF_COORDINATES.RJ;
    else if (firstDigit === '3') base = UF_COORDINATES.MG;
    else if (firstDigit === '4') base = UF_COORDINATES.BA;
    else if (firstDigit === '5') base = UF_COORDINATES.PE;
    else if (firstDigit === '6') base = UF_COORDINATES.CE;
    else if (firstDigit === '7') base = UF_COORDINATES.DF;
    else if (firstDigit === '8') base = UF_COORDINATES.PR;
    else if (firstDigit === '9') base = UF_COORDINATES.RS;
  }

  if (!base) {
    base = UF_COORDINATES[uf] || { lat: -23.5505, lng: -46.6333 };
  }

  if (clean.length === 8) {
    const sub1 = parseInt(clean.slice(2, 5), 10) || 0;
    const sub2 = parseInt(clean.slice(5, 8), 10) || 0;
    // Micro-variação determinística pequena (~±800m) para não distorcer distâncias reais locais
    const latOffset = ((sub1 / 999) - 0.5) * 0.015;
    const lngOffset = ((sub2 / 999) - 0.5) * 0.015;
    return {
      lat: Number((base.lat + latOffset).toFixed(4)),
      lng: Number((base.lng + lngOffset).toFixed(4)),
    };
  }

  return base;
}

export function calculateHaversineKm(
  coord1?: GeoCoordinates,
  coord2?: GeoCoordinates
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
    return Number.POSITIVE_INFINITY;
  }
  const R = 6371;
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

// ============================================================================
// CACHE DE COORDENADAS POR CEP E DISTÂNCIA REAL DE ROTA (OSRM)
// ============================================================================
const CEP_CACHE_KEY = 'compe_cep_geo_cache_v1';
const ROUTE_CACHE_KEY = 'compe_route_dist_cache_v1';

const memCepCache = new Map<string, CepLookupResult>();
const memRouteCache = new Map<string, RealDistanceResult>();
const inflightCepLookups = new Map<string, Promise<CepLookupResult>>();
const inflightRouteLookups = new Map<string, Promise<RealDistanceResult | null>>();

function loadJsonStorage<T>(key: string): Record<string, T> {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveJsonStorage<T>(key: string, keyEntry: string, value: T) {
  try {
    if (typeof localStorage === 'undefined') return;
    const current = loadJsonStorage<T>(key);
    current[keyEntry] = value;
    // Mantém até 300 registros para não encher localStorage
    const keys = Object.keys(current);
    if (keys.length > 300) {
      keys.slice(0, keys.length - 300).forEach(k => delete current[k]);
    }
    localStorage.setItem(key, JSON.stringify(current));
  } catch {
    // ignore storage quota
  }
}

function getCachedCepResult(cleanCep: string): CepLookupResult | null {
  if (memCepCache.has(cleanCep)) {
    const mem = memCepCache.get(cleanCep)!;
    if (mem.coordinatesPrecision === 'exact_cep' && mem.source !== 'cep_prefix') return mem;
  }
  const stored = loadJsonStorage<CepLookupResult>(CEP_CACHE_KEY);
  const hit = stored[cleanCep];
  if (
    hit &&
    hit.success &&
    hit.source !== 'cep_prefix' &&
    (hit.coordinatesPrecision === 'exact_cep' || hit.source === 'brasilapi' || hit.source === 'nominatim_street' || hit.source === 'nominatim_cep')
  ) {
    const normalized: CepLookupResult = { ...hit, coordinatesPrecision: 'exact_cep' };
    memCepCache.set(cleanCep, normalized);
    return normalized;
  }
  return null;
}

function setCachedCepResult(cleanCep: string, res: CepLookupResult) {
  if (!res.success || res.source === 'cep_prefix' || res.coordinatesPrecision !== 'exact_cep') return;
  memCepCache.set(cleanCep, res);
  saveJsonStorage(CEP_CACHE_KEY, cleanCep, res);
}

function buildRoutePairKey(from: GeoCoordinates, to: GeoCoordinates): string {
  const fLat = from.lat.toFixed(4);
  const fLng = from.lng.toFixed(4);
  const tLat = to.lat.toFixed(4);
  const tLng = to.lng.toFixed(4);
  // Ordena para aproveitar simetria A->B / B->A na maioria dos trajetos
  return `${fLat},${fLng}->${tLat},${tLng}`;
}

export function getCachedRealRouteDistanceKm(
  from?: GeoCoordinates,
  to?: GeoCoordinates
): RealDistanceResult | null {
  if (
    !from ||
    !to ||
    !Number.isFinite(from.lat) ||
    !Number.isFinite(from.lng) ||
    !Number.isFinite(to.lat) ||
    !Number.isFinite(to.lng) ||
    (from.lat === 0 && from.lng === 0) ||
    (to.lat === 0 && to.lng === 0)
  ) {
    return null;
  }
  const key = buildRoutePairKey(from, to);
  if (memRouteCache.has(key)) return memRouteCache.get(key)!;
  const stored = loadJsonStorage<RealDistanceResult>(ROUTE_CACHE_KEY);
  if (stored[key]) {
    memRouteCache.set(key, stored[key]);
    return stored[key];
  }
  const reverseKey = buildRoutePairKey(to, from);
  if (memRouteCache.has(reverseKey)) return memRouteCache.get(reverseKey)!;
  if (stored[reverseKey]) {
    memRouteCache.set(reverseKey, stored[reverseKey]);
    return stored[reverseKey];
  }
  return null;
}

async function fetchWithTimeout(url: string, timeoutMs = 4000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

/**
 * Calcula a distância REAL de percurso por via (km) entre duas coordenadas via OSRM
 * e faz cache persistente. Quando offline, retorna a distância geodésica real (Haversine).
 */
export async function fetchRealRouteDistanceKm(
  from?: GeoCoordinates,
  to?: GeoCoordinates
): Promise<RealDistanceResult | null> {
  if (
    !from ||
    !to ||
    !Number.isFinite(from.lat) ||
    !Number.isFinite(from.lng) ||
    !Number.isFinite(to.lat) ||
    !Number.isFinite(to.lng) ||
    (from.lat === 0 && from.lng === 0) ||
    (to.lat === 0 && to.lng === 0)
  ) {
    return null;
  }

  const cached = getCachedRealRouteDistanceKm(from, to);
  if (cached) return cached;

  const key = buildRoutePairKey(from, to);
  if (inflightRouteLookups.has(key)) {
    return inflightRouteLookups.get(key)!;
  }

  const task = (async (): Promise<RealDistanceResult | null> => {
    // Coordenadas praticamente idênticas (< 50m)
    const straight = calculateHaversineKm(from, to);
    if (straight <= 0.1) {
      const zeroRes: RealDistanceResult = { distanceKm: 0.1, durationMin: 1, source: 'rota_real' };
      memRouteCache.set(key, zeroRes);
      saveJsonStorage(ROUTE_CACHE_KEY, key, zeroRes);
      return zeroRes;
    }

    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false`;
      const res = await fetchWithTimeout(url, 3800);
      if (res.ok) {
        const data = await res.json();
        const route = data?.routes?.[0];
        if (route && Number.isFinite(route.distance)) {
          const km = Number(Math.max(0.1, route.distance / 1000).toFixed(1));
          const durationMin = Number.isFinite(route.duration)
            ? Math.max(1, Math.round(route.duration / 60))
            : undefined;
          const result: RealDistanceResult = {
            distanceKm: km,
            durationMin,
            source: 'rota_real',
          };
          memRouteCache.set(key, result);
          saveJsonStorage(ROUTE_CACHE_KEY, key, result);
          return result;
        }
      }
    } catch {
      // Fallback para linha reta geodésica
    }

    return {
      distanceKm: straight,
      source: 'linha_reta',
    };
  })();

  inflightRouteLookups.set(key, task);
  try {
    return await task;
  } finally {
    inflightRouteLookups.delete(key);
  }
}

/**
 * Consulta CEP em tempo real e resolve coordenadas geográficas reais (rua/bairro/CEP)
 * para cálculo verdadeiro de distância em km entre Cliente e Fornecedor.
 */
export async function lookupAddressAndGeoByCep(rawCep: string): Promise<CepLookupResult> {
  const clean = cleanCepDigits(rawCep);
  const formatted = formatCep(clean);

  if (clean.length !== 8) {
    return {
      success: false,
      cep: formatted,
      street: '',
      neighborhood: '',
      city: '',
      state: '',
      coordinates: estimateCoordinatesFromCep(clean),
      coordinatesPrecision: 'cep_prefix',
      source: 'cep_prefix',
      error: 'CEP inválido. Informe os 8 dígitos completos.',
    };
  }

  const cached = getCachedCepResult(clean);
  if (cached) return cached;

  if (inflightCepLookups.has(clean)) {
    return inflightCepLookups.get(clean)!;
  }

  const task = (async (): Promise<CepLookupResult> => {
    let street = '';
    let neighborhood = '';
    let city = '';
    let state = '';
    let coords: GeoCoordinates | null = null;
    let source: CepLookupResult['source'] = 'cep_prefix';

    // 0. Quando no navegador, consulta primeiro o resolver central do servidor (com User-Agent + AwesomeAPI + BrasilAPI + OSM + cache compartilhado)
    if (typeof window !== 'undefined') {
      try {
        const srvRes = await fetchWithTimeout(`/api/geo/cep/${clean}`, 4800);
        if (srvRes.ok) {
          const sData = await srvRes.json();
          if (sData?.ok && sData.city && sData.state) {
            street = sData.street || '';
            neighborhood = sData.neighborhood || '';
            city = sData.city || '';
            state = sData.state || '';
            if (
              sData.coordinates &&
              Number.isFinite(sData.coordinates.lat) &&
              Number.isFinite(sData.coordinates.lng) &&
              sData.coordinatesPrecision === 'exact_cep'
            ) {
              const serverResult: CepLookupResult = {
                success: true,
                cep: formatted,
                street,
                neighborhood,
                city,
                state,
                coordinates: sData.coordinates,
                coordinatesPrecision: 'exact_cep',
                source: 'server_geo',
              };
              setCachedCepResult(clean, serverResult);
              return serverResult;
            }
          }
        }
      } catch {
        // segue para consulta direta
      }
    }

    // 1. BrasilAPI v2 (endereço + coordenadas exatas quando disponíveis)
    try {
      const res = await fetchWithTimeout(`https://brasilapi.com.br/api/cep/v2/${clean}`, 3800);
      if (res.ok) {
        const data = await res.json();
        street = street || data.street || '';
        neighborhood = neighborhood || data.neighborhood || '';
        city = city || data.city || '';
        state = state || data.state || '';

        const latNum = Number(data?.location?.coordinates?.latitude);
        const lngNum = Number(data?.location?.coordinates?.longitude);
        if (Number.isFinite(latNum) && Number.isFinite(lngNum) && latNum !== 0 && lngNum !== 0) {
          coords = { lat: Number(latNum.toFixed(5)), lng: Number(lngNum.toFixed(5)) };
          source = 'brasilapi';
        }
      }
    } catch {
      // fallback para AwesomeAPI / ViaCEP
    }

    // 1b. AwesomeAPI CEP (coordenadas lat/lng exatas por CEP brasileiro)
    if (!coords || !city || !state) {
      try {
        const awRes = await fetchWithTimeout(`https://cep.awesomeapi.com.br/json/${clean}`, 3500);
        if (awRes.ok) {
          const awData = await awRes.json();
          if (awData && !awData.status && !awData.code) {
            street = street || awData.address || awData.address_name || '';
            neighborhood = neighborhood || awData.district || '';
            city = city || awData.city || '';
            state = state || awData.state || '';
            const latNum = Number(awData.lat);
            const lngNum = Number(awData.lng);
            if (!coords && Number.isFinite(latNum) && Number.isFinite(lngNum) && latNum !== 0 && lngNum !== 0) {
              coords = { lat: Number(latNum.toFixed(5)), lng: Number(lngNum.toFixed(5)) };
              source = 'awesomeapi';
            }
          }
        }
      } catch {
        // fallback para ViaCEP
      }
    }

    // 2. ViaCEP (garante logradouro/bairro/cidade/UF completos para geocodificação precisa)
    if (!city || !state || !street) {
      try {
        const res = await fetchWithTimeout(`https://viacep.com.br/ws/${clean}/json/`, 3800);
        if (res.ok) {
          const data = await res.json();
          if (data.erro && !city) {
            return {
              success: false,
              cep: formatted,
              street: '',
              neighborhood: '',
              city: '',
              state: '',
              coordinates: estimateCoordinatesFromCep(clean),
              coordinatesPrecision: 'cep_prefix',
              source: 'cep_prefix',
              error: 'CEP não encontrado na base dos Correios. Verifique os números digitados.',
            };
          }
          if (!data.erro) {
            street = street || data.logradouro || '';
            neighborhood = neighborhood || data.bairro || '';
            city = city || data.localidade || '';
            state = state || data.uf || '';
          }
        }
      } catch {
        // segue com dados disponíveis
      }
    }

    if (!city && !state) {
      return {
        success: false,
        cep: formatted,
        street: '',
        neighborhood: '',
        city: '',
        state: '',
        coordinates: estimateCoordinatesFromCep(clean),
        coordinatesPrecision: 'cep_prefix',
        source: 'cep_prefix',
        error: 'Não foi possível validar este CEP no momento. Verifique o CEP e tente novamente.',
      };
    }

    // 3. Geocodificação real por Rua + Cidade + UF no Nominatim (precisão de logradouro)
    if (!coords && street && city && state) {
      try {
        const cleanStreet = street.replace(/^(Rua|Avenida|Av\.|R\.|Travessa|Alameda|Estrada|Rodovia)\s+/i, '');
        const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&street=${encodeURIComponent(street)}&city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}`;
        const nomStreetRes = await fetchWithTimeout(url, 3200);
        if (nomStreetRes.ok) {
          const nomData = await nomStreetRes.json();
          if (Array.isArray(nomData) && nomData.length > 0) {
            const latNum = Number(nomData[0].lat);
            const lngNum = Number(nomData[0].lon);
            if (Number.isFinite(latNum) && Number.isFinite(lngNum)) {
              coords = { lat: Number(latNum.toFixed(5)), lng: Number(lngNum.toFixed(5)) };
              source = 'nominatim_street';
            }
          }
        }
        // Segunda tentativa com query livre se a busca estruturada não achou
        if (!coords && cleanStreet) {
          const q = `${street}, ${neighborhood ? neighborhood + ', ' : ''}${city}, ${state}, Brasil`;
          const nomFreeRes = await fetchWithTimeout(
            `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(q)}`,
            3000
          );
          if (nomFreeRes.ok) {
            const nomFreeData = await nomFreeRes.json();
            if (Array.isArray(nomFreeData) && nomFreeData.length > 0) {
              const latNum = Number(nomFreeData[0].lat);
              const lngNum = Number(nomFreeData[0].lon);
              if (Number.isFinite(latNum) && Number.isFinite(lngNum)) {
                coords = { lat: Number(latNum.toFixed(5)), lng: Number(lngNum.toFixed(5)) };
                source = 'nominatim_street';
              }
            }
          }
        }
      } catch {
        // tenta Photon / CEP / Bairro
      }
    }

    // 4. Geocodificação via Photon (OSM) por rua/bairro + cidade + UF
    if (!coords && city && state) {
      try {
        const query = [street || neighborhood, city, state, 'Brasil'].filter(Boolean).join(', ');
        const photonRes = await fetchWithTimeout(
          `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=1`,
          3000
        );
        if (photonRes.ok) {
          const pData = await photonRes.json();
          const feat = pData?.features?.[0];
          const [lngNum, latNum] = feat?.geometry?.coordinates || [];
          if (Number.isFinite(latNum) && Number.isFinite(lngNum)) {
            coords = { lat: Number(Number(latNum).toFixed(5)), lng: Number(Number(lngNum).toFixed(5)) };
            source = 'photon';
          }
        }
      } catch {
        // tenta Nominatim CEP
      }
    }

    // 5. Nominatim por código postal
    if (!coords) {
      try {
        const nomRes = await fetchWithTimeout(
          `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&postalcode=${clean}`,
          2800
        );
        if (nomRes.ok) {
          const nomData = await nomRes.json();
          if (Array.isArray(nomData) && nomData.length > 0) {
            const latNum = Number(nomData[0].lat);
            const lngNum = Number(nomData[0].lon);
            if (Number.isFinite(latNum) && Number.isFinite(lngNum)) {
              coords = { lat: Number(latNum.toFixed(5)), lng: Number(lngNum.toFixed(5)) };
              source = 'nominatim_cep';
            }
          }
        }
      } catch {
        // tenta cidade + UF
      }
    }

    // 6. Nominatim por Bairro/Cidade + UF
    if (!coords && city && state) {
      try {
        const query = neighborhood ? `${neighborhood}, ${city}, ${state}` : `${city}, ${state}`;
        const nomCityRes = await fetchWithTimeout(
          `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(query)}`,
          2800
        );
        if (nomCityRes.ok) {
          const nomCityData = await nomCityRes.json();
          if (Array.isArray(nomCityData) && nomCityData.length > 0) {
            const latNum = Number(nomCityData[0].lat);
            const lngNum = Number(nomCityData[0].lon);
            if (Number.isFinite(latNum) && Number.isFinite(lngNum)) {
              coords = { lat: Number(latNum.toFixed(5)), lng: Number(lngNum.toFixed(5)) };
              source = 'nominatim_city';
            }
          }
        }
      } catch {
        // fallback regional
      }
    }

    // 7. Fallback regional por prefixo CEP de 2 dígitos
    if (!coords) {
      coords = estimateCoordinatesFromCep(clean, state);
      source = 'cep_prefix';
    }

    const coordinatesPrecision: CepLookupResult['coordinatesPrecision'] =
      source === 'cep_prefix' ? 'cep_prefix' : 'exact_cep';

    const result: CepLookupResult = {
      success: true,
      cep: formatted,
      street,
      neighborhood,
      city,
      state,
      coordinates: coords,
      coordinatesPrecision,
      source,
    };

    setCachedCepResult(clean, result);
    return result;
  })();

  inflightCepLookups.set(clean, task);
  try {
    return await task;
  } finally {
    inflightCepLookups.delete(clean);
  }
}

/**
 * Obtém coordenadas GPS reais do dispositivo via navegador (HTML5 Geolocation API)
 */
export function getCurrentDeviceCoordinates(): Promise<GeoCoordinates> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocalização não suportada neste navegador.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        resolve({
          lat: Number(pos.coords.latitude.toFixed(5)),
          lng: Number(pos.coords.longitude.toFixed(5)),
        });
      },
      err => {
        reject(new Error(err.message || 'Não foi possível capturar a localização GPS.'));
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });
}
