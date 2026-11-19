import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Truck,
  CheckCircle,
  Tag,
  Clock,
  ArrowRight,
  Eye,
  Star,
  Lock,
  Package,
  MapPin,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { Quote, PartRequest, OrderAndPayment } from '../../types';
import { db } from '../../services/db';

interface QuotesComparisonProps {
  request: PartRequest;
  quotes: Quote[];
  onSelectQuoteToBuy: (quote: Quote) => void;
  onViewOrderDetails?: (order: OrderAndPayment) => void;
  onBack: () => void;
}

export const QuotesComparison: React.FC<QuotesComparisonProps> = ({
  request,
  quotes,
  onSelectQuoteToBuy,
  onViewOrderDetails,
  onBack,
}) => {
  // Live 1-second interval for real-time countdown + hydration of true road distances
  const [currentNow, setCurrentNow] = useState(Date.now());
  const [, setGeoTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentNow(Date.now());
    }, 1000);
    const unsub = db.subscribe(() => setGeoTick(t => t + 1));
    quotes.forEach(q => {
      db.hydrateRealDistanceForPair(q.supplierId, request.id);
    });
    return () => {
      clearInterval(timer);
      unsub();
    };
  }, [quotes, request.id]);

  // Ordem estritamente crescente por menor valor total (peça + frete) no topo
  const sortedQuotes = db.sortQuotesAscending(quotes);

  // 24-hour countdown target calculation (monotonic, never resets)
  const clientTarget = request.clientExpiresAt
    ? new Date(request.clientExpiresAt).getTime()
    : (new Date(request.createdAt).getTime() + 24 * 60 * 60 * 1000);
  const clientDiffMs = Math.max(0, clientTarget - currentNow);
  const clientHoursLeft = Math.floor(clientDiffMs / 3600000);
  const clientMinsLeft = Math.floor((clientDiffMs % 3600000) / 60000);
  const clientSecsLeft = Math.floor((clientDiffMs % 60000) / 1000);
  const formattedClientCountdown = `${clientHoursLeft.toString().padStart(2, '0')}:${clientMinsLeft.toString().padStart(2, '0')}:${clientSecsLeft.toString().padStart(2, '0')}`;
  const isUrgent = clientDiffMs < 30 * 60 * 1000;

  // Verificação de compra já efetuada e produto pago
  const existingOrder = db.getOrders().find(o => o.requestId === request.id);
  const isOrderPaid = Boolean(existingOrder && (existingOrder.paymentStatus === 'confirmado' || request.status === 'finalizado'));

  return (
    <div className="space-y-6">
      {/* Banner de Compra Efetuada e Paga */}
      {isOrderPaid && existingOrder && (
        <div className="p-4 sm:p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/80 border-2 border-emerald-500 text-emerald-950 dark:text-emerald-100 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-600 text-white shrink-0">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300 block">
                COMPRA JÁ REALIZADA & PRODUTO PAGO!
              </span>
              <p className="text-xs text-slate-700 dark:text-slate-300 font-semibold mt-0.5">
                Pedido <strong className="font-mono text-emerald-700 dark:text-emerald-400">{existingOrder.orderNumber}</strong> · Status: <span className="font-mono uppercase font-black">{existingOrder.deliveryStatus.replace('_', ' ')}</span>
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              if (onViewOrderDetails) onViewOrderDetails(existingOrder);
              else onBack();
            }}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>Ver Detalhes & Rastreio</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Request Header Summary */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs">
            <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
              {request.requestNumber}
            </span>
            <span className="text-slate-400">·</span>
            <span className="text-slate-500">
              {request.vehicleBrand} {request.vehicleModel} ({request.vehicleYear})
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white mt-1">
            {request.partName}
          </h2>
          <span className="text-xs text-slate-500 flex items-center gap-1 mt-0.5 flex-wrap">
            <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span>
              Entrega em: <strong>{request.deliveryAddress.neighborhood}, {request.deliveryAddress.city} - {request.deliveryAddress.state}</strong>
            </span>
            {request.deliveryAddress.cep && (
              <span className="font-mono text-[11px] font-bold bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                CEP: {request.deliveryAddress.cep}
              </span>
            )}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
          {/* Active 24-hour countdown timer */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl font-bold font-mono text-xs border shadow-sm ${
            isUrgent
              ? 'bg-red-50 dark:bg-red-950/80 text-red-600 dark:text-red-300 border-red-300 dark:border-red-800 animate-pulse'
              : 'bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900'
          }`}>
            <Clock className="w-4 h-4 text-blue-600 shrink-0" />
            <span>Tempo para aprovar proposta: {formattedClientCountdown} (24h)</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onBack}
              className="px-3.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition cursor-pointer"
            >
              ← Voltar
            </button>
            <div className="px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-xs font-bold border border-blue-200 dark:border-blue-900">
              {quotes.length} {quotes.length === 1 ? 'Orçamento Recebido' : 'Orçamentos Recebidos'}
            </div>
          </div>
        </div>
      </div>

      {/* Strict Privacy Notice */}
      <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-400">
        <Lock className="w-4 h-4 text-blue-600 shrink-0" />
        <span>
          <strong>Proteção AUTO SHOP:</strong> As propostas chegam em tempo real e estão ordenadas estritamente em ordem crescente (do menor para o maior valor no topo). Você tem 60 minutos para aprovar e garantir o melhor preço.
        </span>
      </div>

      {sortedQuotes.length === 0 ? (() => {
        const attempt = request.searchAttempt || 1;
        const maxAttempts = request.maxSearchAttempts || 4;
        const isClosedNoSupplier =
          request.status === 'sem_fornecedor' || request.closedReason === 'nenhum_fornecedor_disponivel';
        const attemptTarget = new Date(request.attemptExpiresAt || request.expiresAt).getTime();
        const attemptDiffMs = Math.max(0, attemptTarget - currentNow);
        const attemptMins = Math.floor(attemptDiffMs / 60000);
        const attemptSecs = Math.floor((attemptDiffMs % 60000) / 1000);
        const canRetry = !isClosedNoSupplier && attemptDiffMs === 0 && attempt < maxAttempts;
        const nextRadius = attempt + 1 === 2 ? 100 : attempt + 1 === 3 ? 200 : 500;

        if (isClosedNoSupplier) {
          return (
            <div className="p-10 text-center rounded-2xl bg-red-50 dark:bg-red-950/40 border-2 border-red-300 dark:border-red-900 space-y-3">
              <AlertTriangle className="w-12 h-12 text-red-600 mx-auto" />
              <span className="inline-block px-3 py-1 rounded-full bg-red-600 text-white text-xs font-black uppercase">
                0 OFERTAS RECEBIDAS
              </span>
              <h3 className="text-lg font-black text-red-900 dark:text-red-200">
                NENHUM FORNECEDOR DISPONÍVEL
              </h3>
              <p className="text-xs text-red-800/90 dark:text-red-300 max-w-md mx-auto">
                Após {maxAttempts} tentativas (raio progressivo até {request.searchRadiusKm} km), nenhum fornecedor respondeu a esta solicitação. O chamado permanece registrado em Minhas Solicitações com 0 ofertas recebidas.
              </p>
            </div>
          );
        }

        if (canRetry) {
          return (
            <div className="p-8 sm:p-10 text-center rounded-2xl bg-amber-50 dark:bg-amber-950/50 border-2 border-amber-400 dark:border-amber-800 space-y-4">
              <AlertTriangle className="w-12 h-12 text-amber-600 mx-auto animate-bounce" />
              <div className="space-y-1">
                <span className="text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200">
                  16 minutos esgotados · Tentativa {attempt}/{maxAttempts}
                </span>
                <h3 className="text-lg font-black text-amber-950 dark:text-amber-100 mt-1">
                  Faça uma nova solicitação, iremos buscar novos fornecedores
                </h3>
                <p className="text-xs text-amber-900 dark:text-amber-200 max-w-md mx-auto">
                  Nenhum orçamento foi recebido neste raio ({request.searchRadiusKm} km). Clique abaixo para dobrar o raio de busca automaticamente para até +{nextRadius} km.
                </p>
              </div>
              <button
                type="button"
                onClick={() => db.retryExpiredRequest(request.id, request.customerId)}
                className="px-6 py-3.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs sm:text-sm shadow-lg inline-flex items-center gap-2 cursor-pointer transition active:scale-95"
              >
                <RefreshCw className="w-4 h-4" />
                <span>REFAZER SOLICITAÇÃO (+{nextRadius} km)</span>
              </button>
            </div>
          );
        }

        return (
          <div className="p-12 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
            <Clock className="w-12 h-12 text-blue-500 mx-auto mb-2 animate-spin" />
            <div className="font-mono text-sm font-black text-blue-700 dark:text-blue-300">
              {attemptMins.toString().padStart(2, '0')}:{attemptSecs.toString().padStart(2, '0')} restantes · Tentativa {attempt}/{maxAttempts} (Raio {request.searchRadiusKm} km)
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Aguardando propostas dos fornecedores...
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Notificamos lojas credenciadas no raio atual com prazo de 16 minutos. Caso não receba orçamento ao zerar, você poderá clicar em REFAZER SOLICITAÇÃO para buscar fornecedores mais distantes.
            </p>
          </div>
        );
      })() : (
        /* Vertical Stacked List: One above the other, strictly ascending order with lowest total at top */
        <div className="flex flex-col space-y-4">
          <div className="text-xs font-bold text-slate-500 flex items-center justify-between px-1">
            <span>Classificação das Ofertas (Ordem Crescente · Menor Valor no Topo):</span>
            <span>{sortedQuotes.length} {sortedQuotes.length === 1 ? 'proposta disponível' : 'propostas disponíveis'}</span>
          </div>

          {sortedQuotes.map((quote, idx) => {
            const isBestOffer = idx === 0;
            const rankNumber = idx + 1;
            const maskedSupplierCode = `Fornecedor Certificado #${quote.supplierId.slice(-4).toUpperCase()}`;
            const supplierUser = db.getUserById(quote.supplierId);
            const distDetails = db.getDistanceDetailsSupplierToRequest(supplierUser, request);
            const displayDistanceKm = distDetails?.distanceKm ?? quote.distanceKm ?? null;
            const displayDistanceSource = distDetails?.source ?? quote.distanceSource;

            return (
              <div
                key={quote.id}
                className={`rounded-2xl bg-white dark:bg-slate-900 border transition-all hover:shadow-lg overflow-hidden relative ${
                  isBestOffer
                    ? 'border-emerald-500 ring-2 ring-emerald-500/30 shadow-md'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                {/* Ranking Top Bar com Cronômetro de 60 Minutos */}
                <div className={`px-4 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-black ${
                  isBestOffer
                    ? 'bg-emerald-600 text-white'
                    : rankNumber === 2
                    ? 'bg-blue-600/90 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}>
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[11px] font-black">
                      {rankNumber}º
                    </span>
                    <span>
                      {isBestOffer
                        ? '1º Lugar — MELHOR OFERTA (Menor Valor Total)'
                        : `${rankNumber}º Lugar na Comparação`}
                    </span>
                  </div>

                  {/* Cronômetro Regressivo de 60 Minutos para Aprovar Proposta */}
                  <div className="flex items-center gap-1.5 font-mono text-[11px] bg-black/20 px-2 py-0.5 rounded-lg">
                    <Clock className="w-3 h-3 animate-pulse" />
                    <span>Tempo para responder: {clientMinsLeft}:{clientSecsLeft.toString().padStart(2, '0')}</span>
                  </div>
                </div>

                {/* Card Content Row */}
                <div className="p-4 sm:p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
                  {/* Foto da Peça */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full lg:w-auto flex-1">
                    <div className="relative w-full sm:w-36 h-36 rounded-xl overflow-hidden bg-slate-950 border border-slate-200 dark:border-slate-800 shrink-0 shadow-xs">
                      <img
                        src={quote.photoUrl}
                        alt={quote.brand}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <span className={`absolute bottom-1 left-1 text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded shadow-sm text-white ${
                        quote.condition === 'nova'
                          ? 'bg-blue-600'
                          : quote.condition === 'usada'
                          ? 'bg-amber-600'
                          : 'bg-purple-600'
                      }`}>
                        {quote.condition === 'nova' ? 'Peça Nova' : quote.condition === 'usada' ? 'Peça Usada' : 'Recondicionada'}
                      </span>
                    </div>

                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-black text-slate-900 dark:text-white text-base">
                          {quote.brand}
                        </span>
                        {quote.partCode && (
                          <span className="font-mono text-[11px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300 font-bold">
                            Cód: {quote.partCode}
                          </span>
                        )}
                      </div>

                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                        {request.partName}
                      </h4>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        {quote.supplierTier === 'opcao_3' && quote.supplierLogoUrl ? (
                          <div className="flex items-center gap-2 bg-purple-50 dark:bg-purple-950/70 px-3 py-1 rounded-xl border border-purple-200 dark:border-purple-800 shadow-xs">
                            <img
                              src={quote.supplierLogoUrl}
                              alt="Logo"
                              className="w-6 h-6 rounded-lg object-cover border border-purple-300 dark:border-purple-700"
                            />
                            <strong className="text-purple-900 dark:text-purple-200 font-bold">
                              {quote.supplierName}
                            </strong>
                            <span className="text-[9px] uppercase font-black bg-purple-600 text-white px-2 py-0.5 rounded-full">
                              Fornecedor Nacional (3ª Opção)
                            </span>
                          </div>
                        ) : (
                          <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300 font-medium">
                            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                            {maskedSupplierCode}
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-amber-500 font-bold">
                          <Star className="w-3.5 h-3.5 fill-current" />
                          {quote.supplierRating.toFixed(1)}
                        </span>
                        <span className="flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                          Garantia {quote.warrantyDays} dias
                        </span>
                      </div>

                      {/* Tempo Estimado de Entrega, Distância Real e Modo de Envio */}
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-slate-700 dark:text-slate-300">
                        <div className="flex items-start gap-2">
                          <Truck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white">
                              Prazo de entrega: {quote.deliveryHours ? `${quote.deliveryHours} horas (Expresso)` : `${quote.deliveryDays} ${quote.deliveryDays === 1 ? 'dia útil' : 'dias úteis'}`}
                              {quote.shippingMethod && ` · ${quote.shippingMethod}`}
                            </span>
                            <span className="block text-[11px] text-slate-500">
                              Destino: {request.deliveryAddress.neighborhood}, {request.deliveryAddress.city} - {request.deliveryAddress.state}
                              {request.deliveryAddress.cep ? ` (CEP ${request.deliveryAddress.cep})` : ''}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 shrink-0">
                          <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <div className="leading-tight">
                            <span className="font-mono font-black text-emerald-700 dark:text-emerald-300 text-xs block">
                              {displayDistanceKm !== null ? `${displayDistanceKm.toFixed(1)} km reais` : 'Calculando km...'}
                            </span>
                            <span className="text-[10px] text-emerald-700/80 dark:text-emerald-400/80 block">
                              {supplierUser?.address?.city ? `De ${supplierUser.address.city}/${supplierUser.address.state}` : 'Distância até seu CEP'}
                              {displayDistanceSource === 'rota_real'
                                ? distDetails?.durationMin
                                  ? ` · Rota ~${distDetails.durationMin} min`
                                  : ' · Rota real'
                                : ''}
                            </span>
                          </div>
                        </div>
                      </div>

                      {quote.technicalDetails && (
                        <div className="p-2.5 rounded-xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200/60 dark:border-purple-900/40 text-xs text-purple-950 dark:text-purple-200">
                          <strong className="block text-[10px] uppercase font-black tracking-wider text-purple-700 dark:text-purple-300 mb-0.5">
                            Características Técnicas da Peça:
                          </strong>
                          <span>{quote.technicalDetails}</span>
                        </div>
                      )}

                      {quote.observations && (
                        <p className="text-xs text-slate-500 italic line-clamp-2">
                          "{quote.observations}"
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Pricing Breakdown Claro: Valor da Peça, Frete e Total + Botão de Ação */}
                  <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end justify-between w-full lg:w-auto pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-800 gap-4 shrink-0">
                    <div className="text-left lg:text-right space-y-1">
                      <div className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                        Valor da Peça: <strong className="text-slate-900 dark:text-white font-mono">R$ {quote.partPrice.toFixed(2)}</strong>
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                        Valor do Frete:{' '}
                        <strong className="text-slate-900 dark:text-white font-mono">
                          {quote.shippingPrice > 0 ? `R$ ${quote.shippingPrice.toFixed(2)}` : 'Grátis (R$ 0,00)'}
                        </strong>
                        {displayDistanceKm !== null && (
                          <span className="block text-[10px] text-emerald-700 dark:text-emerald-400 font-bold">
                            Baseado em {displayDistanceKm.toFixed(1)} km reais até o seu CEP
                          </span>
                        )}
                      </div>
                      <div className="pt-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Total a Pagar:</span>
                        <div className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                          R$ {quote.totalPrice.toFixed(2)}
                        </div>
                      </div>
                    </div>

                    {isOrderPaid ? (
                      <div className="flex flex-col items-stretch sm:items-end gap-1.5 w-full sm:w-auto">
                        {existingOrder?.quoteId === quote.id && (
                          <span className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950 px-2.5 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800 text-center">
                            ✓ Oferta Comprada & Paga
                          </span>
                        )}
                        <button
                          onClick={() => {
                            if (onViewOrderDetails && existingOrder) {
                              onViewOrderDetails(existingOrder);
                            } else {
                              onBack();
                            }
                          }}
                          className="w-full sm:w-auto px-6 py-3 rounded-xl font-black text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer transition active:scale-95 whitespace-nowrap"
                        >
                          <CheckCircle className="w-4 h-4" />
                          <span>Ver Detalhes</span>
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => onSelectQuoteToBuy(quote)}
                        className={`w-full sm:w-auto px-6 py-3 rounded-xl font-black text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer whitespace-nowrap ${
                          isBestOffer
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30 ring-2 ring-emerald-400'
                            : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20'
                        }`}
                      >
                        <span>Aprovar e Comprar Proposta</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

