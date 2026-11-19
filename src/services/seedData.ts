/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  User,
  Vehicle,
  CatalogPart,
  PartRequest,
  Quote,
  OrderAndPayment,
  AuditLog,
  Evaluation,
  SpamTriggerConfig,
  CommissionSettings,
  AppCustomizationSettings,
  ManufacturerCatalog,
  SystemTimerSettings,
  ChatMessage,
  AdminCategory,
  DispatchedSpamAlert,
  SplitTransaction,
  SupplierSpamModality,
  ClientAdsSettings,
} from '../types/index.ts';

export interface DatabaseSchema {
  users: User[];
  vehicles: Vehicle[];
  catalog_parts: CatalogPart[];
  categories: AdminCategory[];
  requests: PartRequest[];
  quotes: Quote[];
  orders_and_payments: OrderAndPayment[];
  split_transactions?: SplitTransaction[];
  spams_config: SpamTriggerConfig[];
  supplier_modalities?: SupplierSpamModality[];
  client_ads_settings?: ClientAdsSettings;
  dispatched_spams?: DispatchedSpamAlert[];
  audit_logs: AuditLog[];
  evaluations: Evaluation[];
  commission_settings: CommissionSettings;
  customization_settings: AppCustomizationSettings;
  manufacturer_catalogs: ManufacturerCatalog[];
  rejected_supplier_requests?: { supplierId: string; requestId: string }[];
  timer_settings: SystemTimerSettings;
  chat_messages: ChatMessage[];
}

