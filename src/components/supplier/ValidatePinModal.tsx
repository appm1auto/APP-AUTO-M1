/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  X,
  Key,
  CheckCircle,
  ShieldCheck,
  Camera,
  Upload,
  Lock
} from 'lucide-react';
import { OrderAndPayment } from '../../types';
import { db } from '../../services/db';
import { soundEffects } from '../../services/sound';

interface ValidatePinModalProps {
  order: OrderAndPayment;
  supplierId: string;
  onSuccess: () => void;
  onClose: () => void;
}

export const ValidatePinModal: React.FC<ValidatePinModalProps> = ({
  order,
  supplierId,
  onSuccess,
  onClose,
}) => {
  const [activeMethod, setActiveMethod] = useState<'pin' | 'foto'>('pin');
  const [pin, setPin] = useState('');
  const [deliveryPhotoUrl, setDeliveryPhotoUrl] = useState<string | null>(order.clientConfirmationPhotoUrl || null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);

  const customer = db.getUserById(order.customerId);

  // Validação pelo PIN digitado pelo entregador
  const handleValidatePin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (pin.trim().length !== 4) {
      setError('O PIN deve conter exatamente 4 dígitos numéricos.');
      return;
    }

    setValidating(true);
    const result = db.validateDeliveryPin(order.id, pin, supplierId);
    setValidating(false);

    if (result.success) {
      soundEffects.playCashSuccess();
      setSuccessMsg(result.message);
      setTimeout(() => {
        onSuccess();
      }, 1200);
    } else {
      soundEffects.playWarningBeep();
      setError(result.message);
    }
  };

  // Baixa alternativa por foto do produto entregue
  const handleConfirmPhoto = (photoDataUrl: string) => {
    setError(null);
    setDeliveryPhotoUrl(photoDataUrl);
    setValidating(true);
    try {
      db.confirmDeliveryByPhoto(order.id, photoDataUrl, supplierId);
      soundEffects.playCashSuccess();
      setSuccessMsg('Entrega confirmada com foto do produto! Repasse financeiro liberado com sucesso.');
      setTimeout(() => {
        onSuccess();
      }, 1200);
    } catch (err: any) {
      setError(err?.message || 'Falha ao confirmar entrega por foto.');
    } finally {
      setValidating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 relative max-h-[92vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Dar Baixa na Entrega do Pedido
            </h3>
            <span className="text-xs text-slate-500 font-mono">
              Pedido {order.orderNumber}
            </span>
          </div>
        </div>

        {/* Delivery Details */}
        <div className="mt-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Peça:</span>
            <strong className="text-slate-900 dark:text-white">{order.partName}</strong>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Cliente:</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {customer?.name} ({customer?.phone})
            </span>
          </div>
          <div className="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-slate-700">
            <span className="text-slate-500">Valor a ser Liberado:</span>
            <strong className="text-emerald-600 dark:text-emerald-400 font-mono text-sm">
              R$ {order.supplierTransferAmount.toFixed(2)}
            </strong>
          </div>
        </div>

        {/* Escolha do Método de Baixa (PIN ou Foto) */}
        <div className="mt-4 grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveMethod('pin')}
            className={`py-2 px-3 rounded-lg text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeMethod === 'pin'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>1. Código PIN</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveMethod('foto')}
            className={`py-2 px-3 rounded-lg text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeMethod === 'foto'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>2. Foto Entrega</span>
          </button>
        </div>

        {/* MÉTODO 1: DIGITAÇÃO DO PIN */}
        {activeMethod === 'pin' && (
          <form onSubmit={handleValidatePin} className="mt-4 space-y-4">
            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 text-xs text-blue-800 dark:text-blue-300 flex items-start gap-2">
              <Lock className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <span>
                Por regra de segurança, o PIN é exclusivo do cliente. Solicite os 4 dígitos ao comprador no ato da entrega para validar e receber seu repasse.
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 text-center">
                Dígitos fornecidos pelo cliente:
              </label>
              <input
                type="text"
                maxLength={4}
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="0000"
                className="w-full text-center tracking-[0.5em] font-mono text-3xl font-black py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                autoFocus
                required
              />
            </div>

            {error && (
              <p className="text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/60 p-2.5 rounded-lg border border-red-200 text-center">
                {error}
              </p>
            )}

            {successMsg && (
              <div className="text-xs font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 p-2.5 rounded-lg border border-emerald-200 text-center flex items-center justify-center gap-1.5 animate-in fade-in">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span>{successMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={validating || pin.length !== 4}
              className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-sm shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition active:scale-98 cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{validating ? 'Validando PIN...' : 'Confirmar PIN e Liberar Repasse'}</span>
            </button>
          </form>
        )}

        {/* MÉTODO 2: COMPROVANTE POR FOTO DO PRODUTO ENTREGUE */}
        {activeMethod === 'foto' && (
          <div className="mt-4 space-y-4">
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-xs text-emerald-900 dark:text-emerald-300">
              Caso o cliente prefira ou não esteja com o celular no momento, tire uma foto da peça entregue no local para dar baixa e liberar o pagamento.
            </div>

            {deliveryPhotoUrl ? (
              <div className="space-y-3">
                <div className="relative h-44 rounded-xl overflow-hidden border-2 border-emerald-500 bg-black">
                  <img
                    src={deliveryPhotoUrl}
                    alt="Comprovante de Entrega"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <span className="absolute bottom-2 left-2 text-[10px] bg-emerald-600 text-white font-black px-2 py-0.5 rounded">
                    ✓ Foto do Produto Entregue
                  </span>
                </div>

                {successMsg && (
                  <div className="text-xs font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 p-2.5 rounded-lg border border-emerald-200 text-center flex items-center justify-center gap-1.5">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span>{successMsg}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-col gap-2.5">
                  <label className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md flex items-center justify-center gap-2 cursor-pointer transition active:scale-95">
                    <Camera className="w-4 h-4" />
                    <span>Tirar Foto da Peça no Local</span>
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
                              handleConfirmPhoto(ev.target.result as string);
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>

                  <label className="w-full py-3 px-4 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition active:scale-95">
                    <Upload className="w-4 h-4" />
                    <span>Anexar Foto da Galeria</span>
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
                              handleConfirmPhoto(ev.target.result as string);
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                </div>
              </div>
            )}

            {error && (
              <p className="text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/60 p-2.5 rounded-lg border border-red-200 text-center">
                {error}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
