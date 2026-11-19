/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Car,
  Bike,
  Truck,
  Hourglass,
  CheckCircle,
  ShieldCheck,
  CreditCard,
  QrCode,
  MapPin,
  Camera,
  Star,
  ChevronRight,
  ArrowRight,
  ArrowLeft,
  Key,
  Lock,
  Package
} from 'lucide-react';
import { soundEffects } from '../../services/sound';

export const ClientReferenceFlow: React.FC = () => {
  const [screenIndex, setScreenIndex] = useState<number>(0);
  const [acceptedTerms, setAcceptedTerms] = useState(true);
  const [paymentDone, setPaymentDone] = useState(false);
  const [clientPin, setClientPin] = useState('4872');

  const screens = [
    { id: 1, title: '1. Solicitar Peça' },
    { id: 2, title: '2. Aguardando Orçamentos' },
    { id: 3, title: '3. Lista das 5 Melhores Ofertas' },
    { id: 4, title: '4. Visualizar a Peça Antes de Pagar' },
    { id: 5, title: '5. Pagamento Seguro' },
    { id: 6, title: '6. Acompanhar Entrega (com PIN)' },
    { id: 7, title: '7. Confirmar Chegada da Peça' },
  ];

  return (
    <div className="space-y-4">
      {/* Screen Sequence Selector Bar */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            Fluxo do Cliente · Modelo da Imagem de Referência
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

      {/* RENDER CURRENT MOBILE SCREEN ACCORDING TO REFERENCE IMAGE */}

      {/* SCREEN 1: Solicitar Peça */}
      {screenIndex === 0 && (
        <div className="space-y-4 animate-in fade-in">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Qual peça você precisa?
            </h3>
            {/* 3 Quick Buttons */}
            <div className="grid grid-cols-3 gap-2 mt-2">
              <button className="p-3 rounded-xl border border-blue-600 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 flex flex-col items-center gap-1 text-xs font-bold">
                <Car className="w-5 h-5 text-blue-600" />
                <span>Carro</span>
              </button>
              <button className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 flex flex-col items-center gap-1 text-xs font-semibold">
                <Bike className="w-5 h-5" />
                <span>Moto</span>
              </button>
              <button className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 flex flex-col items-center gap-1 text-xs font-semibold">
                <Truck className="w-5 h-5" />
                <span>Caminhão</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Descrição da peça
            </label>
            <input
              type="text"
              readOnly
              value="Amortecedor dianteiro"
              className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          {/* Photo Preview & Upload Box */}
          <div className="p-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 text-center space-y-2">
            <div className="h-28 w-full rounded-lg overflow-hidden bg-slate-900 mx-auto">
              <img
                src="/src/assets/images/compe_hero_autoparts_1793928394704.jpg"
                alt="Amortecedor"
                className="w-full h-full object-cover"
              />
            </div>
            <button className="w-full py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1.5">
              <Camera className="w-3.5 h-3.5 text-blue-600" />
              <span>Enviar Foto ou Vídeo</span>
            </button>
          </div>

          <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs">
            <span className="text-slate-500 block">Veículo Selecionado:</span>
            <strong className="text-slate-900 dark:text-white">Toyota Corolla | Ano: 2018 / 2015</strong>
          </div>

          <button
            onClick={() => setScreenIndex(1)}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase shadow-md flex items-center justify-center gap-2 transition"
          >
            <span>Enviar Solicitação</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* SCREEN 2: Aguardando Orçamentos */}
      {screenIndex === 1 && (
        <div className="p-6 text-center space-y-5 animate-in fade-in">
          <div className="w-16 h-16 mx-auto rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center text-blue-600 animate-pulse">
            <Hourglass className="w-8 h-8" />
          </div>

          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              Sua solicitação foi enviada!
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Estamos buscando os melhores preços entre dezenas de lojas e desmanches credenciados.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <span className="text-[10px] text-slate-500 font-bold uppercase block">Número da Solicitação</span>
            <span className="text-2xl font-mono font-black text-blue-600 dark:text-blue-400">
              Nº Pedido #45872
            </span>
          </div>

          {/* Animated Progress Bar */}
          <div className="space-y-1.5">
            <div className="h-2 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-blue-600 animate-[pulse_1.5s_infinite] w-4/5 rounded-full" />
            </div>
            <span className="text-[11px] font-bold text-slate-500">
              Aguardando propostas...
            </span>
          </div>

          <button
            onClick={() => {
              soundEffects.playDeliveryChime();
              setScreenIndex(2);
            }}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition"
          >
            Ver as 5 Ofertas Recebidas →
          </button>
        </div>
      )}

      {/* SCREEN 3: Lista das 5 Melhores Ofertas */}
      {screenIndex === 2 && (
        <div className="space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
              Melhores Ofertas (Top 5)
            </h3>
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
              Menor valor total
            </span>
          </div>

          <div className="space-y-2">
            {[
              { rank: 1, price: 'R$ 320,00', delivery: 'Entrega: 1 dia', highlight: true },
              { rank: 2, price: 'R$ 340,00', delivery: 'Entrega: 1 dia', highlight: false },
              { rank: 3, price: 'R$ 350,00', delivery: 'Entrega: 2 dias', highlight: false },
              { rank: 4, price: 'R$ 360,00', delivery: 'Entrega: 1 dia', highlight: false },
              { rank: 5, price: 'R$ 390,00', delivery: 'Entrega: 2 dias', highlight: false },
            ].map(item => (
              <div
                key={item.rank}
                onClick={() => setScreenIndex(3)}
                className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                  item.highlight
                    ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 hover:border-blue-500'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                    item.highlight ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {item.rank}
                  </div>
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-900 shrink-0">
                    <img
                      src="/src/assets/images/compe_hero_autoparts_1793928394704.jpg"
                      alt="Amortecedor"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <strong className="text-xs font-mono font-black text-slate-900 dark:text-white block">
                      {item.price}
                    </strong>
                    <span className="text-[10px] text-slate-500">{item.delivery}</span>
                  </div>
                </div>

                <ChevronRight className="w-4 h-4 text-slate-400" />
              </div>
            ))}
          </div>

          <button
            onClick={() => setScreenIndex(3)}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs shadow-md uppercase transition"
          >
            Comprar Esta Peça (R$ 320,00)
          </button>
        </div>
      )}

      {/* SCREEN 4: Visualizar a Peça Antes de Pagar */}
      {screenIndex === 3 && (
        <div className="space-y-4 animate-in fade-in">
          {/* Main Photo */}
          <div className="h-44 rounded-2xl overflow-hidden bg-slate-900 border border-slate-200 dark:border-slate-800 relative">
            <img
              src="/src/assets/images/compe_hero_autoparts_1793928394704.jpg"
              alt="Amortecedor dianteiro"
              className="w-full h-full object-cover"
            />
            <span className="absolute top-2 right-2 bg-black/75 text-white text-[10px] font-bold px-2 py-0.5 rounded">
              Garantia 6 meses
            </span>
          </div>

          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              Amortecedor Dianteiro
            </h3>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                R$ 320,00
              </span>
              <span className="text-xs font-semibold text-slate-500">
                + R$ 0,00 entrega
              </span>
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-300 mt-2 space-y-1">
              <div>✓ Garantia: <strong>6 meses com certificado</strong></div>
              <div>✓ Entrega Expressa: <strong>1 dia útil</strong></div>
              <div>✓ Compatibilidade: <strong>Toyota Corolla 2018 / 2015</strong></div>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 dark:text-slate-300 pt-2 border-t border-slate-100 dark:border-slate-800">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={e => setAcceptedTerms(e.target.checked)}
              className="rounded text-blue-600"
            />
            <span>Li e aceito os termos e políticas de garantia AUTO SHOP</span>
          </label>

          <button
            onClick={() => setScreenIndex(4)}
            disabled={!acceptedTerms}
            className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-sm shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition"
          >
            <Lock className="w-4 h-4" />
            <span>Pagar Agora</span>
          </button>
        </div>
      )}

      {/* SCREEN 5: Pagamento na Plataforma */}
      {screenIndex === 4 && (
        <div className="space-y-4 animate-in fade-in">
          <div className="text-center pb-2">
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 mx-auto mb-1">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              Pagamento Seguro
            </h3>
            <span className="text-xs text-slate-500">
              Gateway integrado com split de repasse protegido
            </span>
          </div>

          <div className="space-y-2">
            <label className="p-3 rounded-xl border border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/40 flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-2.5">
                <input type="radio" name="pay" defaultChecked className="text-emerald-600" />
                <span className="text-xs font-bold text-slate-900 dark:text-white">+ PIX (Aprovação Imediata)</span>
              </div>
              <QrCode className="w-4 h-4 text-emerald-600" />
            </label>

            <label className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between cursor-pointer text-xs">
              <div className="flex items-center gap-2.5">
                <input type="radio" name="pay" className="text-blue-600" />
                <span className="font-semibold text-slate-700 dark:text-slate-300">Cartão de Crédito</span>
              </div>
              <CreditCard className="w-4 h-4 text-slate-400" />
            </label>

            <label className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between cursor-pointer text-xs">
              <div className="flex items-center gap-2.5">
                <input type="radio" name="pay" className="text-blue-600" />
                <span className="font-semibold text-slate-700 dark:text-slate-300">Cartão de Débito</span>
              </div>
              <CreditCard className="w-4 h-4 text-slate-400" />
            </label>

            <label className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between cursor-pointer text-xs">
              <div className="flex items-center gap-2.5">
                <input type="radio" name="pay" className="text-blue-600" />
                <span className="font-semibold text-slate-700 dark:text-slate-300">Carteira Digital</span>
              </div>
              <Lock className="w-4 h-4 text-slate-400" />
            </label>
          </div>

          <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-between text-xs">
            <span className="font-bold text-slate-700 dark:text-slate-300 uppercase">Total:</span>
            <span className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400">
              R$ 320,00
            </span>
          </div>

          <button
            onClick={() => {
              soundEffects.playCashSuccess();
              setPaymentDone(true);
              setScreenIndex(5);
            }}
            className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-sm shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition"
          >
            <span>Confirmar Pagamento</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <span className="text-[10px] text-slate-400 text-center block">
            🔒 Seguro e Protegido pelo Protocolo de Pagamentos AUTO SHOP
          </span>
        </div>
      )}

      {/* SCREEN 6: Acompanhar Entrega */}
      {screenIndex === 5 && (
        <div className="space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase block">Rastreamento do Pedido</span>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Meu Pedido #45872
              </h3>
            </div>
            <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
              Jadlog 123456789
            </span>
          </div>

          {/* Timeline */}
          <div className="space-y-3 p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
            <div className="flex items-center gap-2 text-emerald-600 font-semibold">
              <CheckCircle className="w-4 h-4" />
              <span>Compra Confirmada (12/09 às 15:20)</span>
            </div>
            <div className="flex items-center gap-2 text-emerald-600 font-semibold">
              <CheckCircle className="w-4 h-4" />
              <span>Peça Separada (12/09 às 16:10)</span>
            </div>
            <div className="flex items-center gap-2 text-blue-600 font-bold animate-pulse">
              <Truck className="w-4 h-4" />
              <span>A Caminho (12/09 às 17:00)</span>
            </div>
            <div className="flex items-center gap-2 text-slate-400 font-normal">
              <span className="w-4 h-4 rounded-full border border-slate-300 inline-block" />
              <span>Entregue (Aguardando digitação do PIN)</span>
            </div>
          </div>

          {/* MAP ILLUSTRATION WITH TRUCK */}
          <div className="relative h-32 rounded-xl overflow-hidden bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-white">
            <img
              src="/src/assets/images/compe_delivery_van_1793928395506.jpg"
              alt="Caminhão a caminho"
              className="w-full h-full object-cover opacity-60"
            />
            <div className="absolute inset-0 bg-blue-950/40 backdrop-blur-xs flex flex-col items-center justify-center p-2 text-center">
              <Truck className="w-8 h-8 text-amber-300 animate-bounce mb-1" />
              <span className="text-xs font-black">Entrega Expressa em Trânsito</span>
              <span className="text-[10px] text-slate-300">Entregador a 15 minutos do destino</span>
            </div>
          </div>

          {/* CRITICAL PIN DISPLAY */}
          <div className="p-3.5 rounded-xl bg-slate-900 text-white flex items-center justify-between">
            <div>
              <span className="text-[10px] text-amber-300 font-bold uppercase block">
                PIN de Recebimento
              </span>
              <span className="text-xs text-slate-300">Dite ao entregador:</span>
            </div>
            <div className="font-mono text-2xl font-black text-amber-300 tracking-[0.25em] bg-white/10 px-3 py-1 rounded-lg">
              {clientPin}
            </div>
          </div>

          <button
            onClick={() => setScreenIndex(6)}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase shadow-md flex items-center justify-center gap-2"
          >
            <span>Ver no Mapa / Confirmar Recebimento</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* SCREEN 7: Confirmação da Chegada da Peça */}
      {screenIndex === 6 && (
        <div className="space-y-4 animate-in fade-in">
          <div className="text-center pb-2">
            <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center text-blue-600 mx-auto mb-1">
              <Camera className="w-6 h-6" />
            </div>
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              Confirmar Entrega
            </h3>
            <p className="text-xs text-slate-500">
              Tire uma foto da peça recebida para arquivar no histórico seguro.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-center space-y-2 bg-slate-50 dark:bg-slate-800">
            <Camera className="w-8 h-8 text-slate-400 mx-auto" />
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 block">
              Foto da Peça Entregue em Mãos
            </span>
            <button className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold shadow-sm">
              Tirar Foto / Enviar Foto
            </button>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>PIN validado! Pedido encerrado com sucesso. Histórico salvo para ambas as partes.</span>
          </div>

          <button
            onClick={() => setScreenIndex(0)}
            className="w-full py-3 rounded-xl bg-slate-900 text-white text-xs font-bold"
          >
            Voltar ao Início do Fluxo
          </button>
        </div>
      )}
    </div>
  );
};
