/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Truck,
  CheckCircle,
  Package,
  ShieldCheck,
  Key,
  Star,
  FileText,
  MapPin,
  ExternalLink,
  Clock,
  MessageSquare,
  Phone,
  Store,
  Camera,
  Upload,
  Bike,
  Hourglass
} from 'lucide-react';
import { OrderAndPayment, User } from '../../types';
import { db } from '../../services/db';
import { OrderChatModal } from '../common/OrderChatModal';

interface DeliveryTrackingModalProps {
  order: OrderAndPayment;
  customerId: string;
  onClose: () => void;
}

export const DeliveryTrackingModal: React.FC<DeliveryTrackingModalProps> = ({
  order,
  customerId,
  onClose,
}) => {
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState('');
  const [submittedRating, setSubmittedRating] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [clientPhoto, setClientPhoto] = useState<string>(order.clientConfirmationPhotoUrl || '');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [, setDbTick] = useState(0);

  useEffect(() => {
    const unsub = db.subscribe(() => setDbTick(t => t + 1));
    return () => {
      unsub();
    };
  }, []);

  const handleAttachClientPhoto = (url: string) => {
    setClientPhoto(url);
    db.confirmClientDeliveryWithPhoto(order.id, url, customerId);
  };

  const liveOrder = db.getOrderById(order.id) || order;
  const supplier = db.getUserById(liveOrder.supplierId);
  const customer = db.getUserById(customerId);
  const unreadChatCount = db.getUnreadChatCountForOrder(customerId, liveOrder.requestId, liveOrder.id);

  // Status mapping
  const steps = [
    { key: 'compra_confirmada', label: '1. Compra Confirmada', desc: 'Pagamento aprovado e NF-e emitida' },
    { key: 'peca_separada', label: '2. Peça Separada', desc: 'Conferida e embalada pelo fornecedor' },
    { key: 'a_caminho', label: '3. A Caminho', desc: 'Em transporte até seu endereço' },
    { key: 'entregue', label: '4. Entregue', desc: 'Recebimento validado via PIN de 4 dígitos' },
  ];

  const getStepStatus = (stepKey: string) => {
    const orderIndex = steps.findIndex(s => s.key === liveOrder.deliveryStatus);
    const stepIndex = steps.findIndex(s => s.key === stepKey);
    if (stepIndex < orderIndex) return 'completed';
    if (stepIndex === orderIndex) return 'current';
    return 'upcoming';
  };

  const isAwaitingSupplierConfirm =
    liveOrder.paymentStatus === 'confirmado' && liveOrder.supplierReceiptConfirmed !== true;

  const handleRatingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    db.submitEvaluation(order.id, customerId, rating, comment);
    setSubmittedRating(true);
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

        {/* Modal Header */}
        <div className="pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
              Rastreamento em Tempo Real · AUTO SHOP
            </span>
            <span className="text-slate-400">·</span>
            <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
              {liveOrder.orderNumber}
            </span>
          </div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white mt-1">
            {liveOrder.partName}
          </h2>

          {/* Dados do Fornecedor Desbloqueados após Aprovação do Orçamento */}
          <div className="mt-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 flex items-center justify-center shrink-0">
                {supplier?.avatarUrl ? (
                  <img src={supplier.avatarUrl} alt={supplier.companyName || supplier.name} className="w-full h-full object-cover" />
                ) : (
                  <Store className="w-5 h-5 text-emerald-600" />
                )}
              </div>
              <div>
                <strong className="block text-xs font-black text-slate-900 dark:text-white">
                  {supplier?.companyName || supplier?.name || 'Fornecedor'}
                </strong>
                <span className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
                  <Phone className="w-3 h-3 text-emerald-600" />
                  WhatsApp: {supplier?.phone || '—'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsChatOpen(true)}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs self-start sm:self-auto ${
                unreadChatCount > 0
                  ? 'bg-amber-500 hover:bg-amber-600 text-white ring-2 ring-amber-300 animate-pulse shadow-lg shadow-amber-500/40'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Abrir Chat / Suporte</span>
              {unreadChatCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-white text-amber-700 text-[10px] font-black leading-none">
                  {unreadChatCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* AGUARDANDO CONFIRMAÇÃO DE PAGAMENTO PELO FORNECEDOR */}
        {isAwaitingSupplierConfirm && (
          <div className="mt-4 p-4 rounded-2xl border-2 border-orange-400 bg-orange-50 dark:bg-orange-950/60 flex items-center gap-3 shadow-sm">
            <div className="p-2.5 rounded-xl bg-orange-100 dark:bg-orange-900/70 shrink-0">
              <Hourglass className="w-5 h-5 text-orange-500 animate-spin" />
            </div>
            <div className="text-xs space-y-0.5">
              <strong className="font-black uppercase tracking-wider text-orange-600 dark:text-orange-400 block">
                AGUARDANDO CONFIRMAÇÃO DE PAGAMENTO
              </strong>
              <p className="text-orange-900 dark:text-orange-200 font-semibold">
                O fornecedor está conferindo o recebimento em conta. Assim que ele confirmar, seu pedido seguirá automaticamente para separação e envio.
              </p>
            </div>
          </div>
        )}

        {/* CRITICAL PIN SECURITY SECTION (§4.4) */}
        <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white shadow-lg space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Key className="w-5 h-5 text-amber-400" />
              <span className="text-xs font-black uppercase tracking-wider text-amber-300">
                Seu PIN de Confirmação de Entrega
              </span>
            </div>
            <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded uppercase font-bold">
              Segurança AUTO SHOP
            </span>
          </div>

          <div className="flex items-center justify-between pt-1">
            <p className="text-xs text-slate-200 max-w-[280px]">
              Dite este código de 4 dígitos ao entregador no momento em que você receber a peça em mãos:
            </p>
            <div className="px-4 py-2 rounded-xl bg-white text-slate-900 font-mono text-3xl font-black tracking-[0.25em] shadow-inner text-center">
              {liveOrder.pinDeliveryCode}
            </div>
          </div>

          <p className="text-[11px] text-slate-400 italic pt-1 border-t border-white/10">
            * O repasse financeiro ao fornecedor só é liberado pelo sistema após a validação deste PIN.
          </p>
        </div>

        {/* Step-by-step Timeline */}
        <div className="mt-5 space-y-4">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
            Status do Pedido
          </h3>
          <div className="space-y-3">
            {steps.map((st, i) => {
              const status = getStepStatus(st.key);
              return (
                <div key={st.key} className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                      status === 'completed'
                        ? 'bg-emerald-600 text-white'
                        : status === 'current'
                        ? 'bg-blue-600 text-white ring-4 ring-blue-500/20 animate-pulse'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                    }`}>
                      {status === 'completed' ? <CheckCircle className="w-4 h-4" /> : i + 1}
                    </div>
                    {i < steps.length - 1 && (
                      <div className={`w-0.5 h-7 ${status === 'completed' ? 'bg-emerald-600' : 'bg-slate-200 dark:bg-slate-800'}`} />
                    )}
                  </div>
                  <div className="pt-0.5">
                    <span className={`text-xs font-bold block ${
                      status === 'current'
                        ? 'text-blue-600 dark:text-blue-400'
                        : status === 'completed'
                        ? 'text-slate-900 dark:text-white'
                        : 'text-slate-400'
                    }`}>
                      {st.label}
                    </span>
                    <span className="text-[11px] text-slate-500">{st.desc}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Motoboy & Expedição Informações (§10) */}
        {(liveOrder.motoboyName || liveOrder.trackingCode) && (
          <div className="mt-4 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
              <span className="text-xs font-black uppercase text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Bike className="w-4 h-4 text-blue-600" />
                Dados do Motoboy & Rastreio da Entrega
              </span>
              <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                {liveOrder.trackingCode || liveOrder.orderNumber}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {liveOrder.motoboyName && (
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Entregador:</span>
                  <strong className="text-slate-900 dark:text-white">{liveOrder.motoboyName}</strong>
                </div>
              )}
              {liveOrder.motoboyPhone && (
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">WhatsApp do Motoboy:</span>
                  <a
                    href={`https://wa.me/55${liveOrder.motoboyPhone.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-600 dark:text-emerald-400 font-bold underline"
                  >
                    {liveOrder.motoboyPhone}
                  </a>
                </div>
              )}
              {liveOrder.motoboyVehicle && (
                <div className="sm:col-span-2">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Veículo / Placa:</span>
                  <strong className="text-slate-900 dark:text-white font-mono">{liveOrder.motoboyVehicle}</strong>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Photo of Packaged Piece (Mandatory step completed by supplier) */}
        {liveOrder.packagedPhotoUrl && (
          <div className="mt-4">
            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
              Foto da Peça Embalada pelo Fornecedor:
            </span>
            <div className="h-36 rounded-xl overflow-hidden bg-slate-900 border border-slate-200 dark:border-slate-700">
              <img
                src={liveOrder.packagedPhotoUrl}
                alt="Peça Embalada"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        )}

        {/* CIÊNCIA DO CLIENTE ATRAVÉS DE UMA FOTO DA PEÇA RECEBIDA (§10) */}
        <div className="mt-4 p-4 rounded-2xl border-2 border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-emerald-600" />
              <span className="text-xs font-black uppercase tracking-wider text-emerald-900 dark:text-emerald-300">
                Ciência de Recebimento com Foto da Peça (§10)
              </span>
            </div>
            {clientPhoto && (
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                Foto Anexada
              </span>
            )}
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-300">
            Você pode ditar o PIN de 4 dígitos ao entregador no recebimento <strong>OU</strong> tirar uma foto da peça entregue diretamente aqui no app — ambas as formas confirmam a entrega com segurança e liberam a conclusão do pedido.
          </p>

          {clientPhoto ? (
            <div className="relative h-40 rounded-xl overflow-hidden border-2 border-emerald-500 shadow-sm bg-slate-950">
              <img
                src={clientPhoto}
                alt="Foto da peça recebida"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <span className="absolute bottom-2 left-2 text-[10px] bg-black/80 text-white font-bold px-2 py-0.5 rounded">
                Foto de Ciência do Cliente
              </span>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <label className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md transition active:scale-95">
                <Camera className="w-4 h-4" />
                <span>Tirar Foto da Peça Recebida</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = ev => {
                        if (ev.target?.result) {
                          handleAttachClientPhoto(ev.target.result as string);
                        }
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
              </label>

              <label className="px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition active:scale-95">
                <Upload className="w-4 h-4" />
                <span>Anexar da Galeria</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = ev => {
                        if (ev.target?.result) {
                          handleAttachClientPhoto(ev.target.result as string);
                        }
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
              </label>
            </div>
          )}
        </div>

        {/* NF-e Details */}
        {liveOrder.nfeNumber && (
          <div className="mt-4 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs flex items-center justify-between text-slate-600 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-400" />
              <span>NF-e Emitida: <strong>{liveOrder.nfeNumber}</strong></span>
            </div>
            <span className="text-[10px] font-mono text-slate-500 truncate max-w-[180px]">
              {liveOrder.nfeKey}
            </span>
          </div>
        )}

        {/* Evaluation section if delivered */}
        {liveOrder.deliveryStatus === 'entregue' && !liveOrder.customerRatingId && !submittedRating && (
          <form onSubmit={handleRatingSubmit} className="mt-5 p-4 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 space-y-3">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Avaliar Atendimento e Qualidade da Peça
            </h4>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className="p-1 text-amber-500 hover:scale-110 transition"
                >
                  <Star className={`w-6 h-6 ${star <= rating ? 'fill-current' : 'text-slate-300'}`} />
                </button>
              ))}
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 ml-2">
                {rating} de 5 estrelas
              </span>
            </div>
            <input
              type="text"
              placeholder="Deixe um comentário opcional sobre a entrega e a peça..."
              value={comment}
              onChange={e => setComment(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-600"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition"
            >
              Enviar Avaliação
            </button>
          </form>
        )}

        {submittedRating && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            <span>Obrigado! Sua avaliação foi registrada no perfil do fornecedor.</span>
          </div>
        )}
      </div>

      {/* Chat Modal with Supplier & Admin Supervision */}
      {isChatOpen && (
        <OrderChatModal
          currentUser={customer || ({ id: customerId, name: 'Cliente', role: 'cliente' } as User)}
          requestId={liveOrder.requestId}
          orderId={liveOrder.id}
          requestNumber={liveOrder.orderNumber}
          otherPartyName={supplier?.companyName || supplier?.name || 'Fornecedor Credenciado'}
          otherPartyRole="fornecedor"
          otherPartyAvatar={supplier?.avatarUrl}
          onClose={() => setIsChatOpen(false)}
        />
      )}
    </div>
  );
};