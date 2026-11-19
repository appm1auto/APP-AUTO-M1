/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User, UserRole, PartRequest, OrderAndPayment, ChatMessage } from './types';
import { auth } from './services/auth';
import { db } from './services/db';
import { soundEffects } from './services/sound';
import { getCurrentDeviceCoordinates } from './services/geolocation';
import {
  AppRoute,
  canAccessRoute,
  getDefaultRouteForUser,
  getPortalTargetFromLocation,
  isSupplierClassifiedAndApproved,
  parseHashRoute,
  syncHashRoute,
} from './services/rbac';
import { Header } from './components/common/Header';
import { PortalGateway } from './components/common/PortalGateway';
import { SmartphoneFrame } from './components/common/SmartphoneFrame';
import { SpamOverlay, ActiveSpamPayload } from './components/common/SpamOverlay';
import { ClientApp } from './components/client/ClientApp';
import { SupplierApp } from './components/supplier/SupplierApp';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { AuthModal } from './components/auth/AuthModal';
import { OrderChatModal } from './components/common/OrderChatModal';
import { MessageSquare, X, Clock, AlertTriangle } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => auth.getCurrentUser());
  const [portalTarget, setPortalTarget] = useState<UserRole>(() => getPortalTargetFromLocation());
  const [activeRoute, setActiveRoute] = useState<AppRoute>(() =>
    getDefaultRouteForUser(auth.getCurrentUser())
  );
  const [isPhoneFrameMode, setIsPhoneFrameMode] = useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalRole, setAuthModalRole] = useState<UserRole>(() => getPortalTargetFromLocation());
  const [authModalTab, setAuthModalTab] = useState<'login' | 'register'>('login');
  const [activeSpam, setActiveSpam] = useState<ActiveSpamPayload | null>(null);
  const [activeChatAlert, setActiveChatAlert] = useState<{
    msg: ChatMessage;
    requestId: string;
    orderId?: string;
    requestNumber: string;
    otherPartyName: string;
    otherPartyRole: string;
    otherPartyAvatar?: string;
  } | null>(null);
  const [openChatModalFromAlert, setOpenChatModalFromAlert] = useState<{
    requestId: string;
    orderId?: string;
    requestNumber: string;
    otherPartyName: string;
    otherPartyRole: string;
    otherPartyAvatar?: string;
  } | null>(null);

  const [snoozedOrders, setSnoozedOrders] = useState<Record<string, number>>({});
  const [snoozeTick, setSnoozeTick] = useState<number>(0);

  const triggeredRequestIdsRef = useRef<Set<string>>(new Set());
  const triggeredSaleOrderIdsRef = useRef<Set<string>>(new Set());

  const triggeredDispatchedIdsRef = useRef<Set<string>>(new Set());

  // Apply root visual customization (fonts, scale, colors, favicon, title) live
  const applyRootCustomization = useCallback(() => {
    const custom = db.getCustomizationSettings();
    const root = document.documentElement;
    root.style.setProperty('--font-custom', custom.fontFamily);
    document.body.style.fontFamily = custom.fontFamily;
    root.style.fontSize =
      custom.fontSizeScale === 'compact'
        ? '14px'
        : custom.fontSizeScale === 'large'
        ? '18px'
        : '16px';
    root.style.setProperty('--color-primary-text', custom.primaryTextColor || '#0f172a');
    root.style.setProperty('--color-secondary-text', custom.secondaryTextColor || '#475569');
    root.style.setProperty('--color-brand', custom.primaryBrandColor || '#2563eb');
    root.style.setProperty('--color-accent', custom.accentColor || '#eab308');

    if (custom.appName) {
      document.title = `${custom.appName} — ${custom.appSlogan || custom.appSubtitle}`;
    }
    if (custom.faviconUrl) {
      let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = custom.faviconUrl;
    }
  }, []);

  // Enforce strict RBAC Route Guard whenever auth state or DB user status changes
  const enforceRouteGuard = useCallback((user: User | null) => {
    const locPortal = getPortalTargetFromLocation();
    const scopedUser = user && user.role === locPortal ? user : auth.getCurrentUser(locPortal);
    setPortalTarget(locPortal);
    const allowedRoute = getDefaultRouteForUser(scopedUser);
    setActiveRoute(allowedRoute);
    syncHashRoute(allowedRoute, locPortal);

    // Clear sensitive overlays if user logs out or loses supplier approval
    if (!scopedUser) {
      setActiveSpam(null);
      setActiveChatAlert(null);
      setOpenChatModalFromAlert(null);
    } else if (scopedUser.role === 'fornecedor' && !isSupplierClassifiedAndApproved(scopedUser)) {
      setActiveSpam(null);
    }
  }, []);

  // Sync with AuthService and DB status updates (e.g. Admin approves or blocks supplier in real time)
  useEffect(() => {
    applyRootCustomization();
    enforceRouteGuard(auth.getCurrentUser());

    const unsubAuth = auth.subscribe(() => {
      const updatedUser = auth.getCurrentUser();
      setCurrentUser(updatedUser);
      enforceRouteGuard(updatedUser);
    });

    const unsubDb = db.subscribe(() => {
      applyRootCustomization();
      const refreshedUser = auth.getCurrentUser();
      setCurrentUser(refreshedUser ? { ...refreshedUser } : null);
      enforceRouteGuard(refreshedUser);
    });

    const handleLocationUpdate = () => {
      const locPortal = getPortalTargetFromLocation();
      setPortalTarget(locPortal);
      const user = auth.getCurrentUser(locPortal);
      setCurrentUser(user ? { ...user } : null);
      const requestedRoute = parseHashRoute();
      if (!canAccessRoute(user, requestedRoute)) {
        const safeRoute = getDefaultRouteForUser(user);
        syncHashRoute(safeRoute, locPortal);
        setActiveRoute(safeRoute);
      } else {
        setActiveRoute(requestedRoute);
      }
    };

    window.addEventListener('hashchange', handleLocationUpdate);
    window.addEventListener('popstate', handleLocationUpdate);

    // Verifica periodicamente chamados vencidos (16 min sem orçamento / 4 tentativas)
    db.processExpiredRequests();
    const expiryInterval = setInterval(() => {
      db.processExpiredRequests();
    }, 10000);

    // Sincroniza GPS ativo no aparelho quando usuário estiver autenticado
    const initialUser = auth.getCurrentUser();
    if (initialUser && (initialUser.role === 'cliente' || initialUser.role === 'fornecedor')) {
      getCurrentDeviceCoordinates().then(coords => {
        if (coords) {
          db.updateUserGpsCoordinates(initialUser.id, coords);
        }
      });
    }

    return () => {
      unsubAuth();
      unsubDb();
      clearInterval(expiryInterval);
      window.removeEventListener('hashchange', handleLocationUpdate);
      window.removeEventListener('popstate', handleLocationUpdate);
    };
  }, [enforceRouteGuard, applyRootCustomization]);

  // Trigger SPAM de Nova Oportunidade apenas para Fornecedor autorizado e classificado
  const triggerSupplierOpportunitySpam = useCallback((req: PartRequest, supplier: User) => {
    if (!isSupplierClassifiedAndApproved(supplier)) return;
    const triggerKey = `${req.id}:att${req.searchAttempt || 1}`;
    if (triggeredRequestIdsRef.current.has(triggerKey)) return;
    if (db.getQuotes(req.id).some(q => q.supplierId === supplier.id)) return;
    triggeredRequestIdsRef.current.add(triggerKey);

    const oppTemplate = db.getSpamsConfig().find(s => s.type === 'nova_oportunidade');
    if (!oppTemplate || oppTemplate.soundEnabled !== false) {
      soundEffects.playConfiguredEvent('nova_oportunidade');
    }

    const distanceKm = db.getDistanceSupplierToRequestKm(supplier, req) ?? undefined;
    db.hydrateRealDistanceForPair(supplier.id, req.id);

    const targetExpireIso = req.attemptExpiresAt || req.expiresAt;
    const expiresAtMs = targetExpireIso
      ? new Date(targetExpireIso).getTime()
      : (supplier.supplierTier === 'opcao_1' ? Date.now() + 10 * 60 * 1000 : Date.now() + 16 * 60 * 1000);

    const spamPayload: ActiveSpamPayload = {
      config: oppTemplate
        ? {
            ...oppTemplate,
            id: `spam_opp_${req.id}`,
            countdownSeconds: supplier.supplierTier === 'opcao_3' ? 0 : (oppTemplate.countdownSeconds || 960),
          }
        : {
            id: `spam_opp_${req.id}`,
            type: 'nova_oportunidade',
            targetAudience: 'fornecedor',
            title: 'NOVA OPORTUNIDADE DE VENDA',
            subtitle: 'Preencha o orçamento abaixo. CEP, endereço e dados do comprador ficam ocultos até a confirmação do pagamento.',
            countdownSeconds: supplier.supplierTier === 'opcao_3' ? 0 : 960,
            soundEnabled: true,
            soundType: 'urgent_alarm',
            colorScheme: 'orange',
            isMandatoryAction: false,
            actionButtonLabel: 'ENVIAR ORÇAMENTO',
          },
      requestId: req.id,
      requestNumber: req.requestNumber,
      partName: req.partName,
      partCategory: req.partCategory,
      categoryName: req.categoryName,
      partSubcategory: req.partSubcategory,
      oemCode: req.oemCode,
      description: req.description,
      vehicleSummary: `${req.vehicleBrand} ${req.vehicleModel} (${req.vehicleYear}) ${req.vehicleEngine ? `· ${req.vehicleEngine}` : ''}`,
      city: req.deliveryAddress?.city,
      neighborhood: req.deliveryAddress?.neighborhood,
      locationSummary: (() => {
        const localParts = [
          req.deliveryAddress?.neighborhood,
          req.deliveryAddress?.city
            ? `${req.deliveryAddress.city}${req.deliveryAddress.state ? ` - ${req.deliveryAddress.state}` : ''}`
            : undefined,
        ]
          .filter(Boolean)
          .join(' · ');
        if (distanceKm !== undefined) {
          return `${distanceKm.toFixed(1)} km reais da sua loja${localParts ? ` · ${localParts}` : ''} (rua, CEP e cliente ocultos até pagamento)`;
        }
        return localParts
          ? `${localParts} (rua, CEP e dados do cliente ocultos até pagamento)`
          : 'Localização protegida por sigilo AUTO SHOP até confirmação do pagamento';
      })(),
      distanceKm,
      mediaUrl: req.mediaUrl,
      mediaType: req.mediaType || 'photo',
      supplierTier: supplier.supplierTier || 'opcao_2',
      supplierId: supplier.id,
      supplierName: supplier.companyName || supplier.name,
      supplierAvatarUrl: supplier.avatarUrl,
      expiresAtTimestamp: expiresAtMs,
      onSubmitQuoteDirectly: async (quoteData) => {
        const savedQuote = await db.submitQuoteRemote(supplier.id, {
          requestId: req.id,
          condition: quoteData.condition || 'nova',
          availability: 'estoque',
          brand: quoteData.selectedParts && quoteData.selectedParts[0]?.brand ? quoteData.selectedParts[0].brand : 'Original / 1ª Linha',
          partCode: req.oemCode || 'GEN-01',
          partPrice: quoteData.partPrice,
          shippingPrice: quoteData.shippingPrice,
          deliveryDays: quoteData.deliveryDays,
          deliveryHours: quoteData.deliveryHours,
          shippingMethod: quoteData.shippingMethod,
          warrantyDays: quoteData.warrantyDays,
          technicalDetails: quoteData.technicalDetails,
          photoUrl: req.mediaUrl || '',
          observations: quoteData.selectedParts?.map(p => `${p.name}: R$ ${p.price.toFixed(2)}`).join(' | '),
        });
        setActiveSpam(null);
        window.dispatchEvent(
          new CustomEvent('compe:quote_submitted_success', {
            detail: { quote: savedQuote, supplierId: supplier.id, requestNumber: req.requestNumber },
          })
        );
      },
      onAction: () => {
        setActiveSpam(null);
      },
      onRejectCall: () => {
        db.rejectSupplierRequest(supplier.id, req.id);
        setActiveSpam(null);
      },
      onDismissOptional: () => {
        setActiveSpam(null);
      },
    };

    setActiveSpam(spamPayload);
  }, []);

  // Ouvinte global e fila automática para novas solicitações (todos os Fornecedores compatíveis, online e dentro do raio)
  useEffect(() => {
    const checkQueuedRequestsForSupplier = () => {
      const user = auth.getCurrentUser();
      if (!user || !isSupplierClassifiedAndApproved(user) || user.isAvailableForOrders === false) return;
      const eligible = db.getRequestsForSupplier(user.id);
      const nextReq = eligible.find(req => {
        const triggerKey = `${req.id}:att${req.searchAttempt || 1}`;
        if (triggeredRequestIdsRef.current.has(triggerKey)) return false;
        if (db.getQuotes(req.id).some(q => q.supplierId === user.id)) return false;
        return true;
      });
      if (!nextReq) return;
      setActiveSpam(prev => {
        if (prev) return prev;
        setTimeout(() => triggerSupplierOpportunitySpam(nextReq, user), 0);
        return prev;
      });
    };

    const handleNewRequest = (e: Event) => {
      const customEvent = e as CustomEvent<PartRequest>;
      const newReq = customEvent.detail;
      if (!newReq) return;

      const user = auth.getCurrentUser();
      if (!user || !isSupplierClassifiedAndApproved(user) || user.isAvailableForOrders === false) return;
      if (newReq.status === 'finalizado' || newReq.status === 'cancelado' || newReq.status === 'sem_fornecedor') return;
      if (db.getQuotes(newReq.id).some(q => q.supplierId === user.id)) return;
      if (!db.isSupplierMatchingRequestCategory(user, newReq)) return;
      if (!db.isSupplierWithinRequestRadius(user, newReq)) return;

      setActiveSpam(prev => {
        if (prev) return prev;
        setTimeout(() => triggerSupplierOpportunitySpam(newReq, user), 0);
        return prev;
      });
    };

    if (!activeSpam) {
      checkQueuedRequestsForSupplier();
    }

    window.addEventListener('compe:new_request', handleNewRequest);
    const unsub = db.subscribe(() => {
      if (!activeSpam) {
        checkQueuedRequestsForSupplier();
      }
    });
    return () => {
      window.removeEventListener('compe:new_request', handleNewRequest);
      unsub();
    };
  }, [activeSpam, triggerSupplierOpportunitySpam]);

  // Ouvinte global de Chat (estritamente para usuário autenticado participante ou Admin)
  useEffect(() => {
    const handleChatMessage = (e: Event) => {
      const customEvent = e as CustomEvent<ChatMessage>;
      const msg = customEvent.detail;
      if (!msg) return;

      const user = auth.getCurrentUser();
      if (!user || user.status === 'bloqueado') return;
      if (msg.senderId === user.id) return;
      if (user.role === 'fornecedor' && !isSupplierClassifiedAndApproved(user)) return;

      const reqId = msg.requestId || '';
      const req = reqId ? db.getRequestById(reqId) : undefined;
      const orders = db.getOrders();
      const ord = msg.orderId ? db.getOrderById(msg.orderId) : (reqId ? orders.find(o => o.requestId === reqId) : undefined);

      // Isolamento RBAC de notificação de chat: apenas envolvidos no pedido/solicitação ou Admin
      const isParticipant =
        user.role === 'admin' ||
        msg.recipientId === user.id ||
        ord?.customerId === user.id ||
        ord?.supplierId === user.id ||
        req?.customerId === user.id;

      if (!isParticipant) return;

      soundEffects.playConfiguredEvent('mensagem_chat');

      const otherUser = db.getUserById(msg.senderId);

      setActiveChatAlert({
        msg,
        requestId: reqId || ord?.requestId || '',
        orderId: msg.orderId || ord?.id,
        requestNumber: ord?.orderNumber || req?.requestNumber || 'PEDIDO',
        otherPartyName: otherUser?.companyName || otherUser?.name || msg.senderName,
        otherPartyRole: msg.senderRole,
        otherPartyAvatar: otherUser?.avatarUrl,
      });
    };

    window.addEventListener('compe:chat_message', handleChatMessage);
    return () => window.removeEventListener('compe:chat_message', handleChatMessage);
  }, []);

  // Trigger SPAM de Venda Confirmada (Fornecedor aprovado)
  const triggerSaleSpam = useCallback((order: OrderAndPayment) => {
    const customer = db.getUserById(order.customerId);
    const supplier = db.getUserById(order.supplierId);
    const req = db.getRequestById(order.requestId);
    const saleTemplate = db.getSpamsConfig().find(s => s.type === 'venda_confirmada');

    triggeredSaleOrderIdsRef.current.add(order.id);
    if (!saleTemplate || saleTemplate.soundEnabled !== false) {
      soundEffects.playConfiguredEvent('venda_confirmada');
    }

    const paymentMethodDetail =
      order.paymentMethod === 'pix'
        ? 'PIX Instantâneo / QR Code'
        : order.paymentMethod === 'credit_card'
        ? 'Cartão de Crédito'
        : `${String(order.paymentMethod || 'Pagamento').toUpperCase()} Confirmado`;

    const bankParts: string[] = [];
    const pixOrAccount = supplier?.gatewayPixKey || supplier?.bankAccountOrPix;
    if (pixOrAccount) bankParts.push(`Chave/Conta: ${pixOrAccount}`);
    if (supplier?.gatewayBankInfo?.bankName || supplier?.gatewayBankInfo?.bankCode) {
      const bankLabel = supplier.gatewayBankInfo.bankName || `Banco ${supplier.gatewayBankInfo.bankCode}`;
      const agAcc = [
        supplier.gatewayBankInfo.agency ? `Ag ${supplier.gatewayBankInfo.agency}` : '',
        supplier.gatewayBankInfo.account
          ? `Cc ${supplier.gatewayBankInfo.account}${supplier.gatewayBankInfo.accountDigit ? `-${supplier.gatewayBankInfo.accountDigit}` : ''}`
          : '',
      ]
        .filter(Boolean)
        .join(' · ');
      bankParts.push(`${bankLabel}${agAcc ? ` (${agAcc})` : ''}`);
    }
    if (supplier?.gatewayWalletId) bankParts.push(`Carteira: ${supplier.gatewayWalletId}`);
    const supplierAccountSummary = bankParts.length > 0 ? bankParts.join(' · ') : 'Conta bancária / PIX cadastrado na plataforma';

    const splitStatusText =
      order.splitStatus === 'repassado'
        ? 'Repassado para Subconta'
        : order.splitStatus === 'dividido_pago'
        ? 'Split Dividido & Pago'
        : 'Aguardando Conferência em Conta';

    const confirmReceiptAndClearSnooze = () => {
      db.confirmSupplierSaleReceipt(order.id, order.supplierId);
      setSnoozedOrders(prev => {
        if (!prev[order.id]) return prev;
        const copy = { ...prev };
        delete copy[order.id];
        return copy;
      });
      setActiveSpam(null);
    };

    setActiveSpam({
      config: saleTemplate || {
        id: `spam_sale_${order.id}`,
        type: 'venda_confirmada',
        targetAudience: 'fornecedor',
        title: 'VENDA CONFIRMADA, VERIFIQUE SE O VALOR JÁ ESTÁ NA CONTA!',
        subtitle: 'Verifique se o recebimento do valor já está na sua conta bancária antes de separar e enviar a encomenda ao cliente.',
        countdownSeconds: 0,
        soundEnabled: true,
        soundType: 'cash_success',
        colorScheme: 'yellow',
        isMandatoryAction: true,
        actionButtonLabel: 'CONFIRMO O PAGAMENTO',
      },
      orderId: order.id,
      orderNumber: order.orderNumber,
      requestId: order.requestId,
      requestNumber: req?.requestNumber,
      partName: order.partName,
      vehicleSummary: order.vehicleSummary,
      priceSummary: `R$ ${order.totalAmount.toFixed(2)}`,
      partPriceSummary: `R$ ${order.partPrice.toFixed(2)}`,
      shippingPriceSummary: `R$ ${order.shippingPrice.toFixed(2)}`,
      supplierTransferSummary: `R$ ${order.supplierTransferAmount.toFixed(2)}`,
      paymentMethodText: `${order.paymentMethod.toUpperCase()} CONFIRMADO`,
      paymentMethodDetail,
      gatewayProviderText: (order.gatewayProvider || supplier?.gatewayProvider || 'asaas').toUpperCase(),
      gatewayChargeId: order.gatewayChargeId,
      supplierAccountSummary,
      splitStatusText,
      shippingMethodText: 'Motoboy Express / Transportadora',
      cancellationWarning: order.cancellationPenaltyNotice,
      // Neste SPAM vai SOMENTE o nome do cliente + dados de pagamento/conta (sem telefone, CPF/CNPJ ou endereço completo)
      customerName: customer?.name || 'Cliente AUTO SHOP',
      customerPhotoUrl: customer?.avatarUrl,
      mediaUrl: req?.mediaUrl,
      onSnoozeWaitingPayment: () => {
        const reopenAt = Date.now() + 10 * 60 * 1000;
        setSnoozedOrders(prev => ({ ...prev, [order.id]: reopenAt }));
        setActiveSpam(null);
      },
      onConfirmSale: confirmReceiptAndClearSnooze,
      onAction: confirmReceiptAndClearSnooze,
    });
  }, []);

  // Ouvinte para pagamentos confirmados -> VENDA CONFIRMADA apenas para Fornecedor autenticado e aprovado
  useEffect(() => {
    const checkUnconfirmedSalesForSupplier = () => {
      const user = auth.getCurrentUser();
      const targetUser =
        user && user.role === 'fornecedor'
          ? user
          : currentUser && currentUser.role === 'fornecedor'
          ? currentUser
          : null;
      if (!targetUser || !isSupplierClassifiedAndApproved(targetUser)) return;
      const nowMs = Date.now();
      const pendingSale = db.getOrders().find(o => {
        if (
          o.supplierId !== targetUser.id ||
          o.paymentStatus !== 'confirmado' ||
          o.supplierReceiptConfirmed === true
        ) {
          return false;
        }
        const snoozeUntil = snoozedOrders[o.id];
        if (snoozeUntil && nowMs < snoozeUntil) return false;
        return !triggeredSaleOrderIdsRef.current.has(o.id);
      });
      if (pendingSale) {
        triggerSaleSpam(pendingSale);
      }
    };

    checkUnconfirmedSalesForSupplier();

    const handleOrderPaid = (e: Event) => {
      const order = (e as CustomEvent<OrderAndPayment>).detail;
      if (!order) return;
      const user = auth.getCurrentUser();
      if (
        user &&
        isSupplierClassifiedAndApproved(user) &&
        order.supplierId === user.id &&
        order.paymentStatus === 'confirmado' &&
        order.supplierReceiptConfirmed !== true
      ) {
        triggerSaleSpam(order);
      }
    };

    // Cliente: assim que o fornecedor clicar em "CONFIRMO O PAGAMENTO" -> "CONFIRMAR", dispara o SPAM do fluxo normal de separação/envio
    const handleSupplierConfirmedPayment = (e: Event) => {
      const order = (e as CustomEvent<OrderAndPayment>).detail;
      if (!order) return;
      const user = auth.getCurrentUser();
      if (user && user.role === 'cliente' && order.customerId === user.id) {
        soundEffects.playConfiguredEvent('pedido_a_caminho');
        setActiveSpam({
          config: {
            id: `spam_client_flow_${order.id}`,
            type: 'pedido_a_caminho',
            targetAudience: 'cliente',
            title: 'PAGAMENTO CONFIRMADO! PEDIDO EM SEPARAÇÃO E ENVIO',
            badgeText: 'FLUXO NORMAL LIBERADO',
            subtitle: `O fornecedor confirmou o recebimento do pagamento do pedido ${order.orderNumber}. Seu pedido entrou em separação e envio!`,
            countdownSeconds: 0,
            soundEnabled: true,
            soundType: 'delivery_chime',
            colorScheme: 'green',
            isMandatoryAction: false,
            actionButtonLabel: 'ACOMPANHAR SEPARAÇÃO E ENVIO',
          },
          orderId: order.id,
          orderNumber: order.orderNumber,
          requestId: order.requestId,
          partName: order.partName,
          vehicleSummary: order.vehicleSummary,
          priceSummary: `R$ ${order.totalAmount.toFixed(2)}`,
          paymentMethodText: `${order.paymentMethod.toUpperCase()} CONFIRMADO`,
          shippingMethodText: 'Separação, Embalagem e Envio · PIN de Entrega Ativo',
          dispatchedMessage: `Pedido ${order.orderNumber} confirmado pelo fornecedor! Separação e entrega iniciadas. Seu PIN de segurança para entrega: ${order.pinDeliveryCode}.`,
          onAction: () => setActiveSpam(null),
          onDismissOptional: () => setActiveSpam(null),
        });
      }
    };

    window.addEventListener('compe:order_paid', handleOrderPaid);
    window.addEventListener('compe:supplier_confirmed_payment', handleSupplierConfirmedPayment);
    const unsub = db.subscribe(checkUnconfirmedSalesForSupplier);

    return () => {
      window.removeEventListener('compe:order_paid', handleOrderPaid);
      window.removeEventListener('compe:supplier_confirmed_payment', handleSupplierConfirmedPayment);
      unsub();
    };
  }, [currentUser, activeRoute, triggerSaleSpam, snoozedOrders]);

  // Cronômetro de reabertura automática a cada 10 minutos para lembrete de pagamento pendente do fornecedor
  useEffect(() => {
    if (!currentUser || currentUser.role !== 'fornecedor') return;
    const pendingOrders = db
      .getOrders()
      .filter(
        o =>
          o.supplierId === currentUser.id &&
          o.paymentStatus === 'confirmado' &&
          o.supplierReceiptConfirmed !== true
      );
    if (pendingOrders.length === 0) return;

    const timer = setInterval(() => {
      const nowMs = Date.now();
      setSnoozeTick(t => t + 1);
      setSnoozedOrders(prev => {
        let changed = false;
        const next = { ...prev };
        Object.keys(next).forEach(orderId => {
          if (nowMs >= next[orderId]) {
            delete next[orderId];
            triggeredSaleOrderIdsRef.current.delete(orderId);
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [currentUser, snoozedOrders]);

  // Ouvinte de Recados / SPAMs Direcionados enviados pelo Admin
  useEffect(() => {
    const checkPendingDirectedSpam = () => {
      if (!currentUser || currentUser.role === 'admin' || activeSpam) return;
      if (currentUser.role === 'fornecedor' && !isSupplierClassifiedAndApproved(currentUser)) return;
      const alertItem = db.getPendingDispatchedSpamForUser(currentUser);
      if (!alertItem || triggeredDispatchedIdsRef.current.has(alertItem.id)) return;
      triggeredDispatchedIdsRef.current.add(alertItem.id);

      if (alertItem.config.soundEnabled) {
        if (alertItem.config.soundType === 'urgent_alarm') soundEffects.playUrgentAlarm();
        else if (alertItem.config.soundType === 'cash_success') soundEffects.playCashSuccess();
        else if (alertItem.config.soundType === 'delivery_chime') soundEffects.playDeliveryChime();
        else soundEffects.playWarningBeep();
      }

      setActiveSpam({
        config: alertItem.config,
        dispatchedAlertId: alertItem.id,
        dispatchedMessage: alertItem.message,
        onAction: () => {
          db.acknowledgeDispatchedSpam(alertItem.id, currentUser.id);
          setActiveSpam(null);
        },
        onDismissOptional: () => {
          db.acknowledgeDispatchedSpam(alertItem.id, currentUser.id);
          setActiveSpam(null);
        },
      });
    };

    checkPendingDirectedSpam();
    const unsub = db.subscribe(checkPendingDirectedSpam);
    return () => {
      unsub();
    };
  }, [currentUser, activeSpam]);

  // Render estritamente isolado por rota RBAC e autenticação válida
  const renderPortalContent = () => {
    if (!currentUser || activeRoute === '/login') {
      return (
        <PortalGateway
          portalTarget={portalTarget}
          onSelectPortal={(_role, initialTab = 'login') => {
            setAuthModalRole(portalTarget);
            setAuthModalTab(portalTarget === 'admin' ? 'login' : initialTab);
            setIsAuthModalOpen(true);
          }}
          onOpenAuthModal={() => {
            setAuthModalRole(portalTarget);
            setAuthModalTab('login');
            setIsAuthModalOpen(true);
          }}
        />
      );
    }

    if (activeRoute === '/cliente' && currentUser.role === 'cliente') {
      return (
        <ClientApp
          currentUser={currentUser}
          onOpenNewRequest={() => {}}
        />
      );
    }

    if (
      (activeRoute === '/fornecedor' || activeRoute === '/fornecedor/pendente') &&
      currentUser.role === 'fornecedor'
    ) {
      return (
        <SupplierApp
          currentUser={currentUser}
          onTriggerOpportunitySpam={(req) => triggerSupplierOpportunitySpam(req, currentUser)}
          onTriggerSaleSpam={triggerSaleSpam}
        />
      );
    }

    if (activeRoute === '/admin' && currentUser.role === 'admin') {
      return <AdminDashboard currentUser={currentUser} />;
    }

    return null;
  };

  const getPortalTitle = () => {
    if (activeRoute === '/cliente') return 'Portal do Cliente';
    if (activeRoute === '/fornecedor') return 'Portal do Fornecedor';
    if (activeRoute === '/fornecedor/pendente') return 'Homologação Pendente';
    if (activeRoute === '/admin') return 'Painel Master Admin';
    return 'AUTO SHOP · Acesso Seguro';
  };

  const brandCustom = db.getCustomizationSettings();

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-200">
      {/* Header Superior AUTO SHOP */}
      <Header
        currentUser={currentUser}
        activeRole={currentUser ? currentUser.role : 'gateway'}
        isPhoneFrameMode={isPhoneFrameMode}
        onTogglePhoneFrame={() => setIsPhoneFrameMode(!isPhoneFrameMode)}
        onLogoutToPortalSelect={() => {
          const target = getPortalTargetFromLocation();
          auth.logout(target);
          setActiveRoute('/login');
          syncHashRoute('/login', target);
        }}
        onOpenAuthModal={() => {
          setAuthModalRole(portalTarget);
          setAuthModalTab('login');
          setIsAuthModalOpen(true);
        }}
      />

      {/* LEMBRETE PISCANTE PERSISTENTE: Fornecedor aguardando cair o pagamento na conta */}
      {currentUser?.role === 'fornecedor' && isSupplierClassifiedAndApproved(currentUser) && (() => {
        void snoozeTick;
        const pendingReceiptOrders = db
          .getOrders()
          .filter(
            o =>
              o.supplierId === currentUser.id &&
              o.paymentStatus === 'confirmado' &&
              o.supplierReceiptConfirmed !== true
          );
        if (pendingReceiptOrders.length === 0) return null;
        return (
          <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-3 space-y-2">
            {pendingReceiptOrders.map(ord => {
              const reopenAt = snoozedOrders[ord.id];
              const remainingSec = reopenAt ? Math.max(0, Math.ceil((reopenAt - Date.now()) / 1000)) : 0;
              const mm = String(Math.floor(remainingSec / 60)).padStart(2, '0');
              const ss = String(remainingSec % 60).padStart(2, '0');
              return (
                <div
                  key={`pending_receipt_banner_${ord.id}`}
                  className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 text-white border-2 border-amber-300 shadow-lg shadow-amber-500/30 animate-pulse flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-black/25 shrink-0">
                      <AlertTriangle className="w-5 h-5 text-yellow-200" />
                    </div>
                    <div className="text-xs sm:text-sm">
                      <strong className="font-black uppercase tracking-wide block">
                        AGUARDANDO CAIR O PAGAMENTO · Pedido {ord.orderNumber}
                      </strong>
                      <span className="text-[11px] sm:text-xs font-semibold text-amber-50">
                        {ord.partName} · Valor líquido: <strong className="font-mono">R$ {ord.supplierTransferAmount.toFixed(2)}</strong>
                        {reopenAt
                          ? ` · O alerta reabrirá automaticamente em ${mm}:${ss}`
                          : ' · Confirme assim que verificar na conta'}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => triggerSaleSpam(ord)}
                    className="px-4 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-900 text-amber-300 font-black text-xs uppercase tracking-wider shadow-md flex items-center justify-center gap-1.5 shrink-0 cursor-pointer transition active:scale-95"
                  >
                    <Clock className="w-4 h-4" />
                    <span>Abrir Confirmação Agora</span>
                  </button>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Conteúdo Principal com opção de Moldura Smartphone */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
        {isPhoneFrameMode ? (
          <SmartphoneFrame activeScreenTitle={getPortalTitle()}>
            {renderPortalContent()}
          </SmartphoneFrame>
        ) : (
          renderPortalContent()
        )}
      </main>

      {/* Rodapé Institucional AUTO SHOP */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 py-4 px-4 text-center text-xs text-slate-600 dark:text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
            <span>{brandCustom.appName}</span>
            <span>—</span>
            <span className="text-blue-600 dark:text-blue-400">{brandCustom.appSlogan}</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 font-semibold">
            <span>Site: {brandCustom.headerWebsite || 'www.m1br.com.br'}</span>
            <span>·</span>
            <span>App: {brandCustom.appDomain || 'auto.m1br.com.br'}</span>
            <span>·</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">
              WhatsApp: {brandCustom.whatsappNumber || '11 96212-2694'}
            </span>
          </div>
        </div>
      </footer>

      {/* SPAM Overlay (somente usuário autenticado) */}
      {currentUser && <SpamOverlay spam={activeSpam} />}

      {/* ALARME VISUAL PISCANTE EM NEON PARA CHAT RECEBIDO (somente autenticado) */}
      {currentUser && activeChatAlert && (
        <aside
          aria-label="Alerta de Mensagem Recebida"
          className="fixed top-24 right-4 sm:right-8 z-50 max-w-sm sm:max-w-md w-full bg-slate-950/95 text-white border-2 border-cyan-400 rounded-3xl p-4 sm:p-5 shadow-[0_0_35px_rgba(6,182,212,0.85)] animate-pulse transition-all backdrop-blur-xl"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-400 flex items-center justify-center text-cyan-300 shadow-[0_0_20px_rgba(6,182,212,0.9)] animate-bounce shrink-0">
                <MessageSquare className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full animate-ping ${activeChatAlert.msg.isSac ? 'bg-red-500' : 'bg-cyan-400'}`} />
                  <span className={`text-[10px] font-black uppercase tracking-wider ${activeChatAlert.msg.isSac ? 'text-red-400' : 'text-cyan-300'}`}>
                    {activeChatAlert.msg.isSac ? 'CHAMADO SAC RECEBIDO!' : 'NOVA MENSAGEM NO CHAT!'}
                  </span>
                </div>
                <h4 className="text-sm font-black text-white truncate max-w-[210px] sm:max-w-[250px]">
                  {activeChatAlert.otherPartyName}
                </h4>
                <p className="text-xs text-slate-300 line-clamp-1 italic mt-0.5">
                  "{activeChatAlert.msg.message}"
                </p>
                <span className="text-[10px] font-mono font-bold text-amber-300 block mt-1">
                  Pedido: {activeChatAlert.requestNumber}
                </span>
              </div>
            </div>

            <button
              onClick={() => setActiveChatAlert(null)}
              className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition"
              title="Fechar alerta"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-3 pt-3 border-t border-cyan-500/30 flex items-center gap-2">
            <button
              onClick={() => {
                setOpenChatModalFromAlert({
                  requestId: activeChatAlert.requestId,
                  orderId: activeChatAlert.orderId,
                  requestNumber: activeChatAlert.requestNumber,
                  otherPartyName: activeChatAlert.otherPartyName,
                  otherPartyRole: activeChatAlert.otherPartyRole,
                  otherPartyAvatar: activeChatAlert.otherPartyAvatar,
                });
                setActiveChatAlert(null);
              }}
              className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(6,182,212,0.6)] flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Acessar Conversa Agora</span>
            </button>

            <button
              onClick={() => setActiveChatAlert(null)}
              className="py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-slate-300 font-bold text-xs"
            >
              Depois
            </button>
          </div>
        </aside>
      )}

      {/* CHAT MODAL ABERTO A PARTIR DO ALERTA */}
      {openChatModalFromAlert && currentUser && (
        <OrderChatModal
          currentUser={currentUser}
          requestId={openChatModalFromAlert.requestId}
          orderId={openChatModalFromAlert.orderId}
          requestNumber={openChatModalFromAlert.requestNumber}
          otherPartyName={openChatModalFromAlert.otherPartyName}
          otherPartyRole={openChatModalFromAlert.otherPartyRole}
          otherPartyAvatar={openChatModalFromAlert.otherPartyAvatar}
          onClose={() => setOpenChatModalFromAlert(null)}
        />
      )}

      {/* Modal de Autenticação / Cadastro */}
      {isAuthModalOpen && (
        <AuthModal
          targetPortalRole={authModalRole}
          initialTab={authModalTab}
          onClose={() => setIsAuthModalOpen(false)}
          onLoginSuccess={() => {
            setIsAuthModalOpen(false);
            const user = auth.getCurrentUser();
            setCurrentUser(user);
            enforceRouteGuard(user);
          }}
        />
      )}
    </div>
  );
}