export const INITIAL_SUPPLIER_MODALITIES: SupplierSpamModality[] = [
  {
    id: 'mod_opcao_1',
    escrita: '1ª Opção · Parceiro Ultra-Local Express',
    condicao: 'Resposta rápida em até 10 min · 2 campos no SPAM · Split automático AUTO SHOP',
    porcentagem: 10,
    baseTier: 'opcao_1',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'mod_opcao_2',
    escrita: '2ª Opção · Parceiro Regional Standard',
    condicao: 'Atendimento regional padrão até 16 min · 3 campos no SPAM · Split AUTO SHOP',
    porcentagem: 10,
    baseTier: 'opcao_2',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'mod_opcao_3',
    escrita: '3ª Opção · Distribuidor Nacional Premium',
    condicao: 'Sem limite de tempo · 4 campos + Logo visível ao cliente · Cobertura nacional',
    porcentagem: 8,
    baseTier: 'opcao_3',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

export const INITIAL_USERS: User[] = [
  {
    id: 'usr_cliente_1',
    phone: '11987654321',
    password: '1234',
    name: 'Carlos Eduardo Ribeiro',
    email: 'carlos.ribeiro@gmail.com',
    role: 'cliente',
    personType: 'PF',
    document: '298.412.878-40',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
    address: {
      cep: '01310-100',
      street: 'Av. Paulista',
      number: '1578',
      complement: 'Apto 42',
      neighborhood: 'Bela Vista',
      city: 'São Paulo',
      state: 'SP',
      coordinates: { lat: -23.5615, lng: -46.6559 },
    },
    coordinates: { lat: -23.5615, lng: -46.6559 },
    status: 'ativo',
    createdAt: '2026-02-10T10:00:00.000Z',
    lastLogin: new Date().toISOString(),
  },
  {
    id: 'usr_fornecedor_1',
    phone: '11999887766',
    password: '1234',
    name: 'Roberto Mendonça',
    companyName: 'Auto Peças São Paulo Central Ltda',
    email: 'contato@autoprecessp.com.br',
    role: 'fornecedor',
    personType: 'PJ',
    document: '18.492.102/0001-90',
    stateRegistration: '114.920.812.110',
    avatarUrl: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=200&q=80',
    address: {
      cep: '03010-000',
      street: 'Rua do Gasômetro',
      number: '450',
      neighborhood: 'Brás',
      city: 'São Paulo',
      state: 'SP',
      coordinates: { lat: -23.5453, lng: -46.6203 },
    },
    coordinates: { lat: -23.5453, lng: -46.6203 },
    supplierTier: 'opcao_1',
    isClassifiedByAdmin: true,
    supplierPaymentType: 'compe_split',
    commissionRateOverride: 10,
    gatewayProvider: 'asaas',
    gatewayWalletId: 'wallet_asaas_autopecassp_001',
    gatewaySubaccountId: 'sub_asaas_forn_001',
    gatewayAccountStatus: 'ativa',
    gatewayPixKey: '18.492.102/0001-90',
    bankAccountOrPix: '18.492.102/0001-90',
    gatewaySubaccountCreatedAt: '2026-01-15T09:05:00.000Z',
    categoriesSupplied: ['Freios', 'Suspensão', 'Motor', 'Arrefecimento'],
    equipmentTypesSupplied: ['carro', 'moto'],
    serviceRadiusKm: 50,
    citiesCovered: ['São Paulo', 'Guarulhos', 'São Bernardo do Campo', 'Santo André'],
    status: 'ativo',
    isAvailableForOrders: true,
    rating: 4.9,
    totalRatings: 184,
    totalSales: 412,
    createdAt: '2026-01-15T09:00:00.000Z',
    lastLogin: new Date().toISOString(),
  },
  {
    id: 'usr_fornecedor_2',
    phone: '11977665544',
    password: '1234',
    name: 'Marcos Vinicius Vieira',
    companyName: 'Desmanche Legal Paulista (Credenciado DETRAN)',
    email: 'marcos@desmanchelegal.com.br',
    role: 'fornecedor',
    personType: 'PJ',
    document: '24.119.502/0001-34',
    stateRegistration: '109.840.119.220',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
    address: {
      cep: '04205-001',
      street: 'Av. do Cursino',
      number: '1200',
      neighborhood: 'Saúde',
      city: 'São Paulo',
      state: 'SP',
      coordinates: { lat: -23.6213, lng: -46.6186 },
    },
    coordinates: { lat: -23.6213, lng: -46.6186 },
    supplierTier: 'opcao_2',
    isClassifiedByAdmin: true,
    supplierPaymentType: 'compe_split',
    commissionRateOverride: 10,
    gatewayProvider: 'asaas',
    gatewayWalletId: 'wallet_asaas_desmanchelegal_002',
    gatewaySubaccountId: 'sub_asaas_forn_002',
    gatewayAccountStatus: 'ativa',
    gatewayPixKey: '24.119.502/0001-34',
    bankAccountOrPix: '24.119.502/0001-34',
    gatewaySubaccountCreatedAt: '2026-02-01T14:10:00.000Z',
    categoriesSupplied: ['Lataria', 'Faróis e Iluminação', 'Câmbio', 'Vidros e Retrovisores'],
    equipmentTypesSupplied: ['carro'],
    serviceRadiusKm: 50,
    citiesCovered: ['São Paulo', 'Campinas', 'Jundiaí', 'Osasco'],
    status: 'ativo',
    isAvailableForOrders: true,
    rating: 4.8,
    totalRatings: 96,
    totalSales: 153,
    createdAt: '2026-02-01T14:00:00.000Z',
    lastLogin: new Date().toISOString(),
  },
  {
    id: 'usr_fornecedor_3',
    phone: '11966554433',
    password: '1234',
    name: 'Silvio Valério Rocha',
    companyName: 'Distribuidora Brasil Diesel & Pesados',
    email: 'silvio@brasildiesel.com.br',
    role: 'fornecedor',
    personType: 'PJ',
    document: '04.882.190/0001-55',
    stateRegistration: '112.441.980.330',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
    address: {
      cep: '07020-000',
      street: 'Rodovia Presidente Dutra',
      number: 'km 221',
      neighborhood: 'Vila Augusta',
      city: 'Guarulhos',
      state: 'SP',
      coordinates: { lat: -23.4796, lng: -46.5357 },
    },
    coordinates: { lat: -23.4796, lng: -46.5357 },
    supplierTier: 'opcao_3',
    isClassifiedByAdmin: true,
    supplierPaymentType: 'direto_fornecedor',
    bankAccountOrPix: 'pix: 04.882.190/0001-55 (Banco do Brasil Agência 1820 Conta 49201-9)',
    gatewayProvider: 'mercadopago',
    gatewayWalletId: 'mp_col_brasildiesel_003',
    gatewaySubaccountId: 'sub_mp_forn_003',
    gatewayAccountStatus: 'ativa',
    gatewayPixKey: '04.882.190/0001-55',
    gatewaySubaccountCreatedAt: '2026-02-05T11:15:00.000Z',
    commissionRateOverride: 10,
    categoriesSupplied: ['Caminhão e Diesel', 'Máquinas Agrícolas', 'Freios Pesados', 'Injeção Diesel'],
    equipmentTypesSupplied: ['caminhao', 'agricola', 'industrial', 'outros'],
    serviceRadiusKm: 0,
    citiesCovered: ['São Paulo', 'Ribeirão Preto', 'Santos', 'São José dos Campos'],
    status: 'ativo',
    isAvailableForOrders: true,
    rating: 5.0,
    totalRatings: 78,
    totalSales: 92,
    createdAt: '2026-02-05T11:00:00.000Z',
    lastLogin: new Date().toISOString(),
  },
  {
    id: 'usr_fornecedor_pendente_1',
    phone: '11988887700',
    password: '1234',
    name: 'Jorge Vianna de Souza',
    companyName: 'Auto Peças & Sucatas Leste Ltda',
    email: 'jorge@autoleste.com.br',
    role: 'fornecedor',
    personType: 'PJ',
    document: '31.902.184/0001-44',
    stateRegistration: '118.730.290.410',
    avatarUrl: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=200&q=80',
    address: {
      cep: '08010-000',
      street: 'Av. Marechal Tito',
      number: '2100',
      neighborhood: 'São Miguel Paulista',
      city: 'São Paulo',
      state: 'SP',
      coordinates: { lat: -23.4958, lng: -46.4418 },
    },
    coordinates: { lat: -23.4958, lng: -46.4418 },
    categoriesSupplied: ['Lataria', 'Faróis e Iluminação', 'Suspensão'],
    serviceRadiusKm: 50,
    citiesCovered: ['São Paulo', 'Guarulhos', 'Mogi das Cruzes'],
    status: 'pendente',
    isClassifiedByAdmin: false,
    isAvailableForOrders: false,
    rating: 5.0,
    totalRatings: 0,
    totalSales: 0,
    createdAt: '2026-11-01T10:00:00.000Z',
    lastLogin: '2026-11-01T10:00:00.000Z',
  },
  {
    id: 'usr_fornecedor_pendente_2',
    phone: '11977776611',
    password: '1234',
    name: 'Eduardo Martins Prado',
    companyName: 'Motopeças Brasil 2 Rodas & Desmanche ME',
    email: 'contato@motopecasbrasil.com.br',
    role: 'fornecedor',
    personType: 'PJ',
    document: '44.182.903/0001-12',
    stateRegistration: '108.390.112.550',
    avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=200&q=80',
    address: {
      cep: '09710-000',
      street: 'Rua Marechal Deodoro',
      number: '890',
      neighborhood: 'Centro',
      city: 'São Bernardo do Campo',
      state: 'SP',
      coordinates: { lat: -23.6914, lng: -46.5646 },
    },
    coordinates: { lat: -23.6914, lng: -46.5646 },
    categoriesSupplied: ['Motos', 'Freios', 'Transmissão e Correntes'],
    serviceRadiusKm: 30,
    citiesCovered: ['São Paulo', 'São Bernardo do Campo', 'Santo André'],
    status: 'pendente',
    isClassifiedByAdmin: false,
    isAvailableForOrders: false,
    rating: 5.0,
    totalRatings: 0,
    totalSales: 0,
    createdAt: '2026-11-01T09:00:00.000Z',
    lastLogin: '2026-11-01T09:00:00.000Z',
  },
  {
    id: 'usr_admin_1',
    phone: '11962122694',
    password: '2694',
    name: 'Super Admin AUTO SHOP',
    email: 'diretoria@autoshop.com.br',
    role: 'admin',
    personType: 'PJ',
    document: '42.991.000/0001-88',
    avatarUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=200&q=80',
    status: 'ativo',
    createdAt: '2026-01-01T00:00:00.000Z',
    lastLogin: new Date().toISOString(),
  },
];

export const INITIAL_VEHICLES: Vehicle[] = [
  {
    id: 'veh_1',
    userId: 'usr_cliente_1',
    type: 'carro',
    brand: 'Volkswagen',
    model: 'Gol',
    year: 2021,
    version: '1.6 MSI TotalFlex Trendline',
    engine: '1.6 16V EA211',
    plate: 'BRA2E19',
    chassi: '9BWCA45U7MP019284',
    createdAt: '2026-02-10T10:15:00.000Z',
  },
  {
    id: 'veh_2',
    userId: 'usr_cliente_1',
    type: 'carro',
    brand: 'Fiat',
    model: 'Toro',
    year: 2023,
    version: 'Volcano 4x4 Diesel Automático',
    engine: '2.0 Turbodiesel MultiJet',
    plate: 'FTT9D42',
    chassi: '9BD356194PZ881029',
    createdAt: '2026-02-12T11:30:00.000Z',
  },
];

export const INITIAL_CATALOG: CatalogPart[] = [
  {
    id: 'cat_1',
    category: 'Freios',
    subCategory: 'Pastilhas de Freio',
    name: 'Jogo de Pastilhas de Freio Dianteiras Cerâmica',
    oemCodes: ['5U0698151A', 'N-1282C'],
    sampleVehicles: ['VW Gol 2017-2023', 'VW Voyage 2017-2023', 'VW Saveiro 2016-2024'],
  },
  {
    id: 'cat_2',
    category: 'Freios',
    subCategory: 'Discos de Freio',
    name: 'Par de Discos de Freio Dianteiro Ventilado 256mm',
    oemCodes: ['5Z0615301B', 'HF-43A'],
    sampleVehicles: ['VW Gol 1.6', 'VW Fox 1.6', 'Fiat Toro 2.0'],
  },
  {
    id: 'cat_3',
    category: 'Suspensão',
    subCategory: 'Amortecedores',
    name: 'Par de Amortecedores Dianteiros Pressurizados Turbogás',
    oemCodes: ['5U0413031G', 'HG-31144'],
    sampleVehicles: ['VW Gol G5/G6/G7/G8', 'VW Voyage'],
  },
  {
    id: 'cat_4',
    category: 'Motor',
    subCategory: 'Distribuição e Correias',
    name: 'Kit Correia Dentada + Tensor Automático',
    oemCodes: ['04E109119F', 'CT-1167K1'],
    sampleVehicles: ['VW Gol 1.6 MSI 16V', 'VW Polo 1.6 MSI', 'VW Virtus 1.6 MSI'],
  },
  {
    id: 'cat_5',
    category: 'Faróis e Iluminação',
    subCategory: 'Faróis Principais',
    name: 'Farol Principal Lado Esquerdo Máscara Negra LED',
    oemCodes: ['5U1941005E'],
    sampleVehicles: ['VW Gol G7/G8', 'VW Saveiro Cross'],
  },
  {
    id: 'cat_6',
    category: 'Lataria',
    subCategory: 'Parachoques',
    name: 'Parachoque Dianteiro com Grade e Furo para Milha (Em Primer)',
    oemCodes: ['5U0807217B'],
    sampleVehicles: ['VW Gol 2020-2023'],
  },
  {
    id: 'cat_7',
    category: 'Câmbio',
    subCategory: 'Embreagem',
    name: 'Kit Embreagem Platô + Disco + Rolamento 200mm',
    oemCodes: ['620312700', '3000951097'],
    sampleVehicles: ['VW Gol 1.6 MSI', 'VW Voyage 1.6'],
  },
  {
    id: 'cat_8',
    category: 'Arrefecimento',
    subCategory: 'Bombas e Válvulas',
    name: "Bomba D'Água com Carcaça e Válvula Termostática",
    oemCodes: ['04E121600AD'],
    sampleVehicles: ['VW Gol 1.6 16V', 'VW Polo', 'VW T-Cross 1.0/1.4 TSI'],
  },
];

export const INITIAL_CATEGORIES: AdminCategory[] = [
  {
    id: 'cat_admin_carros',
    name: 'Veículos / Carros',
    vehicleType: 'carro',
    createdAt: '2026-01-01T00:00:00.000Z',
    subcategories: [
      { id: 'sub_car_1', name: 'Freios' },
      { id: 'sub_car_2', name: 'Suspensão' },
      { id: 'sub_car_3', name: 'Motor' },
      { id: 'sub_car_4', name: 'Faróis e Iluminação' },
      { id: 'sub_car_5', name: 'Lataria' },
      { id: 'sub_car_6', name: 'Câmbio' },
      { id: 'sub_car_7', name: 'Arrefecimento' },
      { id: 'sub_car_8', name: 'Elétrica e Ignição' },
      { id: 'sub_car_9', name: 'Vidros e Retrovisores' },
      { id: 'sub_car_10', name: 'Direção' },
    ],
  },
  {
    id: 'cat_admin_motos',
    name: 'Motos',
    vehicleType: 'moto',
    createdAt: '2026-01-01T00:00:00.000Z',
    subcategories: [
      { id: 'sub_moto_1', name: 'Freios' },
      { id: 'sub_moto_2', name: 'Suspensão' },
      { id: 'sub_moto_3', name: 'Motor' },
      { id: 'sub_moto_4', name: 'Transmissão e Correntes' },
      { id: 'sub_moto_5', name: 'Faróis e Iluminação' },
      { id: 'sub_moto_6', name: 'Elétrica e Ignição' },
      { id: 'sub_moto_7', name: 'Carenagem e Lataria' },
    ],
  },
  {
    id: 'cat_admin_caminhoes',
    name: 'Caminhões & Diesel',
    vehicleType: 'caminhao',
    createdAt: '2026-01-01T00:00:00.000Z',
    subcategories: [
      { id: 'sub_cam_1', name: 'Freios Pesados' },
      { id: 'sub_cam_2', name: 'Injeção Diesel' },
      { id: 'sub_cam_3', name: 'Motor' },
      { id: 'sub_cam_4', name: 'Câmbio e Embreagem' },
      { id: 'sub_cam_5', name: 'Suspensão e Eixos' },
      { id: 'sub_cam_6', name: 'Faróis e Iluminação' },
      { id: 'sub_cam_7', name: 'Elétrica 24V' },
    ],
  },
  {
    id: 'cat_admin_agricola',
    name: 'Máquinas Agrícolas',
    vehicleType: 'agricola',
    createdAt: '2026-01-01T00:00:00.000Z',
    subcategories: [
      { id: 'sub_agr_1', name: 'Hidráulica' },
      { id: 'sub_agr_2', name: 'Motor Diesel' },
      { id: 'sub_agr_3', name: 'Transmissão e Eixos' },
      { id: 'sub_agr_4', name: 'Filtros e Manutenção' },
      { id: 'sub_agr_5', name: 'Elétrica' },
    ],
  },
  {
    id: 'cat_admin_industrial',
    name: 'Máquinas Industriais',
    vehicleType: 'industrial',
    createdAt: '2026-01-01T00:00:00.000Z',
    subcategories: [
      { id: 'sub_ind_1', name: 'Hidráulica' },
      { id: 'sub_ind_2', name: 'Pneumática' },
      { id: 'sub_ind_3', name: 'Motor' },
      { id: 'sub_ind_4', name: 'Elétrica' },
      { id: 'sub_ind_5', name: 'Transmissão' },
    ],
  },
  {
    id: 'cat_admin_outros',
    name: 'Outros Veículos',
    vehicleType: 'outros',
    createdAt: '2026-01-01T00:00:00.000Z',
    subcategories: [
      { id: 'sub_out_1', name: 'Motor' },
      { id: 'sub_out_2', name: 'Freios' },
      { id: 'sub_out_3', name: 'Suspensão' },
      { id: 'sub_out_4', name: 'Elétrica' },
      { id: 'sub_out_5', name: 'Acessórios' },
    ],
  },
];

export const INITIAL_REQUESTS: PartRequest[] = [
  {
    id: 'req_corolla_45872',
    requestNumber: '45872',
    customerId: 'usr_cliente_1',
    customerName: 'Carlos Eduardo Ribeiro',
    customerPhone: '11987654321',
    vehicleType: 'carro',
    vehicleBrand: 'Toyota',
    vehicleModel: 'Corolla',
    vehicleYear: 2018,
    vehicleEngine: '2.0 Dual VVT-i Flex',
    vehiclePlate: 'COR-4587',
    vehicleChassi: '9BRBL42E9J0145872',
    partIdentificationType: 'description',
    partName: 'Amortecedor dianteiro',
    partCategory: 'Suspensão',
    oemCode: '48510-02870',
    description: 'Amortecedor dianteiro lado direito original ou primeira linha com garantia para entrega urgente.',
    mediaUrl: '/src/assets/images/compe_hero_autoparts_1793928394704.jpg',
    deliveryAddress: {
      cep: '01001-000',
      city: 'São Paulo',
      neighborhood: 'Centro',
      street: 'Praça da Sé',
      number: '100',
      complement: 'Conjunto 42',
      state: 'SP',
      coordinates: { lat: -23.5503, lng: -46.6342 },
    },
    status: 'orcamentos_recebidos',
    createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 14 * 60 * 1000 + 35 * 1000).toISOString(),
    clientExpiresAt: new Date(Date.now() + 50 * 60 * 1000).toISOString(),
    searchRadiusKm: 30,
    autoExpanded: false,
    priorityLevel: 1,
  },
  {
    id: 'req_1',
    requestNumber: 'CMP-84920',
    customerId: 'usr_cliente_1',
    customerName: 'Carlos Eduardo Ribeiro',
    customerPhone: '11987654321',
    vehicleType: 'carro',
    vehicleBrand: 'Volkswagen',
    vehicleModel: 'Gol',
    vehicleYear: 2021,
    vehicleEngine: '1.6 MSI 16V Flex',
    vehiclePlate: 'BRA2E19',
    vehicleChassi: '9BWCA45U7MP019284',
    partIdentificationType: 'catalog',
    partName: 'Par de Discos de Freio Dianteiro Ventilado 256mm',
    partCategory: 'Freios',
    oemCode: '5Z0615301B',
    description: 'Preciso de discos novos ou em ótimo estado com espessura dentro da tolerância, para entrega rápida na Vila Mariana.',
    mediaUrl: '/src/assets/images/compe_hero_autoparts_1793928394704.jpg',
    deliveryAddress: {
      cep: '04101-000',
      city: 'São Paulo',
      neighborhood: 'Vila Mariana',
      street: 'Rua Domingos de Morais',
      number: '1420',
      complement: 'Apto 82 Bloco B',
      state: 'SP',
      coordinates: { lat: -23.5919, lng: -46.6368 },
    },
    status: 'orcamentos_recebidos',
    createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 7 * 60 * 1000).toISOString(),
    clientExpiresAt: new Date(Date.now() + 52 * 60 * 1000).toISOString(),
    searchRadiusKm: 30,
    autoExpanded: false,
    priorityLevel: 1,
  },
];

