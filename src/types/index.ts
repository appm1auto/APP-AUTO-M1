/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'cliente' | 'fornecedor' | 'admin';
export type UserStatus = 'ativo' | 'bloqueado' | 'pendente';
export type PersonType = 'PF' | 'PJ';

export type SupplierTier = 'opcao_1' | 'opcao_2' | 'opcao_3';
export type SupplierPaymentType = 'compe_split' | 'direto_fornecedor';

export type UserSharedMaterialType = 'pdf' | 'image' | 'video' | 'link' | 'text';

export interface UserSharedMaterial {
  id: string;
  type: UserSharedMaterialType;
  title: string;
  textContent?: string;
  url?: string;
  fileName?: string;
  fileSize?: string;
  mimeType?: string;
  createdAt: string;
  updatedAt?: string;
  addedByAdminId?: string;
}

export interface SupplierSpamModality {
  id: string;
  escrita: string;
  condicao: string;
  porcentagem: number;
  baseTier: SupplierTier;
  createdAt?: string;
  updatedAt?: string;
}

export interface User {
  id: string;
  phone: string;
  name: string;
  email?: string;
  role: UserRole;
  personType: PersonType;
  document: string; // CPF or CNPJ
  companyName?: string;
  stateRegistration?: string;
  categoriesSupplied?: string[];
  supplierCategoryIds?: string[];
  subcategoriesSupplied?: string[];
  equipmentTypesSupplied?: VehicleCategory[]; // Carros / Passeio, Motos, Caminhões & Diesel, Máquinas Agrícolas, Industrial & Outros
  serviceRadiusKm?: number;
  citiesCovered?: string[];
  status: UserStatus;
  isAvailableForOrders?: boolean; // Fornecedor online/offline
  rating?: number;
  totalRatings?: number;
  totalSales?: number;
  password?: string; // 4-digit PIN password
  avatarUrl?: string; // Logo, store facade or face photo
  address?: DeliveryAddress; // Full street address
  commissionRateOverride?: number; // % AUTO SHOP commission
  supplierTier?: SupplierTier; // 1ª, 2ª ou 3ª Opção definida pelo Admin
  supplierModalityId?: string; // ID da Classificação / Modalidade cadastrada pelo Admin
  supplierClassificationEscrita?: string; // Texto/escrita cadastrada pelo Admin para a classificação do fornecedor
  supplierClassificationCondicao?: string; // Condição cadastrada pelo Admin
  supplierClassificationPercent?: number; // Porcentagem (%) cadastrada pelo Admin
  isClassifiedByAdmin?: boolean; // Indica se o Admin já classificou e liberou o fornecedor
  approvedAt?: string;
  approvedByAdminId?: string;
  supplierPaymentType?: SupplierPaymentType; // Split automático ou Direto na conta
  bankAccountOrPix?: string; // Chave PIX ou Conta do fornecedor
  gatewayProvider?: PaymentGatewayProvider; // 'asaas' | 'mercadopago'
  gatewayWalletId?: string; // ID da carteira recebedora (walletId Asaas / collector_id MP)
  gatewaySubaccountId?: string; // ID da subconta criada no gateway
  gatewayAccountStatus?: GatewaySubaccountStatus; // 'nao_configurada' | 'em_analise' | 'ativa' | 'rejeitada'
  gatewayPixKey?: string; // Chave PIX ou conta de recebimento vinculada à subconta
  gatewayBankInfo?: GatewayBankInfo; // Dados bancários opcionais para criação da subconta
  gatewaySubaccountCreatedAt?: string;
  adminSharedMaterials?: UserSharedMaterial[]; // Contratos, PDFs, imagens, vídeos, links e textos enviados pelo Admin
  coordinates?: { lat: number; lng: number };
  coordinatesPrecision?: 'gps' | 'exact_cep' | 'cep_prefix';
  gpsVerifiedAt?: string;
  createdAt: string;
  lastLogin: string;
}

export type PaymentGatewayProvider = 'asaas' | 'mercadopago';
export type GatewaySubaccountStatus = 'nao_configurada' | 'em_analise' | 'ativa' | 'rejeitada';
export type SplitPaymentStatus = 'pendente' | 'processando' | 'dividido_pago' | 'repassado' | 'erro' | 'estornado';

export interface GatewayBankInfo {
  bankCode?: string;
  bankName?: string;
  agency?: string;
  account?: string;
  accountDigit?: string;
  accountType?: 'CONTA_CORRENTE' | 'CONTA_POUPANCA';
  ownerName?: string;
}

