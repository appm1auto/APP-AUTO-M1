/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  AlertTriangle,
  Clock,
  CheckCircle,
  ArrowRight,
  Volume2,
  Lock,
  MapPin,
  Maximize2,
  X,
  AlertOctagon,
  DollarSign,
  UserCheck,
  XCircle,
  Send,
  Camera,
  CheckSquare,
  Square,
  Package,
  CreditCard,
  Megaphone,
  Eye,
  Truck,
  Bell
} from 'lucide-react';
import { SpamTriggerConfig, SupplierTier, PartRequestExtraPart, UserRole } from '../../types';
import { soundEffects } from '../../services/sound';
import { db } from '../../services/db';
import {
  isOrderIdentityUnlocked,
  getMaskedCounterpartyLabel,
  formatCityNeighborhood,
} from '../../services/rbac';

export interface ActiveSpamPayload {
  config: SpamTriggerConfig;
  isPreviewMode?: boolean;
  dispatchedAlertId?: string;
  dispatchedMessage?: string;
  onAcknowledgeDirectedSpam?: () => void;
  requestId?: string;
  orderId?: string;
  orderNumber?: string;
  requestNumber?: string;
  partName?: string;
  partCategory?: string;
  categoryName?: string;
  partSubcategory?: string;
  oemCode?: string;
  description?: string;
  vehicleSummary?: string;
  locationSummary?: string;
  city?: string;
  neighborhood?: string;
  fullAddress?: string;
  deliveryCep?: string;
  distanceKm?: number;
  viewerRole?: UserRole;
  mediaUrl?: string;
  mediaUrls?: string[];
  extraParts?: PartRequestExtraPart[];
  mediaType?: 'photo' | 'video';
  priceSummary?: string;
  partPriceSummary?: string;
  shippingPriceSummary?: string;
  supplierTransferSummary?: string;
  paymentMethodText?: string;
  paymentMethodDetail?: string;
  gatewayProviderText?: string;
  gatewayChargeId?: string;
  supplierAccountSummary?: string;
  splitStatusText?: string;
  shippingMethodText?: string;
  deliveryTimeText?: string;
  cancellationWarning?: string;
  customerName?: string;
  customerPhone?: string;
  customerDocument?: string;
  customerPhotoUrl?: string;
  supplierTier?: SupplierTier;
  supplierId?: string;
  supplierName?: string;
  supplierAvatarUrl?: string;
  expiresAtTimestamp?: number;
  onSubmitQuoteDirectly?: (quoteData: {
    partPrice: number;
    shippingPrice: number;
    deliveryDays: number;
    deliveryHours?: number;
    shippingMethod: string;
    condition: 'nova' | 'usada' | 'recondicionada';
    warrantyDays: number;
    technicalDetails?: string;
    selectedParts?: { name: string; price: number; brand?: string; condition?: string }[];
  }) => void | Promise<void>;
  onConfirmSale?: () => void;
  onSnoozeWaitingPayment?: () => void;
  onAction: () => void;
  onRejectCall?: () => void;
  onDismissOptional?: () => void;
}

export interface ParsedPart {
  id: string;
  name: string;
  category?: string;
  oem?: string;
  characteristics?: string;
  position?: string;
}

interface SpamOverlayProps {
  spam: ActiveSpamPayload | null;
}

const FONT_CSS_MAP: Record<string, string> = {
  'Plus Jakarta Sans': '"Plus Jakarta Sans", system-ui, sans-serif',
  Inter: '"Inter", system-ui, sans-serif',
  Poppins: '"Poppins", system-ui, sans-serif',
  Roboto: '"Roboto", system-ui, sans-serif',
  Montserrat: '"Montserrat", system-ui, sans-serif',
  'JetBrains Mono': '"JetBrains Mono", monospace',
  Orbitron: '"Orbitron", system-ui, sans-serif',
  Raleway: '"Raleway", system-ui, sans-serif',
};

const SCHEME_COLORS: Record<
  SpamTriggerConfig['colorScheme'],
  { headerBg: string; border: string; ring: string; badgeBg: string; btnBg: string }
> = {
  orange: {
    headerBg: '#ea580c',
    border: '#f97316',
    ring: 'ring-orange-500/50',
    badgeBg: 'bg-orange-500',
    btnBg: '#ea580c',
  },
  yellow: {
    headerBg: '#ca8a04',
    border: '#eab308',
    ring: 'ring-yellow-500/50',
    badgeBg: 'bg-yellow-500',
    btnBg: '#ca8a04',
  },
  red: {
    headerBg: '#dc2626',
    border: '#ef4444',
    ring: 'ring-red-500/50',
    badgeBg: 'bg-red-600',
    btnBg: '#dc2626',
  },
  green: {
    headerBg: '#059669',
    border: '#10b981',
    ring: 'ring-emerald-500/50',
    badgeBg: 'bg-emerald-600',
    btnBg: '#059669',
  },
  blue: {
    headerBg: '#2563eb',
    border: '#3b82f6',
    ring: 'ring-blue-500/50',
    badgeBg: 'bg-blue-600',
    btnBg: '#2563eb',
  },
  amber: {
    headerBg: '#d97706',
    border: '#f59e0b',
    ring: 'ring-amber-500/50',
    badgeBg: 'bg-amber-600',
    btnBg: '#d97706',
  },
  purple: {
    headerBg: '#7c3aed',
    border: '#8b5cf6',
    ring: 'ring-purple-500/50',
    badgeBg: 'bg-purple-600',
    btnBg: '#7c3aed',
  },
};