export const INITIAL_QUOTES: Quote[] = [
  {
    id: 'quo_corolla_1',
    requestId: 'req_corolla_45872',
    supplierId: 'usr_fornecedor_1',
    supplierName: 'Auto Peças São Paulo Central Ltda',
    supplierPhone: '11999887766',
    supplierRating: 4.9,
    availability: 'estoque',
    condition: 'nova',
    brand: 'Cofap Turbogás',
    partCode: 'GP-32941',
    partPrice: 320.00,
    shippingPrice: 0.00,
    totalPrice: 320.00,
    deliveryDays: 1,
    warrantyDays: 180,
    observations: 'Amortecedor novo lacrado com certificado e garantia de 6 meses. Entrega grátis no mesmo dia.',
    photoUrl: '/src/assets/images/compe_hero_autoparts_1793928394704.jpg',
    status: 'pendente',
    createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
  },
  {
    id: 'quo_corolla_2',
    requestId: 'req_corolla_45872',
    supplierId: 'usr_fornecedor_2',
    supplierName: 'Desmanche Legal Paulista (Credenciado DETRAN)',
    supplierPhone: '11977665544',
    supplierRating: 4.8,
    availability: 'estoque',
    condition: 'nova',
    brand: 'Monroe OESpectrum',
    partCode: 'MN-7419',
    partPrice: 340.00,
    shippingPrice: 0.00,
    totalPrice: 340.00,
    deliveryDays: 1,
    warrantyDays: 180,
    observations: 'Monroe pressurizado a gás de alta durabilidade.',
    photoUrl: '/src/assets/images/compe_hero_autoparts_1793928394704.jpg',
    status: 'pendente',
    createdAt: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
  },
  {
    id: 'quo_corolla_3',
    requestId: 'req_corolla_45872',
    supplierId: 'usr_fornecedor_3',
    supplierName: 'Distribuidora Brasil Diesel & Pesados',
    supplierPhone: '11966554433',
    supplierRating: 5.0,
    availability: 'estoque',
    condition: 'nova',
    brand: 'Nakata Pressurizado',
    partCode: 'HG-31002',
    partPrice: 350.00,
    shippingPrice: 0.00,
    totalPrice: 350.00,
    deliveryDays: 2,
    warrantyDays: 180,
    observations: 'Nakata original com batente e coifa inclusos.',
    photoUrl: '/src/assets/images/compe_hero_autoparts_1793928394704.jpg',
    status: 'pendente',
    createdAt: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
  },
  {
    id: 'quo_corolla_4',
    requestId: 'req_corolla_45872',
    supplierId: 'usr_fornecedor_1',
    supplierName: 'Auto Peças São Paulo Central Ltda',
    supplierPhone: '11999887766',
    supplierRating: 4.9,
    availability: 'estoque',
    condition: 'nova',
    brand: 'Kayaba Excel-G',
    partCode: 'KYB-33441',
    partPrice: 360.00,
    shippingPrice: 0.00,
    totalPrice: 360.00,
    deliveryDays: 1,
    warrantyDays: 180,
    observations: 'Linha japonesa premium para Toyota Corolla.',
    photoUrl: '/src/assets/images/compe_hero_autoparts_1793928394704.jpg',
    status: 'pendente',
    createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  },
  {
    id: 'quo_corolla_5',
    requestId: 'req_corolla_45872',
    supplierId: 'usr_fornecedor_2',
    supplierName: 'Desmanche Legal Paulista (Credenciado DETRAN)',
    supplierPhone: '11977665544',
    supplierRating: 4.8,
    availability: 'estoque',
    condition: 'nova',
    brand: 'Toyota OEM Genuína',
    partCode: '48510-02870',
    partPrice: 390.00,
    shippingPrice: 0.00,
    totalPrice: 390.00,
    deliveryDays: 2,
    warrantyDays: 365,
    observations: 'Peça genuína Toyota na caixa lacrada da concessionária.',
    photoUrl: '/src/assets/images/compe_hero_autoparts_1793928394704.jpg',
    status: 'pendente',
    createdAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
  },
];