export interface SplitBreakdown {
  provider: PaymentGatewayProvider | 'sandbox';
  platformWalletId: string;
  platformFeePercent: number;
  platformAmount: number;
  supplierWalletId: string;
  supplierSubaccountId?: string;
  supplierAmount: number;
  gatewaySplitId?: string;
  rawGatewayPayload?: Record<string, unknown>;
  processedAt?: string;
  transferredAt?: string;
  errorMessage?: string;
}

export interface SplitTransaction {
  id: string;
  orderId: string;
  orderNumber: string;
  requestId: string;
  customerId: string;
  supplierId: string;
  supplierName: string;
  supplierDocument?: string;
  gatewayProvider: PaymentGatewayProvider | 'sandbox';
  gatewayChargeId: string;
  supplierWalletId: string;
  supplierSubaccountId?: string;
  platformWalletId: string;
  paymentMethod: PaymentMethod;
  grossAmount: number;
  platformFeePercent: number;
  platformAmount: number;
  supplierNetAmount: number;
  status: SplitPaymentStatus;
  splitPayload?: Record<string, unknown>;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  transferredAt?: string;
}

export interface SubcategoryItem {
  id: string;
  name: string;
}

export interface AdminCategory {
  id: string;
  name: string;
  vehicleType?: VehicleCategory;
  subcategories: SubcategoryItem[];
  createdAt: string;
}

export type VehicleCategory = 'carro' | 'moto' | 'caminhao' | 'agricola' | 'industrial' | 'outros';

export interface Vehicle {
  id: string;
  userId: string;
  type: VehicleCategory;
  brand: string;
  model: string;
  year: number;
  version?: string;
  engine?: string;
  plate?: string;
  chassi?: string;
  createdAt: string;
}

export interface CatalogPart {
  id: string;
  category: string;
  subCategory: string;
  name: string;
  oemCodes: string[];
  sampleVehicles: string[];
}

export type PartIdentificationType = 'catalog' | 'oem' | 'description' | 'media';
export type RequestStatus =
  | 'aguardando_orcamentos'
  | 'orcamentos_recebidos'
  | 'em_negociacao'
  | 'finalizado'
  | 'cancelado'
  | 'sem_fornecedor';

export interface RequestStatusHistoryEntry {
  id: string;
  timestamp: string;
  stage: string;
  details: string;
  actorRole: UserRole | 'sistema';
  actorName?: string;
  radiusKm?: number;
  attemptNumber?: number;
}

export interface DeliveryAddress {
  cep: string;
  city: string;
  neighborhood: string;
  street: string;
  number: string;
  complement?: string;
  state: string;
  coordinates?: { lat: number; lng: number };
  coordinatesPrecision?: 'gps' | 'exact_cep' | 'cep_prefix';
}

export interface PartRequestExtraPart {
  id: string;
  partName: string;
  partCategory: string;
  oemCode?: string;
  characteristics?: string;
  position?: string;
  mediaUrls?: string[]; // Até 3 fotos por peça adicional
}

export interface PartRequest {
  id: string;
  requestNumber: string; // e.g. CMP-84920
  customerId: string;
  customerName: string; // HIDDEN from supplier until payment
  customerPhone: string; // HIDDEN from supplier until payment
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
  mediaUrl?: string; // primary photo or video (alias for mediaUrls[0])
  mediaUrls?: string[]; // Até 5 fotos na peça principal
  mediaType?: 'photo' | 'video';
  extraParts?: PartRequestExtraPart[];
  deliveryAddress: DeliveryAddress;
  status: RequestStatus;
  createdAt: string;
  expiresAt: string; // supplier countdown target
  attemptExpiresAt?: string; // 16-minute no-quote retry countdown target
  lastAttemptAt?: string; // start timestamp of the current search attempt
  clientExpiresAt?: string; // client response countdown target
  searchRadiusKm: number;
  autoExpanded: boolean;
  searchAttempt?: number; // 1 to 4
  maxSearchAttempts?: number; // max 4
  closedReason?: 'nenhum_fornecedor_disponivel' | 'cancelado_usuario' | 'pedido_pago';
  clientGpsVerified?: boolean;
  statusHistory?: RequestStatusHistoryEntry[];
  priorityLevel: number; // 1 to 5
}


export type PartCondition = 'nova' | 'usada' | 'recondicionada';
export type AvailabilityType = 'estoque' | 'encomenda';
export type QuoteStatus = 'pendente' | 'aceito' | 'rejeitado' | 'expirado';

