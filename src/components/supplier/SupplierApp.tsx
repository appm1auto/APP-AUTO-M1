/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Store, DollarSign, Package, Truck, CheckCircle, Clock, Send, Star, Power,
  AlertTriangle, AlertCircle, Lock, Key, XCircle, UserCheck, BookOpen, MapPin, MessageSquare,
  X, Camera, ChevronRight, Check, Tag, Calendar, Wallet, Save, ShieldCheck,
  FileText, Download, Eye, ExternalLink, Film, Link2, Image as ImageIcon
} from 'lucide-react';
import { User, PartRequest, OrderAndPayment, VehicleCategory, PaymentGatewayProvider, UserSharedMaterial } from '../../types';
import { db } from '../../services/db';
import { apiUrl } from '../../services/apiBase';
import { QuoteFormModal } from './QuoteFormModal';
import { PackageShipModal } from './PackageShipModal';
import { ValidatePinModal } from './ValidatePinModal';
import { SupplierReferenceFlow } from './SupplierReferenceFlow';
import { ManufacturerCatalogHub } from '../catalogs/ManufacturerCatalogHub';
import { soundEffects } from '../../services/sound';
import { OrderChatModal } from '../common/OrderChatModal';
import { isSupplierClassifiedAndApproved } from '../../services/rbac';
import { getCurrentDeviceCoordinates } from '../../services/geolocation';

// ============================================================================
// COMPONENTE: MODAL DE SPAM DE OPORTUNIDADE (Layout Vertical Rigoroso)
// ============================================================================
interface OpportunitySpamModalProps {
  request: PartRequest;
  supplierId: string;
  onClose: () => void;
  onSubmit: (quoteData: any) => void | Promise<void>;
}