export const INITIAL_ORDERS: OrderAndPayment[] = [
  {
    id: 'ord_corolla_45872',
    orderNumber: '26.11.00000001',
    requestId: 'req_corolla_45872',
    quoteId: 'quo_corolla_1',
    customerId: 'usr_cliente_1',
    supplierId: 'usr_fornecedor_1',
    partName: 'Amortecedor dianteiro',
    vehicleSummary: 'Toyota Corolla 2018',
    partPrice: 320.00,
    shippingPrice: 0.00,
    totalAmount: 320.00,
    platformCommissionRate: 10,
    platformCommissionAmount: 32.00,
    supplierTransferAmount: 288.00,
    paymentMethod: 'pix',
    paymentStatus: 'confirmado',
    pixCode: '00020126580014br.gov.bcb.pix0136autoshop-gateway-458725204000053039865406320.005802BR5917AUTO SHOP PLATAF6009SAO PAULO62070503***63047A8F',
    nfeKey: '35260218492102000190550010000458721008492014',
    nfeNumber: 'NF-e Emitida: 004587 - Série 1',
    nfeSerie: '1',
    pinDeliveryCode: '4872',
    deliveryStatus: 'a_caminho',
    packagedPhotoUrl: '/src/assets/images/compe_delivery_van_1793928395506.jpg',
    trackingCarrier: 'Jadlog',
    trackingCode: '123456789',
    deliveryAddress: INITIAL_REQUESTS[0].deliveryAddress,
    supplierReceiptConfirmed: true,
    gatewayProvider: 'asaas',
    gatewayChargeId: 'chg_asaas_45872_seed',
    gatewayInvoiceUrl: 'https://autoshop.sandbox.gateway/fatura/chg_asaas_45872_seed',
    splitStatus: 'dividido_pago',
    splitBreakdown: {
      provider: 'asaas',
      platformWalletId: 'wallet_master_autoshop_001',
      platformFeePercent: 10,
      platformAmount: 32.00,
      supplierWalletId: 'wallet_asaas_autopecassp_001',
      supplierSubaccountId: 'sub_asaas_forn_001',
      supplierAmount: 288.00,
      gatewaySplitId: 'spl_chg_asaas_45872_seed',
      processedAt: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
    },
    createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    paidAt: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
  },
];