export const SpamOverlay: React.FC<SpamOverlayProps> = ({ spam }) => {
  const [now, setNow] = useState<number>(Date.now());
  const [soundPlayed, setSoundPlayed] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Peças selecionadas pelo fornecedor e preços individuais
  const [selectedParts, setSelectedParts] = useState<Record<string, boolean>>({});
  const [partPrices, setPartPrices] = useState<Record<string, string>>({});
  const [partBrands, setPartBrands] = useState<Record<string, string>>({});
  const [partConditions, setPartConditions] = useState<Record<string, 'nova' | 'usada' | 'recondicionada'>>({});
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});
  const [selectedPaymentKey, setSelectedPaymentKey] = useState<string>('');

  // Parâmetros gerais do orçamento
  const [inlineShippingPrice, setInlineShippingPrice] = useState<string>('0');
  const [inlineDeliveryAmount, setInlineDeliveryAmount] = useState<string>('2');
  const [inlineDeliveryUnit, setInlineDeliveryUnit] = useState<'horas' | 'dias'>('horas');
  const [inlineShippingMethod, setInlineShippingMethod] = useState<string>('Motoboy Express');
  const [inlineWarrantyDays] = useState<number>(90);
  const [isPenaltyModalOpen, setIsPenaltyModalOpen] = useState(false);
  const [penaltyAgreed, setPenaltyAgreed] = useState(false);
  const [isSubmittingQuote, setIsSubmittingQuote] = useState(false);
  const [showConfirmReceiptStep, setShowConfirmReceiptStep] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const hasExpiredTriggeredRef = useRef(false);

  const parsePartsFromDescription = (description?: string, mainPartName?: string): ParsedPart[] => {
    const parts: ParsedPart[] = [];

    if (description && description.includes('=== PEÇAS SOLICITADAS')) {
      const lines = description.split('\n');
      lines.forEach((line, idx) => {
        const match = line.match(
          /^\d+\.\s*(.+?)(?:\s*\|\s*Categoria:\s*(.+?))?(?:\s*\|\s*OEM:\s*(.+?))?(?:\s*\|\s*(.+?))?(?:\s*\|\s*(.+?))?$/
        );
        if (match) {
          parts.push({
            id: `part-${idx}`,
            name: match[1]?.trim() || `Peça ${idx + 1}`,
            category: match[2]?.trim(),
            oem: match[3]?.trim() !== 'N/A' ? match[3]?.trim() : undefined,
            characteristics: match[4]?.trim(),
            position: match[5]?.trim(),
          });
        }
      });
    }

    if (parts.length === 0 && mainPartName) {
      parts.push({
        id: 'part-main',
        name: mainPartName,
        category: spam?.partCategory,
        oem: spam?.oemCode,
      });
    }

    return parts;
  };

  const parsedParts = useMemo(() => {
    return spam ? parsePartsFromDescription(spam.description, spam.partName) : [];
  }, [spam?.description, spam?.partName, spam?.partCategory, spam?.oemCode]);

  useEffect(() => {
    if (!spam) {
      setSoundPlayed(false);
      setLightboxUrl(null);
      setIsPenaltyModalOpen(false);
      setShowConfirmReceiptStep(false);
      setPenaltyAgreed(false);
      setFormError(null);
      hasExpiredTriggeredRef.current = false;
      return;
    }

    setInlineShippingPrice('0');
    setPenaltyAgreed(false);
    setIsPenaltyModalOpen(false);
    setShowConfirmReceiptStep(false);
    setFormError(null);
    hasExpiredTriggeredRef.current = false;

    const initialSelected: Record<string, boolean> = {};
    const initialPrices: Record<string, string> = {};
    const initialBrands: Record<string, string> = {};
    const initialConditions: Record<string, 'nova' | 'usada' | 'recondicionada'> = {};

    parsedParts.forEach(p => {
      initialSelected[p.id] = true;
      initialPrices[p.id] = '';
      initialBrands[p.id] = 'Original / 1ª Linha';
      initialConditions[p.id] = 'nova';
    });

    setSelectedParts(initialSelected);
    setPartPrices(initialPrices);
    setPartBrands(initialBrands);
    setPartConditions(initialConditions);

    const initCustomInputs: Record<string, string> = {};
    (spam.config.customFields || []).forEach(f => {
      initCustomInputs[f.id] = f.value || '';
    });
    setCustomFieldValues(initCustomInputs);

    const enabledMethods = (spam.config.paymentMethodsConfig || []).filter(m => m.enabled);
    setSelectedPaymentKey(enabledMethods[0]?.key || '');

    if (!spam.isPreviewMode && spam.supplierId && spam.requestId) {
      db.hydrateRealDistanceForPair(spam.supplierId, spam.requestId);
    }

    if (spam.config.soundEnabled && !soundPlayed) {
      if (spam.config.soundType === 'cash_success') {
        soundEffects.playCashSuccess();
      } else if (spam.config.soundType === 'delivery_chime') {
        soundEffects.playDeliveryChime();
      } else if (spam.config.soundType === 'warning_beep') {
        soundEffects.playWarningBeep();
      } else {
        soundEffects.playUrgentAlarm();
      }
      setSoundPlayed(true);
    }
  }, [spam?.requestId, spam?.orderId, spam?.supplierId, spam?.config?.id, spam?.dispatchedAlertId]);

  const [, setSpamGeoTick] = useState(0);
  useEffect(() => {
    const unsub = db.subscribe(() => setSpamGeoTick(t => t + 1));
    return () => {
      unsub();
    };
  }, []);

  const isSaleConfirmation = spam?.config.type === 'venda_confirmada';

  const targetTimestamp = useMemo(() => {
    if (!spam || isSaleConfirmation) return 0;
    if (spam.supplierTier === 'opcao_3') return 0;

    if (spam.expiresAtTimestamp && spam.expiresAtTimestamp > 0) {
      return spam.expiresAtTimestamp;
    }

    if (spam.config.countdownSeconds > 0) {
      return Date.now() + spam.config.countdownSeconds * 1000;
    }

    if (spam.config.type === 'nova_oportunidade') {
      const minutes = spam.supplierTier === 'opcao_1' ? 10 : 15;
      return Date.now() + minutes * 60 * 1000;
    }

    return 0;
  }, [spam?.requestId, spam?.orderId, spam?.supplierTier, spam?.expiresAtTimestamp, spam?.config?.countdownSeconds, spam?.config?.type, isSaleConfirmation]);

  useEffect(() => {
    if (!spam || targetTimestamp === 0) return;
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [spam, targetTimestamp]);

  const secondsRemaining = targetTimestamp > 0 ? Math.max(0, Math.floor((targetTimestamp - now) / 1000)) : 0;

  useEffect(() => {
    if (
      !spam ||
      spam.isPreviewMode ||
      isSaleConfirmation ||
      targetTimestamp <= 0 ||
      secondsRemaining > 0 ||
      hasExpiredTriggeredRef.current
    ) {
      return;
    }
    hasExpiredTriggeredRef.current = true;
    if (spam.onRejectCall) {
      spam.onRejectCall();
    } else {
      spam.onAction();
    }
  }, [secondsRemaining, targetTimestamp, spam, isSaleConfirmation]);

  if (!spam) return null;

  const { config } = spam;
  const isConfirmedSale = config.type === 'venda_confirmada';
  const isOpportunitySpam = config.type === 'nova_oportunidade';
  const tier = spam.supplierTier || 'opcao_2';
  const vis = config.sectionVisibility || {};
  const showTimer = vis.showTimer !== false;
  const showPartIdentification = vis.showPartIdentification !== false;
  const showPhoto = vis.showPhoto !== false;
  const showLocation = vis.showLocation !== false;
  const showQuoteForm = vis.showQuoteForm !== false;
  const showFinancialSummary = vis.showFinancialSummary !== false;
  const showCustomerData = vis.showCustomerData !== false;
  const showPaymentMethods = vis.showPaymentMethods !== false;

  const palette = SCHEME_COLORS[config.colorScheme || 'orange'] || SCHEME_COLORS.orange;
  const fontFamilyCss = config.fontFamily ? (FONT_CSS_MAP[config.fontFamily] || config.fontFamily) : undefined;
  const titleSizeClass =
    config.titleFontSize === 'sm'
      ? 'text-base sm:text-lg'
      : config.titleFontSize === 'lg'
      ? 'text-xl sm:text-2xl'
      : config.titleFontSize === 'xl'
      ? 'text-2xl sm:text-3xl'
      : 'text-lg sm:text-xl';

  const headerStyle: React.CSSProperties = {
    backgroundColor: config.headerBgColor || palette.headerBg,
    color: config.headerTextColor || '#ffffff',
  };

  const containerStyle: React.CSSProperties = {
    fontFamily: fontFamilyCss,
    borderColor: config.borderColor || palette.border,
    backgroundColor: config.bodyBgColor || undefined,
    color: config.bodyTextColor || undefined,
  };

  const defaultBtnStyle: React.CSSProperties = {
    backgroundColor: config.actionButtonBgColor || palette.btnBg,
    color: config.actionButtonTextColor || '#ffffff',
  };

  const formatCountdown = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remaining = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remaining.toString().padStart(2, '0')}`;
  };

  const selectedPartsList = parsedParts.filter(p => selectedParts[p.id]);
  const totalPartsPrice = selectedPartsList.reduce((sum, p) => {
    const val = parseFloat((partPrices[p.id] || '0').replace(',', '.'));
    return sum + (isNaN(val) ? 0 : val);
  }, 0);
  const shippingValue = parseFloat((inlineShippingPrice || '0').replace(',', '.')) || 0;
  const grandTotal = totalPartsPrice + shippingValue;

  const togglePart = (id: string) => {
    setSelectedParts(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCloseAction = () => {
    if (spam.isPreviewMode) {
      if (spam.onDismissOptional) spam.onDismissOptional();
      else spam.onAction();
      return;
    }
    if (spam.onDismissOptional) spam.onDismissOptional();
    else if (spam.onRejectCall) spam.onRejectCall();
    else spam.onAction();
  };

  const handleCustomButtonClick = (actionType: 'confirm' | 'dismiss' | 'open_payment' | 'acknowledge') => {
    if (spam.isPreviewMode) {
      handleCloseAction();
      return;
    }
    if (actionType === 'dismiss') {
      handleCloseAction();
    } else if (actionType === 'acknowledge') {
      if (spam.onAcknowledgeDirectedSpam) spam.onAcknowledgeDirectedSpam();
      else spam.onAction();
    } else if (actionType === 'confirm' && spam.onConfirmSale) {
      spam.onConfirmSale();
    } else {
      spam.onAction();
    }
  };

  const directedNoticeText = spam.dispatchedMessage || (config.targetedNoticeEnabled ? config.targetedMessage : '');
  const enabledPaymentMethods = (config.paymentMethodsConfig || []).filter(m => m.enabled);
  const customImages = config.images || [];
  const customFields = config.customFields || [];
  const customButtons = config.customButtons || [];

  const renderPreviewRibbon = () => {
    if (!spam.isPreviewMode) return null;
    return (
      <div className="bg-slate-950 text-amber-300 px-4 py-2 text-[11px] font-black uppercase tracking-wider flex items-center justify-between gap-2 border-b border-amber-500/40 shrink-0">
        <span className="flex items-center gap-1.5">
          <Eye className="w-3.5 h-3.5 text-amber-400" />
          PRÉ-VISUALIZAÇÃO ADMIN (MODO TESTE · Nenhuma ação altera pedidos reais)
        </span>
        <button
          type="button"
          onClick={handleCloseAction}
          className="px-2.5 py-1 rounded-lg bg-amber-400 text-slate-950 hover:bg-amber-300 text-[10px] font-black cursor-pointer"
        >
          Fechar Pré-visualização
        </button>
      </div>
    );
  };

  const renderDirectedNoticeBlock = () => {
    if (!directedNoticeText) return null;
    return (
      <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border-2 border-indigo-400 dark:border-indigo-700 flex items-start gap-3">
        <Megaphone className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1 flex-1">
          <strong className="uppercase tracking-wider text-[10px] font-black text-indigo-700 dark:text-indigo-300 block">
            Recado Direcionado da Administração AUTO SHOP
          </strong>
          <p className="text-sm font-bold text-slate-900 dark:text-white whitespace-pre-line">
            {directedNoticeText}
          </p>
        </div>
      </div>
    );
  };

  const renderCustomImagesGallery = () => {
    if (customImages.length === 0) return null;
    return (
      <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/50 space-y-2.5">
        <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-300 block">
          Imagens & Comunicados Visuais do Alerta ({customImages.length})
        </span>
        <div className={`grid gap-2.5 ${customImages.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {customImages.map(img => (
            <div
              key={img.id}
              onClick={() => setLightboxUrl(img.url)}
              className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 cursor-pointer group"
            >
              <div className="relative h-36 bg-slate-950">
                <img
                  src={img.url}
                  alt={img.caption || 'Imagem do SPAM'}
                  className="w-full h-full object-contain group-hover:scale-105 transition"
                />
              </div>
              {img.caption && (
                <p className="p-2 text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                  {img.caption}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderCustomFieldsBlock = () => {
    if (customFields.length === 0) return null;
    return (
      <div className="space-y-2">
        {customFields.map(field => {
          if (field.fieldType === 'highlight') {
            return (
              <div
                key={field.id}
                className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border-2 border-amber-400 dark:border-amber-700 text-xs"
              >
                <span className="text-[10px] font-black uppercase text-amber-700 dark:text-amber-300 block">
                  {field.label}
                </span>
                <p className="font-bold text-amber-950 dark:text-amber-100 mt-0.5">{field.value}</p>
              </div>
            );
          }
          if (field.fieldType === 'input') {
            return (
              <div
                key={field.id}
                className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/60 space-y-1"
              >
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-200 block">
                  {field.label} {field.required && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="text"
                  value={customFieldValues[field.id] ?? ''}
                  onChange={e => setCustomFieldValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                  placeholder={field.value || 'Digite aqui...'}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            );
          }
          return (
            <div
              key={field.id}
              className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/90 dark:bg-slate-800/50 flex items-center justify-between gap-2 text-xs"
            >
              <span className="font-bold text-slate-600 dark:text-slate-300">{field.label}:</span>
              <span className="font-black text-slate-900 dark:text-white text-right">{field.value}</span>
            </div>
          );
        })}
      </div>
    );
  };

  const renderPaymentMethodsBlock = () => {
    if (!showPaymentMethods || enabledPaymentMethods.length === 0) return null;
    const selectedMethod = enabledPaymentMethods.find(m => m.key === selectedPaymentKey) || enabledPaymentMethods[0];
    return (
      <div className="p-4 rounded-2xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/30 space-y-2.5">
        <div className="flex items-center gap-2 pb-2 border-b border-emerald-200 dark:border-emerald-800">
          <CreditCard className="w-4 h-4 text-emerald-600" />
          <span className="text-xs font-black uppercase text-emerald-800 dark:text-emerald-200">
            Meios de Pagamento Configurados no SPAM
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {enabledPaymentMethods.map(method => {
            const active = selectedMethod?.key === method.key;
            return (
              <button
                key={method.id}
                type="button"
                onClick={() => setSelectedPaymentKey(method.key)}
                className={`px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center gap-1.5 ${
                  active
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700'
                }`}
              >
                <span>{method.label}</span>
                {method.badgeText && (
                  <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-black/15">
                    {method.badgeText}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {selectedMethod?.instructions && (
          <p className="text-[11px] font-semibold text-emerald-900 dark:text-emerald-200 bg-white/80 dark:bg-slate-900/60 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800">
            {selectedMethod.instructions}
          </p>
        )}
      </div>
    );
  };

  const renderCustomButtonsRow = () => {
    if (customButtons.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-2">
        {customButtons.map(btn => (
          <button
            key={btn.id}
            type="button"
            onClick={() => handleCustomButtonClick(btn.actionType)}
            style={{ backgroundColor: btn.bgColor || '#7c3aed', color: btn.textColor || '#ffffff' }}
            className="flex-1 min-w-[140px] py-3 px-4 rounded-2xl font-black text-xs sm:text-sm shadow-md transition active:scale-98 cursor-pointer flex items-center justify-center gap-1.5"
          >
            <span>{btn.label}</span>
          </button>
        ))}
      </div>
    );
  };

  const renderLightbox = () => {
    if (!lightboxUrl) return null;
    return (
      <div className="fixed inset-0 z-[130] flex items-center justify-center p-3 sm:p-6 bg-black/95 backdrop-blur-lg">
        <div className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center">
          <button
            onClick={() => setLightboxUrl(null)}
            className="absolute -top-12 right-0 p-2 rounded-full bg-white/20 hover:bg-white text-white hover:text-black cursor-pointer transition"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={lightboxUrl}
            alt="Ampliação SPAM"
            className="max-h-[75vh] max-w-full object-contain rounded-2xl shadow-2xl"
            referrerPolicy="no-referrer"
          />
          <button
            onClick={() => setLightboxUrl(null)}
            className="mt-4 px-6 py-2 rounded-xl bg-white text-slate-900 font-black text-xs cursor-pointer hover:bg-slate-200 transition"
          >
            Fechar Visualização
          </button>
        </div>
      </div>
    );
  };

  // =========================================================================
  // MODO 1: VENDA CONFIRMADA (FORNECEDOR)
  // =========================================================================
  if (isConfirmedSale) {
    return (
      <>
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div
            style={containerStyle}
            className="w-full max-w-2xl rounded-3xl bg-white dark:bg-slate-900 border-2 shadow-2xl overflow-hidden ring-8 ring-emerald-500/40 flex flex-col max-h-[92vh]"
          >
            {renderPreviewRibbon()}

            <div style={headerStyle} className="p-4 sm:p-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-white/20 animate-bounce">
                  <DollarSign className="w-8 h-8" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-400 text-slate-950">
                      {config.badgeText || 'PAGAMENTO RECEBIDO'}
                    </span>
                    <span className="text-xs opacity-90 flex items-center gap-1 font-bold">
                      <Volume2 className="w-3.5 h-3.5" /> AUTO SHOP SPAM FINANCEIRO
                    </span>
                  </div>
                  <h2 className={`${titleSizeClass} font-black mt-1 leading-tight`}>
                    VENDA CONFIRMADA, VERIFIQUE SE O VALOR JÁ ESTÁ NA CONTA!
                  </h2>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (spam.isPreviewMode) {
                    handleCloseAction();
                    return;
                  }
                  if (spam.onSnoozeWaitingPayment) spam.onSnoozeWaitingPayment();
                  else handleCloseAction();
                }}
                className="p-1.5 rounded-xl hover:bg-white/20 transition cursor-pointer shrink-0"
                title="Aguardar pagamento cair (reabrirá em 10 min)"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
              {renderDirectedNoticeBlock()}

              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border-2 border-amber-400 dark:border-amber-700 flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5 animate-pulse" />
                <div className="text-xs space-y-1">
                  <strong className="text-sm font-black text-amber-950 dark:text-amber-200 block">
                    ATENÇÃO FORNECEDOR: Verifique se o valor já está na sua conta!
                  </strong>
                  <p className="text-amber-900 dark:text-amber-300">
                    Confira os valores, os dados do pagamento abaixo e confirme apenas quando o dinheiro estiver disponível na sua conta. Se ainda não caiu, clique em <strong>AGUARDANDO CAIR O PAGAMENTO</strong> (reabrirá a cada 10 min).
                  </p>
                </div>
              </div>

              {renderCustomImagesGallery()}
              {renderCustomFieldsBlock()}

              {showFinancialSummary && (
                <div className="p-4 rounded-2xl border-2 border-emerald-300 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/30 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-emerald-200 dark:border-emerald-800">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-black uppercase px-2.5 py-1 rounded-lg bg-slate-900 text-white font-mono">
                        Pedido: {spam.orderNumber || 'N/A'}
                      </span>
                      {spam.requestNumber && (
                        <span className="text-xs font-black uppercase px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-900/70 text-emerald-900 dark:text-emerald-200 font-mono">
                          Venda / Solicitação: {spam.requestNumber}
                        </span>
                      )}
                    </div>
                    {spam.paymentMethodText && (
                      <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-lg bg-emerald-600 text-white">
                        {spam.paymentMethodText}
                      </span>
                    )}
                  </div>

                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-500 block">
                      Descrição do Produto Vendido:
                    </span>
                    <p className="text-base font-black text-slate-900 dark:text-white">{spam.partName}</p>
                    {spam.vehicleSummary && (
                      <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">{spam.vehicleSummary}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-emerald-200 dark:border-emerald-800 text-xs">
                    <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800">
                      <span className="text-[10px] text-slate-500 block">Valor Pago pelo Cliente</span>
                      <strong className="font-mono text-sm font-black text-slate-900 dark:text-white tabular-nums">
                        {spam.priceSummary || 'R$ 0,00'}
                      </strong>
                    </div>
                    {spam.partPriceSummary && (
                      <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800">
                        <span className="text-[10px] text-slate-500 block">Peça</span>
                        <strong className="font-mono text-sm font-black text-slate-800 dark:text-slate-200 tabular-nums">
                          {spam.partPriceSummary}
                        </strong>
                      </div>
                    )}
                    {spam.shippingPriceSummary && (
                      <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800">
                        <span className="text-[10px] text-slate-500 block">Frete</span>
                        <strong className="font-mono text-sm font-black text-slate-800 dark:text-slate-200 tabular-nums">
                          {spam.shippingPriceSummary}
                        </strong>
                      </div>
                    )}
                    <div className="p-2.5 rounded-xl bg-emerald-600 text-white">
                      <span className="text-[10px] text-emerald-100 block font-bold">
                        Valor REAL na Sua Conta
                      </span>
                      <strong className="font-mono text-sm font-black tabular-nums">
                        {spam.supplierTransferSummary || spam.priceSummary || 'R$ 0,00'}
                      </strong>
                    </div>
                  </div>
                </div>
              )}

              {showCustomerData && (() => {
                const linkedOrd = spam.orderId ? db.getOrderById(spam.orderId) : undefined;
                const identityUnlocked = Boolean(
                  spam.isPreviewMode || isOrderIdentityUnlocked(linkedOrd, spam.viewerRole || 'fornecedor')
                );
                const maskedCustomerLabel = getMaskedCounterpartyLabel(
                  'cliente',
                  linkedOrd?.customerId || spam.orderId
                );
                const regionText = formatCityNeighborhood({
                  city: spam.city || linkedOrd?.deliveryAddress?.city,
                  neighborhood: spam.neighborhood || linkedOrd?.deliveryAddress?.neighborhood,
                });

                return (
                  <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 space-y-3">
                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-700">
                      <div className="flex items-center gap-2">
                        {identityUnlocked ? (
                          <UserCheck className="w-4 h-4 text-blue-600" />
                        ) : (
                          <Lock className="w-4 h-4 text-amber-600" />
                        )}
                        <span className="text-xs font-black uppercase text-slate-700 dark:text-slate-200">
                          {identityUnlocked
                            ? 'Identificação do Comprador & Pagamento'
                            : 'Dados da Venda, Distância & Recebimento (Sigilo Ativo)'}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200">
                        Dados Bancários / PIX / Cartão
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl overflow-hidden bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0">
                        {identityUnlocked && spam.customerPhotoUrl ? (
                          <img src={spam.customerPhotoUrl} alt={spam.customerName} className="w-full h-full object-cover" />
                        ) : identityUnlocked ? (
                          <UserCheck className="w-6 h-6 text-blue-600" />
                        ) : (
                          <Lock className="w-5 h-5 text-amber-600" />
                        )}
                      </div>
                      <div className="text-xs space-y-0.5">
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">
                          {identityUnlocked ? 'Nome do Cliente:' : 'Comprador Protegido:'}
                        </span>
                        <strong className="text-sm font-black text-slate-900 dark:text-white block">
                          {identityUnlocked ? (spam.customerName || 'Cliente AUTO SHOP') : maskedCustomerLabel}
                        </strong>
                        {(spam.distanceKm !== undefined || regionText !== 'Região protegida') && (
                          <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 block">
                            {spam.distanceKm !== undefined ? `${spam.distanceKm.toFixed(1)} km reais · ` : ''}
                            {regionText}
                          </span>
                        )}
                      </div>
                    </div>

                    {!identityUnlocked && (
                      <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-[11px] font-bold text-amber-900 dark:text-amber-200 flex items-center gap-2">
                        <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>
                          Nome completo, WhatsApp, CPF/CNPJ, CEP, rua e número do cliente serão liberados somente após você CONFIRMAR O PAGAMENTO em conta.
                        </span>
                      </div>
                    )}

                    <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs space-y-1.5">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-slate-500 font-semibold">Meio de Pagamento:</span>
                        <strong className="font-black text-slate-900 dark:text-white">
                          {spam.paymentMethodDetail || spam.paymentMethodText || 'PIX / Cartão'}
                        </strong>
                      </div>
                      {spam.supplierAccountSummary && (
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <span className="text-slate-500 font-semibold">Conta / Chave de Recebimento:</span>
                          <strong className="font-mono text-emerald-700 dark:text-emerald-400 text-right">
                            {spam.supplierAccountSummary}
                          </strong>
                        </div>
                      )}
                      {(spam.gatewayProviderText || spam.gatewayChargeId) && (
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-slate-500 font-semibold">Gateway / Cobrança:</span>
                          <span className="font-mono font-bold text-slate-700 dark:text-slate-200">
                            {spam.gatewayProviderText || 'ASAAS'} {spam.gatewayChargeId ? `· ${spam.gatewayChargeId}` : ''}
                          </span>
                        </div>
                      )}
                      {spam.splitStatusText && (
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-slate-500 font-semibold">Status do Repasse:</span>
                          <span className="font-bold text-emerald-700 dark:text-emerald-400">
                            {spam.splitStatusText}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {spam.cancellationWarning && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-[11px] font-bold text-red-700 dark:text-red-300">
                  {spam.cancellationWarning}
                </div>
              )}

              {renderCustomButtonsRow()}

              <div className="pt-1 flex flex-col sm:flex-row gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    if (spam.isPreviewMode) {
                      handleCloseAction();
                      return;
                    }
                    if (spam.onSnoozeWaitingPayment) spam.onSnoozeWaitingPayment();
                    else handleCloseAction();
                  }}
                  className="flex-1 py-4 px-4 rounded-2xl border-2 border-amber-500 bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 hover:bg-amber-100 font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition active:scale-98 cursor-pointer"
                >
                  <Clock className="w-4 h-4 shrink-0 text-amber-600" />
                  <span>AGUARDANDO CAIR O PAGAMENTO</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (spam.isPreviewMode) {
                      handleCloseAction();
                      return;
                    }
                    setShowConfirmReceiptStep(true);
                  }}
                  className="flex-1 py-4 px-5 rounded-2xl bg-gradient-to-r from-emerald-600 to-green-600 hover:brightness-110 text-white font-black text-xs sm:text-sm shadow-xl flex items-center justify-center gap-2 transition active:scale-98 cursor-pointer"
                >
                  <CheckCircle className="w-5 h-5 shrink-0" />
                  <span>CONFIRMO O PAGAMENTO</span>
                  <ArrowRight className="w-4 h-4 shrink-0" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* DUPLA CONFIRMAÇÃO DE RECEBIMENTO DO PAGAMENTO */}
        {showConfirmReceiptStep && (
          <div className="fixed inset-0 z-[125] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-150">
            <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border-2 border-emerald-500 shadow-2xl p-6 space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                <div className="p-2.5 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600">
                  <CheckCircle className="w-7 h-7" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 block">
                    Dupla Confirmação Obrigatória
                  </span>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white leading-tight">
                    CONFIRMAR RECEBIMENTO NA CONTA?
                  </h3>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs text-slate-800 dark:text-slate-200 space-y-2">
                <p className="font-bold leading-relaxed">
                  Confirmo que estou ciente desta venda e que o valor líquido referente ao pedido já foi confirmado na minha conta. O pedido seguirá imediatamente para separação e envio ao cliente.
                </p>
                <div className="pt-2 border-t border-emerald-200 dark:border-emerald-800 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Pedido:</span>
                    <strong className="font-mono">{spam.orderNumber}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Produto:</span>
                    <strong className="truncate max-w-[200px]">{spam.partName}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Valor REAL na Conta:</span>
                    <strong className="font-mono text-emerald-700 dark:text-emerald-400">
                      {spam.supplierTransferSummary || spam.priceSummary}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setShowConfirmReceiptStep(false)}
                  className="flex-1 py-3.5 px-4 rounded-2xl border-2 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-black text-xs sm:text-sm hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition"
                >
                  VOLTAR
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowConfirmReceiptStep(false);
                    if (spam.onConfirmSale) spam.onConfirmSale();
                    else spam.onAction();
                  }}
                  className="flex-1 py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm shadow-lg cursor-pointer transition flex items-center justify-center gap-1.5"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>CONFIRMAR</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {renderLightbox()}
      </>
    );
  }

  // =========================================================================
  // MODO 2: TEMPLATES GERAIS / RECADOS DIRECIONADOS / CLIENTE / ENTREGA / ADMIN
  // =========================================================================
  if (!isOpportunitySpam) {
    return (
      <>
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div
            style={containerStyle}
            className={`w-full max-w-2xl rounded-3xl bg-white dark:bg-slate-900 border-2 shadow-2xl overflow-hidden ring-8 ${palette.ring} flex flex-col max-h-[92vh]`}
          >
            {renderPreviewRibbon()}

            <div style={headerStyle} className="p-4 sm:p-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-white/20">
                  {config.type === 'pedido_a_caminho' ? (
                    <Truck className="w-7 h-7" />
                  ) : (
                    <Bell className="w-7 h-7 animate-bounce" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-white/20">
                      {config.badgeText || `COMUNICADO · ${config.targetAudience.toUpperCase()}`}
                    </span>
                    <span className="text-xs opacity-90 flex items-center gap-1 font-bold">
                      <Volume2 className="w-3.5 h-3.5" /> AUTO SHOP SPAM CONFIGURADO
                    </span>
                  </div>
                  <h2 className={`${titleSizeClass} font-black mt-1 leading-tight`}>
                    {config.title}
                  </h2>
                </div>
              </div>

              {(!config.isMandatoryAction || spam.isPreviewMode) && (
                <button
                  type="button"
                  onClick={handleCloseAction}
                  className="p-1.5 rounded-xl hover:bg-white/20 transition cursor-pointer"
                  title="Fechar"
                >
                  <X className="w-6 h-6" />
                </button>
              )}
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
              {showTimer && targetTimestamp > 0 && (
                <div className="w-full flex items-center justify-between p-3.5 rounded-2xl border bg-slate-900 text-amber-300 border-amber-500/40">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-amber-400" />
                    <span className="text-xs font-black uppercase tracking-wider">
                      Tempo Limite Ativo:
                    </span>
                  </div>
                  <span className="text-2xl font-black font-mono tabular-nums">
                    {formatCountdown(secondsRemaining)}
                  </span>
                </div>
              )}

              {renderDirectedNoticeBlock()}

              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 space-y-2">
                <p className="text-sm font-semibold leading-relaxed whitespace-pre-line">
                  {config.subtitle}
                </p>
                {spam.partName && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700 text-xs">
                    <strong>Referência / Peça:</strong> {spam.partName}
                    {spam.vehicleSummary ? ` · ${spam.vehicleSummary}` : ''}
                  </div>
                )}
                {spam.priceSummary && (
                  <div className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    Valor: {spam.priceSummary}
                  </div>
                )}
              </div>

              {renderCustomImagesGallery()}
              {renderCustomFieldsBlock()}
              {renderPaymentMethodsBlock()}

              {showLocation && (spam.fullAddress || spam.city || spam.neighborhood || spam.distanceKm !== undefined) && (() => {
                const linkedOrd = spam.orderId ? db.getOrderById(spam.orderId) : undefined;
                const identityUnlocked = Boolean(
                  spam.isPreviewMode ||
                    spam.viewerRole === 'admin' ||
                    isOrderIdentityUnlocked(linkedOrd, spam.viewerRole || 'cliente')
                );
                const canExposeAddress = Boolean(
                  spam.isPreviewMode ||
                    spam.viewerRole === 'admin' ||
                    (identityUnlocked && (config.type === 'venda_confirmada' || config.type === 'pedido_a_caminho'))
                );
                return (
                  <div className="p-3.5 rounded-2xl border border-blue-200 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-950/30 text-xs flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-blue-900 dark:text-blue-200">
                        {canExposeAddress ? 'Localidade / Entrega:' : 'Distância & Região (Sigilo AUTO SHOP):'}
                      </strong>
                      {canExposeAddress ? (
                        <span>
                          {spam.fullAddress || `${spam.neighborhood || ''}, ${spam.city || ''}`}
                          {spam.deliveryCep ? ` · CEP ${spam.deliveryCep}` : ''}
                        </span>
                      ) : (
                        <span>
                          {spam.distanceKm !== undefined ? `${spam.distanceKm.toFixed(1)} km reais · ` : ''}
                          {formatCityNeighborhood({ city: spam.city, neighborhood: spam.neighborhood })}
                          {' — '}Rua, número, CEP e dados pessoais ocultos até confirmação do pagamento em conta.
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}

              {renderCustomButtonsRow()}

              <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
                {(!config.isMandatoryAction || spam.isPreviewMode) && (
                  <button
                    type="button"
                    onClick={handleCloseAction}
                    className="py-3 px-5 rounded-2xl border border-slate-300 dark:border-slate-700 font-bold text-xs sm:text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                  >
                    Fechar
                  </button>
                )}
                {config.showDefaultActionButton !== false && (
                  <button
                    type="button"
                    style={defaultBtnStyle}
                    onClick={() => {
                      if (spam.isPreviewMode) {
                        handleCloseAction();
                        return;
                      }
                      if (spam.onAcknowledgeDirectedSpam) spam.onAcknowledgeDirectedSpam();
                      else spam.onAction();
                    }}
                    className="flex-1 py-3.5 px-6 rounded-2xl font-black text-sm shadow-xl flex items-center justify-center gap-2 transition hover:brightness-110 cursor-pointer"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>{config.actionButtonLabel || 'ENTENDI / CONFIRMAR'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
        {renderLightbox()}
      </>
    );
  }

  // =========================================================================
  // MODO 3: NOVA OPORTUNIDADE (COTAÇÃO RÁPIDA DO FORNECEDOR)
  // =========================================================================
  return (
    <>
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
        <div
          style={containerStyle}
          className={`w-full max-w-2xl rounded-3xl bg-white dark:bg-slate-900 border-2 shadow-2xl overflow-hidden ring-8 ${palette.ring} flex flex-col max-h-[92vh]`}
        >
          {renderPreviewRibbon()}

          <div style={headerStyle} className="p-4 sm:p-5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-white/20">
                <AlertTriangle className="w-8 h-8 animate-bounce" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full bg-white/20">
                    {config.badgeText || 'ALERTA EM TEMPO REAL'}
                  </span>
                  <span className="text-xs opacity-90 flex items-center gap-1 font-bold">
                    <Volume2 className="w-3.5 h-3.5" /> AUTO SHOP SPAM VISUAL & SONORO
                  </span>
                </div>
                <h2 className={`${titleSizeClass} font-black mt-0.5`}>
                  {config.title || 'NOVA OPORTUNIDADE DE VENDA'}
                </h2>
              </div>
            </div>

            <button
              onClick={handleCloseAction}
              className="p-1.5 rounded-xl hover:bg-white/20 transition cursor-pointer"
              title="Fechar"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 flex flex-col">
            {renderDirectedNoticeBlock()}

            {config.subtitle && (
              <p className="text-xs font-semibold opacity-85">
                {config.subtitle}
              </p>
            )}

            {showTimer && (
              tier === 'opcao_3' ? (
                <div className="w-full flex items-center justify-between p-3.5 rounded-2xl border bg-emerald-950 text-emerald-200 border-emerald-800">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                    <div>
                      <span className="text-xs font-black uppercase tracking-wider block">
                        3ª Opção Liberada · Sem Limite de Tempo
                      </span>
                      <span className="text-[10px] opacity-75">Envio para todo o Brasil</span>
                    </div>
                  </div>
                  <span className="text-xs font-black uppercase px-2.5 py-1 rounded-lg bg-emerald-700 text-white">
                    Tempo Livre
                  </span>
                </div>
              ) : (
                <div className="w-full flex items-center justify-between p-3.5 rounded-2xl border bg-orange-950 text-orange-200 border-orange-500 shadow-md">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 animate-spin shrink-0 text-orange-400" />
                    <div>
                      <span className="text-xs font-black uppercase tracking-wider block">
                        Tempo Restante para Responder ({tier === 'opcao_1' ? '10 min' : '15 min'}):
                      </span>
                      <span className="text-[10px] opacity-80 font-semibold">
                        Contagem única. Passado o tempo, o chamado some da sua tela
                      </span>
                    </div>
                  </div>
                  <span className={`text-2xl sm:text-3xl font-black font-mono tracking-wider tabular-nums ${secondsRemaining < 120 ? 'text-red-400 animate-pulse' : 'text-orange-300'}`}>
                    {formatCountdown(secondsRemaining)}
                  </span>
                </div>
              )
            )}

            {renderCustomImagesGallery()}
            {renderCustomFieldsBlock()}
            {renderPaymentMethodsBlock()}

            {showPartIdentification && (
              <div className="w-full rounded-2xl border-2 border-orange-300 dark:border-orange-800 bg-orange-50/70 dark:bg-orange-950/30 p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-orange-200 dark:border-orange-800">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-orange-600" />
                    <span className="text-xs font-black uppercase text-orange-800 dark:text-orange-300">
                      Card 1 · Identificação das Peças ({parsedParts.length} item(ns))
                    </span>
                  </div>
                  {spam.requestNumber && (
                    <span className="font-mono text-xs font-black text-orange-600 bg-white dark:bg-slate-900 px-2.5 py-0.5 rounded border border-orange-300">
                      {spam.requestNumber}
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-400 font-semibold">
                  Selecione as peças que você tem em estoque para cotar:
                </p>

                {parsedParts.length === 0 ? (
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{spam.partName}</p>
                ) : (
                  <div className="space-y-2">
                    {parsedParts.map((part, idx) => (
                      <div
                        key={part.id}
                        onClick={() => togglePart(part.id)}
                        className={`p-3.5 rounded-xl border-2 cursor-pointer transition flex items-start gap-3 w-full ${
                          selectedParts[part.id]
                            ? 'border-orange-500 bg-white dark:bg-slate-900 shadow-md ring-1 ring-orange-400/40'
                            : 'border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-800/40 opacity-70'
                        }`}
                      >
                        <div className="mt-0.5 shrink-0">
                          {selectedParts[part.id] ? (
                            <CheckSquare className="w-5 h-5 text-orange-600" />
                          ) : (
                            <Square className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase text-orange-700 dark:text-orange-300 bg-orange-100 dark:bg-orange-900/60 px-2 py-0.5 rounded">
                              Peça {idx + 1}
                            </span>
                            {selectedParts[part.id] ? (
                              <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" /> Tenho em Estoque
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-medium">Não disponível</span>
                            )}
                          </div>
                          <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                            {part.name}
                          </p>
                          <div className="flex flex-wrap gap-2 mt-1 text-[11px] text-slate-500">
                            {part.category && <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">Cat: {part.category}</span>}
                            {part.oem && <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">OEM: {part.oem}</span>}
                            {part.characteristics && <span>{part.characteristics}</span>}
                            {part.position && <span className="text-orange-600">{part.position}</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {(spam.categoryName || spam.partSubcategory || spam.partCategory) && (
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-orange-200 dark:border-orange-800 text-xs">
                    {spam.categoryName && (
                      <span className="px-2 py-0.5 rounded bg-orange-200/80 dark:bg-orange-900/60 text-orange-900 dark:text-orange-200 font-bold">
                        Categoria: {spam.categoryName}
                      </span>
                    )}
                    {(spam.partSubcategory || spam.partCategory) && (
                      <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 font-bold">
                        Subcategoria: {spam.partSubcategory || spam.partCategory}
                      </span>
                    )}
                  </div>
                )}

                {spam.vehicleSummary && (
                  <div className="pt-2 border-t border-orange-200 dark:border-orange-800 text-xs text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <span className="font-bold text-slate-500 uppercase text-[10px]">Veículo:</span>
                    <span className="font-bold">{spam.vehicleSummary}</span>
                  </div>
                )}
              </div>
            )}

            {showPhoto && (() => {
              const reqObj = spam.requestId ? db.getRequestById(spam.requestId) : undefined;
              const mainPhotos =
                spam.mediaUrls && spam.mediaUrls.length > 0
                  ? spam.mediaUrls
                  : reqObj?.mediaUrls && reqObj.mediaUrls.length > 0
                  ? reqObj.mediaUrls
                  : spam.mediaUrl
                  ? [spam.mediaUrl]
                  : [];
              const extras = (spam.extraParts || reqObj?.extraParts || []).filter(
                ep => ep.mediaUrls && ep.mediaUrls.length > 0
              );
              const totalPhotos =
                mainPhotos.length + extras.reduce((acc, ep) => acc + (ep.mediaUrls?.length || 0), 0);

              return (
                <div className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-4 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
                    <span className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Camera className="w-4 h-4 text-orange-500" />
                      Card 2 · Fotos da Peça Solicitada ({totalPhotos})
                    </span>
                    {mainPhotos[0] && (
                      <button
                        type="button"
                        onClick={() => setLightboxUrl(mainPhotos[0])}
                        className="text-[11px] font-bold text-orange-600 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Maximize2 className="w-3.5 h-3.5" /> Ampliar Foto
                      </button>
                    )}
                  </div>

                  {totalPhotos > 0 ? (
                    <div className="space-y-3">
                      {mainPhotos.length > 0 && (
                        <div className={`grid gap-2 ${mainPhotos.length === 1 ? 'grid-cols-1' : 'grid-cols-2 sm:grid-cols-3'}`}>
                          {mainPhotos.map((url, idx) => (
                            <div
                              key={`main-photo-${idx}`}
                              className={`relative ${mainPhotos.length === 1 ? 'h-48 sm:h-56' : 'h-28'} rounded-xl overflow-hidden bg-slate-950 cursor-pointer group border border-slate-300 dark:border-slate-700`}
                              onClick={() => setLightboxUrl(url)}
                            >
                              <img
                                src={url}
                                alt={`Peça principal ${idx + 1}`}
                                className="w-full h-full object-contain group-hover:scale-105 transition duration-300"
                                referrerPolicy="no-referrer"
                              />
                              <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/75 text-white text-[9px] font-bold">
                                Foto #{idx + 1}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {extras.map((ep, eIdx) => (
                        <div key={ep.id || eIdx} className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-700">
                          <span className="text-[11px] font-bold text-orange-600 dark:text-orange-400 block">
                            Peça Adicional: {ep.partName} ({ep.mediaUrls?.length || 0} foto(s))
                          </span>
                          <div className="grid grid-cols-3 gap-2">
                            {(ep.mediaUrls || []).map((url, pIdx) => (
                              <div
                                key={`${ep.id}-p-${pIdx}`}
                                onClick={() => setLightboxUrl(url)}
                                className="relative h-24 rounded-xl overflow-hidden bg-slate-950 cursor-pointer group border border-orange-300 dark:border-orange-800"
                              >
                                <img
                                  src={url}
                                  alt={`${ep.partName} ${pIdx + 1}`}
                                  className="w-full h-full object-contain group-hover:scale-105 transition"
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-28 rounded-xl bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center text-slate-400">
                      <Camera className="w-8 h-8 mb-1 opacity-50" />
                      <span className="text-xs font-medium">Cliente não anexou foto para este pedido</span>
                    </div>
                  )}
                </div>
              );
            })()}

            {showLocation && (
              <div className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-4 space-y-2.5">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-700">
                  <MapPin className="w-4 h-4 text-orange-500" />
                  <span className="text-xs font-black uppercase text-slate-700 dark:text-slate-300">
                    Card 3 · Localização & Distância Real (GPS / CEP)
                  </span>
                </div>
                <div className="space-y-2 text-sm">
                  {(() => {
                    const supUser = spam.supplierId ? db.getUserById(spam.supplierId) : undefined;
                    const reqObj = spam.requestId ? db.getRequestById(spam.requestId) : undefined;
                    const liveDetails = supUser && reqObj ? db.getDistanceDetailsSupplierToRequest(supUser, reqObj) : null;
                    const km = liveDetails?.distanceKm ?? spam.distanceKm;
                    const clientCity = spam.city || reqObj?.deliveryAddress?.city;
                    const clientState = reqObj?.deliveryAddress?.state;
                    const clientNeighborhood = spam.neighborhood || reqObj?.deliveryAddress?.neighborhood;
                    return (
                      <>
                        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                              Distância Real (Sua Loja ↔ Cliente):
                            </span>
                          </div>
                          <span className="text-sm text-emerald-700 dark:text-emerald-300 font-black font-mono tabular-nums">
                            {km !== undefined
                              ? `${km.toFixed(1)} km reais${
                                  liveDetails?.source === 'rota_real'
                                    ? liveDetails.durationMin
                                      ? ` (~${liveDetails.durationMin} min)`
                                      : ' (Rota real)'
                                    : ' (GPS/CEP)'
                                }`
                              : 'Calculando distância...'}
                          </span>
                        </div>
                        {(clientCity || clientNeighborhood) && (
                          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 flex items-center justify-between gap-2 flex-wrap text-xs">
                            <span className="font-bold text-blue-900 dark:text-blue-200">
                              Região do Cliente (Cidade / Bairro):
                            </span>
                            <strong className="font-black text-blue-800 dark:text-blue-100">
                              {[clientNeighborhood, clientCity ? (clientState ? `${clientCity}/${clientState}` : clientCity) : ''].filter(Boolean).join(' · ')}
                            </strong>
                          </div>
                        )}
                      </>
                    );
                  })()}
                  <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-300 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-orange-500 shrink-0" />
                    <span>
                      <strong>Sigilo AUTO SHOP:</strong> Você visualiza apenas Distância Real (km), Cidade e Bairro. Rua, número, CEP, nome e WhatsApp do cliente permanecem ocultos até a confirmação do pagamento em conta.
                    </span>
                  </div>
                </div>
              </div>
            )}

            {showQuoteForm && (
              <div className="w-full p-4 sm:p-5 rounded-2xl border-2 border-orange-500 bg-orange-50/80 dark:bg-orange-950/40 space-y-4 shadow-sm">
                <div className="flex items-center justify-between pb-2 border-b border-orange-200 dark:border-orange-800">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-orange-600" />
                    <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white uppercase">
                      Card 4 · Preencha o Orçamento
                    </span>
                  </div>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-orange-500 text-white">
                    {selectedPartsList.length} de {parsedParts.length} peça(s) selecionada(s)
                  </span>
                </div>

                {formError && (
                  <div className="p-3 rounded-xl bg-red-100 dark:bg-red-950/80 border border-red-300 text-red-800 dark:text-red-200 text-xs font-bold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {selectedPartsList.length === 0 ? (
                  <div className="p-6 text-center bg-white dark:bg-slate-900 rounded-xl border border-dashed border-orange-300">
                    <p className="text-xs font-bold text-orange-700 dark:text-orange-300">
                      Selecione acima as peças que você tem disponível para informar os valores.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedPartsList.map((part, idx) => (
                      <div
                        key={part.id}
                        className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-orange-200 dark:border-orange-900 shadow-sm space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase text-orange-600">
                            Peça {idx + 1}: {part.name}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Marca / Fabricante</label>
                            <input
                              type="text"
                              placeholder="Ex: Bosch, Valeo, Original..."
                              value={partBrands[part.id] || ''}
                              onChange={e => setPartBrands(prev => ({ ...prev, [part.id]: e.target.value }))}
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold outline-none focus:ring-1 focus:ring-orange-500"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Condição</label>
                            <select
                              value={partConditions[part.id] || 'nova'}
                              onChange={e => setPartConditions(prev => ({ ...prev, [part.id]: e.target.value as 'nova' | 'usada' | 'recondicionada' }))}
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold outline-none"
                            >
                              <option value="nova">Nova</option>
                              <option value="usada">Usada</option>
                              <option value="recondicionada">Recondicionada</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Valor da Peça (R$) *</label>
                            <div className="relative">
                              <span className="absolute left-2.5 top-1.5 text-xs text-slate-400 font-bold">R$</span>
                              <input
                                type="number"
                                step="0.01"
                                placeholder="0,00"
                                value={partPrices[part.id] || ''}
                                onChange={e => {
                                  setPartPrices(prev => ({ ...prev, [part.id]: e.target.value }));
                                  setFormError(null);
                                }}
                                className="w-full pl-8 pr-2 py-1.5 rounded-lg border-2 border-orange-300 dark:border-orange-800 bg-white dark:bg-slate-900 text-xs font-mono font-black outline-none focus:ring-2 focus:ring-orange-500"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {(() => {
                  const supUser = spam.supplierId ? db.getUserById(spam.supplierId) : undefined;
                  const reqObj = spam.requestId ? db.getRequestById(spam.requestId) : undefined;
                  const liveDetails = supUser && reqObj ? db.getDistanceDetailsSupplierToRequest(supUser, reqObj) : null;
                  const km = liveDetails?.distanceKm ?? spam.distanceKm;
                  if (km === undefined) return null;
                  return (
                    <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs flex items-center justify-between gap-2">
                      <span className="font-bold text-emerald-900 dark:text-emerald-200">
                        Distância real entre sua Loja e o Local de Entrega (base para frete):
                      </span>
                      <span className="font-mono font-black text-emerald-700 dark:text-emerald-300">
                        {km.toFixed(1)} km
                      </span>
                    </div>
                  );
                })()}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div>
                    <label className="block text-xs font-black text-slate-800 dark:text-slate-200 uppercase mb-1">
                      Taxa de Entrega (R$)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">R$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={inlineShippingPrice}
                        onChange={e => setInlineShippingPrice(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 rounded-xl border-2 border-orange-300 dark:border-orange-800 bg-white dark:bg-slate-900 text-sm font-mono font-black outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-800 dark:text-slate-200 uppercase mb-1">
                      Tempo de Entrega
                    </label>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        min="1"
                        value={inlineDeliveryAmount}
                        onChange={e => setInlineDeliveryAmount(e.target.value)}
                        className="w-16 px-2 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-none"
                      />
                      <select
                        value={inlineDeliveryUnit}
                        onChange={e => setInlineDeliveryUnit(e.target.value as 'horas' | 'dias')}
                        className="flex-1 px-2 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-none cursor-pointer"
                      >
                        <option value="horas">Horas</option>
                        <option value="dias">Dias</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-800 dark:text-slate-200 uppercase mb-1">
                      Modo de Envio
                    </label>
                    <select
                      value={inlineShippingMethod}
                      onChange={e => setInlineShippingMethod(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-none cursor-pointer"
                    >
                      <option value="Motoboy Express">Motoboy Express Local</option>
                      <option value="Sedex / Correios">Sedex / Correios</option>
                      <option value="Transportadora Rodoviária">Transportadora</option>
                      <option value="Retirada no Balcão">Retirada no Balcão</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900 text-white shadow-md">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Total do Orçamento:</span>
                    <span className="text-xs text-slate-300 font-medium">
                      Peças ({selectedPartsList.length}): R$ {totalPartsPrice.toFixed(2)} + Frete: R$ {shippingValue.toFixed(2)}
                    </span>
                  </div>
                  <span className="text-xl sm:text-2xl font-black font-mono text-emerald-400">
                    R$ {grandTotal.toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            {renderCustomButtonsRow()}

            <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={handleCloseAction}
                className="py-3.5 px-5 rounded-2xl border-2 border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 font-black text-sm hover:bg-red-100 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <XCircle className="w-4 h-4" />
                <span>CANCELAR (FECHAR)</span>
              </button>

              {config.showDefaultActionButton !== false && (
                <button
                  type="button"
                  style={defaultBtnStyle}
                  onClick={() => {
                    if (spam.isPreviewMode) {
                      handleCloseAction();
                      return;
                    }
                    if (!showQuoteForm) {
                      spam.onAction();
                      return;
                    }
                    if (selectedPartsList.length === 0) {
                      setFormError('Selecione pelo menos uma peça disponível acima.');
                      return;
                    }
                    const hasEmptyPrice = selectedPartsList.some(p => {
                      const val = parseFloat((partPrices[p.id] || '0').replace(',', '.'));
                      return isNaN(val) || val <= 0;
                    });
                    if (hasEmptyPrice) {
                      setFormError('Informe o valor em R$ para todas as peças selecionadas.');
                      return;
                    }
                    setIsPenaltyModalOpen(true);
                  }}
                  className="flex-1 py-4 px-5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-xl hover:brightness-110 cursor-pointer active:scale-98 transition"
                >
                  <Send className="w-4 h-4" />
                  <span>
                    {config.actionButtonLabel || 'ENVIAR ORÇAMENTO'}
                    {showQuoteForm ? ` (R$ ${grandTotal.toFixed(2)})` : ''}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {isPenaltyModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-5 bg-black/90 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border-2 border-red-600 shadow-2xl p-5 sm:p-7 space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-red-200 dark:border-red-900 text-red-600">
              <AlertOctagon className="w-7 h-7 shrink-0" />
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white uppercase">
                  Termo Obrigatório de Multa Contratual (10%)
                </h3>
                <span className="text-[10px] font-bold text-red-600 dark:text-red-400">
                  Garantia de Estoque e Entrega AUTO SHOP
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/60 border border-red-200 text-xs text-red-900 dark:text-red-200 space-y-2">
              <p className="font-bold">
                Confirmo que tenho as peças selecionadas em estoque e compromisso de entrega. Caso cancele após o envio, pagarei multa de 10% sobre o valor total.
              </p>
              <div className="pt-2 border-t border-red-200 dark:border-red-800 text-[11px] space-y-0.5">
                <div>Peças selecionadas: <strong>{selectedPartsList.length}</strong></div>
                <div>Subtotal das peças: <strong className="font-mono text-emerald-600">R$ {totalPartsPrice.toFixed(2)}</strong></div>
                <div>Taxa de entrega: <strong className="font-mono text-emerald-600">R$ {shippingValue.toFixed(2)}</strong></div>
                <div>Total Geral: <strong className="font-mono text-emerald-600">R$ {grandTotal.toFixed(2)}</strong></div>
                <div>Multa Contratual (10%): <strong className="font-mono text-red-600">R$ {(totalPartsPrice * 0.1).toFixed(2)}</strong></div>
              </div>
            </div>

            <label className="flex items-start gap-2.5 cursor-pointer p-3 rounded-xl bg-slate-100 dark:bg-slate-800/80">
              <input
                type="checkbox"
                checked={penaltyAgreed}
                onChange={e => setPenaltyAgreed(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-red-600 cursor-pointer"
              />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Li, confirmo estoque e concordo com o termo e a multa de 10%.
              </span>
            </label>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsPenaltyModalOpen(false)}
                className="flex-1 py-3 px-4 rounded-xl border border-slate-300 text-xs font-bold cursor-pointer"
              >
                Voltar
              </button>
              <button
                type="button"
                disabled={!penaltyAgreed || isSubmittingQuote}
                onClick={async () => {
                  const deliveryDays = inlineDeliveryUnit === 'dias' ? parseInt(inlineDeliveryAmount) || 1 : 1;
                  const deliveryHours = inlineDeliveryUnit === 'horas' ? parseInt(inlineDeliveryAmount) || 2 : undefined;

                  const selectedPartsDetail = selectedPartsList.map(p => ({
                    name: p.name,
                    price: parseFloat((partPrices[p.id] || '0').replace(',', '.')) || 0,
                    brand: partBrands[p.id] || 'Original / 1ª Linha',
                    condition: partConditions[p.id] || 'nova',
                  }));

                  if (spam.onSubmitQuoteDirectly) {
                    setIsSubmittingQuote(true);
                    try {
                      await spam.onSubmitQuoteDirectly({
                        partPrice: totalPartsPrice,
                        shippingPrice: shippingValue,
                        deliveryDays,
                        deliveryHours,
                        shippingMethod: inlineShippingMethod,
                        condition: (selectedPartsDetail[0]?.condition as 'nova' | 'usada' | 'recondicionada') || 'nova',
                        warrantyDays: inlineWarrantyDays,
                        technicalDetails: selectedPartsDetail.map(p => `${p.name} (${p.brand})`).join(' | '),
                        selectedParts: selectedPartsDetail,
                      });
                      setIsPenaltyModalOpen(false);
                    } catch (err: any) {
                      setFormError(err?.message || 'Erro ao enviar proposta. Verifique os valores e tente novamente.');
                      setIsPenaltyModalOpen(false);
                    } finally {
                      setIsSubmittingQuote(false);
                    }
                  } else {
                    spam.onAction();
                    setIsPenaltyModalOpen(false);
                  }
                }}
                className="flex-1 py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white text-xs font-black cursor-pointer shadow-md"
              >
                {isSubmittingQuote ? 'Enviando...' : 'Confirmar e Enviar Orçamento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {renderLightbox()}
    </>
  );
};