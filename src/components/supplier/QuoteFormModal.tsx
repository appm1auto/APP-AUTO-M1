/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  X,
  Send,
  AlertTriangle,
  Upload,
  CheckCircle,
  Truck,
  ShieldCheck,
  Camera,
  Lock,
  Clock,
  Sparkles,
  Zap,
  Globe,
  Store,
  Layers,
  MapPin
} from 'lucide-react';
import { PartRequest, PartCondition, AvailabilityType, Quote, SupplierTier } from '../../types';
import { db } from '../../services/db';

interface QuoteFormModalProps {
  request: PartRequest;
  supplierId: string;
  onSuccess: (quote: Quote) => void;
  onClose: () => void;
}

export const QuoteFormModal: React.FC<QuoteFormModalProps> = ({
  request,
  supplierId,
  onSuccess,
  onClose,
}) => {
  const [, setGeoTick] = useState(0);
  React.useEffect(() => {
    const unsub = db.subscribe(() => setGeoTick(t => t + 1));
    db.hydrateRealDistanceForPair(supplierId, request.id);
    return () => {
      unsub();
    };
  }, [supplierId, request.id]);

  const supplier = db.getUserById(supplierId);
  const tier: SupplierTier = supplier?.supplierTier || 'opcao_2';
  const configuredRadius = supplier?.serviceRadiusKm !== undefined ? supplier.serviceRadiusKm : 50;
  const distDetails = db.getDistanceDetailsSupplierToRequest(supplier, request);

  // 1ª Opção: 2 campos (Valor R$ e Tempo de entrega horas/dias)
  // 2ª Opção: 3 campos (Valor R$, Tempo de entrega horas/dias, Tipo de envio)
  // 3ª Opção: 4 campos (Valor R$, Tempo de entrega horas/dias, Tipo de envio, Características técnicas) + Logo do fornecedor

  const [partPrice, setPartPrice] = useState<string>('240.00');
  const [deliveryTimeValue, setDeliveryTimeValue] = useState<string>('2');
  const [deliveryTimeUnit, setDeliveryTimeUnit] = useState<'horas' | 'dias'>(
    tier === 'opcao_1' ? 'horas' : 'dias'
  );
  const [shippingMethod, setShippingMethod] = useState<string>('Motoboy Express Local');
  const [technicalDetails, setTechnicalDetails] = useState<string>(
    'Peça original testada em bancada, com selo de garantia e certificação de fábrica.'
  );

  // Additional background defaults
  const [photoUrl, setPhotoUrl] = useState<string>(
    request.mediaUrl || '/src/assets/images/compe_hero_autoparts_1793928394704.jpg'
  );
  const [showPenaltyModal, setShowPenaltyModal] = useState(false);
  const [hasCheckedTerms, setHasCheckedTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const numPartPrice = Number(partPrice) || 0;
  const numTime = Number(deliveryTimeValue) || 1;
  const deliveryDays = deliveryTimeUnit === 'dias' ? numTime : Math.ceil(numTime / 24);
  const deliveryHours = deliveryTimeUnit === 'horas' ? numTime : numTime * 24;

  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (numPartPrice <= 0) {
      setError('Informe um valor em R$ válido para a peça.');
      return;
    }

    // Opens mandatory penalty agreement modal before saving
    setShowPenaltyModal(true);
  };

  const handleConfirmAndSaveQuote = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const quote = await db.submitQuoteRemote(supplierId, {
        requestId: request.id,
        partPrice: numPartPrice,
        shippingPrice: 0, // Inclusivo no orçamento expresso
        deliveryDays,
        deliveryHours,
        shippingMethod: tier === 'opcao_1' ? 'Motoboy Express Local (Raio até 50 km)' : shippingMethod,
        technicalDetails: tier === 'opcao_3' ? technicalDetails : undefined,
        brand: request.vehicleBrand ? `${request.vehicleBrand} / Genuína` : 'Genuína OEM',
        partCode: request.oemCode || 'OEM-STANDARD',
        availability: 'estoque',
        condition: 'nova',
        warrantyDays: 90,
        photoUrl,
        observations: `Termo contratual de 10% de multa aceito pelo fornecedor (R$ ${(numPartPrice * 0.10).toFixed(2)}).`,
      });

      setSubmitting(false);
      setShowPenaltyModal(false);
      onSuccess(quote);
    } catch (err: any) {
      setError(err?.message || 'Erro ao enviar orçamento. Tente novamente.');
      setSubmitting(false);
      setShowPenaltyModal(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-5 sm:p-7 relative max-h-[92vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header com Identificação da Opção Definida pelo Admin */}
        <div className="pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">
              Cotação de Fornecedor · AUTO SHOP
            </span>
            <span className="text-slate-400">·</span>
            <span className="font-mono text-xs font-bold text-slate-600">
              {request.requestNumber}
            </span>
          </div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white mt-1">
            Enviar Proposta de Orçamento
          </h2>
        </div>

        {/* Tier Classification Banner (§10 Rule) */}
        {tier === 'opcao_1' && (
          <div className="mt-3 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
            <Zap className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <strong className="block font-black text-amber-800 dark:text-amber-300">
                1ª Opção: Ultra-Local Express (2 Campos Editáveis)
              </strong>
              <span>
                Limite de 10 min para responder · {configuredRadius === 0 ? 'Sem limite de raio' : `Raio definido pelo Admin: ${configuredRadius} km`} · Split automático AUTO SHOP no gateway.
              </span>
            </div>
          </div>
        )}

        {tier === 'opcao_2' && (
          <div className="mt-3 p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-900 dark:text-blue-200 flex items-start gap-2.5">
            <Truck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <strong className="block font-black text-blue-800 dark:text-blue-300">
                2ª Opção: Regional Standard (3 Campos Editáveis)
              </strong>
              <span>
                Limite de 15 min para responder · {configuredRadius === 0 ? 'Sem limite de raio' : `Raio definido pelo Admin: ${configuredRadius} km`} · Split automático AUTO SHOP.
              </span>
            </div>
          </div>
        )}

        {tier === 'opcao_3' && (
          <div className="mt-3 p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/30 text-purple-900 dark:text-purple-200 flex items-start gap-2.5">
            <Globe className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <strong className="block font-black text-purple-800 dark:text-purple-300">
                3ª Opção: Nacional Premium Direto (4 Campos + Logo no Card do Cliente)
              </strong>
              <span>
                Sem limite de tempo · {configuredRadius === 0 ? 'Sem limite de distância (Brasil inteiro)' : `Perímetro definido pelo Admin: ${configuredRadius} km`} · Seu Logo aparecerá visível na cotação do cliente.
              </span>
            </div>
          </div>
        )}

        {/* Resumo da Peça Solicitada */}
        <div className="mt-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Peça:</span>
            <strong className="text-slate-900 dark:text-white">{request.partName}</strong>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Categoria / Subcategoria:</span>
            <strong className="text-blue-700 dark:text-blue-300">
              {request.categoryName ? `${request.categoryName} · ` : ''}{request.partSubcategory || request.partCategory}
            </strong>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Veículo:</span>
            <span className="text-slate-800 dark:text-slate-200 font-semibold">
              {request.vehicleBrand} {request.vehicleModel} ({request.vehicleYear})
            </span>
          </div>
          <div className="pt-2 mt-1 border-t border-slate-200 dark:border-slate-700 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                Distância Real (Sua Loja ↔ Local de Entrega):
              </span>
              <strong className="font-mono text-emerald-700 dark:text-emerald-400">
                {distDetails
                  ? `${distDetails.distanceKm.toFixed(1)} km${distDetails.source === 'rota_real' ? (distDetails.durationMin ? ` (Rota ~${distDetails.durationMin} min)` : ' (Rota real)') : ' (GPS/CEP)'}`
                  : 'Calculando km...'}
              </strong>
            </div>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-[11px] text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>CEP, rua, bairro e dados do cliente ficam ocultos até a confirmação do pagamento.</span>
            </div>
          </div>
        </div>

        {error && (
          <p className="mt-3 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/60 p-2.5 rounded-xl border border-red-200 dark:border-red-900">
            {error}
          </p>
        )}

        <form onSubmit={handlePreSubmit} className="mt-4 space-y-4">
          {(() => {
            const custom = db.getCustomizationSettings();
            const sf = custom.supplierFields || {};
            return (
              <>
                {/* CAMPO 1 (Todas as Opções): O VALOR EM R$ */}
                {(sf.partPrice?.visible ?? true) && (
                  <div>
                    <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-1">
                      {sf.partPrice?.label || '1. Valor Total da Peça (em R$) *'}
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-2.5 text-sm font-bold text-slate-400">R$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={partPrice}
                        onChange={e => setPartPrice(e.target.value)}
                        placeholder={sf.partPrice?.placeholder || '0.00'}
                        className="w-full pl-10 pr-4 py-2.5 text-lg font-mono font-black rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 outline-none focus:ring-2 focus:ring-blue-600"
                        required
                      />
                    </div>
                    <span className="text-[10px] text-slate-500 mt-0.5 block">
                      Este valor será apresentado para o cliente em ordem crescente (menor preço no topo).
                    </span>
                  </div>
                )}

                {/* CAMPO 2 (Todas as Opções): O TEMPO DE ENTREGA DA PEÇA (HORAS / DIAS) */}
                {(sf.deliveryTime?.visible ?? true) && (
                  <div>
                    <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-1">
                      {sf.deliveryTime?.label || '2. Tempo de Entrega da Peça (Horas ou Dias) *'}
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        min="1"
                        value={deliveryTimeValue}
                        onChange={e => setDeliveryTimeValue(e.target.value)}
                        placeholder={sf.deliveryTime?.placeholder || 'Ex: 2'}
                        className="w-full px-3.5 py-2.5 text-sm font-bold rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-600"
                        required
                      />
                      <select
                        value={deliveryTimeUnit}
                        onChange={e => setDeliveryTimeUnit(e.target.value as 'horas' | 'dias')}
                        className="w-full px-3 py-2.5 text-xs font-bold rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
                      >
                        <option value="horas">Horas (Entrega Expressa)</option>
                        <option value="dias">Dias Úteis</option>
                      </select>
                    </div>
                    <span className="text-[10px] text-slate-500 mt-0.5 block">
                      Previsão de entrega no local indicado pelo cliente ({deliveryTimeValue} {deliveryTimeUnit}).
                    </span>
                  </div>
                )}

                {/* CAMPO 3 (2ª e 3ª Opção): TIPO / MODO DE ENVIO DA PEÇA */}
                {(tier === 'opcao_2' || tier === 'opcao_3') && (sf.shippingMethod?.visible ?? true) && (
                  <div>
                    <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-1">
                      {sf.shippingMethod?.label || '3. Tipo / Modo de Envio da Peça *'}
                    </label>
                    <select
                      value={shippingMethod}
                      onChange={e => setShippingMethod(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs font-bold rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
                      required
                    >
                      <option value="Motoboy Express Local">Motoboy Express Local</option>
                      <option value="Transportadora Rodoviária (Jadlog / Braspress)">Transportadora Rodoviária (Jadlog / Braspress)</option>
                      <option value="Correios SEDEX Express">Correios SEDEX Express</option>
                      <option value="Retirada no Balcão da Loja">Retirada no Balcão da Loja</option>
                      <option value="Frota Própria da Autopeças">Frota Própria da Autopeças</option>
                    </select>
                  </div>
                )}

                {/* CAMPO 4 (Apenas 3ª Opção): CARACTERÍSTICAS TÉCNICAS DA PEÇA */}
                {tier === 'opcao_3' && (sf.technicalDetails?.visible ?? true) && (
                  <div>
                    <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-1">
                      {sf.technicalDetails?.label || '4. Características Técnicas e Dados da Peça *'}
                    </label>
                    <textarea
                      rows={3}
                      value={technicalDetails}
                      onChange={e => setTechnicalDetails(e.target.value)}
                      placeholder={sf.technicalDetails?.placeholder || 'Descreva detalhes como material, medidas, compatibilidade com o chassi, número do lote e observações técnicas...'}
                      className="w-full px-3.5 py-2.5 text-xs rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-600"
                      required
                    />
                  </div>
                )}

                {/* EXCLUSIVO 3ª OPÇÃO: LOGO DO FORNECEDOR VISÍVEL NA TELA DO CLIENTE (§10) */}
                {tier === 'opcao_3' && (
                  <div className="p-3.5 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl overflow-hidden bg-white dark:bg-slate-800 border-2 border-purple-400 shrink-0 shadow-sm flex items-center justify-center">
                        {supplier?.avatarUrl ? (
                          <img src={supplier.avatarUrl} alt="Logo" className="w-full h-full object-cover" />
                        ) : (
                          <Store className="w-6 h-6 text-purple-600" />
                        )}
                      </div>
                      <div>
                        <span className="text-xs font-black text-purple-900 dark:text-purple-200 block">
                          Logo da sua Loja Ativo na Proposta
                        </span>
                        <span className="text-[11px] text-purple-700 dark:text-purple-300">
                          {supplier?.companyName || supplier?.name} (Exclusividade 3ª Opção)
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] font-black uppercase px-2 py-1 rounded-lg bg-purple-200 dark:bg-purple-900 text-purple-900 dark:text-purple-200">
                      Visível ao Cliente
                    </span>
                  </div>
                )}

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-4 rounded-2xl hover:brightness-110 text-white font-black text-sm shadow-xl flex items-center justify-center gap-2 transition active:scale-98 cursor-pointer disabled:opacity-50"
                    style={{ backgroundColor: custom.primaryBrandColor || '#2563eb' }}
                  >
                    <Send className="w-4 h-4" />
                    <span>{submitting ? 'Gravando e Enviando...' : (custom.supplierSubmitQuoteText || 'Revisar e Enviar Orçamento ao Cliente')}</span>
                  </button>
                </div>
              </>
            );
          })()}
        </form>

        {/* MODAL OBRIGATÓRIO: TERMO DE RESPONSABILIDADE E MULTA DE 10% AO ENVIAR ORÇAMENTO */}
        {showPenaltyModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in">
            <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border-2 border-amber-500 shadow-2xl p-5 sm:p-7 relative space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="w-7 h-7 animate-bounce" />
                </div>
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400 block">
                    Confirmação Contratual Obrigatória
                  </span>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                    Termo de Responsabilidade e Multa
                  </h3>
                </div>
              </div>

              {/* Resumo do Orçamento Preenchido */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-1.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Valor Ofertado:</span>
                  <span className="font-mono font-black text-emerald-600 text-base">R$ {numPartPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Tempo de Entrega Prometido:</span>
                  <strong className="text-slate-900 dark:text-white">{deliveryTimeValue} {deliveryTimeUnit}</strong>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-slate-200 dark:border-slate-700">
                  <span className="text-red-600 font-bold">Multa em caso de falha/cancelamento (10%):</span>
                  <span className="font-mono font-black text-red-600">R$ {(numPartPrice * 0.10).toFixed(2)}</span>
                </div>
              </div>

              {/* Texto Rigoroso Conforme Especificação */}
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 text-xs text-amber-950 dark:text-amber-200 font-semibold leading-relaxed">
                <p>
                  "Ciente de que não poderá alterar o valor após o envio e garante ter o produto em estoque e condição de entrega; caso contrário, pagará multa de 10% do valor da peça à AUTO SHOP como ressarcimento por engano e taxas bancárias contratuais."
                </p>
              </div>

              {/* Checkbox de Aceite Expresso */}
              <label className="flex items-start gap-2.5 cursor-pointer p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                <input
                  type="checkbox"
                  checked={hasCheckedTerms}
                  onChange={e => setHasCheckedTerms(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Li, compreendi e aceito irrevogavelmente este termo de compromisso e a multa contratual de 10%.
                </span>
              </label>

              {/* Botões de Ação */}
              <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowPenaltyModal(false)}
                  className="flex-1 py-3 px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Voltar e Corrigir
                </button>
                <button
                  type="button"
                  disabled={!hasCheckedTerms || submitting}
                  onClick={handleConfirmAndSaveQuote}
                  className="flex-1 py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>{submitting ? 'Gravando...' : 'Confirmar e Gravar Orçamento'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