export const INITIAL_SPLIT_TRANSACTIONS: SplitTransaction[] = [
  {
    id: 'spl_tx_45872',
    orderId: 'ord_corolla_45872',
    orderNumber: '26.11.00000001',
    requestId: 'req_corolla_45872',
    customerId: 'usr_cliente_1',
    supplierId: 'usr_fornecedor_1',
    supplierName: 'Auto Peças São Paulo Central Ltda',
    supplierDocument: '18.492.102/0001-90',
    gatewayProvider: 'asaas',
    gatewayChargeId: 'chg_asaas_45872_seed',
    supplierWalletId: 'wallet_asaas_autopecassp_001',
    supplierSubaccountId: 'sub_asaas_forn_001',
    platformWalletId: 'wallet_master_autoshop_001',
    paymentMethod: 'pix',
    grossAmount: 320.00,
    platformFeePercent: 10,
    platformAmount: 32.00,
    supplierNetAmount: 288.00,
    status: 'dividido_pago',
    splitPayload: {
      billingType: 'PIX',
      value: 320.00,
      externalReference: '26.11.00000001',
      split: [{ walletId: 'wallet_asaas_autopecassp_001', fixedValue: 288.00 }],
    },
    notes: 'Split automático processado no gateway Asaas (10% AUTO SHOP / 90% carteira parceiro).',
    createdAt: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
  },
];

export const INITIAL_SPAMS_CONFIG: SpamTriggerConfig[] = [
  {
    id: 'spam_1',
    type: 'nova_oportunidade',
    targetAudience: 'fornecedor',
    title: 'NOVA OPORTUNIDADE DE VENDA!',
    subtitle: 'Um cliente próximo solicitou cotação urgente. Responda antes de expirar!',
    colorScheme: 'orange',
    countdownSeconds: 600,
    soundEnabled: true,
    soundType: 'urgent_alarm',
    actionButtonLabel: 'PREENCHER ORÇAMENTO',
    isMandatoryAction: true,
  },
  {
    id: 'spam_2',
    type: 'orcamento_recebido',
    targetAudience: 'cliente',
    title: 'NOVO ORÇAMENTO DISPONÍVEL!',
    subtitle: 'Fornecedores enviaram propostas para sua peça com ótimos preços!',
    colorScheme: 'blue',
    countdownSeconds: 3600,
    soundEnabled: true,
    soundType: 'delivery_chime',
    actionButtonLabel: 'COMPARAR E COMPRAR',
    isMandatoryAction: false,
  },
  {
    id: 'spam_3',
    type: 'venda_confirmada',
    targetAudience: 'fornecedor',
    title: 'PAGAMENTO DO PEDIDO REALIZADO!',
    subtitle: 'Verifique o recebimento do valor na sua conta bancária/gateway antes de iniciar a separação da peça.',
    colorScheme: 'yellow',
    countdownSeconds: 3600,
    soundEnabled: true,
    soundType: 'cash_success',
    actionButtonLabel: 'CONFIRMAR PAGAMENTO RECEBIDO',
    isMandatoryAction: true,
  },
  {
    id: 'spam_4',
    type: 'pedido_a_caminho',
    targetAudience: 'cliente',
    title: 'PEÇA A CAMINHO DA SUA CASA!',
    subtitle: 'O entregador já está em rota. Tenha seu PIN de 4 dígitos em mãos para receber.',
    colorScheme: 'blue',
    countdownSeconds: 0,
    soundEnabled: true,
    soundType: 'delivery_chime',
    actionButtonLabel: 'VER CÓDIGO DE RASTREIO E PIN',
    isMandatoryAction: false,
  },
  {
    id: 'spam_5',
    type: 'alerta_admin_sem_orcamento',
    targetAudience: 'admin',
    title: 'ALERTA: PEDIDO SEM ORÇAMENTO APÓS 15 MIN!',
    subtitle: 'Intervenha para expandir raio ou contatar fornecedores manualmente.',
    colorScheme: 'purple',
    countdownSeconds: 0,
    soundEnabled: true,
    soundType: 'warning_beep',
    actionButtonLabel: 'INTERVIR NO PEDIDO',
    isMandatoryAction: true,
  },
];

export const INITIAL_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'aud_1',
    timestamp: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    userId: 'usr_cliente_1',
    userPhone: '11987654321',
    userRole: 'cliente',
    action: 'Criação de Pedido com Pagamento Confirmado',
    entityType: 'order',
    entityId: 'ord_1',
    details: 'Pagamento PIX confirmado no valor de R$ 160,00. Split: R$ 16,00 plataforma / R$ 144,00 fornecedor. PIN de segurança gerado.',
    ipAddress: '189.102.44.12',
  },
  {
    id: 'aud_2',
    timestamp: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
    userId: 'usr_fornecedor_1',
    userPhone: '11999887766',
    userRole: 'fornecedor',
    action: 'Separação e Envio de Peça',
    entityType: 'order',
    entityId: 'ord_1',
    details: 'Foto da embalagem anexada. Transportadora AUTO SHOP Express Moto Rápido (AS-SP-99104).',
    ipAddress: '201.82.110.5',
  },
];

