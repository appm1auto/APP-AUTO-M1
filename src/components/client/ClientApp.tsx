/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Wrench,
  Search,
  PlusCircle,
  Clock,
  CheckCircle,
  Truck,
  Car,
  Package,
  Key,
  ShieldCheck,
  Star,
  MapPin,
  FileText,
  AlertCircle,
  ArrowRight,
  Sun,
  Moon,
  MessageSquare,
  X,
  Send,
  RefreshCw,
  AlertTriangle,
  Hourglass
} from 'lucide-react';
import { User, PartRequest, Quote, OrderAndPayment } from '../../types';
import { db } from '../../services/db';
import { RequestPartWizard } from './RequestPartWizard';
import { QuotesComparison } from './QuotesComparison';
import { OrderPaymentModal } from './OrderPaymentModal';
import { DeliveryTrackingModal } from './DeliveryTrackingModal';
import { ClientReferenceFlow } from './ClientReferenceFlow';
import { ManufacturerCatalogHub } from '../catalogs/ManufacturerCatalogHub';
import { ClientAdsExperience } from './ClientAdsExperience';
import { OrderChatModal } from '../common/OrderChatModal';
import { BookOpen, Lock } from 'lucide-react';
import {
  hasPermission,
  isOrderIdentityUnlocked,
  getMaskedCounterpartyLabel,
  formatCityNeighborhood,
} from '../../services/rbac';

interface ClientAppProps {
  currentUser: User;
  onOpenNewRequest: () => void;
}

