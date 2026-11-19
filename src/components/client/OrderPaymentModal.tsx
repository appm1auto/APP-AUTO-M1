/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  X,
  CreditCard,
  QrCode,
  ShieldCheck,
  Copy,
  Check,
  ArrowRight,
  AlertTriangle
} from 'lucide-react';
import { Quote, PartRequest, PaymentMethod, OrderAndPayment } from '../../types';
import { db } from '../../services/db';

interface OrderPaymentModalProps {
  quote: Quote;
  request: PartRequest;
  customerId: string;
  /** Taxa da plataforma definida pelo Admin para este Fornecedor (ex: 10 = 10%) */
  platformFeePercent?: number;
  onSuccess: (order: OrderAndPayment) => void;
  onClose: () => void;
}

export const OrderPaymentModal: React.FC<OrderPaymentModalProps> = ({
  quote,
  request,
  customerId,
  platformFeePercent = 10,
  onSuccess,
  onClose,
}) => {
  const custom = db.getCustomizationSettings();
  const enabledPaymentMethods = (custom.paymentMethodsConfig || []).filter(p => p.enabled);
  const effectivePaymentMethods =
    enabledPaymentMethods.length > 0
      ? enabledPaymentMethods
      : [
          { id: 'pay_pix', key: 'pix', label: 'PIX Instantâneo', enabled: true, instructions: 'Aprovação imediata via QR Code.', badgeText: 'Mais Rápido' },
          { id: 'pay_cc', key: 'credit_card', label: 'Cartão de Crédito', enabled: true, instructions: 'Pagamento seguro via cartão.', badgeText: '' },
        ];
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(effectivePaymentMethods[0].key);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [copiedPix, setCopiedPix] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'waiting' | 'confirmed' | 'error'>('idle');
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Usa a taxa definida pelo Admin para este Fornecedor
  const platformRate = platformFeePercent;
  const platformAmount = (quote.partPrice * platformRate) / 100;
  const supplierAmount = quote.totalPrice - platformAmount;

  const supplierUser = db.getUserById(quote.supplierId);
  const distDetails = db.getDistanceDetailsSupplierToRequest(supplierUser, request);
  const realDistanceKm = distDetails?.distanceKm ?? quote.distanceKm ?? null;

  const pixCode = `00020126580014br.gov.bcb.pix0136autoshop-pay-${Date.now().toString().slice(-8)}520400005303986540${quote.totalPrice.toFixed(2).length}${quote.totalPrice.toFixed(2)}5802BR5917AUTO SHOP PLATAF6009SAO PAULO62070503***63047A8F`;

  const handleCopyPix = () => {
    navigator.clipboard.writeText(pixCode);
    setCopiedPix(true);
    setTimeout(() => setCopiedPix(false), 2500);
  };

  const handleConfirmPayment = async () => {
    if (!acceptedTerms) return;
    setProcessing(true);
    setPaymentStatus('waiting');
    setPaymentError(null);

    try {
      const order = await db.createOrderWithSplit(
        customerId,
        quote.id,
        paymentMethod,
        supplierUser?.gatewayProvider
      );

      setPaymentStatus('confirmed');
      setProcessing(false);

      setTimeout(() => {
        onSuccess(order);
      }, 650);
    } catch (error) {
      setPaymentError(
        error instanceof Error ? error.message : 'Falha ao processar cobrança com split no gateway.'
      );
      setPaymentStatus('error');
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-5 sm:p-7 relative max-h-[92vh] overflow-y-auto">
        
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Cabeçalho */}
        <div className="pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
              Checkout Seguro · AUTO SHOP
            </span>
            <span className="text-slate-400">·</span>
            <span className="text-[11px] text-slate-500 font-mono">
              Solicitação {request.requestNumber}
            </span>
          </div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white mt-1">
            Revisão e Pagamento do Pedido
          </h2>
        </div>

        {/* Resumo do Pedido */}
        <div className="mt-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2.5">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs text-slate-500 font-medium">Item Selecionado:</span>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {quote.brand} · {request.partName}
              </p>
              <span className="text-xs text-slate-600 dark:text-slate-300">
                Veículo: {request.vehicleBrand} {request.vehicleModel} ({request.vehicleYear})
              </span>
            </div>
            <span className={`text-[11px] font-extrabold uppercase px-2 py-0.5 rounded text-white ${
              quote.condition === 'nova' ? 'bg-blue-600' : 'bg-amber-600'
            }`}>
              {quote.condition.toUpperCase()}
            </span>
          </div>

          <div className="pt-2 border-t border-slate-200 dark:border-slate-700 grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-slate-500 block">Endereço de Entrega:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {request.deliveryAddress.street}, {request.deliveryAddress.number}
              </span>
              <span className="text-slate-500 block">
                {request.deliveryAddress.neighborhood}, {request.deliveryAddress.city} - {request.deliveryAddress.state}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Prazo & Garantia:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {quote.deliveryDays} dia(s) útil(eis) · {quote.warrantyDays} dias de garantia
              </span>
            </div>
          </div>
        </div>

        {/* Split com a taxa do Fornecedor (definida pelo Admin) */}
        <div className="mt-4 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
            <span>Valor da Peça:</span>
            <span className="font-mono font-semibold">R$ {quote.partPrice.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
            <span>
              Frete Especializado
              {realDistanceKm !== null && (
                <span className="ml-1.5 text-[11px] font-mono font-bold text-emerald-700 dark:text-emerald-400">
                  ({realDistanceKm.toFixed(1)} km reais · CEP {request.deliveryAddress.cep})
                </span>
              )}
              :
            </span>
            <span className="font-mono font-semibold">R$ {quote.shippingPrice.toFixed(2)}</span>
          </div>

          <div className="p-2.5 rounded-lg bg-blue-50/60 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/60 text-[11px] space-y-1">
            <div className="flex items-center justify-between text-blue-900 dark:text-blue-300 font-medium">
              <span>
                Repasse ao Fornecedor via Split
                {supplierUser?.gatewayWalletId ? ` (${supplierUser.gatewayWalletId})` : ''}:
              </span>
              <span className="font-mono font-bold">R$ {supplierAmount.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-blue-800 dark:text-blue-400">
              <span>Taxa AUTO SHOP ({platformRate}% retida na conta principal):</span>
              <span className="font-mono">R$ {platformAmount.toFixed(2)}</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
            <span className="text-sm font-black text-slate-900 dark:text-white uppercase">
              Total a Pagar:
            </span>
            <span className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
              R$ {quote.totalPrice.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Formas de Pagamento (Configuradas pelo Admin) */}
        <div className="mt-4">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
            Forma de Pagamento
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {effectivePaymentMethods.map(pm => {
              const isSelected = paymentMethod === pm.key;
              return (
                <button
                  key={pm.id}
                  type="button"
                  onClick={() => setPaymentMethod(pm.key)}
                  className={`p-3 rounded-xl border flex items-center justify-between gap-2 text-xs font-bold transition cursor-pointer ${
                    isSelected
                      ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/20'
                      : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {pm.key === 'pix' ? (
                      <QrCode className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <CreditCard className="w-4 h-4 text-blue-600 shrink-0" />
                    )}
                    <span className="truncate">{pm.label}</span>
                  </div>
                  {pm.badgeText && (
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shrink-0">
                      {pm.badgeText}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Instruções do método selecionado */}
        {(() => {
          const activeMethod = effectivePaymentMethods.find(p => p.key === paymentMethod);
          if (paymentMethod === 'pix') {
            return (
              <div className="mt-4 p-4 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/40 dark:bg-emerald-950/20 space-y-3 text-center">
                <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200 block">
                  {activeMethod?.instructions || 'Escaneie o QR Code ou Copie o Código PIX:'}
                </span>

                <div className="w-36 h-36 mx-auto bg-white p-2 rounded-xl border border-emerald-200 shadow-sm flex items-center justify-center">
                  <svg viewBox="0 0 100 100" className="w-full h-full text-slate-900">
                    <rect width="100" height="100" fill="#fff" />
                    <path d="M10 10h30v30h-30zM15 15h20v20h-20zM60 10h30v30h-30zM65 15h20v20h-20zM10 60h30v30h-30zM15 65h20v20h-20zM45 10h10v10h-10zM10 45h10v10h-10zM45 45h10v10h-10zM70 45h20v10h-20zM45 70h10v20h-10zM60 60h10v10h-10zM80 80h10v10h-10zM70 75h10v10h-10zM22 22h6v6h-6zM72 22h6v6h-6zM22 72h6v6h-6z" fill="#0f172a" />
                  </svg>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={pixCode}
                    className="flex-1 px-3 py-2 text-xs font-mono bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 rounded-lg truncate text-slate-700 dark:text-slate-300"
                  />
                  <button
                    type="button"
                    onClick={handleCopyPix}
                    className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition active:scale-95 shrink-0"
                  >
                    {copiedPix ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedPix ? 'Copiado!' : 'Copiar PIX'}</span>
                  </button>
                </div>

                <p className="text-[11px] text-emerald-800 dark:text-emerald-300">
                  Após o pagamento a confirmação é automática. Não feche esta tela.
                </p>
              </div>
            );
          }

          if (activeMethod?.instructions) {
            return (
              <div className="mt-4 p-3.5 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/30 text-xs text-blue-900 dark:text-blue-200">
                <strong className="block font-black mb-1">{activeMethod.label}</strong>
                <p>{activeMethod.instructions}</p>
              </div>
            );
          }
          return null;
        })()}

        {/* Aviso de segurança */}
        <div className="mt-4 flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-800 dark:text-amber-200 leading-relaxed">
            <strong>Proteção contra golpes:</strong> O pedido só é liberado após a confirmação oficial do pagamento. Não aceite comprovantes manuais.
          </p>
        </div>

        {/* Termos */}
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
          <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={e => setAcceptedTerms(e.target.checked)}
              className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 shrink-0"
            />
            <span>
              Declaro que li e concordo com os <strong>Termos de Uso</strong>, <strong>Políticas de Troca e Devolução (CDC)</strong> e autorizo a emissão automática de <strong>Nota Fiscal Eletrônica (NF-e)</strong>.
            </span>
          </label>
        </div>

        {paymentError && (
          <div className="mt-3 p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-xs font-bold text-red-700 dark:text-red-300">
            {paymentError}
          </div>
        )}

        {/* Botão de Confirmar */}
        <div className="mt-5">
          <button
            onClick={handleConfirmPayment}
            disabled={!acceptedTerms || processing || paymentStatus === 'confirmed'}
            className={`w-full py-3.5 px-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 shadow-lg transition active:scale-98 cursor-pointer ${
              acceptedTerms && !processing && paymentStatus !== 'confirmed'
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
            }`}
          >
            <ShieldCheck className="w-5 h-5" />
            <span>
              {processing
                ? 'Processando cobrança e Split...'
                : paymentStatus === 'confirmed'
                ? 'Pagamento & Split Confirmados!'
                : `Confirmar Pagamento de R$ ${quote.totalPrice.toFixed(2)}`}
            </span>
            {!processing && paymentStatus !== 'confirmed' && <ArrowRight className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};