export const INITIAL_COMMISSION_SETTINGS: CommissionSettings = {
  generalCommissionPercent: 10,
  categoryCommissions: {
    Freios: 10,
    Suspensão: 10,
    Motor: 8,
    'Faróis e Iluminação': 12,
    Lataria: 12,
    'Caminhão e Diesel': 7,
  },
  minTransferAmount: 50,
  autoReleaseAfterPinValidation: true,
  distributionMode: 'automatic',
};

export const INITIAL_TIMER_SETTINGS: SystemTimerSettings = {
  supplierResponseTimeoutMinutes: 16,
  clientApprovalTimeoutMinutes: 1440,
};

export const INITIAL_CHAT_MESSAGES: ChatMessage[] = [
  {
    id: 'msg_1',
    requestId: 'req_corolla_45872',
    requestNumber: '#45872',
    senderId: 'usr_cliente_1',
    senderName: 'Carlos Eduardo Ribeiro',
    senderRole: 'cliente',
    recipientId: 'usr_fornecedor_1',
    message: 'Olá! O amortecedor do Corolla acompanha o batente e coifa ou somente a peça?',
    readByUserIds: ['usr_cliente_1', 'usr_fornecedor_1', 'usr_admin_1'],
    createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  },
  {
    id: 'msg_2',
    requestId: 'req_corolla_45872',
    requestNumber: '#45872',
    senderId: 'usr_fornecedor_1',
    senderName: 'Auto Peças São Paulo Central Ltda',
    senderRole: 'fornecedor',
    recipientId: 'usr_cliente_1',
    message: 'Olá Carlos! Sim, nosso kit Monroe OESpectrum vai completo com coifa e batente de poliuretano com 6 meses de garantia.',
    readByUserIds: ['usr_cliente_1', 'usr_fornecedor_1', 'usr_admin_1'],
    createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
  },
  {
    id: 'msg_3',
    requestId: 'req_corolla_45872',
    requestNumber: '#45872',
    senderId: 'usr_admin_1',
    senderName: 'Super Administrador AUTO SHOP',
    senderRole: 'admin',
    message: 'AUTO SHOP Suporte: Verificamos o pedido e o prazo de entrega expressa para este CEP está confirmado para o mesmo dia.',
    isAdminIntervention: true,
    readByUserIds: ['usr_cliente_1', 'usr_fornecedor_1', 'usr_admin_1'],
    createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
  },
];

export const INITIAL_CUSTOMIZATION_SETTINGS: AppCustomizationSettings = {
  fontFamily: 'Plus Jakarta Sans',
  fontSizeScale: 'normal',
  primaryTextColor: '#0f172a',
  secondaryTextColor: '#475569',
  primaryBrandColor: '#2563eb',
  accentColor: '#eab308',

  appName: 'AUTO SHOP',
  appSubtitle: 'auto.m1br.com.br',
  appSlogan: 'O shopping das autopeças online !',
  appTagline: 'Do pedido à entrega, tudo pelo app! Site: www.m1br.com.br · App: auto.m1br.com.br · WhatsApp: 11 96212-2694',
  headerWebsite: 'www.m1br.com.br',
  appDomain: 'auto.m1br.com.br',
  whatsappNumber: '11 96212-2694',
  footerText: 'AUTO SHOP — O shopping das autopeças online !',

  portalClienteBadge: 'Cadastro Público Liberado · Acesso Exclusivo do Cliente',
  portalClienteTitle: 'Área do Cliente',
  portalClienteDesc: 'Para proprietários, motoristas e mecânicos cotarem peças para seu veículo, compararem ofertas e receberem com PIN de segurança.',
  portalClienteBtnLogin: 'Entrar como Cliente',
  portalClienteBtnRegister: 'Criar Conta de Cliente',

  portalFornecedorBadge: 'Homologação Prévia pelo Admin · Portal Exclusivo da Loja',
  portalFornecedorTitle: 'Portal do Fornecedor',
  portalFornecedorDesc: 'Para lojas de autopeças, distribuidoras e desmanches credenciados receberem chamados após autorização e classificação do Admin.',
  portalFornecedorBtnLogin: 'Entrar como Fornecedor',
  portalFornecedorBtnRegister: 'Cadastrar Loja (Solicitar Aprovação)',

  clientWelcomeTitle: 'Olá, qual peça seu veículo precisa hoje?',
  clientSearchPlaceholder: 'Ex: Amortecedor Corolla 2018, Pastilha de freio Gol...',
  requestButtonText: 'SOLICITAR COTAÇÃO DE PEÇA',
  quotesTitle: 'Melhores Ofertas Recebidas',
  quotesSubtitle: 'Top 5 ofertas ranqueadas por menor preço total (peça + frete)',
  pinSecurityNotice: 'Informe o PIN de 4 dígitos apenas quando receber e conferir a peça em mãos.',

  supplierWelcomeTitle: 'Central de Cotações & Vendas',
  supplierOpportunityAlert: 'NOVA OPORTUNIDADE! Responda em até 15 minutos',
  supplierSubmitQuoteText: 'Enviar Proposta Competitiva',
  supplierShipNotice: 'Fotografe a embalagem lacrada com a etiqueta de rastreio visível.',
  supplierPinValidationText: 'Valide o PIN de 4 dígitos informado pelo cliente para liberar seu pagamento.',

  logoUrl: '/assets/aistudio/M1_AUTO_LOGO_3c381c58.jpg',
  faviconUrl: '/assets/aistudio/M1_AUTO_LOGO_3c381c58.jpg',
  clientHeroImageUrl: '/src/assets/images/compe_hero_autoparts_1793928394704.jpg',
  portalClienteImageUrl: '/assets/aistudio/M1_AUTO_LOGO_3c381c58.jpg',
  portalFornecedorImageUrl: '/assets/aistudio/M1_AUTO_LOGO_3c381c58.jpg',
  defaultPartImageUrl: '/src/assets/images/compe_hero_autoparts_1793928394704.jpg',

  clientTabs: {
    inicio: { label: 'Painel Geral', visible: true },
    fluxo_referencia: { label: '📱 6 Telas do Modelo (Mockup)', visible: true },
    solicitacoes: { label: 'Minhas Solicitações', visible: true },
    entregas: { label: 'Acompanhar Entregas (PIN)', visible: true },
    compras: { label: 'Histórico de Compras', visible: true },
    garagem: { label: 'Meus Veículos', visible: true },
    catalogos: { label: 'Catálogos Fabricantes (PDF)', visible: true },
  },

  supplierTabs: {
    oportunidades: { label: 'Novas Oportunidades', visible: true },
    catalogos: { label: 'Catálogos Fabricantes (PDF)', visible: true },
    fluxo_referencia: { label: '📱 6 Telas do Modelo', visible: true },
    pedidos: { label: 'Pedidos Recebidos & Expedição', visible: true },
    cotacoes: { label: 'Cotações Enviadas', visible: true },
    financeiro: { label: 'Financeiro e Repasses', visible: true },
    avaliacoes: { label: 'Avaliações da Loja', visible: true },
  },

  clientFields: {
    vehicleBrand: { label: 'Marca *', placeholder: 'Ex: Volkswagen, Toyota...', visible: true },
    vehicleModel: { label: 'Modelo *', placeholder: 'Ex: Gol, Corolla...', visible: true },
    vehicleYear: { label: 'Ano *', placeholder: 'Ex: 2021', visible: true },
    vehicleEngine: { label: 'Versão e Motorização', placeholder: 'Ex: 1.6 MSI TotalFlex', visible: true },
    vehiclePlate: { label: 'Placa (Opcional)', placeholder: 'BRA2E19', visible: true },
    vehicleChassi: { label: 'Número do Chassi (Recomendado)', placeholder: '17 dígitos do chassi', visible: true },
    partName: { label: 'Nome da Peça *', placeholder: 'Ex: Amortecedor Dianteiro', visible: true },
    oemCode: { label: 'Código OEM', placeholder: 'Ex: 5U0698151A', visible: true },
    partCategory: { label: 'Subcategoria *', placeholder: 'Selecione a subcategoria', visible: true },
    partCharacteristics: { label: 'Características', placeholder: 'Condição desejada', visible: true },
    partPosition: { label: 'Posição no Veículo', placeholder: 'Dianteiro / Traseiro', visible: true },
    description: { label: 'Observações', placeholder: 'Detalhes extras para o fornecedor...', visible: true },
  },

  supplierFields: {
    partPrice: { label: '1. Valor Total da Peça (em R$) *', placeholder: '0.00', visible: true },
    deliveryTime: { label: '2. Tempo de Entrega da Peça (Horas ou Dias) *', placeholder: 'Ex: 2', visible: true },
    shippingMethod: { label: '3. Tipo / Modo de Envio da Peça *', placeholder: 'Motoboy / Transportadora', visible: true },
    technicalDetails: { label: '4. Características Técnicas e Dados da Peça *', placeholder: 'Descreva detalhes como material, medidas, compatibilidade com o chassi...', visible: true },
  },

  alarmSettings: {
    nova_oportunidade: { enabled: true, tone: 'urgent_alarm', volume: 0.28, repeatCount: 1 },
    orcamento_recebido: { enabled: true, tone: 'delivery_chime', volume: 0.25, repeatCount: 1 },
    venda_confirmada: { enabled: true, tone: 'cash_success', volume: 0.30, repeatCount: 1 },
    pedido_a_caminho: { enabled: true, tone: 'delivery_chime', volume: 0.25, repeatCount: 1 },
    mensagem_chat: { enabled: true, tone: 'chat_tone', volume: 0.28, repeatCount: 1 },
    alerta_admin: { enabled: true, tone: 'warning_beep', volume: 0.25, repeatCount: 1 },
  },

  paymentMethodsConfig: [
    {
      id: 'pay_pix',
      key: 'pix',
      label: 'PIX Instantâneo',
      enabled: true,
      instructions: 'Aprovação imediata via QR Code ou Copia e Cola.',
      badgeText: 'Mais Rápido',
    },
    {
      id: 'pay_credit_card',
      key: 'credit_card',
      label: 'Cartão de Crédito',
      enabled: true,
      instructions: 'Pagamento parcelado ou à vista no checkout seguro.',
      badgeText: 'Parcelamento',
    },
    {
      id: 'pay_debit_card',
      key: 'debit_card',
      label: 'Cartão de Débito / TED',
      enabled: false,
      instructions: 'Transferência identificada ou débito direto.',
      badgeText: 'Opcional',
    },
  ],

  privacyRuleNotice: 'Regra de Privacidade LGPD: O fornecedor visualiza apenas Cidade e Bairro até o pagamento ser aprovado.',
  warrantyPolicyText: 'Todas as peças possuem garantia legal de 90 dias com mediação segura da plataforma AUTO SHOP.',
};