export interface Quote {
  id: string;
  requestId: string;
  supplierId: string;
  supplierName: string; // masked to customer as "Fornecedor Certificado #ID" until purchase, unless Tier 3
  supplierPhone: string; // masked to customer until purchase
  supplierRating: number;
  supplierTier?: SupplierTier; // 1ª, 2ª ou 3ª Opção
  supplierLogoUrl?: string; // Visível no card do cliente para Fornecedores da 3ª Opção
  availability: AvailabilityType;
  condition: PartCondition;
  brand: string;
  partCode: string;
  partPrice: number;
  shippingPrice: number;
  totalPrice: number;
  deliveryDays: number;
  deliveryHours?: number; // entrega expressa em horas
  shippingMethod?: string; // Motoboy Express, Sedex, Transportadora, Balcão
  technicalDetails?: string; // Dados e características técnicas (Opção 3)
  warrantyDays: number;
  observations?: string;
  photoUrl: string; // foto da peça
  distanceKm?: number; // distância real (km) entre CEP do fornecedor e CEP de entrega do cliente
  distanceSource?: 'rota_real' | 'linha_reta';
  status: QuoteStatus;
  createdAt: string;
}

export type PaymentMethod = 'pix' | 'credit_card' | string;
export type PaymentStatus = 'pendente' | 'confirmado' | 'estornado' | 'falha';
export type OrderDeliveryStatus = 'compra_confirmada' | 'peca_separada' | 'a_caminho' | 'entregue';

export interface OrderAndPayment {
  id: string;
  orderNumber: string; // e.g. PED-3904
  requestId: string;
  quoteId: string;
  customerId: string;
  supplierId: string;
  partName: string;
  vehicleSummary: string;
  partPrice: number;
  shippingPrice: number;
  totalAmount: number;
  platformCommissionRate: number; // e.g. 10 (%)
  platformCommissionAmount: number;
  supplierTransferAmount: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  pixCode?: string;
  nfeKey?: string;
  nfeNumber?: string;
  nfeSerie?: string;
  pinDeliveryCode: string; // 4 digits e.g. "4920"
  deliveryStatus: OrderDeliveryStatus;
  packagedPhotoUrl?: string;
  trackingCarrier?: string;
  trackingCode?: string;
  motoboyName?: string;
  motoboyPhone?: string;
  motoboyVehicle?: string; // e.g. Moto Honda CG 160 placa ABC-1234
  clientConfirmationPhotoUrl?: string; // Foto tirada pelo cliente na entrega
  pinValidatedAt?: string;
  createdAt: string;
  paidAt?: string;
  deliveredAt?: string;
  customerRatingId?: string;
  supplierTier?: SupplierTier;
  supplierPaymentType?: SupplierPaymentType;
  cancellationPenaltyNotice?: string;
  deliveryAddress?: DeliveryAddress; // Endereço cadastrado na cotação (NUNCA usar endereço pessoal do cliente)
  supplierReceiptConfirmed?: boolean; // Confirmação do fornecedor de que recebeu o valor em conta
  supplierReceiptConfirmedAt?: string;
  gatewayProvider?: PaymentGatewayProvider | 'sandbox';
  gatewayChargeId?: string;
  gatewayInvoiceUrl?: string;
  splitStatus?: SplitPaymentStatus;
  splitBreakdown?: SplitBreakdown;
  statusHistory?: RequestStatusHistoryEntry[];
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userPhone: string;
  userRole: UserRole;
  action: string;
  entityType: 'request' | 'quote' | 'order' | 'user' | 'payment' | 'pin_validation' | 'spam_config' | 'chat';
  entityId: string;
  details: string;
  ipAddress: string;
}

export interface Evaluation {
  id: string;
  orderId: string;
  customerId: string;
  supplierId: string;
  rating: number; // 1-5
  comment?: string;
  createdAt: string;
}

export interface SpamImageItem {
  id: string;
  url: string;
  caption?: string;
}

export interface SpamCustomField {
  id: string;
  label: string;
  value: string;
  fieldType: 'text' | 'highlight' | 'input';
  required?: boolean;
}

export interface SpamCustomButton {
  id: string;
  label: string;
  bgColor: string;
  textColor: string;
  actionType: 'confirm' | 'dismiss' | 'open_payment' | 'acknowledge';
}

export interface PaymentMethodConfigItem {
  id: string;
  key: string;
  label: string;
  enabled: boolean;
  instructions?: string;
  badgeText?: string;
}

export interface SpamSectionVisibility {
  showTimer?: boolean;
  showPartIdentification?: boolean;
  showPhoto?: boolean;
  showLocation?: boolean;
  showQuoteForm?: boolean;
  showFinancialSummary?: boolean;
  showCustomerData?: boolean;
  showPaymentMethods?: boolean;
}