const OpportunitySpamModal: React.FC<OpportunitySpamModalProps> = ({
  request,
  supplierId,
  onClose,
  onSubmit,
}) => {
  const [selectedParts, setSelectedParts] = useState<Record<string, boolean>>({});
  const [quoteData, setQuoteData] = useState<Record<string, { price: string; brand: string; condition: string }>>({});
  const [deliveryDays, setDeliveryDays] = useState<string>('1');
  const [shippingMethod, setShippingMethod] = useState<string>('retirada');
  const [tax, setTax] = useState<string>('0');
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const hasExpiredRef = useRef(false);
  const alarmPlayedRef = useRef(false);

  // 1. ALARME SONORO IMEDIATO E GARANTIDO (só toca uma vez)
  useEffect(() => {
    if (alarmPlayedRef.current) return;
    alarmPlayedRef.current = true;

    // Toca imediatamente ao abrir
    const playAlarm = async () => {
      try {
        // Método 1: Sistema de som configurado pelo Admin
        await soundEffects.playConfiguredEvent('nova_oportunidade');
      } catch (e) {
        console.warn('Erro no alarme principal:', e);
      }

      // Método 2: Fallback Web Audio API (garantia total)
      try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContext) {
          const ctx = new AudioContext();
          const oscillator = ctx.createOscillator();
          const gainNode = ctx.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(ctx.destination);
          
          // Alarme urgente: 3 beeps rápidos
          oscillator.type = 'square';
          oscillator.frequency.setValueAtTime(880, ctx.currentTime);
          oscillator.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
          oscillator.frequency.setValueAtTime(880, ctx.currentTime + 0.2);
          oscillator.frequency.setValueAtTime(1100, ctx.currentTime + 0.3);
          
          gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
          
          oscillator.start(ctx.currentTime);
          oscillator.stop(ctx.currentTime + 0.5);
        }
      } catch (err) {
        console.warn('Falha no fallback de áudio:', err);
      }
    };

    playAlarm();
    db.hydrateRealDistanceForPair(supplierId, request.id);
    
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [supplierId, request.id]);

  // 2. TIMER DE CONTAGEM REGRESSIVA ÚNICA (NUNCA RETROCEDE)
  const timeRemaining = useMemo(() => {
    if (!request.expiresAt) return { minutes: 15, seconds: 0, expired: false };
    const diff = new Date(request.expiresAt).getTime() - currentTime;
    if (diff <= 0) return { minutes: 0, seconds: 0, expired: true };
    return {
      minutes: Math.floor(diff / 60000),
      seconds: Math.floor((diff % 60000) / 1000),
      expired: false
    };
  }, [currentTime, request.expiresAt]);

  const isUrgent = timeRemaining.minutes < 5;

  // 3. AUTO-FECHAMENTO AO ZERAR (Some da tela definitivamente)
  useEffect(() => {
    if (timeRemaining.expired && !hasExpiredRef.current) {
      hasExpiredRef.current = true;
      db.rejectSupplierRequest(supplierId, request.id);
      onClose();
    }
  }, [timeRemaining.expired, onClose, supplierId, request.id]);

  // Parsear peças
  const parseRequestedParts = () => {
    if (request.description?.includes('===')) {
      return request.description.split('===').map((p) => p.trim()).filter(Boolean);
    }
    if (request.description?.includes('\n')) {
      return request.description.split('\n').map((p) => p.trim()).filter(Boolean);
    }
    return [request.partName];
  };

  const partsList = parseRequestedParts();

  const togglePartSelection = (partKey: string) => {
    setSelectedParts((prev) => ({ ...prev, [partKey]: !prev[partKey] }));
    if (!quoteData[partKey]) {
      setQuoteData((prev) => ({
        ...prev,
        [partKey]: { price: '', brand: '', condition: 'novo' },
      }));
    }
  };

  const updateQuoteData = (partKey: string, field: string, value: string) => {
    setQuoteData((prev) => ({
      ...prev,
      [partKey]: { ...prev[partKey], [field]: value },
    }));
  };

  const parsePriceNumber = (val?: string) => {
    if (!val) return 0;
    const normalized = String(val).replace(',', '.').trim();
    const num = parseFloat(normalized);
    return Number.isFinite(num) && num > 0 ? num : 0;
  };

  const calculateTotal = () => {
    let total = 0;
    Object.keys(selectedParts).forEach((key) => {
      if (selectedParts[key] && quoteData[key]?.price) {
        total += parsePriceNumber(quoteData[key].price);
      }
    });
    total += parsePriceNumber(tax);
    return total;
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    const selectedKeys = Object.keys(selectedParts).filter((key) => selectedParts[key]);
    if (selectedKeys.length === 0) {
      setSelectionError('Selecione pelo menos uma peça que você tem disponível para cotar.');
      return;
    }

    const invalidPartKey = selectedKeys.find((key) => parsePriceNumber(quoteData[key]?.price) <= 0);
    if (invalidPartKey) {
      setSelectionError('Informe um valor válido maior que R$ 0,00 para cada peça selecionada.');
      return;
    }

    setSelectionError(null);
    setIsSubmitting(true);
    try {
      await onSubmit({
        requestId: request.id,
        supplierId,
        quotes: selectedKeys.map((key) => ({
          partKey: key,
          ...quoteData[key],
          price: String(parsePriceNumber(quoteData[key]?.price)),
        })),
        deliveryDays: Math.max(1, parseInt(deliveryDays, 10) || 1),
        shippingMethod,
        tax: parsePriceNumber(tax),
        totalAmount: calculateTotal(),
      });
    } catch (err: any) {
      setSelectionError(err?.message || 'Erro ao encaminhar orçamento ao cliente. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const supplier = db.getUserById(supplierId);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm overflow-y-auto">
      {/* Container com LAYOUT VERTICAL ESTRITO - flex-col sempre */}
      <div className="relative w-full max-w-2xl my-4 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        
        {/* HEADER - shrink-0 para não encolher */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-6 text-white shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-white/20 rounded-xl animate-pulse">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider opacity-90">
                  <span className="bg-white/20 px-2 py-0.5 rounded">Alerta em Tempo Real</span>
                  <span>🔊 AUTO SHOP Spam Visual & Sonoro</span>
                </div>
                <h2 className="text-2xl font-black mt-1">NOVA OPORTUNIDADE DE VENDA!</h2>
                <p className="text-sm mt-1 opacity-90">Um cliente próximo solicitou cotação urgente. Responda antes de expirar!</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl transition cursor-pointer">
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* TIMER DE CONTAGEM REGRESSIVA */}
          <div className="mt-4 bg-black/30 rounded-2xl p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-bold uppercase opacity-90">Tempo Restante:</div>
                <div className="text-[10px] opacity-75">Passado o tempo, o chamado some da sua tela</div>
              </div>
              <div className={`text-4xl font-mono font-black ${isUrgent ? 'text-red-300 animate-pulse' : 'text-white'}`}>
                {String(timeRemaining.minutes).padStart(2, '0')}:{String(timeRemaining.seconds).padStart(2, '0')}
              </div>
            </div>
          </div>
        </div>

        {/* CONTEÚDO SCROLLÁVEL - LAYOUT VERTICAL ESTRITO (flex-col gap-4) */}
        <div className="overflow-y-auto p-6 bg-slate-50 dark:bg-slate-950 flex flex-col gap-4">
          
          {/* CARD 1: IDENTIFICAÇÃO (TOPO) - width-full para ocupar toda largura */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden w-full">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-3 text-white">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                <h3 className="font-black text-sm uppercase tracking-wider">
                  Identificação {partsList.length > 1 ? `(Peças Adicionadas: ${partsList.length})` : ''}
                </h3>
              </div>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs mb-2">
                <span className="text-slate-500">Pedido:</span>
                <span className="font-mono font-bold text-orange-600 bg-orange-50 dark:bg-orange-900/30 px-2 py-1 rounded">
                  {request.requestNumber}
                </span>
              </div>

              {partsList.map((partName, index) => {
                const partKey = `${request.id}-${index}`;
                const isSelected = selectedParts[partKey] || false;
                
                return (
                  <div
                    key={partKey}
                    onClick={() => togglePartSelection(partKey)}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all w-full ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md'
                        : 'border-slate-200 dark:border-slate-800 hover:border-blue-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center mt-0.5 shrink-0 ${
                        isSelected ? 'bg-blue-600 border-blue-600' : 'border-slate-300 dark:border-slate-600'
                      }`}>
                        {isSelected && <Check className="w-4 h-4 text-white" />}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                          {partsList.length > 1 ? `Peça ${index + 1}: ` : ''}{partName}
                        </h4>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 space-y-0.5">
                          <div>Veículo: {request.vehicleBrand} {request.vehicleModel} ({request.vehicleYear})</div>
                          <div>Motor: {request.vehicleEngine}</div>
                          <div>
                            Categoria: <strong className="text-slate-700 dark:text-slate-300">{request.categoryName ? `${request.categoryName} · ` : ''}{request.partSubcategory || request.partCategory}</strong>
                          </div>
                          {request.oemCode && (
                            <div className="font-mono bg-slate-100 dark:bg-slate-800 inline-block px-1.5 py-0.5 rounded mt-1">
                              OEM: {request.oemCode}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* CARD 2: FOTO (MEIO) - width-full */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden w-full">
            <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-4 py-3 text-white">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5" />
                <h3 className="font-black text-sm uppercase tracking-wider">Foto da Peça Solicitada</h3>
              </div>
            </div>
            <div className="p-4">
              {request.mediaUrl ? (
                <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-900">
                  <img src={request.mediaUrl} alt="Peça solicitada" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                </div>
              ) : (
                <div className="aspect-video rounded-xl bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center text-slate-400">
                  <Camera className="w-12 h-12 mb-2 opacity-50" />
                  <span className="text-sm font-medium">Sem foto anexada</span>
                </div>
              )}
            </div>
          </div>

          {/* CARD 3: LOCAL DE ENTREGA (EMBAIXO) - width-full */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden w-full">
            <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-3 text-white">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                <h3 className="font-black text-sm uppercase tracking-wider">Local de Entrega</h3>
              </div>
            </div>
            <div className="p-4 space-y-3">
              <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Truck className="w-5 h-5 text-orange-600 shrink-0" />
                  <div>
                    <span className="text-slate-600 dark:text-slate-400">Distância Real (Sua Loja ↔ Cliente): </span>
                    <span className="font-bold text-orange-700 dark:text-orange-400 font-mono">
                      {(() => {
                        const details = db.getDistanceDetailsSupplierToRequest(supplier, request);
                        if (!details) return 'Calculando distância...';
                        return `${details.distanceKm.toFixed(1)} km reais de você${details.source === 'rota_real' ? (details.durationMin ? ` (Rota ~${details.durationMin} min)` : ' (Rota real)') : ' (GPS/CEP)'}`;
                      })()}
                    </span>
                  </div>
                </div>
                {(request.deliveryAddress?.city || request.deliveryAddress?.neighborhood) && (
                  <div className="flex items-center gap-2 text-xs pl-7 flex-wrap">
                    <span className="text-slate-600 dark:text-slate-400">Região do Cliente:</span>
                    <span className="font-black text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-lg">
                      {request.deliveryAddress.neighborhood ? `Bairro: ${request.deliveryAddress.neighborhood}` : ''}
                      {request.deliveryAddress.neighborhood && request.deliveryAddress.city ? ' · ' : ''}
                      {request.deliveryAddress.city ? `Cidade: ${request.deliveryAddress.city}${request.deliveryAddress.state ? `/${request.deliveryAddress.state}` : ''}` : ''}
                    </span>
                  </div>
                )}
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3 text-xs text-blue-800 dark:text-blue-300">
                <div className="flex items-start gap-2">
                  <Lock className="w-4 h-4 shrink-0 mt-0.5 text-blue-600" />
                  <p>
                    <strong>Sigilo AUTO SHOP:</strong> Você visualiza Distância Real (km), Cidade e Bairro. Rua, número, CEP e dados pessoais do cliente ficam ocultos até o pagamento.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* CARD 4: PREENCHA O ORÇAMENTO (SEMPRE VISÍVEL) - width-full */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden w-full">
            <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-3 text-white">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                <h3 className="font-black text-sm uppercase tracking-wider">Preencha o Orçamento</h3>
              </div>
            </div>

            <div className="p-4 space-y-4">
              {/* Campos dinâmicos APENAS para as peças selecionadas */}
              {Object.keys(selectedParts).filter((key) => selectedParts[key]).length > 0 ? (
                Object.keys(selectedParts)
                  .filter((key) => selectedParts[key])
                  .map((partKey, index) => {
                    const partIndex = parseInt(partKey.split('-')[1]) || 0;
                    const partName = partsList[partIndex] || `Peça ${index + 1}`;
                    const data = quoteData[partKey] || { price: '', brand: '', condition: 'novo' };

                    return (
                      <div key={partKey} className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                        <div className="font-bold text-slate-900 dark:text-white text-sm border-b border-slate-200 dark:border-slate-700 pb-2 flex items-center gap-2">
                          <Check className="w-4 h-4 text-blue-600" />
                          {partName}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Marca/Fabricante *</label>
                            <input
                              type="text"
                              value={data.brand}
                              onChange={(e) => updateQuoteData(partKey, 'brand', e.target.value)}
                              placeholder="Ex: Bosch, Valeo..."
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Condição *</label>
                            <select
                              value={data.condition}
                              onChange={(e) => updateQuoteData(partKey, 'condition', e.target.value)}
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                              <option value="novo">Novo</option>
                              <option value="usado">Usado</option>
                              <option value="recondicionado">Recondicionado</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Valor da Peça (R$) *</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={data.price}
                              onChange={(e) => updateQuoteData(partKey, 'price', e.target.value)}
                              placeholder="0,00"
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })
              ) : (
                <div className="p-8 text-center bg-slate-50 dark:bg-slate-800 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700">
                  <Package className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                    Selecione pelo menos uma peça disponível acima para preencher o orçamento
                  </p>
                </div>
              )}

              {/* Campos Gerais do Orçamento */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                    <Calendar className="w-3 h-3 inline mr-1" /> Tempo de Entrega (dias) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={deliveryDays}
                    onChange={(e) => setDeliveryDays(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                    <Truck className="w-3 h-3 inline mr-1" /> Modo de Envio *
                  </label>
                  <select
                    value={shippingMethod}
                    onChange={(e) => setShippingMethod(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="retirada">Retirada no Local</option>
                    <option value="correios">Correios</option>
                    <option value="transportadora">Transportadora</option>
                    <option value="motoboy">Motoboy</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Taxa de Envio (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={tax}
                    onChange={(e) => setTax(e.target.value)}
                    placeholder="0,00"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              {/* Total Calculado */}
              <div className="bg-emerald-50 dark:bg-emerald-900/20 border-2 border-emerald-300 dark:border-emerald-800 rounded-xl p-4 flex items-center justify-between">
                <span className="text-sm font-bold text-emerald-800 dark:text-emerald-300">Valor Total do Orçamento:</span>
                <span className="text-2xl font-black text-emerald-700 dark:text-emerald-400">
                  R$ {calculateTotal().toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER COM BOTÕES FIXOS - shrink-0 */}
        <div className="p-6 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 space-y-2.5">
          {selectionError && (
            <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-xs font-bold text-red-700 dark:text-red-300">
              {selectionError}
            </div>
          )}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 rounded-xl border-2 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              CANCELAR
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !Object.keys(selectedParts).some((key) => selectedParts[key])}
              className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold text-sm hover:from-blue-700 hover:to-blue-800 transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
            >
              <ChevronRight className="w-5 h-5" />
              {isSubmitting ? 'ENVIANDO ORÇAMENTO...' : 'ENVIAR ORÇAMENTO'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// COMPONENTE PRINCIPAL: SUPPLIER APP
// ============================================================================
interface SupplierAppProps {
  currentUser: User;
  onTriggerOpportunitySpam: (req: PartRequest) => void;
  onTriggerSaleSpam?: (order: OrderAndPayment) => void;
}

export const SupplierApp: React.FC<SupplierAppProps> = ({
  currentUser,
  onTriggerOpportunitySpam,
  onTriggerSaleSpam,
}) => {
  const [activeTab, setActiveTab] = useState<
    'oportunidades' | 'fluxo_referencia' | 'pedidos' | 'cotacoes' | 'financeiro' | 'avaliacoes' | 'catalogos' | 'materiais'
  >('oportunidades');
  const [previewMaterial, setPreviewMaterial] = useState<UserSharedMaterial | null>(null);

  // Modals
  const [quotingRequest, setQuotingRequest] = useState<PartRequest | null>(null);
  const [packagingOrder, setPackagingOrder] = useState<OrderAndPayment | null>(null);
  const [validatingPinOrder, setValidatingPinOrder] = useState<OrderAndPayment | null>(null);
  const [activeChat, setActiveChat] = useState<{
    requestId: string;
    orderId?: string;
    requestNumber: string;
    customerName: string;
    customerAvatar?: string;
  } | null>(null);

  // Estado para controlar o Modal de Spam
  const [spamRequest, setSpamRequest] = useState<PartRequest | null>(null);

  // Sorting
  const [sortOrder, setSortOrder] = useState<'mais_novas' | 'mais_antigas'>('mais_novas');

  // Live clock, GPS capture & DB subscription
  const [currentNow, setCurrentNow] = useState(Date.now());
  const [supplierFeedback, setSupplierFeedback] = useState<string | null>(null);
  const [gpsUpdating, setGpsUpdating] = useState(false);

  // Gateway & Subconta (Split Automático)
  const [subGatewayProvider, setSubGatewayProvider] = useState<PaymentGatewayProvider>(
    currentUser.gatewayProvider || 'asaas'
  );
  const [subGatewayPixKey, setSubGatewayPixKey] = useState<string>(
    currentUser.gatewayPixKey || currentUser.bankAccountOrPix || ''
  );
  const [subGatewayWalletId, setSubGatewayWalletId] = useState<string>(
    currentUser.gatewayWalletId || ''
  );
  const [subBankCode, setSubBankCode] = useState<string>(
    currentUser.gatewayBankInfo?.bankCode || ''
  );
  const [subAgency, setSubAgency] = useState<string>(
    currentUser.gatewayBankInfo?.agency || ''
  );
  const [subAccount, setSubAccount] = useState<string>(
    currentUser.gatewayBankInfo?.account || ''
  );
  const [subSaving, setSubSaving] = useState(false);
  const [subFeedback, setSubFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [, setDbTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setCurrentNow(Date.now()), 1000);
    const unsub = db.subscribe(() => setDbTick(t => t + 1));
    const onQuoteSuccess = (e: any) => {
      const detail = e?.detail;
      const targetSupplierId = detail?.supplierId || detail?.quote?.supplierId;
      if (!detail || targetSupplierId !== currentUser.id) return;
      setSupplierFeedback('Orçamento enviado sem erros! Já aparece na aba Cotações Enviadas aguardando aceite do cliente.');
      setTimeout(() => setSupplierFeedback(null), 6000);
    };
    window.addEventListener('compe:quote_submitted_success', onQuoteSuccess as EventListener);

    // Captura GPS ativo da loja ao abrir painel para cálculo preciso de distância
    getCurrentDeviceCoordinates().then(coords => {
      if (coords) {
        db.updateUserGpsCoordinates(currentUser.id, coords);
      }
    });

    return () => {
      clearInterval(timer);
      unsub();
      window.removeEventListener('compe:quote_submitted_success', onQuoteSuccess as EventListener);
    };
  }, [currentUser.id]);

  const handleRefreshSupplierGps = async () => {
    setGpsUpdating(true);
    const coords = await getCurrentDeviceCoordinates();
    if (coords) {
      db.updateUserGpsCoordinates(currentUser.id, coords);
      setSupplierFeedback(`GPS da loja atualizado (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}). Distâncias recalculadas!`);
    } else {
      setSupplierFeedback('Não foi possível obter GPS do navegador. Verifique a permissão de localização; usando CEP cadastrado.');
    }
    setGpsUpdating(false);
    setTimeout(() => setSupplierFeedback(null), 5000);
  };

  const handleSaveSupplierSubaccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subGatewayPixKey.trim() && !subGatewayWalletId.trim()) {
      setSubFeedback({
        type: 'error',
        text: 'Informe sua chave PIX / conta de recebimento ou um Wallet ID do gateway.',
      });
      return;
    }
    setSubSaving(true);
    setSubFeedback(null);
    try {
      const result = await db.registerSupplierSubaccountRemote(currentUser.id, {
        provider: subGatewayProvider,
        pixKey: subGatewayPixKey.trim() || undefined,
        walletId: subGatewayWalletId.trim() || undefined,
        bankInfo:
          subBankCode.trim() || subAgency.trim() || subAccount.trim()
            ? {
                bankCode: subBankCode.trim() || undefined,
                agency: subAgency.trim() || undefined,
                account: subAccount.trim() || undefined,
              }
            : undefined,
        actorId: currentUser.id,
      });

      if (!result.ok) {
        setSubFeedback({ type: 'error', text: result.message });
      } else {
        if (result.user?.gatewayWalletId) setSubGatewayWalletId(result.user.gatewayWalletId);
        setSubFeedback({
          type: 'success',
          text: `${result.message} Carteira ativa: ${result.user?.gatewayWalletId || subGatewayWalletId}`,
        });
      }
    } catch {
      setSubFeedback({
        type: 'error',
        text: 'Erro de conexão com o servidor ao salvar sua subconta de repasse.',
      });
    } finally {
      setSubSaving(false);
    }
  };

  const isSupplierRole = currentUser.role === 'fornecedor';
  const isApprovedAndClassified = isSupplierClassifiedAndApproved(currentUser);
  const isAvailable = isApprovedAndClassified && (currentUser.isAvailableForOrders ?? true);
  const currentRadius = currentUser.serviceRadiusKm ?? 50;
  const currentTier = currentUser.supplierTier || 'opcao_2';
  const allowedCategories = currentUser.equipmentTypesSupplied || ['carro'];

  // Requests filtrados pelo DB (base)
  const allRequests = isAvailable
    ? db.getRequestsForSupplier(currentUser.id).filter((r) => {
        if (currentTier === 'opcao_3') return true;
        const expIso = r.attemptExpiresAt || r.expiresAt;
        return !expIso || new Date(expIso).getTime() > currentNow;
      })
    : [];

  useEffect(() => {
    allRequests.forEach((r) => {
      db.hydrateRealDistanceForPair(currentUser.id, r.id);
    });
  }, [currentUser.id, allRequests]);

  const sortedRequests = [...allRequests].sort((a, b) => {
    if (sortOrder === 'mais_novas') {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  // Cotações do fornecedor (TODAS as propostas enviadas aparecem imediatamente na aba Cotações Enviadas)
  const myQuotes = db
    .getQuotes()
    .filter((q) => q.supplierId === currentUser.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const myOrders = db.getOrders().filter((o) => o.supplierId === currentUser.id);

  // Financeiro
  const totalGrossSales = myOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const releasedFunds = myOrders
    .filter((o) => o.deliveryStatus === 'entregue')
    .reduce((sum, o) => sum + o.supplierTransferAmount, 0);
  const pendingFunds = myOrders
    .filter((o) => o.deliveryStatus !== 'entregue')
    .reduce((sum, o) => sum + o.supplierTransferAmount, 0);

  const handleToggleAvailability = () => {
    db.setSupplierAvailability(currentUser.id, !isAvailable);
  };

  // ============================================================
  // AUTO-TRIGGER SPAM IMEDIATO COM VALIDAÇÃO ESTREITA
  // ============================================================
  const [autoSpammedIds, setAutoSpammedIds] = useState<Record<string, boolean>>({});
  const lastTriggeredIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isApprovedAndClassified || !isAvailable || spamRequest || quotingRequest) return;

    const existingQuotes = db.getQuotes();
    const validNewRequests = sortedRequests.filter((req) => {
      // 1. Não foi cotado por este fornecedor
      if (existingQuotes.some((q) => q.requestId === req.id && q.supplierId === currentUser.id)) return false;

      // 2. Já foi disparado o spam para esta tentativa deste fornecedor (evita loop)
      const triggerKey = `${req.id}:att${req.searchAttempt || 1}`;
      if (autoSpammedIds[triggerKey] || lastTriggeredIdRef.current === triggerKey) return false;

      // 3. Validação estrita de Perímetro (Raio) definido pelo Admin com base no CEP do Cliente
      if (!db.isSupplierWithinRequestRadius(currentUser, req)) return false;

      // 4. Validação unificada de Categorias, Subcategorias e Equipamentos Habilitados pelo Admin
      if (!db.isSupplierMatchingRequestCategory(currentUser, req)) return false;

      return true;
    });

    if (validNewRequests.length === 0) return;

    // Pega a solicitação mais recente
    const targetReq = validNewRequests[0];
    const targetKey = `${targetReq.id}:att${targetReq.searchAttempt || 1}`;

    // Marca como disparada imediatamente para não repetir
    lastTriggeredIdRef.current = targetKey;
    setAutoSpammedIds((prev) => ({ ...prev, [targetKey]: true }));

    // DISPARA IMEDIATAMENTE: Dispara o SPAM com alarme sonoro
    if (onTriggerOpportunitySpam) {
      onTriggerOpportunitySpam(targetReq);
    } else {
      setSpamRequest(targetReq);
    }
  }, [
    sortedRequests,
    isApprovedAndClassified,
    isAvailable,
    spamRequest,
    quotingRequest,
    currentRadius,
    allowedCategories,
    currentUser,
    autoSpammedIds,
    onTriggerOpportunitySpam
  ]);

  // Handler para enviar o orçamento (persistência atômica no servidor)
  const handleSpamQuoteSubmit = async (quoteData: any) => {
    const firstQuote = quoteData.quotes?.[0];
    const shippingPrice = Number(quoteData.tax) || 0;
    const partPrice = Math.max(0.01, (Number(quoteData.totalAmount) || 0) - shippingPrice);

    await db.submitQuoteRemote(quoteData.supplierId, {
      requestId: quoteData.requestId,
      brand: firstQuote?.brand || 'Original / Paralela',
      condition: (firstQuote?.condition as 'nova' | 'usada' | 'recondicionada') || 'nova',
      partPrice,
      shippingPrice,
      deliveryDays: Number(quoteData.deliveryDays) || 1,
      shippingMethod: quoteData.shippingMethod || 'Motoboy Express',
    });

    setSpamRequest(null);
    setSupplierFeedback('Orçamento enviado sem erros! Já aparece na aba Cotações Enviadas aguardando aceite do cliente.');
    setTimeout(() => setSupplierFeedback(null), 6000);
  };

  if (!isSupplierRole) {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 rounded-3xl bg-white dark:bg-slate-900 border-2 border-red-300 dark:border-red-900 text-center space-y-3 shadow-xl">
        <Lock className="w-12 h-12 text-red-600 mx-auto" />
        <h2 className="text-xl font-black text-slate-900 dark:text-white">Acesso Negado (RBAC)</h2>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          Esta área é restrita exclusivamente ao perfil Fornecedor / Prestador autenticado.
        </p>
      </div>
    );
  }

  if (!isApprovedAndClassified) {
    const isBlocked = currentUser.status === 'bloqueado';
    return (
      <div className="max-w-2xl mx-auto my-8 sm:my-12 p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border-2 border-amber-400 dark:border-amber-700 shadow-2xl space-y-6">
        <div className="flex items-start gap-4">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${
            isBlocked
              ? 'bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400'
              : 'bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400'
          }`}>
            {isBlocked ? <XCircle className="w-8 h-8" /> : <Clock className="w-8 h-8 animate-pulse" />}
          </div>
          <div className="space-y-1">
            <span className={`inline-block text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
              isBlocked
                ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
            }`}>
              {isBlocked ? 'Acesso Bloqueado' : 'Homologação e Classificação Pendente'}
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              {isBlocked
                ? 'Conta de Fornecedor Suspensa'
                : 'Cadastro em Análise pelo Administrador'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              {isBlocked
                ? 'Seu acesso ao Portal do Fornecedor foi suspenso pela administração da AUTO SHOP. Entre em contato com o suporte para mais informações.'
                : 'Seu cadastro comercial foi recebido com sucesso! Por segurança e regras de homologação, o Administrador precisa autorizar e classificar seu perfil (1ª, 2ª ou 3ª Opção e raio de atuação) antes de liberar o painel operacional.'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs">
          <div>
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Loja / Razão Social</span>
            <strong className="text-slate-900 dark:text-white">{currentUser.companyName || currentUser.name}</strong>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Documento (CPF/CNPJ)</span>
            <strong className="font-mono text-slate-900 dark:text-white">{currentUser.document}</strong>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Status de Aprovação</span>
            <strong className={isBlocked ? 'text-red-600' : 'text-amber-600'}>
              {currentUser.status === 'pendente'
                ? 'Aguardando Autorização do Admin'
                : currentUser.status === 'ativo'
                ? 'Aguardando Classificação do Admin'
                : 'Bloqueado'}
            </strong>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Classificação (Tier)</span>
            <strong className="text-slate-700 dark:text-slate-300">
              {currentUser.supplierTier ? currentUser.supplierTier.toUpperCase() : 'Não classificado ainda'}
            </strong>
          </div>
          {currentUser.categoriesSupplied && currentUser.categoriesSupplied.length > 0 && (
            <div className="sm:col-span-2 pt-2 border-t border-slate-200 dark:border-slate-700">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Categorias Selecionadas no Cadastro</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {currentUser.categoriesSupplied.join(', ')}
              </span>
            </div>
          )}
        </div>

        <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 text-xs text-blue-800 dark:text-blue-200 flex items-center gap-2.5">
          <Lock className="w-4 h-4 shrink-0 text-blue-600" />
          <span>
            Enquanto a homologação estiver pendente, o recebimento de chamados, cotações e painel financeiro permanecem bloqueados.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Banner do Fornecedor */}
      <div className="p-5 sm:p-6 rounded-3xl bg-slate-900 text-white border border-slate-800 shadow-xl flex flex-col gap-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
              <Store className="w-7 h-7" />
            </div>
            <div>
              {(() => {
                const assignedModality = currentUser.supplierModalityId
                  ? db.getSupplierModalities().find((m) => m.id === currentUser.supplierModalityId)
                  : undefined;
                const classEscrita = currentUser.supplierClassificationEscrita || assignedModality?.escrita;
                const classCondicao = currentUser.supplierClassificationCondicao || assignedModality?.condicao;
                const classPercent =
                  currentUser.supplierClassificationPercent ??
                  assignedModality?.porcentagem ??
                  currentUser.commissionRateOverride;

                return (
                  <>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className="text-xl sm:text-2xl font-black text-white">
                        {currentUser.companyName || currentUser.name}
                      </h1>
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        Credenciado
                      </span>
                      <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        {classEscrita
                          ? `${classEscrita}${classPercent !== undefined ? ` · ${classPercent}%` : ''}`
                          : currentTier === 'opcao_1'
                          ? '1ª Opção (10 min · até 50km)'
                          : currentTier === 'opcao_2'
                          ? '2ª Opção (15 min · até 100km)'
                          : '3ª Opção (Sem Limite · Brasil Inteiro)'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 flex-wrap">
                      <span>CNPJ: {currentUser.document}</span>
                      <span>·</span>
                      <span className="flex items-center gap-1 text-amber-400 font-bold">
                        <Star className="w-3.5 h-3.5 fill-current" />
                        {currentUser.rating?.toFixed(1) || '5.0'} ({currentUser.totalRatings || 0} avaliações)
                      </span>
                    </div>
                    {(classEscrita || classCondicao || classPercent !== undefined) && (
                      <div className="mt-2 p-2.5 rounded-xl bg-indigo-950/60 border border-indigo-500/40 text-xs space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-black uppercase text-indigo-300">
                            Classificação / Modalidade SPAM:
                          </span>
                          {classEscrita && (
                            <strong className="text-white">{classEscrita}</strong>
                          )}
                          {classPercent !== undefined && (
                            <span className="text-[10px] font-mono font-black px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              {classPercent}%
                            </span>
                          )}
                        </div>
                        {classCondicao && (
                          <p className="text-[11px] text-indigo-100 whitespace-pre-line">
                            <strong>Condição:</strong> {classCondicao}
                          </p>
                        )}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 p-2 rounded-2xl bg-slate-800/80 border border-slate-700/80 text-xs">
              <MapPin className="w-4 h-4 text-blue-400 shrink-0" />
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 font-bold uppercase">
                  Raio de Atuação (CEP {currentUser.address?.cep || 'N/A'}):
                </span>
                <span className="text-white font-bold text-xs flex items-center gap-1.5">
                  <span>{currentRadius === 0 ? 'Sem Limite (Brasil Inteiro)' : `${currentRadius} km`}</span>
                  {currentUser.gpsVerifiedAt && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      ✓ GPS ativo
                    </span>
                  )}
                </span>
              </div>
              <button
                type="button"
                onClick={handleRefreshSupplierGps}
                disabled={gpsUpdating}
                className="ml-1 px-2 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-[10px] font-bold text-white cursor-pointer transition disabled:opacity-50"
                title="Sincronizar GPS real da sua loja"
              >
                {gpsUpdating ? 'GPS...' : 'Atualizar GPS'}
              </button>
            </div>

            <div className="flex items-center gap-3 p-2 rounded-2xl bg-slate-800/80 border border-slate-700/80">
              <div className="text-right">
                <span className="text-xs font-bold block text-white">
                  {isAvailable ? 'Recebimento Ativo' : 'Recebimento Pausado'}
                </span>
                <span className="text-[10px] text-slate-400">
                  {isAvailable ? 'Recebendo SPAMs no raio' : 'Offline para novos chamados'}
                </span>
              </div>

              <button
                onClick={handleToggleAvailability}
                className={`p-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer ${
                  isAvailable
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/30'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                <Power className="w-4 h-4" />
                <span>{isAvailable ? 'Online' : 'Offline'}</span>
              </button>
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs space-y-0.5">
            <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">
              Categorias e Equipamentos Habilitados (definido pelo Admin):
            </span>
            <p className="text-[11px] text-slate-300">
              Você só recebe chamados das categorias abaixo.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {db.getCategories().map((cat) => {
              const isChecked =
                (currentUser.supplierCategoryIds && currentUser.supplierCategoryIds.includes(cat.id)) ||
                (cat.vehicleType ? allowedCategories.includes(cat.vehicleType) : false) ||
                (currentUser.categoriesSupplied ? currentUser.categoriesSupplied.includes(cat.name) : false);
              return (
                <div
                  key={cat.id}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1 border ${
                    isChecked
                      ? 'bg-blue-600 text-white border-blue-500'
                      : 'bg-slate-800 text-slate-500 border-slate-700 opacity-60'
                  }`}
                >
                  <span>{isChecked ? '✓' : '–'}</span>
                  <span>{cat.name}</span>
                </div>
              );
            })}
            {currentUser.subcategoriesSupplied && currentUser.subcategoriesSupplied.length > 0 && (
              <span className="text-[10px] text-emerald-300 bg-emerald-950/60 border border-emerald-700 px-2 py-1 rounded-xl font-bold">
                Subcategorias: {currentUser.subcategoriesSupplied.join(', ')}
              </span>
            )}
          </div>
        </div>
      </div>

      {currentUser.status === 'pendente' && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-400 dark:border-amber-700 text-amber-900 dark:text-amber-200 flex items-center gap-3 shadow-sm">
          <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
          <div className="text-xs space-y-0.5">
            <strong className="block text-sm font-bold text-amber-950 dark:text-amber-100">
              Cadastro Pendente de Autorização
            </strong>
            <p>Seu cadastro está aguardando liberação do Administrador.</p>
          </div>
        </div>
      )}

      {supplierFeedback && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 text-xs font-bold text-emerald-800 dark:text-emerald-200 flex items-center justify-between gap-2 shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{supplierFeedback}</span>
          </div>
          <button type="button" onClick={() => setSupplierFeedback(null)} className="text-emerald-700 hover:underline cursor-pointer">
            Fechar
          </button>
        </div>
      )}

      {(currentUser.adminSharedMaterials?.length || 0) > 0 && activeTab !== 'materiais' && (
        <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-sm">
          <div className="flex items-center gap-2.5 text-xs text-amber-900 dark:text-amber-200">
            <FileText className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Admin compartilhou {currentUser.adminSharedMaterials!.length} item(ns):</strong>{' '}
              Contratos em PDF, mídias, links ou recados disponíveis no seu perfil.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('materiais')}
            className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs cursor-pointer self-start sm:self-auto"
          >
            Visualizar / Baixar Agora
          </button>
        </div>
      )}

      {/* Abas de Navegação */}
      {(() => {
        const customSup = db.getCustomizationSettings();
        const st = customSup.supplierTabs || {};
        const brandColor = customSup.primaryBrandColor || '#2563eb';
        return (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200 dark:border-slate-800">
            {(st.oportunidades?.visible ?? true) && (
              <button
                onClick={() => setActiveTab('oportunidades')}
                className={`px-4 py-2 text-xs font-bold rounded-xl transition whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'oportunidades'
                    ? 'text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                style={activeTab === 'oportunidades' ? { backgroundColor: brandColor } : undefined}
              >
                <span>{st.oportunidades?.label || 'Novas Oportunidades'}</span>
                {allRequests.length > 0 && (
                  <span className="w-5 h-5 rounded-full bg-red-600 text-white text-[10px] font-black flex items-center justify-center animate-pulse">
                    {allRequests.length}
                  </span>
                )}
              </button>
            )}

            {(st.catalogos?.visible ?? true) && (
              <button
                onClick={() => setActiveTab('catalogos')}
                className={`px-4 py-2 text-xs font-bold rounded-xl transition whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'catalogos'
                    ? 'text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                style={activeTab === 'catalogos' ? { backgroundColor: brandColor } : undefined}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>{st.catalogos?.label || 'Catálogos Fabricantes (PDF)'}</span>
              </button>
            )}

            {(st.fluxo_referencia?.visible ?? true) && (
              <button
                onClick={() => setActiveTab('fluxo_referencia')}
                className={`px-4 py-2 text-xs font-bold rounded-xl transition whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'fluxo_referencia'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-emerald-700 bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900'
                }`}
              >
                <span>{st.fluxo_referencia?.label || '📱 6 Telas do Modelo'}</span>
              </button>
            )}

            {(st.pedidos?.visible ?? true) && (
              <button
                onClick={() => setActiveTab('pedidos')}
                className={`px-4 py-2 text-xs font-bold rounded-xl transition whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'pedidos'
                    ? 'text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                style={activeTab === 'pedidos' ? { backgroundColor: brandColor } : undefined}
              >
                <Package className="w-3.5 h-3.5" />
                <span>{st.pedidos?.label || 'Pedidos Recebidos & Expedição'}</span>
                {myOrders.length > 0 && (
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-black flex items-center justify-center">
                    {myOrders.length}
                  </span>
                )}
                {db.getUnreadChatCountForUser(currentUser.id, 'fornecedor') > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-black animate-pulse">
                    {db.getUnreadChatCountForUser(currentUser.id, 'fornecedor')} msg
                  </span>
                )}
              </button>
            )}

            {(st.cotacoes?.visible ?? true) && (
              <button
                onClick={() => setActiveTab('cotacoes')}
                className={`px-4 py-2 text-xs font-bold rounded-xl transition whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'cotacoes'
                    ? 'text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                style={activeTab === 'cotacoes' ? { backgroundColor: brandColor } : undefined}
              >
                {st.cotacoes?.label || 'Cotações Enviadas'} ({myQuotes.length})
              </button>
            )}

            {(st.financeiro?.visible ?? true) && (
              <button
                onClick={() => setActiveTab('financeiro')}
                className={`px-4 py-2 text-xs font-bold rounded-xl transition whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'financeiro'
                    ? 'text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                style={activeTab === 'financeiro' ? { backgroundColor: brandColor } : undefined}
              >
                <DollarSign className="w-3.5 h-3.5" />
                <span>{st.financeiro?.label || 'Financeiro e Repasses'}</span>
              </button>
            )}

            {(st.avaliacoes?.visible ?? true) && (
              <button
                onClick={() => setActiveTab('avaliacoes')}
                className={`px-4 py-2 text-xs font-bold rounded-xl transition whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'avaliacoes'
                    ? 'text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                style={activeTab === 'avaliacoes' ? { backgroundColor: brandColor } : undefined}
              >
                <Star className="w-3.5 h-3.5" />
                <span>{st.avaliacoes?.label || 'Avaliações da Loja'}</span>
              </button>
            )}

            <button
              onClick={() => setActiveTab('materiais')}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'materiais'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 hover:bg-amber-100'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Contratos, Mídias & Recados</span>
              {(currentUser.adminSharedMaterials?.length || 0) > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-amber-600 text-white text-[10px] font-black leading-none">
                  {currentUser.adminSharedMaterials!.length}
                </span>
              )}
            </button>
          </div>
        );
      })()}

      {/* TAB: Catálogos PDF de Fabricantes Adicionados pelo Admin */}
      {activeTab === 'catalogos' && <ManufacturerCatalogHub />}

      {/* TAB: Fluxo de Referência */}
      {activeTab === 'fluxo_referencia' && <SupplierReferenceFlow />}

      {/* TAB: Novas Oportunidades */}
      {activeTab === 'oportunidades' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 flex items-start gap-3">
            <Lock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 dark:text-amber-200">
              <strong>Regra de Sigilo Comercial AUTO SHOP:</strong> Antes do pagamento você visualiza a distância real em km calculada por GPS/CEP exato entre sua loja e o cliente, além da Cidade e do Bairro de destino. Rua, número, CEP e dados pessoais do cliente só são liberados após a confirmação do pagamento.
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Lista de Solicitações Recebidas ({sortedRequests.length})
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Ordenar lista:</span>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as 'mais_novas' | 'mais_antigas')}
                className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
              >
                <option value="mais_novas">Mais Nova Aparece Primeiro</option>
                <option value="mais_antigas">Mais Antiga Aparece Primeiro</option>
              </select>
            </div>
          </div>

          {sortedRequests.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Nenhuma solicitação pendente no seu raio de atuação
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                Quando clientes solicitarem peças compatíveis com suas categorias no seu raio, elas aparecerão aqui automaticamente com alarme.
              </p>
            </div>
          ) : (
            <div className="flex flex-col space-y-4">
              {sortedRequests.map((req) => {
                const alreadyQuoted = myQuotes.some((q) => q.requestId === req.id);
                const diffMs = new Date(req.attemptExpiresAt || req.expiresAt).getTime() - currentNow;
                const minutesLeft = Math.max(0, Math.floor(diffMs / 60000));
                const secondsLeft = Math.max(0, Math.floor((diffMs % 60000) / 1000));
                const isUrgent = minutesLeft < 5;

                return (
                  <div
                    key={req.id}
                    className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow p-5 space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono font-black text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-2.5 py-1 rounded-lg border border-blue-200 dark:border-blue-900">
                          {req.requestNumber}
                        </span>
                        <span className="text-xs font-semibold text-slate-500">
                          {req.vehicleBrand} {req.vehicleModel} ({req.vehicleYear}) - {req.vehicleEngine}
                        </span>
                      </div>

                      <div
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl font-bold font-mono text-xs border shadow-sm ${
                          isUrgent
                            ? 'bg-red-50 dark:bg-red-950/80 text-red-600 dark:text-red-300 border-red-300 dark:border-red-800 animate-pulse'
                            : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                        }`}
                      >
                        <Clock className="w-4 h-4 text-red-600 shrink-0" />
                        <span>
                          Tempo restante: {minutesLeft}:{secondsLeft.toString().padStart(2, '0')}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-2 space-y-2">
                        <h3 className="text-lg font-black text-slate-900 dark:text-white">
                          {req.partName}
                        </h3>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300">
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">
                              Categoria / Subcategoria:
                            </span>
                            <strong>
                              {req.categoryName ? `${req.categoryName} · ` : ''}
                              {req.partSubcategory || req.partCategory}
                            </strong>
                          </div>
                          {req.oemCode && (
                            <div>
                              <span className="text-slate-400 block text-[10px] uppercase font-bold">
                                Código OEM:
                              </span>
                              <strong className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                {req.oemCode}
                              </strong>
                            </div>
                          )}
                          <div className="sm:col-span-2">
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">
                              Local de Entrega (Sigilo até Pagamento):
                            </span>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="text-xs text-emerald-700 dark:text-emerald-300 font-black font-mono bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 rounded-lg flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                {(() => {
                                  const details = db.getDistanceDetailsSupplierToRequest(currentUser, req);
                                  if (!details) return 'Calculando km reais...';
                                  return `${details.distanceKm.toFixed(1)} km reais da sua loja${details.source === 'rota_real' ? (details.durationMin ? ` (~${details.durationMin} min)` : ' · Rota') : ' · GPS/CEP'}`;
                                })()}
                              </span>
                              {(req.deliveryAddress?.neighborhood || req.deliveryAddress?.city) && (
                                <span className="text-xs text-blue-700 dark:text-blue-300 font-bold bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 px-2.5 py-1 rounded-lg">
                                  {[
                                    req.deliveryAddress?.neighborhood,
                                    req.deliveryAddress?.city
                                      ? `${req.deliveryAddress.city}${req.deliveryAddress.state ? `/${req.deliveryAddress.state}` : ''}`
                                      : '',
                                  ]
                                    .filter(Boolean)
                                    .join(' · ')}
                                </span>
                              )}
                              <span className="text-[11px] text-slate-500 flex items-center gap-1">
                                <Lock className="w-3 h-3 text-amber-500" />
                                Rua, número, CEP e cliente ocultos até pagamento
                              </span>
                            </div>
                          </div>
                        </div>

                        {req.description && (
                          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-300 italic">
                            "{req.description}"
                          </div>
                        )}
                      </div>

                      {req.mediaUrl && (
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                            Foto Original da Peça:
                          </span>
                          <div className="h-32 rounded-xl overflow-hidden bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-sm">
                            <img
                              src={req.mediaUrl}
                              alt="Foto da peça"
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-3">
                      <button
                        onClick={() => db.rejectSupplierRequest(currentUser.id, req.id)}
                        className="px-4 py-2.5 rounded-xl border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 bg-red-50/60 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/60 text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>RECUSAR</span>
                      </button>

                      {alreadyQuoted ? (
                        <div className="flex-1 min-w-[200px] py-2.5 px-4 rounded-xl text-xs font-black bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 flex items-center justify-center gap-2 cursor-not-allowed select-none">
                          <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>ORÇAMENTO ENVIADO · AGUARDANDO CLIENTE</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => setQuotingRequest(req)}
                          className="flex-1 min-w-[200px] py-2.5 px-5 rounded-xl text-xs sm:text-sm font-black shadow-md flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          <Send className="w-4 h-4" />
                          <span>ENVIAR ORÇAMENTO</span>
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

      {/* TAB: Catálogos */}
      {activeTab === 'catalogos' && <ManufacturerCatalogHub />}

      {/* TAB: Pedidos */}
      {activeTab === 'pedidos' && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Fluxo de Pedidos Vendidos e Expedição
          </h2>

          {myOrders.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                Nenhum pedido recebido ainda
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {myOrders.map((order) => {
                const customer = db.getUserById(order.customerId);
                const req = db.getRequestById(order.requestId);
                // REGRA ESTRITA: Somente o endereço de entrega com CEP cadastrado na cotação (NUNCA o endereço pessoal do perfil do cliente)
                const deliveryAddress = order.deliveryAddress || req?.deliveryAddress;
                const unreadChat = db.getUnreadChatCountForOrder(currentUser.id, order.requestId, order.id);
                const unreadSac = db.getUnreadChatCountForOrder(currentUser.id, order.requestId, order.id, true);
                const isWaitingReceiptConfirm = order.paymentStatus === 'confirmado' && order.supplierReceiptConfirmed !== true;

                return (
                  <div
                    key={order.id}
                    className={`p-5 rounded-2xl bg-white dark:bg-slate-900 border shadow-sm space-y-4 ${
                      isWaitingReceiptConfirm
                        ? 'border-amber-500 ring-2 ring-amber-400/40'
                        : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    {isWaitingReceiptConfirm && (
                      <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border-2 border-amber-400 dark:border-amber-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-2.5 text-xs">
                          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5 animate-bounce" />
                          <div>
                            <strong className="block font-black text-amber-950 dark:text-amber-200 uppercase">
                              VENDA CONFIRMADA, VERIFIQUE SE O VALOR JÁ ESTÁ NA CONTA!
                            </strong>
                            <span className="text-amber-800 dark:text-amber-300">
                              Verifique se o dinheiro caiu na sua conta e clique em CONFIRMAR para separar e enviar a encomenda.
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {onTriggerSaleSpam && (
                            <button
                              type="button"
                              onClick={() => onTriggerSaleSpam(order)}
                              className="px-3 py-2 rounded-xl border border-amber-500 text-amber-800 dark:text-amber-200 text-xs font-black hover:bg-amber-100 dark:hover:bg-amber-900/50 cursor-pointer"
                            >
                              Ver Aviso
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => db.confirmSupplierSaleReceipt(order.id, currentUser.id)}
                            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md cursor-pointer"
                          >
                            CONFIRMAR
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 gap-2">
                      <div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {order.orderNumber}
                          </span>
                          <span className="text-slate-400">·</span>
                          <span className="text-slate-500">
                            {new Date(order.createdAt).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                          {order.partName}
                        </h3>
                      </div>

                      <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-right">
                        <span className="text-[10px] text-slate-500 uppercase block font-semibold">
                          Seu Repasse Líquido:
                        </span>
                        <strong className="text-base font-mono font-black text-emerald-600 dark:text-emerald-400">
                          R$ {order.supplierTransferAmount.toFixed(2)}
                        </strong>
                      </div>
                    </div>

                    {(order.deliveryStatus === 'compra_confirmada' ||
                      order.deliveryStatus === 'a_caminho' ||
                      order.deliveryStatus === 'entregue') && (
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-2">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">
                            Dados do Comprador & Entrega da Cotação (Liberados após pagamento):
                          </span>
                          <div className="flex items-center gap-2">
                            {unreadSac > 0 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setActiveChat({
                                    requestId: order.requestId,
                                    orderId: order.id,
                                    requestNumber: order.orderNumber,
                                    customerName: customer?.name || 'Cliente AUTO SHOP',
                                    customerAvatar: customer?.avatarUrl,
                                  })
                                }
                                className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs flex items-center gap-1.5 ring-2 ring-amber-300 animate-pulse shadow-lg shadow-red-500/40 cursor-pointer"
                              >
                                <AlertCircle className="w-3.5 h-3.5" />
                                <span>SAC</span>
                                <span className="px-1.5 py-0.5 rounded-full bg-white text-red-700 text-[10px] font-black leading-none">
                                  {unreadSac}
                                </span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() =>
                                setActiveChat({
                                  requestId: order.requestId,
                                  orderId: order.id,
                                  requestNumber: order.orderNumber,
                                  customerName: customer?.name || 'Cliente AUTO SHOP',
                                  customerAvatar: customer?.avatarUrl,
                                })
                              }
                              className={`px-3 py-1.5 rounded-xl text-white font-black text-xs flex items-center gap-1.5 cursor-pointer transition ${
                                unreadChat > 0
                                  ? 'bg-cyan-600 hover:bg-cyan-700 ring-2 ring-cyan-300 animate-pulse shadow-lg shadow-cyan-500/40'
                                  : 'bg-blue-600 hover:bg-blue-700'
                              }`}
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span>Abrir Chat</span>
                              {unreadChat > 0 && (
                                <span className="px-1.5 py-0.5 rounded-full bg-white text-cyan-700 text-[10px] font-black leading-none">
                                  {unreadChat}
                                </span>
                              )}
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-700 shrink-0 flex items-center justify-center">
                            {customer?.avatarUrl ? (
                              <img
                                src={customer.avatarUrl}
                                alt={customer.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <UserCheck className="w-5 h-5 text-blue-600" />
                            )}
                          </div>
                          <div>
                            <strong className="block text-slate-900 dark:text-white font-black text-sm">
                              {customer?.name}
                            </strong>
                            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 mt-0.5">
                              <span>
                                WhatsApp: <strong className="font-mono">{customer?.phone}</strong>
                              </span>
                            </div>
                          </div>
                        </div>

                        {deliveryAddress && (
                          <div className="text-slate-700 dark:text-slate-200 flex items-start gap-1.5 pt-2 border-t border-slate-200 dark:border-slate-700 text-[11px]">
                            <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-black text-blue-700 dark:text-blue-300 mr-1.5 font-mono">
                                CEP: {deliveryAddress.cep || 'N/A'} ·
                              </span>
                              <span className="font-semibold">
                                {deliveryAddress.street}, {deliveryAddress.number}{' '}
                                {deliveryAddress.complement
                                  ? `(${deliveryAddress.complement})`
                                  : ''}{' '}
                                - {deliveryAddress.neighborhood}, {deliveryAddress.city}/
                                {deliveryAddress.state}
                              </span>
                              <span className="block text-[10px] text-slate-400">
                                Endereço cadastrado na cotação da peça
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                      {order.deliveryStatus === 'compra_confirmada' && (
                        isWaitingReceiptConfirm ? (
                          <button
                            type="button"
                            onClick={() => db.confirmSupplierSaleReceipt(order.id, currentUser.id)}
                            className="sm:col-span-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md flex items-center justify-center gap-2 transition cursor-pointer animate-pulse"
                          >
                            <CheckCircle className="w-4 h-4" />
                            <span>CONFIRMAR RECEBIMENTO EM CONTA PARA SEPARAR</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => setPackagingOrder(order)}
                            className="sm:col-span-2 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md flex items-center justify-center gap-2 transition cursor-pointer"
                          >
                            <Package className="w-4 h-4" />
                            <span>Separar Peça e Enviar Foto Embalada</span>
                          </button>
                        )
                      )}

                      {order.deliveryStatus === 'a_caminho' && (
                        <button
                          onClick={() => setValidatingPinOrder(order)}
                          className="sm:col-span-2 py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md flex items-center justify-center gap-2 transition animate-pulse"
                        >
                          <Key className="w-4 h-4" />
                          <span>Confirmar Entrega (Validar PIN)</span>
                        </button>
                      )}

                      {order.deliveryStatus === 'entregue' && (
                        <div className="sm:col-span-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                          <span>Pedido entregue com sucesso! Repasse liberado.</span>
                        </div>
                      )}

                      <button
                        onClick={() => setPackagingOrder(order)}
                        className="py-3 px-3 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                      >
                        Ver Detalhes do Envio
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB: Cotações Enviadas */}
      {activeTab === 'cotacoes' && (() => {
        const allOrders = db.getOrders();
        const awaitingCount = myQuotes.filter((q) => {
          const orderForReq = allOrders.find((o) => o.requestId === q.requestId);
          return q.status === 'pendente' && !orderForReq;
        }).length;

        return (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Suas Cotações Enviadas ({myQuotes.length})
              </h2>
              <span className="px-3 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-xs font-extrabold text-amber-800 dark:text-amber-300 w-fit">
                {awaitingCount} aguardando aceite do cliente
              </span>
            </div>

            {myQuotes.length === 0 ? (
              <div className="p-10 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <Send className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  Nenhuma cotação enviada ainda
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Assim que você responder um chamado em Novas Oportunidades ou no alerta SPAM, sua proposta aparecerá aqui aguardando o aceite do cliente.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {myQuotes.map((q) => {
                  const req = db.getRequestById(q.requestId);
                  const orderForReq = allOrders.find((o) => o.requestId === q.requestId);
                  const isAccepted = q.status === 'aceito' || (orderForReq && orderForReq.supplierId === currentUser.id);
                  const isClosedOther = !isAccepted && (q.status === 'rejeitado' || Boolean(orderForReq));

                  return (
                    <div
                      key={q.id}
                      className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-blue-600">
                            {req?.requestNumber || q.requestId}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Enviada em {new Date(q.createdAt).toLocaleString('pt-BR')}
                          </span>
                        </div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                          {q.brand} · {req?.partName || 'Peça Automotiva'}
                        </h3>
                        <div className="text-slate-500">
                          Condição: <strong className="uppercase">{q.condition}</strong> · Prazo:{' '}
                          {q.deliveryDays} dia(s) · Envio: {q.shippingMethod}
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="text-left sm:text-right">
                          <span className="text-[10px] text-slate-400 block uppercase">
                            Peça R$ {q.partPrice.toFixed(2)} + Frete R$ {q.shippingPrice.toFixed(2)}
                          </span>
                          <strong className="text-base font-mono font-black text-emerald-600">
                            Total: R$ {q.totalPrice.toFixed(2)}
                          </strong>
                        </div>

                        <span
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase text-center ${
                            isAccepted
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : isClosedOther
                              ? 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                          }`}
                        >
                          {isAccepted
                            ? 'ACEITA · CLIENTE APROVOU'
                            : isClosedOther
                            ? 'ENCERRADA · CLIENTE ESCOLHEU OUTRA OFERTA'
                            : 'AGUARDANDO ACEITE DO CLIENTE'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* TAB: Financeiro */}
      {activeTab === 'financeiro' && (() => {
        const mySplits = db.getSplitTransactions().filter(s => s.supplierId === currentUser.id);
        const accStatus = currentUser.gatewayAccountStatus || 'nao_configurada';
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                <span className="text-xs text-slate-500 font-medium">Saldo Liberado (Pós PIN)</span>
                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
                  R$ {releasedFunds.toFixed(2)}
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                <span className="text-xs text-slate-500 font-medium">Saldo Pendente</span>
                <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1 tabular-nums">
                  R$ {pendingFunds.toFixed(2)}
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                <span className="text-xs text-slate-500 font-medium">Faturamento Bruto</span>
                <p className="text-2xl font-black text-slate-900 dark:text-white mt-1 tabular-nums">
                  R$ {totalGrossSales.toFixed(2)}
                </p>
              </div>
            </div>

            {/* Subconta & Carteira Gateway (Split Automático) */}
            <form
              onSubmit={handleSaveSupplierSubaccount}
              className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-900/60 shadow-sm space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 flex items-center justify-center shrink-0">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                      Subconta & Carteira Gateway (Split Automático AUTO SHOP)
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Configure sua chave PIX e carteira recebedora para receber automaticamente o repasse líquido das vendas.
                    </p>
                  </div>
                </div>

                <span
                  className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border self-start sm:self-auto ${
                    accStatus === 'ativa'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : accStatus === 'em_analise'
                      ? 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300'
                      : 'bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {accStatus === 'ativa'
                    ? 'Subconta Ativa'
                    : accStatus === 'em_analise'
                    ? 'Em Análise'
                    : 'Configuração Pendente'}
                </span>
              </div>

              {(currentUser.gatewaySubaccountId || currentUser.gatewayWalletId) && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs font-mono flex flex-wrap items-center justify-between gap-2">
                  <span>
                    Subconta: <strong>{currentUser.gatewaySubaccountId || 'Gerada no vínculo'}</strong>
                  </span>
                  <span className="text-purple-600 dark:text-purple-300">
                    Wallet ID: <strong>{currentUser.gatewayWalletId || 'Pendente'}</strong>
                  </span>
                </div>
              )}

              {subFeedback && (
                <div
                  className={`p-3 rounded-xl text-xs font-bold border ${
                    subFeedback.type === 'success'
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 text-emerald-800 dark:text-emerald-200'
                      : 'bg-red-50 dark:bg-red-950/50 border-red-300 text-red-800 dark:text-red-200'
                  }`}
                >
                  {subFeedback.text}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Gateway Integrado
                  </label>
                  <select
                    value={subGatewayProvider}
                    onChange={e => setSubGatewayProvider(e.target.value as PaymentGatewayProvider)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold outline-none"
                  >
                    <option value="asaas">Asaas (Split via Wallet ID)</option>
                    <option value="mercadopago">Mercado Pago (Collector ID)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Chave PIX ou Conta de Recebimento *
                  </label>
                  <input
                    type="text"
                    value={subGatewayPixKey}
                    onChange={e => setSubGatewayPixKey(e.target.value)}
                    placeholder="CNPJ, e-mail, celular ou chave aleatória"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Wallet ID / Collector ID (Opcional — deixe vazio para criação automática)
                </label>
                <input
                  type="text"
                  value={subGatewayWalletId}
                  onChange={e => setSubGatewayWalletId(e.target.value)}
                  placeholder="Ex: wal_asaas_..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  value={subBankCode}
                  onChange={e => setSubBankCode(e.target.value)}
                  placeholder="Banco (ex: 341)"
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono outline-none"
                />
                <input
                  type="text"
                  value={subAgency}
                  onChange={e => setSubAgency(e.target.value)}
                  placeholder="Agência"
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono outline-none"
                />
                <input
                  type="text"
                  value={subAccount}
                  onChange={e => setSubAccount(e.target.value)}
                  placeholder="Conta c/ dígito"
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={subSaving}
                className="py-2.5 px-5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-black text-xs shadow-md flex items-center gap-2 transition cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{subSaving ? 'Salvando no Gateway...' : 'Salvar / Vincular Subconta no Gateway'}</span>
              </button>
            </form>

            {/* Extrato de Repasses via Split */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Extrato de Repasses via Split ({mySplits.length})</span>
                </h3>
              </div>

              {mySplits.length === 0 ? (
                <p className="text-xs text-slate-500">
                  Nenhum repasse dividido registrado ainda. Quando clientes finalizarem compras com sua loja, o detalhamento aparecerá aqui.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {mySplits.map(sp => (
                    <div
                      key={sp.id}
                      className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <strong className="font-mono text-blue-600 dark:text-blue-400">
                            Pedido {sp.orderNumber}
                          </strong>
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700">
                            {sp.gatewayProvider} · {sp.gatewayChargeId}
                          </span>
                        </div>
                        <span className="text-[11px] font-mono text-slate-500 block">
                          Carteira destino: {sp.supplierWalletId} · {new Date(sp.createdAt).toLocaleString('pt-BR')}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 sm:text-right">
                        <div>
                          <span className="text-[10px] text-slate-400 block">Bruto / Taxa AUTO SHOP</span>
                          <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                            R$ {sp.grossAmount.toFixed(2)} (-R$ {sp.platformAmount.toFixed(2)})
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-emerald-600 font-bold block uppercase">
                            Repasse Líquido ({sp.status})
                          </span>
                          <strong className="text-sm font-mono font-black text-emerald-600 dark:text-emerald-400">
                            R$ {sp.supplierNetAmount.toFixed(2)}
                          </strong>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Solicitar Repasse Manual
              </h3>
              <p className="text-xs text-slate-500">
                Chave PIX / Conta cadastrada: <strong>{currentUser.gatewayPixKey || currentUser.bankAccountOrPix || currentUser.document}</strong>
              </p>
              <button
                onClick={() => {
                  setSupplierFeedback(`Solicitação de repasse de R$ ${releasedFunds.toFixed(2)} registrada com sucesso para sua conta cadastrada!`);
                  setTimeout(() => setSupplierFeedback(null), 5000);
                }}
                disabled={releasedFunds <= 0}
                className="py-3 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs shadow-md transition cursor-pointer"
              >
                Transferir Saldo Liberado (R$ {releasedFunds.toFixed(2)})
              </button>
            </div>
          </div>
        );
      })()}

      {/* TAB: Avaliações */}
      {activeTab === 'avaliacoes' && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-500 font-semibold">Reputação Comercial AUTO SHOP</span>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-3xl font-black text-slate-900 dark:text-white">
                  {currentUser.rating?.toFixed(1) || '5.0'}
                </span>
                <div className="flex text-amber-500">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star key={i} className="w-5 h-5 fill-current" />
                  ))}
                </div>
              </div>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              Baseado em {currentUser.totalRatings || 0} compras concluídas
            </span>
          </div>
        </div>
      )}

      {/* TAB: Contratos, Documentos (PDF), Imagens, Vídeos, Links & Recados do Admin */}
      {activeTab === 'materiais' && (() => {
        const materials = currentUser.adminSharedMaterials || [];
        const resolveMediaSrc = (url?: string) => {
          if (!url) return '';
          if (url.startsWith('/api/')) return apiUrl(url);
          return url;
        };
        const resolveDownloadSrc = (url?: string) => {
          if (!url) return '';
          if (url.startsWith('/api/media/')) {
            return apiUrl(`${url}${url.includes('?') ? '&' : '?'}download=1`);
          }
          return resolveMediaSrc(url);
        };

        return (
          <div className="space-y-4">
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-amber-600" />
                  <span>Contratos, Documentos, Mídias & Recados da Administração</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Contratos em PDF, vídeos, imagens, links, promoções e comunicados enviados diretamente pelo Administrador para sua loja.
                </p>
              </div>
              <span className="px-3 py-1 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-xs font-black self-start sm:self-auto">
                {materials.length} item(ns)
              </span>
            </div>

            {materials.length === 0 ? (
              <div className="p-10 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  Nenhum contrato, arquivo ou recado compartilhado ainda
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Quando o Administrador anexar PDFs, imagens, vídeos, links ou comunicados ao seu perfil, eles aparecerão exatamente aqui.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {materials.map((item) => {
                  const mediaSrc = resolveMediaSrc(item.url);
                  const downloadSrc = resolveDownloadSrc(item.url);
                  return (
                    <div
                      key={item.id}
                      className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between gap-3"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 text-[10px] font-black uppercase">
                            {item.type === 'pdf' && <FileText className="w-3 h-3" />}
                            {item.type === 'image' && <ImageIcon className="w-3 h-3" />}
                            {item.type === 'video' && <Film className="w-3 h-3" />}
                            {item.type === 'link' && <Link2 className="w-3 h-3" />}
                            {item.type === 'text' && <MessageSquare className="w-3 h-3" />}
                            <span>
                              {item.type === 'pdf'
                                ? 'Documento PDF'
                                : item.type === 'image'
                                ? 'Imagem'
                                : item.type === 'video'
                                ? 'Vídeo'
                                : item.type === 'link'
                                ? 'Link'
                                : 'Recado / Promoção'}
                            </span>
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(item.createdAt).toLocaleString('pt-BR')}
                          </span>
                        </div>

                        <h3 className="text-base font-black text-slate-900 dark:text-white">
                          {item.title}
                        </h3>

                        {item.textContent && (
                          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                            {item.textContent}
                          </div>
                        )}

                        {item.type === 'image' && mediaSrc && (
                          <div
                            onClick={() => setPreviewMaterial(item)}
                            className="rounded-xl overflow-hidden bg-slate-950 border border-slate-200 dark:border-slate-800 max-h-60 cursor-pointer"
                          >
                            <img
                              src={mediaSrc}
                              alt={item.title}
                              className="w-full max-h-60 object-contain"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        )}

                        {item.type === 'video' && mediaSrc && (
                          <video
                            src={mediaSrc}
                            controls
                            preload="metadata"
                            className="w-full max-h-64 rounded-xl bg-black border border-slate-200 dark:border-slate-800"
                          />
                        )}

                        {(item.fileName || item.fileSize) && (
                          <div className="text-[11px] font-mono text-slate-500">
                            {item.fileName || 'Arquivo'} {item.fileSize ? `(${item.fileSize})` : ''}
                          </div>
                        )}
                      </div>

                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2">
                        {(item.type === 'pdf' || item.type === 'image') && mediaSrc && (
                          <button
                            type="button"
                            onClick={() => setPreviewMaterial(item)}
                            className="flex-1 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer transition"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>{item.type === 'pdf' ? 'Visualizar PDF' : 'Ampliar Imagem'}</span>
                          </button>
                        )}

                        {item.type === 'link' && item.url && (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black flex items-center justify-center gap-1.5 transition"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Acessar Link</span>
                          </a>
                        )}

                        {(item.type === 'pdf' || item.type === 'image' || item.type === 'video') && downloadSrc && (
                          <a
                            href={downloadSrc}
                            download={item.fileName || `${item.title}.${item.type === 'pdf' ? 'pdf' : item.type === 'image' ? 'png' : 'mp4'}`}
                            className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center justify-center gap-1.5 transition"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Baixar</span>
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* MODAL DE VISUALIZAÇÃO INLINE DE PDF / IMAGEM DO ADMIN */}
      {previewMaterial && previewMaterial.url && (
        <div className="fixed inset-0 z-[105] bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6">
          <div className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white truncate">
                  {previewMaterial.title}
                </h3>
                {previewMaterial.fileName && (
                  <span className="text-[11px] font-mono text-slate-500 block truncate">
                    {previewMaterial.fileName}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={
                    previewMaterial.url.startsWith('/api/media/')
                      ? apiUrl(`${previewMaterial.url}${previewMaterial.url.includes('?') ? '&' : '?'}download=1`)
                      : previewMaterial.url.startsWith('/api/')
                      ? apiUrl(previewMaterial.url)
                      : previewMaterial.url
                  }
                  download={previewMaterial.fileName || previewMaterial.title}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar</span>
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewMaterial(null)}
                  className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto bg-slate-950 flex items-center justify-center min-h-[60vh]">
              {previewMaterial.type === 'pdf' ? (
                <iframe
                  title={previewMaterial.title}
                  src={
                    previewMaterial.url.startsWith('/api/')
                      ? apiUrl(previewMaterial.url)
                      : previewMaterial.url
                  }
                  className="w-full h-[75vh] bg-white"
                />
              ) : (
                <img
                  src={
                    previewMaterial.url.startsWith('/api/')
                      ? apiUrl(previewMaterial.url)
                      : previewMaterial.url
                  }
                  alt={previewMaterial.title}
                  className="max-h-[75vh] max-w-full object-contain"
                  referrerPolicy="no-referrer"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE SPAM DE OPORTUNIDADE */}
      {spamRequest && (
        <OpportunitySpamModal
          request={spamRequest}
          supplierId={currentUser.id}
          onClose={() => setSpamRequest(null)}
          onSubmit={handleSpamQuoteSubmit}
        />
      )}

      {/* OUTROS MODALS */}
      {quotingRequest && (
        <QuoteFormModal
          request={quotingRequest}
          supplierId={currentUser.id}
          onSuccess={() => {
            setQuotingRequest(null);
            setSupplierFeedback('Orçamento enviado sem erros! Já aparece na aba Cotações Enviadas aguardando aceite do cliente.');
            setTimeout(() => setSupplierFeedback(null), 6000);
          }}
          onClose={() => setQuotingRequest(null)}
        />
      )}

      {packagingOrder && (
        <PackageShipModal
          order={packagingOrder}
          supplierId={currentUser.id}
          onSuccess={() => setPackagingOrder(null)}
          onClose={() => setPackagingOrder(null)}
        />
      )}

      {validatingPinOrder && (
        <ValidatePinModal
          order={validatingPinOrder}
          supplierId={currentUser.id}
          onSuccess={() => setValidatingPinOrder(null)}
          onClose={() => setValidatingPinOrder(null)}
        />
      )}

      {activeChat && (
        <OrderChatModal
          currentUser={currentUser}
          requestId={activeChat.requestId}
          orderId={activeChat.orderId}
          requestNumber={activeChat.requestNumber}
          otherPartyName={activeChat.customerName}
          otherPartyRole="cliente"
          otherPartyAvatar={activeChat.customerAvatar}
          onClose={() => setActiveChat(null)}
        />
      )}
    </div>
  );
};