export const INITIAL_MANUFACTURER_CATALOGS: ManufacturerCatalog[] = [];

export const INITIAL_CLIENT_ADS_SETTINGS: ClientAdsSettings = {
  enabled: true,
  showOnStartupSplash: false,
  startupSplashSeconds: 3,
  startupAdItemId: '',
  footerEnabled: true,
  footerMode: 'sequential',
  intervalSeconds: 5,
  periodicIntervalSeconds: 30,
  periodicDurationSeconds: 10,
  footerSize: 'medium',
  fixedAdItemId: '',
  allowUserPause: true,
  items: [],
};

export function mergeCustomizationSettings(
  incoming?: Partial<AppCustomizationSettings>
): AppCustomizationSettings {
  const base = INITIAL_CUSTOMIZATION_SETTINGS;
  if (!incoming) return { ...base };

  const isLegacyAppName =
    !incoming.appName ||
    incoming.appName === 'COMPE' ||
    incoming.appName === 'COMP AUTO' ||
    incoming.appName === 'M1 AUTO';
  const isLegacySubtitle = !incoming.appSubtitle || incoming.appSubtitle === 'ONLINE' || incoming.appSubtitle.includes('Comércio de Peças');
  const isLegacySlogan = !incoming.appSlogan || incoming.appSlogan === 'O Shopping de Autopeças';
  const isLegacyWebsite = !incoming.headerWebsite || incoming.headerWebsite === 'www.compe.online';
  const isLegacyTagline = !incoming.appTagline || incoming.appTagline === 'Do pedido à entrega, tudo pelo app! Rápido · Seguro · Sem complicação';
  const isLegacyFooter =
    !incoming.footerText ||
    incoming.footerText === 'Mais agilidade, mais economia, em um só lugar!' ||
    incoming.footerText.startsWith('M1 AUTO —');
  const isLegacyLogo = incoming.logoUrl === undefined || incoming.logoUrl === '/compe_logo.png';
  const isLegacyFavicon = !incoming.faviconUrl || incoming.faviconUrl === '/icon.svg';
  const isLegacyPortalCliImg = !incoming.portalClienteImageUrl || incoming.portalClienteImageUrl === '/compe_logo.png';
  const isLegacyPortalFornImg = !incoming.portalFornecedorImageUrl || incoming.portalFornecedorImageUrl === '/compe_logo.png';
  const isLegacyWarranty =
    !incoming.warrantyPolicyText ||
    incoming.warrantyPolicyText === 'Todas as peças possuem garantia legal de 90 dias com mediação segura da plataforma COMPE.' ||
    incoming.warrantyPolicyText === 'Todas as peças possuem garantia legal de 90 dias com mediação segura da plataforma M1 AUTO.';

  return {
    ...base,
    ...incoming,
    appName: isLegacyAppName ? base.appName : incoming.appName!,
    appSubtitle: isLegacySubtitle ? base.appSubtitle : incoming.appSubtitle!,
    appSlogan: isLegacySlogan ? base.appSlogan : incoming.appSlogan!,
    appTagline: isLegacyTagline ? base.appTagline : incoming.appTagline!,
    headerWebsite: isLegacyWebsite ? base.headerWebsite : incoming.headerWebsite!,
    appDomain: incoming.appDomain || base.appDomain,
    whatsappNumber: incoming.whatsappNumber || base.whatsappNumber,
    footerText: isLegacyFooter ? base.footerText : incoming.footerText!,
    logoUrl: isLegacyLogo ? base.logoUrl : incoming.logoUrl,
    faviconUrl: isLegacyFavicon ? base.faviconUrl : incoming.faviconUrl,
    portalClienteImageUrl: isLegacyPortalCliImg ? base.portalClienteImageUrl : incoming.portalClienteImageUrl,
    portalFornecedorImageUrl: isLegacyPortalFornImg ? base.portalFornecedorImageUrl : incoming.portalFornecedorImageUrl,
    warrantyPolicyText: isLegacyWarranty ? base.warrantyPolicyText : incoming.warrantyPolicyText!,
    clientTabs: { ...base.clientTabs, ...(incoming.clientTabs || {}) },
    supplierTabs: { ...base.supplierTabs, ...(incoming.supplierTabs || {}) },
    clientFields: { ...base.clientFields, ...(incoming.clientFields || {}) },
    supplierFields: { ...base.supplierFields, ...(incoming.supplierFields || {}) },
    alarmSettings: {
      ...base.alarmSettings!,
      ...(incoming.alarmSettings || {}),
    },
    paymentMethodsConfig:
      incoming.paymentMethodsConfig && incoming.paymentMethodsConfig.length > 0
        ? incoming.paymentMethodsConfig
        : base.paymentMethodsConfig,
  };
}