export interface SpamTriggerConfig {
  id: string;
  type: 'nova_oportunidade' | 'orcamento_recebido' | 'venda_confirmada' | 'pedido_a_caminho' | 'alerta_admin_sem_orcamento';
  targetAudience: 'fornecedor' | 'cliente' | 'admin';
  title: string;
  subtitle: string;
  badgeText?: string;
  fontFamily?: FontFamilyOption;
  titleFontSize?: 'sm' | 'md' | 'lg' | 'xl';
  colorScheme: 'red' | 'blue' | 'green' | 'amber' | 'purple' | 'orange' | 'yellow';
  headerBgColor?: string;
  headerTextColor?: string;
  bodyBgColor?: string;
  bodyTextColor?: string;
  borderColor?: string;
  actionButtonBgColor?: string;
  actionButtonTextColor?: string;
  showDefaultActionButton?: boolean;
  countdownSeconds: number; // e.g. 900 for 15 min
  soundEnabled: boolean;
  soundType: 'urgent_alarm' | 'cash_success' | 'delivery_chime' | 'warning_beep';
  actionButtonLabel: string;
  isMandatoryAction: boolean; // cannot be closed without taking action
  images?: SpamImageItem[];
  customFields?: SpamCustomField[];
  customButtons?: SpamCustomButton[];
  sectionVisibility?: SpamSectionVisibility;
  paymentMethodsConfig?: PaymentMethodConfigItem[];
  targetedNoticeEnabled?: boolean;
  targetedMessage?: string;
  targetedAudienceFilter?: 'all' | 'specific';
  targetedUserIds?: string[];
}

export interface DispatchedSpamAlert {
  id: string;
  config: SpamTriggerConfig;
  targetAudience: 'fornecedor' | 'cliente' | 'admin';
  targetedUserIds?: string[];
  message: string;
  createdByAdminId: string;
  createdAt: string;
  acknowledgedByUserIds: string[];
}

export interface CommissionSettings {
  generalCommissionPercent: number; // default 10%
  categoryCommissions: Record<string, number>;
  minTransferAmount: number;
  autoReleaseAfterPinValidation: boolean;
  distributionMode: 'manual' | 'automatic' | 'priority';
}

export interface SystemTimerSettings {
  supplierResponseTimeoutMinutes: number; // default 15 minutes for suppliers to submit quote
  clientApprovalTimeoutMinutes: number;   // default 60 minutes for client to approve quote
}

export interface ManufacturerCatalog {
  id: string;
  manufacturer: string; // e.g. "Nakata", "Bosch", "Fras-le", "Cofap", "Mahle", "Cummins", "Honda", "Caterpillar"
  title: string;        // e.g. "Catálogo Geral de Suspensão e Direção"
  category: VehicleCategory | string;
  compatibleModels: string; // e.g. "Gol, Fox, Polo, Voyage, Saveiro, Up"
  description: string;
  fileSize: string;     // e.g. "18.4 MB"
  pdfUrl: string;       // Direct URL or DataURI
  pdfFileName?: string;  // e.g. "catalogo-nakata-suspensao-2024.pdf"
  uploadedAt: string;
  downloadsCount: number;
  hasRealPdf?: boolean;
  // Aliases for admin form
  name?: string;
  fileName?: string;
  uploadDate?: string;
}

export type FontFamilyOption =
  | 'Plus Jakarta Sans'
  | 'Inter'
  | 'Roboto'
  | 'Montserrat'
  | 'Poppins'
  | 'JetBrains Mono'
  | 'Orbitron'
  | 'Raleway';

export type AlarmEventKey =
  | 'nova_oportunidade'
  | 'orcamento_recebido'
  | 'venda_confirmada'
  | 'pedido_a_caminho'
  | 'mensagem_chat'
  | 'alerta_admin';

export type AlarmToneOption =
  | 'urgent_alarm'
  | 'cash_success'
  | 'delivery_chime'
  | 'warning_beep'
  | 'chat_tone'
  | 'siren_pulse';

export interface AlarmEventConfig {
  enabled: boolean;
  tone: AlarmToneOption;
  volume: number; // 0.05 to 1.0
  repeatCount: number; // 1 to 3
}

export interface CustomTabConfig {
  label: string;
  visible: boolean;
}

export interface CustomFieldConfig {
  label: string;
  placeholder?: string;
  visible: boolean;
}

export interface AppCustomizationSettings {
  // Typography
  fontFamily: FontFamilyOption;
  fontSizeScale: 'compact' | 'normal' | 'large';

