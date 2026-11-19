/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Clock,
  Send,
  CheckCircle,
  Truck,
  Package,
  Key,
  Star,
  ArrowRight,
  ArrowLeft,
  Camera,
  AlertTriangle,
  Lock
} from 'lucide-react';
import { soundEffects } from '../../services/sound';

export const SupplierReferenceFlow: React.FC = () => {
  const [screenIndex, setScreenIndex] = useState<number>(0);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinVerified, setPinVerified] = useState(false);

  const screens = [
    { id: 1, title: '1. Receber Solicitação (SPAM 15 min)' },
    { id: 2, title: '2. Enviar Proposta' },
    { id: 3, title: '3. Venda Confirmada' },
    { id: 4, title: '4. Enviar Foto da Peça Embalada' },
    { id: 5, title: '5. Informar Envio (Jadlog)' },
    { id: 6, title: '6. Confirmar Entrega (com PIN)' },
  ];

  return (
    <div className="space-y-4">
      {/* Screen Sequence Selector Bar */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Fluxo do Fornecedor · Modelo da Imagem de Referência
          </span>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            {screens[screenIndex].title}
          </h2>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setScreenIndex(prev => Math.max(0, prev - 1))}
            disabled={screenIndex === 0}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-slate-100 transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono font-bold text-slate-500">
            {screenIndex + 1} / {screens.length}
          </span>
          <button
            onClick={() => setScreenIndex(prev => Math.min(screens.length - 1, prev + 1))}
            disabled={screenIndex === screens.length - 1}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-slate-100 transition"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* SCREEN 1: Receber Solicitação (SPAM Urgente!) */}
      {screenIndex === 0 && (
        <div className="space-y-3 animate-in fade-in">
          {/* URGENT RED SPAM BANNER MATCHING POSTER */}
          <div className="p-4 rounded-2xl bg-red-600 text-white shadow-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-black tracking-wider uppercase">
                NOVA OPORTUNIDADE!
              </span>
              <span className="font-mono text-xs font-bold bg-white/20 px-2 py-0.5 rounded">
                Nº 45872
              </span>
            </div>

            <div>
              <h3 className="text-base font-bold text-white">
                Amortecedor Dianteiro
              </h3>
              <span className="text-xs text-white/90 block">
                Toyota Corolla - 2018
              </span>
            </div>

            <div className="h-28 rounded-lg overflow-hidden bg-slate-900">
              <img
                src="/src/assets/images/compe_hero_autoparts_1793928394704.jpg"
                alt="Amortecedor"
                className="w-full h-full object-cover"
              />
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <span>Distância: <strong>4.8 km reais (CEP oculto)</strong></span>
              <div className="bg-red-950 px-2.5 py-1 rounded-lg font-mono font-black text-red-200 text-xs">
                Responder em: 14:35
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={() => {
                  soundEffects.playUrgentAlarm();
                  setScreenIndex(1);
                }}
                className="py-2.5 px-3 rounded-xl bg-white text-red-600 font-black text-xs hover:bg-red-50 transition uppercase"
              >
                Enviar Orçamento
              </button>
              <button
                onClick={() => alert('Solicitação recusada pelo fornecedor.')}
                className="py-2.5 px-3 rounded-xl bg-red-800 text-white font-bold text-xs hover:bg-red-900 transition uppercase"
              >
                Recusar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SCREEN 2: Enviar Proposta */}
      {screenIndex === 1 && (
        <div className="space-y-3.5 animate-in fade-in">
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
            Enviar Proposta
          </h3>

          <div className="space-y-2.5 text-xs">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Peça (R$)
              </label>
              <input
                type="text"
                readOnly
                value="320,00"
                className="w-full px-3 py-2 font-mono font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Entrega (R$)
              </label>
              <input
                type="text"
                readOnly
                value="0,00"
                className="w-full px-3 py-2 font-mono font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Prazo
                </label>
                <input
                  type="text"
                  readOnly
                  value="1 dia útil"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Garantia
                </label>
                <input
                  type="text"
                  readOnly
                  value="6 meses"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
            </div>

            {/* Photo Attachment Thumbnail */}
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Foto da Peça Anexada
              </label>
              <div className="h-20 rounded-xl overflow-hidden bg-slate-900 border border-slate-300 dark:border-slate-700">
                <img
                  src="/src/assets/images/compe_hero_autoparts_1793928394704.jpg"
                  alt="Peça"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              soundEffects.playCashSuccess();
              setScreenIndex(2);
            }}
            className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs shadow-md transition"
          >
            Enviar Proposta
          </button>
        </div>
      )}

      {/* SCREEN 3: Venda Confirmada (SPAM Verde) */}
      {screenIndex === 2 && (
        <div className="p-6 text-center space-y-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md animate-in fade-in">
          <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 mx-auto">
            <CheckCircle className="w-9 h-9" />
          </div>

          <div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white">
              Parabéns! Você vendeu!
            </h3>
            <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 block mt-0.5">
              Pedido #45872
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Valor da Peça:</span>
              <strong className="text-slate-900 dark:text-white font-mono">R$ 320,00</strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Taxa AUTO SHOP (10%):</span>
              <span className="text-slate-600 font-mono">R$ 32,00</span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-slate-700 font-bold">
              <span className="text-slate-700 dark:text-slate-300">Seu Repasse Líquido:</span>
              <span className="text-emerald-600 font-mono text-sm font-black">R$ 288,00</span>
            </div>
          </div>

          <button
            onClick={() => setScreenIndex(3)}
            className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs shadow-md uppercase transition"
          >
            Confirmar e Separar
          </button>
        </div>
      )}

      {/* SCREEN 4: Enviar Foto da Peça */}
      {screenIndex === 3 && (
        <div className="space-y-4 animate-in fade-in">
          <div className="text-center">
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              Foto da Peça Enviada!
            </h3>
            <span className="text-xs text-slate-500">
              A peça foi embalada e fotografada na caixa.
            </span>
          </div>

          <div className="h-44 rounded-2xl overflow-hidden bg-slate-900 border border-slate-300 dark:border-slate-700 shadow-sm">
            <img
              src="/src/assets/images/compe_delivery_van_1793928395506.jpg"
              alt="Peça na caixa"
              className="w-full h-full object-cover"
            />
          </div>

          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Cliente já pode visualizar a embalagem no app.</span>
          </div>

          <button
            onClick={() => setScreenIndex(4)}
            className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs shadow-md transition"
          >
            Prosseguir para Envio (Informar Rastreio)
          </button>
        </div>
      )}

      {/* SCREEN 5: Informar Envio */}
      {screenIndex === 4 && (
        <div className="space-y-4 animate-in fade-in">
          <div>
            <span className="text-[10px] font-bold text-blue-600 uppercase block">Logística Jadlog</span>
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              Pedido em Trânsito
            </h3>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Transportadora:</span>
              <strong className="text-slate-900 dark:text-white">Jadlog</strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Código de Rastreamento:</span>
              <strong className="font-mono text-blue-600 dark:text-blue-400">123456789</strong>
            </div>
          </div>

          <div className="h-32 rounded-xl overflow-hidden bg-slate-900 border border-slate-300 dark:border-slate-700">
            <img
              src="/src/assets/images/compe_delivery_van_1793928395506.jpg"
              alt="Etiqueta e despacho"
              className="w-full h-full object-cover"
            />
          </div>

          <button
            onClick={() => setScreenIndex(5)}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md uppercase transition"
          >
            Atualizar Status / Ir para Entrega
          </button>
        </div>
      )}

      {/* SCREEN 6: Confirmar Entrega (Validar PIN) */}
      {screenIndex === 5 && (
        <div className="p-5 text-center space-y-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md animate-in fade-in">
          <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 mx-auto">
            <CheckCircle className="w-9 h-9" />
          </div>

          <div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white">
              Pedido Entregue!
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Cliente confirmou o recebimento fornecendo o PIN de 4 dígitos.
            </p>
          </div>

          {/* PIN Input verification simulation */}
          {!pinVerified ? (
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs space-y-2 text-left">
              <label className="block font-bold text-slate-700 dark:text-slate-300">
                Digite o PIN de 4 dígitos do cliente (Ex: 4872):
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={4}
                  placeholder="0000"
                  value={enteredPin}
                  onChange={e => setEnteredPin(e.target.value)}
                  className="flex-1 text-center font-mono font-black text-lg py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (enteredPin === '4872' || enteredPin.length === 4) {
                      soundEffects.playCashSuccess();
                      setPinVerified(true);
                    } else {
                      alert('PIN incorreto! Dica: O PIN é 4872');
                    }
                  }}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white font-bold text-xs"
                >
                  Validar
                </button>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-emerald-50 text-emerald-800 font-bold text-xs border border-emerald-200">
              ✓ PIN 4872 Validado! Repasse de R$ 288,00 liberado na carteira.
            </div>
          )}

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="text-xs text-slate-500 font-semibold block mb-1.5">
              Avaliar Cliente:
            </span>
            <div className="flex justify-center text-amber-500 gap-1 mb-3">
              {[1, 2, 3, 4, 5].map(i => (
                <Star key={i} className="w-6 h-6 fill-current cursor-pointer hover:scale-110 transition" />
              ))}
            </div>

            <button
              onClick={() => {
                alert('Pedido #45872 encerrado com sucesso! Saldo adicionado aos repasses liberados.');
                setScreenIndex(0);
              }}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs shadow-md uppercase transition"
            >
              Encerrar Pedido
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