export function repairUserRecord(u: User): { user: User; changed: boolean } {
  let changed = false;
  const copy: User = { ...u };

  if (copy.id === 'usr_admin_1' || copy.role === 'admin') {
    if (
      copy.phone === '11900001111' ||
      !copy.password ||
      copy.password === '1234' ||
      copy.phone !== '11962122694' ||
      copy.name === 'Super Admin COMPE' ||
      copy.name === 'Super Admin M1 AUTO'
    ) {
      if (copy.id === 'usr_admin_1') {
        if (copy.phone !== '11962122694') {
          copy.phone = '11962122694';
          changed = true;
        }
        if (copy.password !== '2694') {
          copy.password = '2694';
          changed = true;
        }
        if (copy.name === 'Super Admin COMPE' || copy.name === 'Super Admin M1 AUTO') {
          copy.name = 'Super Admin AUTO SHOP';
          changed = true;
        }
      }
    }
  }

  const seed = INITIAL_USERS.find(s => s.id === copy.id);
  if (seed) {
    if (!copy.password && seed.password) {
      copy.password = seed.password;
      changed = true;
    }
    if (!copy.address && seed.address) {
      copy.address = { ...seed.address };
      changed = true;
    }
    if (!copy.coordinates && seed.coordinates) {
      copy.coordinates = { ...seed.coordinates };
      changed = true;
    }
    if (copy.role === 'fornecedor' && copy.status === 'ativo') {
      if (!copy.supplierTier && seed.supplierTier) {
        copy.supplierTier = seed.supplierTier;
        changed = true;
      }
      if (copy.isClassifiedByAdmin === undefined && seed.isClassifiedByAdmin !== undefined) {
        copy.isClassifiedByAdmin = seed.isClassifiedByAdmin;
        changed = true;
      }
      if (!copy.equipmentTypesSupplied && seed.equipmentTypesSupplied) {
        copy.equipmentTypesSupplied = [...seed.equipmentTypesSupplied];
        changed = true;
      }
      if (copy.serviceRadiusKm === undefined && seed.serviceRadiusKm !== undefined) {
        copy.serviceRadiusKm = seed.serviceRadiusKm;
        changed = true;
      }
      if (!copy.gatewayWalletId && seed.gatewayWalletId) {
        copy.gatewayProvider = seed.gatewayProvider;
        copy.gatewayWalletId = seed.gatewayWalletId;
        copy.gatewaySubaccountId = seed.gatewaySubaccountId;
        copy.gatewayAccountStatus = seed.gatewayAccountStatus;
        copy.gatewayPixKey = seed.gatewayPixKey;
        copy.gatewaySubaccountCreatedAt = seed.gatewaySubaccountCreatedAt;
        changed = true;
      }
    }
  }

  return { user: copy, changed };
}

export function repairUsersArray(rawUsers: User[] | undefined, deletedUserIds: string[] = []): { users: User[]; changed: boolean } {
  let changed = !Array.isArray(rawUsers);
  const deletedSet = new Set(deletedUserIds);
  const list = Array.isArray(rawUsers) ? rawUsers : [...INITIAL_USERS];

  const repaired: User[] = [];
  const seenIds = new Set<string>();

  for (const item of list) {
    if (!item || !item.id || deletedSet.has(item.id) || seenIds.has(item.id)) {
      changed = true;
      continue;
    }
    seenIds.add(item.id);
    const res = repairUserRecord(item);
    if (res.changed) changed = true;
    repaired.push(res.user);
  }

  // Garante contas base (Cliente, Fornecedores iniciais, Pendentes, Admin) se não foram explicitamente excluídas
  for (const seed of INITIAL_USERS) {
    if (!seenIds.has(seed.id) && !deletedSet.has(seed.id)) {
      repaired.push({ ...seed });
      seenIds.add(seed.id);
      changed = true;
    }
  }

  return { users: repaired, changed };
}

export function createInitialDatabaseSchema(): DatabaseSchema {
  return {
    users: INITIAL_USERS.map(u => ({ ...u })),
    vehicles: INITIAL_VEHICLES.map(v => ({ ...v })),
    catalog_parts: INITIAL_CATALOG.map(c => ({ ...c })),
    categories: INITIAL_CATEGORIES.map(c => ({ ...c, subcategories: c.subcategories.map(s => ({ ...s })) })),
    requests: INITIAL_REQUESTS.map(r => ({ ...r })),
    quotes: INITIAL_QUOTES.map(q => ({ ...q })),
    orders_and_payments: INITIAL_ORDERS.map(o => ({ ...o })),
    split_transactions: INITIAL_SPLIT_TRANSACTIONS.map(s => ({ ...s })),
    spams_config: INITIAL_SPAMS_CONFIG.map(s => ({ ...s })),
    supplier_modalities: INITIAL_SUPPLIER_MODALITIES.map(m => ({ ...m })),
    client_ads_settings: { ...INITIAL_CLIENT_ADS_SETTINGS, items: [] },
    dispatched_spams: [],
    audit_logs: INITIAL_AUDIT_LOGS.map(a => ({ ...a })),
    evaluations: [],
    commission_settings: { ...INITIAL_COMMISSION_SETTINGS },
    customization_settings: { ...INITIAL_CUSTOMIZATION_SETTINGS },
    manufacturer_catalogs: [],
    rejected_supplier_requests: [],
    timer_settings: { ...INITIAL_TIMER_SETTINGS },
    chat_messages: INITIAL_CHAT_MESSAGES.map(m => ({ ...m })),
  };
}