  // Custom Colors
  primaryTextColor: string;    // Titles & primary text (#0f172a)
  secondaryTextColor: string;  // Subtitles / details (#475569)
  primaryBrandColor: string;   // Main action buttons & brand (#2563eb)
  accentColor: string;         // Highlights / badges (#eab308)

  // App Identity & Slogans
  appName: string;               // e.g. "AUTO SHOP"
  appSubtitle: string;           // e.g. "auto.m1br.com.br"
  appSlogan: string;             // e.g. "O shopping das autopeças online !"
  appTagline: string;            // e.g. "Do pedido à entrega, tudo pelo app! Site: www.m1br.com.br · App: auto.m1br.com.br · WhatsApp: 11 96212-2694"
  headerWebsite: string;         // e.g. "www.m1br.com.br"
  appDomain?: string;            // e.g. "auto.m1br.com.br"
  whatsappNumber?: string;       // e.g. "11 96212-2694"
  footerText: string;            // e.g. "AUTO SHOP — O shopping das autopeças online !"

  // Independent Portals Copy
  portalClienteBadge?: string;
  portalClienteTitle?: string;
  portalClienteDesc?: string;
  portalClienteBtnLogin?: string;
  portalClienteBtnRegister?: string;

  portalFornecedorBadge?: string;
  portalFornecedorTitle?: string;
  portalFornecedorDesc?: string;
  portalFornecedorBtnLogin?: string;
  portalFornecedorBtnRegister?: string;

  // Client Interface Texts
  clientWelcomeTitle: string;
  clientSearchPlaceholder: string;
  requestButtonText: string;
  quotesTitle: string;
  quotesSubtitle: string;
  pinSecurityNotice: string;

  // Supplier Interface Texts
  supplierWelcomeTitle: string;
  supplierOpportunityAlert: string;
  supplierSubmitQuoteText: string;
  supplierShipNotice: string;
  supplierPinValidationText: string;

  // Logo, Favicon & App Images
  logoUrl?: string; // Custom app logo URL or data URL (empty string means removed/text only)
  faviconUrl?: string; // Custom browser favicon URL or data URL
  clientHeroImageUrl?: string;
  portalClienteImageUrl?: string;
  portalFornecedorImageUrl?: string;
  defaultPartImageUrl?: string;

  // Configurable Tabs & Form Fields (Cliente & Fornecedor)
  clientTabs?: Record<string, CustomTabConfig>;
  supplierTabs?: Record<string, CustomTabConfig>;
  clientFields?: Record<string, CustomFieldConfig>;
  supplierFields?: Record<string, CustomFieldConfig>;

  // Configurable Alarms & Sounds
  alarmSettings?: Record<AlarmEventKey, AlarmEventConfig>;

  // Configurable Payment Methods
  paymentMethodsConfig?: PaymentMethodConfigItem[];

  // Policies & Rules
  privacyRuleNotice: string;
  warrantyPolicyText: string;
}

export interface ChatMessage {
  id: string;
  requestId?: string;
  orderId?: string;
  requestNumber?: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  recipientId?: string;
  message: string;
  mediaUrl?: string; // Attached photo
  isAdminIntervention?: boolean;
  isSac?: boolean;
  readByUserIds?: string[];
  createdAt: string;
}

export type ClientAdMediaType = 'image' | 'video' | 'text';
export type ClientAdsFooterMode = 'sequential' | 'paused' | 'fixed' | 'periodic';
export type ClientAdsFooterSize = 'compact' | 'medium' | 'large';

export interface ClientAdItem {
  id: string;
  title: string;
  description?: string;
  mediaType: ClientAdMediaType;
  mediaUrl?: string;
  linkUrl?: string;
  linkLabel?: string;
  price?: number;
  priceLabel?: string;
  bgColor?: string;
  textColor?: string;
  durationSeconds?: number;
  active: boolean;
  order: number;
  createdAt: string;
  updatedAt?: string;
}

export interface ClientAdsSettings {
  enabled: boolean;
  showOnStartupSplash: boolean;
  startupSplashSeconds: number;
  startupAdItemId?: string;
  footerEnabled: boolean;
  footerMode: ClientAdsFooterMode;
  intervalSeconds: number;
  periodicIntervalSeconds: number;
  periodicDurationSeconds: number;
  footerSize: ClientAdsFooterSize;
  footerCustomHeightPx?: number;
  fixedAdItemId?: string;
  allowUserPause: boolean;
  updatedAt?: string;
  items: ClientAdItem[];
}