export const ClientApp: React.FC<ClientAppProps> = ({
  currentUser,
}) => {
  const custom = db.getCustomizationSettings();
  const [activeTab, setActiveTab] = useState<
    'inicio' | 'fluxo_referencia' | 'solicitacoes' | 'orcamentos' | 'compras' | 'entregas' | 'garagem' | 'catalogos'
  >('inicio');

  const [isCreatingRequest, setIsCreatingRequest] = useState(false);
  const [viewingQuotesRequestId, setViewingQuotesRequestId] = useState<string | null>(null);
  const [buyingQuote, setBuyingQuote] = useState<{ quote: Quote; request: PartRequest } | null>(null);
  const [trackingOrder, setTrackingOrder] = useState<OrderAndPayment | null>(null);
  const [activeChatOrder, setActiveChatOrder] = useState<OrderAndPayment | null>(null);
  const [sacModalOrder, setSacModalOrder] = useState<OrderAndPayment | null>(null);
  const [sacReason, setSacReason] = useState('');
  const [purchaseSearch, setPurchaseSearch] = useState('');
  const [clientFeedback, setClientFeedback] = useState<string | null>(null);
  const [, setRefreshTick] = useState(0);
  const [nowTick, setNowTick] = useState(Date.now());

  useEffect(() => {
    db.processExpiredRequests();
    const unsub = db.subscribe(() => setRefreshTick(t => t + 1));
    const handleNewQuote = (e: Event) => {
      const quote = (e as CustomEvent<Quote>).detail;
      if (!quote) return;
      const req = db.getRequestById(quote.requestId);
      if (req && req.customerId === currentUser.id) {
        setClientFeedback(
          `Nova proposta recebida para ${req.requestNumber} (${req.partName}): R$ ${quote.totalPrice.toFixed(2)} — ordenada por menor preço no topo!`
        );
        setRefreshTick(t => t + 1);
      }
    };
    window.addEventListener('compe:new_quote', handleNewQuote);
    const timer = setInterval(() => setNowTick(Date.now()), 1000);
    const expiryCheck = setInterval(() => db.processExpiredRequests(), 5000);
    return () => {
      unsub();
      window.removeEventListener('compe:new_quote', handleNewQuote);
      clearInterval(timer);
      clearInterval(expiryCheck);
    };
  }, [currentUser.id]);

  // Queries
  const allRequests = db.getRequests().filter(r => r.customerId === currentUser.id);
  const allOrders = db.getOrders().filter(o => o.customerId === currentUser.id);
  const allVehicles = db.getVehicles(currentUser.id);

  // Regra 1: Após pagamento confirmado, o pedido SOME de TODAS as solicitações e vai apenas para Histórico de Compras
  const paidRequestIds = new Set(
    allOrders.filter(o => o.paymentStatus === 'confirmado').map(o => o.requestId)
  );
  const visibleRequests = allRequests.filter(
    r => r.status !== 'finalizado' && !paidRequestIds.has(r.id)
  );
  const pendingRequests = visibleRequests.filter(
    r => r.status !== 'cancelado' && r.status !== 'sem_fornecedor'
  );
  const activeDeliveries = allOrders.filter(o => o.deliveryStatus !== 'entregue');

  // Solicitações com 16 minutos vencidos sem nenhum orçamento (liberadas para REFAZER SOLICITAÇÃO até 4 tentativas)
  const retryableExpiredRequests = pendingRequests.filter(r => {
    const quotesCount = db.getQuotes(r.id).length;
    if (quotesCount > 0) return false;
    const attempt = r.searchAttempt || 1;
    const maxAttempts = r.maxSearchAttempts || 4;
    if (attempt >= maxAttempts) return false;
    const deadlineMs = new Date(r.attemptExpiresAt || r.expiresAt).getTime();
    return Number.isFinite(deadlineMs) && nowTick >= deadlineMs;
  });

  const getNextRadiusForAttempt = (currentAttempt: number) => {
    const nextAttempt = currentAttempt + 1;
    if (nextAttempt === 2) return 100;
    if (nextAttempt === 3) return 200;
    return 500;
  };

  const handleRetryRequest = (req: PartRequest) => {
    const res = db.retryExpiredRequest(req.id, currentUser.id);
    if (res.success && res.request) {
      setClientFeedback(
        `Nova solicitação enviada! Buscando fornecedores mais distantes no raio de até ${res.request.searchRadiusKm} km (Tentativa ${res.request.searchAttempt}/${res.request.maxSearchAttempts || 4}).`
      );
    } else {
      setClientFeedback(res.message);
    }
    setTimeout(() => setClientFeedback(null), 6000);
  };

  const filteredOrders = allOrders.filter(order => {
    const q = purchaseSearch.trim().toLowerCase();
    if (!q) return true;
    const statusText = order.deliveryStatus === 'entregue'
      ? 'comprado pago recebido entregue aprovado'
      : `comprado pago ${order.deliveryStatus.replace('_', ' ')}`;
    return (
      order.orderNumber.toLowerCase().includes(q) ||
      order.partName.toLowerCase().includes(q) ||
      order.vehicleSummary.toLowerCase().includes(q) ||
      (order.nfeNumber || '').toLowerCase().includes(q) ||
      order.paymentMethod.toLowerCase().includes(q) ||
      statusText.includes(q)
    );
  });

  if (currentUser.role !== 'cliente' || !hasPermission(currentUser, 'client:request_parts')) {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 rounded-3xl bg-white dark:bg-slate-900 border-2 border-red-300 dark:border-red-900 text-center space-y-3 shadow-xl">
        <Lock className="w-12 h-12 text-red-600 mx-auto" />
        <h2 className="text-xl font-black text-slate-900 dark:text-white">Acesso Negado (RBAC)</h2>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          Esta interface é exclusiva para Clientes autenticados e ativos.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero Quick Action Bar */}
      {!isCreatingRequest && !viewingQuotesRequestId && (
        <div className="relative rounded-3xl bg-slate-900 text-white overflow-hidden shadow-xl border border-slate-800">
          <div className="absolute inset-0 opacity-25">
            <img
              src={custom.clientHeroImageUrl || '/src/assets/images/compe_hero_autoparts_1793928394704.jpg'}
              alt="Autopeças AUTO SHOP"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="relative z-10 p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="max-w-xl space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-400 bg-blue-950/60 px-2.5 py-1 rounded-full border border-blue-800">
                {custom.appName} · {custom.appSlogan}
              </span>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                {custom.clientWelcomeTitle}
              </h1>
              <p className="text-xs sm:text-sm text-slate-300">
                {custom.appTagline}
              </p>
            </div>

            <button
              onClick={() => setIsCreatingRequest(true)}
              className="px-6 py-4 rounded-2xl text-white font-extrabold text-sm sm:text-base shadow-lg shadow-blue-600/30 flex items-center justify-center gap-3 transition active:scale-95 shrink-0 cursor-pointer"
              style={{ backgroundColor: custom.primaryBrandColor }}
            >
              <PlusCircle className="w-5 h-5" />
              <span>{custom.requestButtonText}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Client Sub-Navigation */}
      {!isCreatingRequest && !viewingQuotesRequestId && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200 dark:border-slate-800">
          {(custom.clientTabs?.inicio?.visible ?? true) && (
            <button
              onClick={() => setActiveTab('inicio')}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'inicio'
                  ? 'text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              style={activeTab === 'inicio' ? { backgroundColor: custom.primaryBrandColor } : undefined}
            >
              {custom.clientTabs?.inicio?.label || 'Painel Geral'}
            </button>
          )}

          {(custom.clientTabs?.fluxo_referencia?.visible ?? true) && (
            <button
              onClick={() => setActiveTab('fluxo_referencia')}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'fluxo_referencia'
                  ? 'text-white shadow-sm'
                  : 'text-blue-700 bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900'
              }`}
              style={activeTab === 'fluxo_referencia' ? { backgroundColor: custom.primaryBrandColor } : undefined}
            >
              <span>{custom.clientTabs?.fluxo_referencia?.label || '📱 6 Telas do Modelo (Mockup)'}</span>
            </button>
          )}

          {(custom.clientTabs?.solicitacoes?.visible ?? true) && (
            <button
              onClick={() => setActiveTab('solicitacoes')}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'solicitacoes'
                  ? 'text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              style={activeTab === 'solicitacoes' ? { backgroundColor: custom.primaryBrandColor } : undefined}
            >
              <span>{custom.clientTabs?.solicitacoes?.label || 'Minhas Solicitações'}</span>
              {pendingRequests.length > 0 && (
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-black flex items-center justify-center">
                  {pendingRequests.length}
                </span>
              )}
            </button>
          )}

          {(custom.clientTabs?.entregas?.visible ?? true) && (
            <button
              onClick={() => setActiveTab('entregas')}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'entregas'
                  ? 'text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              style={activeTab === 'entregas' ? { backgroundColor: custom.primaryBrandColor } : undefined}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>{custom.clientTabs?.entregas?.label || 'Acompanhar Entregas (PIN)'}</span>
              {activeDeliveries.length > 0 && (
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-black flex items-center justify-center animate-pulse">
                  {activeDeliveries.length}
                </span>
              )}
            </button>
          )}

          {(custom.clientTabs?.compras?.visible ?? true) && (
            <button
              onClick={() => setActiveTab('compras')}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'compras'
                  ? 'text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              style={activeTab === 'compras' ? { backgroundColor: custom.primaryBrandColor } : undefined}
            >
              {custom.clientTabs?.compras?.label || 'Histórico de Compras'} ({allOrders.length})
            </button>
          )}

          {(custom.clientTabs?.garagem?.visible ?? true) && (
            <button
              onClick={() => setActiveTab('garagem')}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'garagem'
                  ? 'text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              style={activeTab === 'garagem' ? { backgroundColor: custom.primaryBrandColor } : undefined}
            >
              <Car className="w-3.5 h-3.5" />
              <span>{custom.clientTabs?.garagem?.label || 'Meus Veículos'} ({allVehicles.length})</span>
            </button>
          )}

          {(custom.clientTabs?.catalogos?.visible ?? true) && (
            <button
              onClick={() => setActiveTab('catalogos')}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'catalogos'
                  ? 'text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              style={activeTab === 'catalogos' ? { backgroundColor: custom.primaryBrandColor } : undefined}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>{custom.clientTabs?.catalogos?.label || 'Catálogos Fabricantes (PDF)'}</span>
            </button>
          )}
        </div>
      )}

      {/* WIZARD: Request Part */}
      {isCreatingRequest && (
        <RequestPartWizard
          customerId={currentUser.id}
          onSuccess={reqId => {
            setIsCreatingRequest(false);
            setViewingQuotesRequestId(reqId);
          }}
          onCancel={() => setIsCreatingRequest(false)}
        />
      )}

      {/* QUOTES COMPARISON */}
      {viewingQuotesRequestId && (
        (() => {
          const req = db.getRequestById(viewingQuotesRequestId);
          if (!req) return null;
          const quotes = db.getQuotes(req.id);
          return (
            <QuotesComparison
              request={req}
              quotes={quotes}
              onSelectQuoteToBuy={q => setBuyingQuote({ quote: q, request: req })}
              onViewOrderDetails={ord => {
                setViewingQuotesRequestId(null);
                setTrackingOrder(ord);
              }}
              onBack={() => setViewingQuotesRequestId(null)}
            />
          );
        })()
      )}

      {/* TAB: FLUXO DE REFERÊNCIA VISUAL (6 Telas do Modelo da Imagem) */}
      {!isCreatingRequest && !viewingQuotesRequestId && activeTab === 'fluxo_referencia' && (
        <ClientReferenceFlow />
      )}

      {/* TAB: DASHBOARD OVERVIEW: TAB = INICIO */}
      {!isCreatingRequest && !viewingQuotesRequestId && activeTab === 'inicio' && (
        <div className="space-y-6">
          {clientFeedback && (
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-xs font-bold text-emerald-800 dark:text-emerald-200 flex items-center justify-between gap-2 shadow-sm">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{clientFeedback}</span>
              </div>
              <button type="button" onClick={() => setClientFeedback(null)} className="underline cursor-pointer">
                Fechar
              </button>
            </div>
          )}

          {/* ALERTA 16 MINUTOS SEM ORÇAMENTO -> REFAZER SOLICITAÇÃO */}
          {retryableExpiredRequests.map(expReq => {
            const currentAttempt = expReq.searchAttempt || 1;
            const nextRadius = getNextRadiusForAttempt(currentAttempt);
            return (
              <div
                key={`retry_banner_${expReq.id}`}
                className="p-4 sm:p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/80 border-2 border-amber-500 text-amber-950 dark:text-amber-100 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-amber-500 text-white shrink-0 animate-bounce">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200">
                      {expReq.requestNumber} · 16 Minutos Sem Orçamento (Tentativa {currentAttempt}/4)
                    </span>
                    <h3 className="text-sm sm:text-base font-black">
                      Faça uma nova solicitação, iremos buscar novos fornecedores
                    </h3>
                    <p className="text-xs text-amber-900/90 dark:text-amber-200/90">
                      Peça: <strong>{expReq.partName}</strong> · Ao refazer, o app amplia o raio automaticamente para até{' '}
                      <strong>+{nextRadius} km</strong> para alcançar fornecedores mais distantes.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRetryRequest(expReq)}
                  className="px-5 py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 shrink-0 cursor-pointer transition active:scale-95"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>REFAZER SOLICITAÇÃO (+{nextRadius} km)</span>
                </button>
              </div>
            );
          })}

          {/* Active Deliveries Banner with prominent PIN or Awaiting Supplier Payment Confirmation */}
          {activeDeliveries.length > 0 && (() => {
            const firstOrder = activeDeliveries[0];
            const awaitingSupplierConfirm =
              firstOrder.paymentStatus === 'confirmado' && firstOrder.supplierReceiptConfirmed !== true;

            if (awaitingSupplierConfirm) {
              return (
                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-orange-950 via-slate-900 to-orange-950 text-white border-2 border-orange-500 shadow-lg space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-orange-500/20 border border-orange-400/60 shrink-0">
                        <Hourglass className="w-5 h-5 text-orange-400 animate-spin" />
                      </div>
                      <div>
                        <span className="text-[11px] font-black uppercase tracking-wider text-orange-400 block">
                          AGUARDANDO CONFIRMAÇÃO DE PAGAMENTO
                        </span>
                        <h3 className="text-base font-bold text-white">
                          {firstOrder.partName} ({firstOrder.orderNumber})
                        </h3>
                        <p className="text-[11px] text-orange-200/90 mt-0.5">
                          Pagamento enviado! Assim que o fornecedor confirmar na conta, o pedido seguirá para separação e envio.
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setTrackingOrder(firstOrder)}
                      className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-black text-xs transition shrink-0 cursor-pointer"
                    >
                      Acompanhar Status
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-blue-900 to-indigo-950 text-white shadow-md space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-blue-500/20 text-blue-300">
                      <Truck className="w-5 h-5 animate-bounce" />
                    </span>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300">
                        Entrega em Andamento
                      </span>
                      <h3 className="text-base font-bold text-white">
                        {firstOrder.partName}
                      </h3>
                    </div>
                  </div>
                  <button
                    onClick={() => setTrackingOrder(firstOrder)}
                    className="px-3 py-1.5 rounded-xl bg-white text-blue-900 font-bold text-xs hover:bg-blue-50 transition"
                  >
                    Ver Rastreio & PIN
                  </button>
                </div>

                <div className="p-3 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-300 block">PIN de Segurança para Recebimento:</span>
                    <span className="text-[11px] text-slate-400">Dite ao entregador para liberar o repasse</span>
                  </div>
                  <div className="font-mono text-2xl font-black text-amber-300 tracking-[0.2em] px-3 py-1 rounded-lg bg-white/10">
                    {firstOrder.pinDeliveryCode}
                  </div>
                </div>
              </div>
            );
          })()}


          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-500 font-medium">Solicitações Ativas</span>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-1 tabular-nums">
                {pendingRequests.length}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-500 font-medium">Orçamentos Recebidos</span>
              <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1 tabular-nums">
                {db.getQuotes().filter(q => pendingRequests.some(r => r.id === q.requestId)).length}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-500 font-medium">Entregas em Rota</span>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
                {activeDeliveries.length}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-500 font-medium">Total de Compras</span>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-1 tabular-nums">
                {allOrders.length}
              </p>
            </div>
          </div>

          {/* Active Requests List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Suas Solicitações de Peças em Aberto
              </h3>
              <button
                onClick={() => setIsCreatingRequest(true)}
                className="text-xs font-bold text-blue-600 hover:underline"
              >
                + Nova Solicitação
              </button>
            </div>

            {pendingRequests.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <Wrench className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Nenhuma solicitação em andamento
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  Clique no botão acima para cotar qualquer peça com os fornecedores da sua região.
                </p>
              </div>
            ) : (
              /* Lista uma embaixo da outra (vertical single-column stack) */
              <div className="flex flex-col space-y-4">
                {pendingRequests.map(req => {
                  const quotes = db.getQuotes(req.id);
                  const bestQuote = quotes.length > 0
                    ? [...quotes].sort((a, b) => a.totalPrice - b.totalPrice)[0]
                    : null;
                  const photoToShow = req.mediaUrl || bestQuote?.photoUrl;

                  const attempt = req.searchAttempt || 1;
                  const maxAttempts = req.maxSearchAttempts || 4;
                  const attemptTarget = new Date(req.attemptExpiresAt || req.expiresAt).getTime();
                  const attemptDiffMs = Math.max(0, attemptTarget - nowTick);
                  const attemptMins = Math.floor(attemptDiffMs / 60000);
                  const attemptSecs = Math.floor((attemptDiffMs % 60000) / 1000);
                  const isWaitingRetry = quotes.length === 0 && attemptDiffMs === 0 && attempt < maxAttempts;
                  const nextRadius = getNextRadiusForAttempt(attempt);

                  // 24-hour non-resetting countdown timer for client to analyze quotes and decide
                  const clientTarget = req.clientExpiresAt
                    ? new Date(req.clientExpiresAt).getTime()
                    : (new Date(req.createdAt).getTime() + 24 * 60 * 60 * 1000);
                  const clientDiffMs = Math.max(0, clientTarget - nowTick);
                  const clientHoursLeft = Math.floor(clientDiffMs / 3600000);
                  const clientMinsLeft = Math.floor((clientDiffMs % 3600000) / 60000);
                  const clientSecsLeft = Math.floor((clientDiffMs % 60000) / 1000);
                  const formattedClientCountdown = `${clientHoursLeft.toString().padStart(2, '0')}:${clientMinsLeft.toString().padStart(2, '0')}:${clientSecsLeft.toString().padStart(2, '0')}`;

                  return (
                    <div
                      key={req.id}
                      className={`p-5 rounded-2xl bg-white dark:bg-slate-900 border shadow-sm transition space-y-4 ${
                        isWaitingRetry
                          ? 'border-amber-500 ring-2 ring-amber-400/30'
                          : 'border-slate-200 dark:border-slate-800 hover:border-blue-500/50'
                      }`}
                    >
                      {/* Top Bar com Número da Solicitação e Tempo em Tela para Responder */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-black text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-2.5 py-1 rounded-lg border border-blue-200 dark:border-blue-900">
                            {req.requestNumber}
                          </span>
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            Tentativa {attempt}/{maxAttempts} · Raio {req.searchRadiusKm} km
                          </span>
                          <span className="text-xs font-semibold text-slate-500">
                            {req.vehicleBrand} {req.vehicleModel} ({req.vehicleYear}) {req.vehicleEngine && `· ${req.vehicleEngine}`}
                          </span>
                        </div>

                        {quotes.length === 0 ? (
                          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl font-bold font-mono text-xs border shadow-sm ${
                            isWaitingRetry
                              ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-400'
                              : 'bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                          }`}>
                            <Clock className="w-4 h-4 shrink-0" />
                            <span>
                              {isWaitingRetry
                                ? '16:00 encerrados · 0 orçamentos'
                                : `Busca ativa (16 min): ${attemptMins.toString().padStart(2, '0')}:${attemptSecs.toString().padStart(2, '0')}`}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl font-bold font-mono text-xs border shadow-sm bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                            <Clock className="w-4 h-4 text-blue-600 shrink-0" />
                            <span>Tempo para decidir: {formattedClientCountdown} (24h)</span>
                          </div>
                        )}
                      </div>

                      {isWaitingRetry && (
                        <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="text-xs text-amber-950 dark:text-amber-200">
                            <strong className="block text-sm font-black">
                              Faça uma nova solicitação, iremos buscar novos fornecedores
                            </strong>
                            <span>
                              Nenhum orçamento chegou em 16 minutos. Clique em REFAZER SOLICITAÇÃO para ampliar a busca para +{nextRadius} km.
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRetryRequest(req)}
                            className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs shadow flex items-center gap-1.5 shrink-0 cursor-pointer"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>REFAZER SOLICITAÇÃO</span>
                          </button>
                        </div>
                      )}

                      {/* Conteúdo Principal do Card */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {(() => {
                          const reqPhotos =
                            req.mediaUrls && req.mediaUrls.length > 0
                              ? req.mediaUrls
                              : req.mediaUrl
                              ? [req.mediaUrl]
                              : [];
                          const extraPhotos = (req.extraParts || []).flatMap(ep => ep.mediaUrls || []);
                          const allPhotos = [...reqPhotos, ...extraPhotos];
                          const fallbackPhoto = allPhotos.length === 0 && bestQuote?.photoUrl ? [bestQuote.photoUrl] : [];
                          const gallery = allPhotos.length > 0 ? allPhotos : fallbackPhoto;

                          if (gallery.length === 0) return null;
                          return (
                            <div className="space-y-1.5">
                              <div className="relative w-full h-32 md:h-28 rounded-xl overflow-hidden bg-slate-950 border border-slate-200 dark:border-slate-800 shrink-0">
                                <img
                                  src={gallery[0]}
                                  alt={req.partName}
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                                <span className="absolute bottom-1 left-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-black/75 text-white">
                                  {allPhotos.length > 1
                                    ? `${allPhotos.length} fotos anexadas`
                                    : bestQuote?.condition
                                    ? `Condição: ${bestQuote.condition.toUpperCase()}`
                                    : 'Foto da Peça'}
                                </span>
                              </div>
                              {allPhotos.length > 1 && (
                                <div className="flex gap-1 overflow-x-auto">
                                  {allPhotos.slice(1, 5).map((u, idx) => (
                                    <img
                                      key={`${req.id}-thumb-${idx}`}
                                      src={u}
                                      alt={`Foto ${idx + 2}`}
                                      className="w-10 h-10 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                                      referrerPolicy="no-referrer"
                                    />
                                  ))}
                                  {allPhotos.length > 5 && (
                                    <div className="w-10 h-10 rounded-lg bg-slate-800 text-white text-[10px] font-black flex items-center justify-center shrink-0">
                                      +{allPhotos.length - 5}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        <div className={`${(req.mediaUrls?.length || req.mediaUrl || (req.extraParts || []).some(e => e.mediaUrls?.length) || bestQuote?.photoUrl) ? 'md:col-span-3' : 'md:col-span-4'} space-y-2`}>
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <h4 className="text-lg font-black text-slate-900 dark:text-white">
                              {req.partName}
                            </h4>
                            {bestQuote && (
                              <div className="text-left sm:text-right">
                                <span className="text-[10px] uppercase font-bold text-slate-400 block">Menor Valor da Peça:</span>
                                <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono">
                                  R$ {bestQuote.partPrice.toFixed(2)}
                                  <span className="text-xs font-normal text-slate-500 ml-1">
                                    (+ Frete R$ {bestQuote.shippingPrice.toFixed(2)})
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300">
                            <div>
                              <span className="text-slate-400 block text-[10px] uppercase font-bold">Categoria / Subcategoria:</span>
                              <strong>
                                {req.categoryName ? `${req.categoryName} · ` : ''}
                                {req.partSubcategory || req.partCategory}
                              </strong>
                            </div>
                            {req.oemCode && (
                              <div>
                                <span className="text-slate-400 block text-[10px] uppercase font-bold">Código OEM:</span>
                                <strong className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">{req.oemCode}</strong>
                              </div>
                            )}
                            <div className="sm:col-span-2">
                              <span className="text-slate-400 block text-[10px] uppercase font-bold">Tempo de Entrega no Local Indicado:</span>
                              <div className="flex items-center gap-1.5 mt-0.5 text-slate-700 dark:text-slate-200">
                                <Truck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                <strong>
                                  {bestQuote ? `Entrega em até ${bestQuote.deliveryDays} ${bestQuote.deliveryDays === 1 ? 'dia útil' : 'dias úteis'}` : 'Calculado na resposta dos fornecedores'}
                                </strong>
                                <span>para</span>
                                <span className="font-semibold">{req.deliveryAddress.neighborhood}, {req.deliveryAddress.city} - {req.deliveryAddress.state}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Rodapé com Status e Ação */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 gap-3">
                        <div className="flex items-center gap-2 text-xs">
                          <span className={`w-2.5 h-2.5 rounded-full ${quotes.length > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {quotes.length} {quotes.length === 1 ? 'Orçamento Disponível' : 'Orçamentos Disponíveis'}
                          </span>
                          {quotes.length > 0 && (
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded text-[11px]">
                              A partir de R$ {bestQuote?.totalPrice.toFixed(2)}
                            </span>
                          )}
                        </div>

                        {isWaitingRetry ? (
                          <button
                            type="button"
                            onClick={() => handleRetryRequest(req)}
                            className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
                          >
                            <RefreshCw className="w-4 h-4" />
                            <span>REFAZER SOLICITAÇÃO (+{nextRadius} km)</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => setViewingQuotesRequestId(req.id)}
                            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
                          >
                            <span>{quotes.length > 0 ? 'Ver Orçamentos & Comprar' : 'Aguardar Orçamentos'}</span>
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* PDF Catalogs of Manufacturers Hub right on Client Home Page */}
          <div className="pt-2">
            <ManufacturerCatalogHub />
          </div>
        </div>
      )}

      {/* TAB: CATÁLOGOS PDF DE FABRICANTES */}
      {!isCreatingRequest && !viewingQuotesRequestId && activeTab === 'catalogos' && (
        <ManufacturerCatalogHub />
      )}

      {/* TAB: MINHAS SOLICITAÇÕES (Exclui pedidos já comprados/pagos, mantendo histórico apenas em Histórico de Compras) */}
      {!isCreatingRequest && !viewingQuotesRequestId && activeTab === 'solicitacoes' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Minhas Solicitações de Peças ({visibleRequests.length})
            </h2>
            <button
              onClick={() => setIsCreatingRequest(true)}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm cursor-pointer"
            >
              + Nova Solicitação
            </button>
          </div>

          {clientFeedback && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-xs font-bold text-emerald-800 dark:text-emerald-200 flex items-center justify-between gap-2">
              <span>{clientFeedback}</span>
              <button type="button" onClick={() => setClientFeedback(null)} className="underline cursor-pointer">
                Fechar
              </button>
            </div>
          )}

          {visibleRequests.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
              <Wrench className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Nenhuma solicitação pendente de compra
              </h3>
              <p className="text-xs text-slate-500">
                Pedidos já pagos e comprados ficam armazenados exclusivamente na aba "Histórico de Compras".
              </p>
            </div>
          ) : (
            <div className="flex flex-col space-y-4">
              {visibleRequests.map(req => {
                const quotes = db.getQuotes(req.id);
                const bestQuote = quotes.length > 0
                  ? [...quotes].sort((a, b) => a.totalPrice - b.totalPrice)[0]
                  : null;
                const photoToShow = req.mediaUrl || bestQuote?.photoUrl;

                const attempt = req.searchAttempt || 1;
                const maxAttempts = req.maxSearchAttempts || 4;
                const isClosedNoSupplier =
                  req.status === 'sem_fornecedor' || req.closedReason === 'nenhum_fornecedor_disponivel';
                const attemptTarget = new Date(req.attemptExpiresAt || req.expiresAt).getTime();
                const attemptDiffMs = Math.max(0, attemptTarget - nowTick);
                const attemptMins = Math.floor(attemptDiffMs / 60000);
                const attemptSecs = Math.floor((attemptDiffMs % 60000) / 1000);
                const isWaitingRetry =
                  !isClosedNoSupplier &&
                  req.status !== 'cancelado' &&
                  quotes.length === 0 &&
                  attemptDiffMs === 0 &&
                  attempt < maxAttempts;
                const nextRadius = getNextRadiusForAttempt(attempt);

                // 24-hour non-resetting countdown timer for client to answer quote
                const clientTarget = req.clientExpiresAt
                  ? new Date(req.clientExpiresAt).getTime()
                  : (new Date(req.createdAt).getTime() + 24 * 60 * 60 * 1000);
                const clientDiffMs = Math.max(0, clientTarget - nowTick);
                const clientHoursLeft = Math.floor(clientDiffMs / 3600000);
                const clientMinsLeft = Math.floor((clientDiffMs % 3600000) / 60000);
                const clientSecsLeft = Math.floor((clientDiffMs % 60000) / 1000);
                const formattedClientCountdown = `${clientHoursLeft.toString().padStart(2, '0')}:${clientMinsLeft.toString().padStart(2, '0')}:${clientSecsLeft.toString().padStart(2, '0')}`;

                return (
                  <div
                    key={req.id}
                    className={`p-5 rounded-2xl bg-white dark:bg-slate-900 border shadow-sm hover:shadow-md transition space-y-4 ${
                      isClosedNoSupplier
                        ? 'border-red-300 dark:border-red-900/70'
                        : isWaitingRetry
                        ? 'border-amber-500 ring-2 ring-amber-400/30'
                        : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 gap-2">
                      <div className="flex items-center gap-2 text-xs flex-wrap">
                        <span className="font-mono font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-900">
                          {req.requestNumber}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                          Tentativa {attempt}/{maxAttempts} · Raio {req.searchRadiusKm} km
                        </span>
                        <span className="text-slate-600 dark:text-slate-300 font-semibold">
                          {req.vehicleBrand} {req.vehicleModel} ({req.vehicleYear})
                        </span>
                      </div>

                      {isClosedNoSupplier ? (
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 text-xs font-black border border-red-300 dark:border-red-800">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>NENHUM FORNECEDOR DISPONÍVEL</span>
                        </div>
                      ) : quotes.length === 0 ? (
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 text-xs font-mono font-bold border border-amber-200 dark:border-amber-900">
                          <Clock className="w-3.5 h-3.5 text-amber-600" />
                          <span>
                            {isWaitingRetry
                              ? '16 min esgotados · 0 ofertas'
                              : `Busca (16 min): ${attemptMins.toString().padStart(2, '0')}:${attemptSecs.toString().padStart(2, '0')}`}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 text-xs font-mono font-bold border border-blue-200 dark:border-blue-900">
                          <Clock className="w-3.5 h-3.5 text-blue-600" />
                          <span>Tempo para decidir: {formattedClientCountdown} (24h)</span>
                        </div>
                      )}
                    </div>

                    {isWaitingRetry && (
                      <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="text-xs text-amber-950 dark:text-amber-200">
                          <strong className="block text-sm font-black">
                            Faça uma nova solicitação, iremos buscar novos fornecedores
                          </strong>
                          <span>
                            Prazo de 16 minutos encerrado sem propostas. Clique para ampliar o raio para até +{nextRadius} km.
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRetryRequest(req)}
                          className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs shadow flex items-center gap-1.5 shrink-0 cursor-pointer"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>REFAZER SOLICITAÇÃO</span>
                        </button>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      {(() => {
                        const reqPhotos =
                          req.mediaUrls && req.mediaUrls.length > 0
                            ? req.mediaUrls
                            : req.mediaUrl
                            ? [req.mediaUrl]
                            : [];
                        const extraPhotos = (req.extraParts || []).flatMap(ep => ep.mediaUrls || []);
                        const allPhotos = [...reqPhotos, ...extraPhotos];
                        const gallery = allPhotos.length > 0 ? allPhotos : (photoToShow ? [photoToShow] : []);

                        if (gallery.length === 0) return null;
                        return (
                          <div className="space-y-1.5">
                            <div className="relative w-full h-28 rounded-xl overflow-hidden bg-slate-950 border border-slate-200 dark:border-slate-800 shrink-0">
                              <img
                                src={gallery[0]}
                                alt={req.partName}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                              {allPhotos.length > 1 && (
                                <span className="absolute bottom-1 left-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-black/75 text-white">
                                  {allPhotos.length} fotos
                                </span>
                              )}
                            </div>
                            {allPhotos.length > 1 && (
                              <div className="flex gap-1 overflow-x-auto">
                                {allPhotos.slice(1, 5).map((u, idx) => (
                                  <img
                                    key={`${req.id}-sol-thumb-${idx}`}
                                    src={u}
                                    alt={`Foto ${idx + 2}`}
                                    className="w-10 h-10 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                                    referrerPolicy="no-referrer"
                                  />
                                ))}
                                {allPhotos.length > 5 && (
                                  <div className="w-10 h-10 rounded-lg bg-slate-800 text-white text-[10px] font-black flex items-center justify-center shrink-0">
                                    +{allPhotos.length - 5}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      <div className={`${(req.mediaUrls?.length || req.mediaUrl || (req.extraParts || []).some(e => e.mediaUrls?.length) || photoToShow) ? 'md:col-span-3' : 'md:col-span-4'} space-y-1.5`}>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                          <h3 className="text-base font-bold text-slate-900 dark:text-white">
                            {req.partName}
                          </h3>
                          {bestQuote && (
                            <div className="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400">
                              Valor da peça: R$ {bestQuote.partPrice.toFixed(2)}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                          <span>
                            Categoria: <strong>{req.categoryName ? `${req.categoryName} · ` : ''}{req.partSubcategory || req.partCategory}</strong>
                          </span>
                          {req.oemCode && <span>OEM: <strong className="font-mono">{req.oemCode}</strong></span>}
                          <span>
                            Status:{' '}
                            <strong className={isClosedNoSupplier ? 'text-red-600 uppercase' : 'capitalize'}>
                              {isClosedNoSupplier ? 'NENHUM FORNECEDOR DISPONÍVEL' : req.status.replace('_', ' ')}
                            </strong>
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 pt-1">
                          <Truck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span>Tempo de entrega no local: <strong>{bestQuote ? `${bestQuote.deliveryDays} dia(s)` : 'A definir'}</strong> ({req.deliveryAddress.neighborhood}, {req.deliveryAddress.city})</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        {isClosedNoSupplier ? (
                          <span className="px-3 py-1 rounded-full bg-red-100 dark:bg-red-950/70 text-red-700 dark:text-red-300 text-xs font-black border border-red-300 dark:border-red-800">
                            0 OFERTAS RECEBIDAS · Encerrado após 4 tentativas (até 500 km)
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                            {quotes.length} {quotes.length === 1 ? 'oferta recebida' : 'ofertas recebidas'}
                          </span>
                        )}
                      </div>

                      {isClosedNoSupplier ? (
                        <span className="text-xs font-bold text-slate-500">
                          Histórico arquivado sem ofertas
                        </span>
                      ) : isWaitingRetry ? (
                        <button
                          type="button"
                          onClick={() => handleRetryRequest(req)}
                          className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>REFAZER SOLICITAÇÃO (+{nextRadius} km)</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => setViewingQuotesRequestId(req.id)}
                          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition cursor-pointer"
                        >
                          Ver Orçamentos
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB: ACOMPANHAR ENTREGAS */}
      {!isCreatingRequest && !viewingQuotesRequestId && activeTab === 'entregas' && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Acompanhamento de Entregas e Código PIN
          </h2>

          {allOrders.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <Truck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                Nenhuma compra em transporte no momento
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {allOrders.map(order => (
                <div
                  key={order.id}
                  className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {order.orderNumber}
                      </span>
                      <span className="text-slate-400">·</span>
                      <span className="text-slate-500">{order.vehicleSummary}</span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      {order.partName}
                    </h3>
                    <div className="flex items-center gap-2 text-xs flex-wrap">
                      {order.paymentStatus === 'confirmado' && order.supplierReceiptConfirmed !== true ? (
                        <span className="inline-flex items-center gap-1.5 font-black uppercase px-2.5 py-1 rounded-lg text-[10px] bg-orange-50 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 border border-orange-300 dark:border-orange-800">
                          <Hourglass className="w-3.5 h-3.5 animate-spin text-orange-500 shrink-0" />
                          <span>AGUARDANDO CONFIRMAÇÃO DE PAGAMENTO</span>
                        </span>
                      ) : (
                        <span className={`font-bold uppercase px-2 py-0.5 rounded text-[10px] ${
                          order.deliveryStatus === 'entregue'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                        }`}>
                          {order.deliveryStatus.replace('_', ' ')}
                        </span>
                      )}
                      {order.trackingCode && (
                        <span className="text-slate-500 font-mono text-[11px]">
                          Rastreio: {order.trackingCode}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* PIN Display & Details CTA */}
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-slate-900 text-white text-center">
                      <span className="text-[10px] text-slate-400 block font-semibold">PIN DE ENTREGA</span>
                      <span className="font-mono text-xl font-black text-amber-300 tracking-wider">
                        {order.pinDeliveryCode}
                      </span>
                    </div>

                    <button
                      onClick={() => setTrackingOrder(order)}
                      className="px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition"
                    >
                      Ver Rastreio Completo
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB: HISTÓRICO DE COMPRAS (PESQUISÁVEL) */}
      {!isCreatingRequest && !viewingQuotesRequestId && activeTab === 'compras' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Histórico de Compras ({filteredOrders.length} de {allOrders.length})
              </h2>
              <p className="text-xs text-slate-500">
                Consulte e pesquise todas as peças compradas, pagas e recebidas com nota fiscal e suporte.
              </p>
            </div>
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={purchaseSearch}
                onChange={e => setPurchaseSearch(e.target.value)}
                placeholder="Pesquisar peça, veículo, pedido, NF-e ou recebido..."
                className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-600"
              />
              {purchaseSearch && (
                <button
                  type="button"
                  onClick={() => setPurchaseSearch('')}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  title="Limpar pesquisa"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {filteredOrders.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
              <Package className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Nenhuma compra encontrada no histórico
              </h3>
              <p className="text-xs text-slate-500">
                {purchaseSearch
                  ? 'Nenhum item corresponde à sua pesquisa. Tente outro termo.'
                  : 'Suas peças compradas e pagas aparecerão aqui.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredOrders.map(order => {
                const isDelivered = order.deliveryStatus === 'entregue';
                const unreadChat = db.getUnreadChatCountForOrder(currentUser.id, order.requestId, order.id);
                const unreadSac = db.getUnreadChatCountForOrder(currentUser.id, order.requestId, order.id, true);

                return (
                  <div
                    key={order.id}
                    className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <span className="font-mono font-bold text-slate-500 block">
                        {order.orderNumber} · {new Date(order.createdAt).toLocaleDateString('pt-BR')} · {order.vehicleSummary}
                      </span>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                        {order.partName}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold uppercase px-2 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          COMPRADO & PAGO
                        </span>
                        {order.paymentStatus === 'confirmado' && order.supplierReceiptConfirmed !== true ? (
                          <span className="inline-flex items-center gap-1.5 font-black uppercase px-2.5 py-0.5 rounded text-[10px] bg-orange-50 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 border border-orange-300 dark:border-orange-800">
                            <Hourglass className="w-3 h-3 animate-spin text-orange-500 shrink-0" />
                            <span>AGUARDANDO CONFIRMAÇÃO DE PAGAMENTO</span>
                          </span>
                        ) : (
                          <span className={`font-bold uppercase px-2 py-0.5 rounded text-[10px] ${
                            isDelivered
                              ? 'bg-emerald-600 text-white'
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                          }`}>
                            {isDelivered ? 'RECEBIDO (ENTREGUE)' : order.deliveryStatus.replace('_', ' ')}
                          </span>
                        )}
                        <span className="text-slate-500">
                          NF-e: {order.nfeNumber || 'Emitida'} · {order.paymentMethod.toUpperCase()}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base font-black font-mono text-emerald-600 dark:text-emerald-400">
                        R$ {order.totalAmount.toFixed(2)}
                      </span>

                      <button
                        type="button"
                        onClick={() => setActiveChatOrder(order)}
                        className={`px-3 py-1.5 rounded-lg text-white text-xs font-black shadow-sm transition flex items-center gap-1.5 cursor-pointer ${
                          unreadChat > 0
                            ? 'bg-cyan-600 hover:bg-cyan-700 ring-2 ring-cyan-300 animate-pulse shadow-lg shadow-cyan-500/40'
                            : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                        title="Abrir Chat e Suporte direto com o Fornecedor"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Chat / Suporte</span>
                        {unreadChat > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full bg-white text-cyan-700 text-[10px] font-black leading-none">
                            {unreadChat}
                          </span>
                        )}
                      </button>

                      <button
                        onClick={() => setTrackingOrder(order)}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                      >
                        Ver Detalhes / PIN
                      </button>

                      {isDelivered && (
                        <button
                          type="button"
                          onClick={() => {
                            if (unreadSac > 0) {
                              setActiveChatOrder(order);
                            } else {
                              setSacReason('');
                              setSacModalOrder(order);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-lg text-white text-xs font-black shadow-sm transition flex items-center gap-1 cursor-pointer ${
                            unreadSac > 0
                              ? 'bg-red-600 hover:bg-red-700 ring-2 ring-amber-300 animate-pulse shadow-lg shadow-red-500/50'
                              : 'bg-red-600 hover:bg-red-700'
                          }`}
                        >
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>SAC</span>
                          {unreadSac > 0 && (
                            <span className="px-1.5 py-0.5 rounded-full bg-white text-red-700 text-[10px] font-black leading-none">
                              {unreadSac}
                            </span>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      {/* TAB: MEUS VEÍCULOS (GARAGEM) */}
      {!isCreatingRequest && !viewingQuotesRequestId && activeTab === 'garagem' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Sua Garagem Cadastrada ({allVehicles.length})
            </h2>
            <button
              onClick={() => setIsCreatingRequest(true)}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm"
            >
              + Cotar Peça para Veículo
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {allVehicles.map(veh => (
              <div
                key={veh.id}
                className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600">
                      <Car className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        {veh.brand} {veh.model}
                      </h3>
                      <span className="text-xs text-slate-500 font-semibold">
                        Ano {veh.year} · {veh.version}
                      </span>
                    </div>
                  </div>
                  {veh.plate && (
                    <span className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono text-xs font-black uppercase">
                      {veh.plate}
                    </span>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 space-y-1">
                  <div>Motor: <strong className="text-slate-800 dark:text-slate-200">{veh.engine || 'Padrão de Fábrica'}</strong></div>
                  <div>Chassi: <strong className="font-mono text-slate-800 dark:text-slate-200">{veh.chassi || 'Não informado'}</strong></div>
                </div>

                <button
                  onClick={() => setIsCreatingRequest(true)}
                  className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-blue-600 hover:text-white text-slate-700 dark:text-slate-200 font-black text-xs transition"
                >
                  SOLICITAR COTAÇÃO DE PEÇA
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PAYMENT MODAL */}
      {buyingQuote && (
        <OrderPaymentModal
          quote={buyingQuote.quote}
          request={buyingQuote.request}
          customerId={currentUser.id}
          platformFeePercent={
            db.getUserById(buyingQuote.quote.supplierId)?.commissionRateOverride ??
            db.getCommissionSettings().generalCommissionPercent
          }
          onSuccess={order => {
            setBuyingQuote(null);
            setViewingQuotesRequestId(null);
            setTrackingOrder(order);
          }}
          onClose={() => setBuyingQuote(null)}
        />
      )}

      {/* TRACKING & PIN MODAL */}
      {trackingOrder && (
        <DeliveryTrackingModal
          order={trackingOrder}
          customerId={currentUser.id}
          onClose={() => setTrackingOrder(null)}
        />
      )}

      {/* CHAT / SUPORTE MODAL COM ALARME VISUAL & SONORO */}
      {activeChatOrder && (
        (() => {
          const supplier = db.getUserById(activeChatOrder.supplierId);
          const identityUnlocked = isOrderIdentityUnlocked(activeChatOrder, 'cliente');
          const maskedName = getMaskedCounterpartyLabel('fornecedor', activeChatOrder.supplierId);
          return (
            <OrderChatModal
              currentUser={currentUser}
              requestId={activeChatOrder.requestId}
              orderId={activeChatOrder.id}
              requestNumber={activeChatOrder.orderNumber}
              otherPartyName={identityUnlocked ? (supplier?.companyName || supplier?.name || maskedName) : maskedName}
              otherPartyRole="fornecedor"
              otherPartyAvatar={identityUnlocked ? supplier?.avatarUrl : undefined}
              onClose={() => setActiveChatOrder(null)}
            />
          );
        })()
      )}
      {/* MODAL DE ABERTURA DE CHAMADO SAC */}
      {sacModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 text-red-600">
                <AlertCircle className="w-5 h-5" />
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Abrir Chamado SAC · {sacModalOrder.orderNumber}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSacModalOrder(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Descreva o motivo do atendimento (troca, garantia, estorno ou dúvida pós-entrega). O fornecedor e o Administrador receberão o alerta imediatamente.
            </p>
            <textarea
              rows={3}
              value={sacReason}
              onChange={e => setSacReason(e.target.value)}
              placeholder="Ex: Solicito análise de garantia / troca para a peça..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-red-600"
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setSacModalOrder(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const text = sacReason.trim() || `Chamado SAC aberto para o pedido ${sacModalOrder.orderNumber} (${sacModalOrder.partName}).`;
                  db.sendChatMessage({
                    requestId: sacModalOrder.requestId,
                    orderId: sacModalOrder.id,
                    requestNumber: sacModalOrder.orderNumber,
                    senderId: currentUser.id,
                    senderName: currentUser.name,
                    senderRole: 'cliente',
                    recipientId: sacModalOrder.supplierId,
                    message: `[CHAMADO SAC] ${text}`,
                    isSac: true,
                    isAdminIntervention: false,
                  });
                  const targetOrder = sacModalOrder;
                  setSacModalOrder(null);
                  setActiveChatOrder(targetOrder);
                }}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Enviar SAC e Abrir Chat</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ANÚNCIOS PROGRAMÁVEIS PARA CLIENTES (3s NA TELA INICIAL + CARROSSEL NO RODAPÉ) */}
      <ClientAdsExperience currentUserId={currentUser.id} />
    </div>
  );
};
