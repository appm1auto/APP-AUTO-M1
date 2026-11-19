/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  X,
  Package,
  Truck,
  Camera,
  CheckCircle,
  Upload,
  ArrowRight,
  Lock,
  MapPin
} from 'lucide-react';
import { OrderAndPayment } from '../../types';
import { db } from '../../services/db';

interface PackageShipModalProps {
  order: OrderAndPayment;
  supplierId: string;
  onSuccess: () => void;
  onClose: () => void;
}

export const PackageShipModal: React.FC<PackageShipModalProps> = ({
  order,
  supplierId,
  onSuccess,
  onClose,
}) => {
  // Se o pedido já foi expedido, fica somente leitura
  const isAlreadyShipped = order.deliveryStatus === 'a_caminho' || order.deliveryStatus === 'entregue';
  const req = db.getRequestById(order.requestId);
  const deliveryAddress = order.deliveryAddress || req?.deliveryAddress;

  const [packagedPhotoUrl, setPackagedPhotoUrl] = useState<string>(
    order.packagedPhotoUrl || '/src/assets/images/compe_delivery_van_1793928395506.jpg'
  );
  const [carrier, setCarrier] = useState(order.trackingCarrier || 'AUTO SHOP Express Moto Rápido');
  const [trackingCode, setTrackingCode] = useState(
    order.trackingCode || `AS-SP-${Math.floor(10000 + Math.random() * 90000)}`
  );
  const [motoboyName, setMotoboyName] = useState(order.motoboyName || '');
  const [motoboyPhone, setMotoboyPhone] = useState(order.motoboyPhone || '');
  const [motoboyVehicle, setMotoboyVehicle] = useState(order.motoboyVehicle || '');
  const [nfeNumber, setNfeNumber] = useState(
    order.nfeNumber ? order.nfeNumber.replace(/\D/g, '').slice(0, 8) || '' : ''
  );
  const [nfeSerie, setNfeSerie] = useState(order.nfeSerie || '1');
  const [submitting, setSubmitting] = useState(false);

  // Número sequencial AS·PED (ano + sequencial)
  const yearShort = new Date().getFullYear().toString().slice(-2);
  const sequentialNumber = order.orderNumber?.replace(/\D/g, '').slice(-5) || Math.floor(10000 + Math.random() * 90000).toString();
  const compePedNumber = `AS·PED ${yearShort}${sequentialNumber}`;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isAlreadyShipped) return; // Impede duplicidade

    setSubmitting(true);
    db.updateOrderDelivery(order.id, supplierId, {
      deliveryStatus: 'a_caminho',
      packagedPhotoUrl,
      trackingCarrier: carrier,
      trackingCode,
      motoboyName,
      motoboyPhone,
      motoboyVehicle,
      nfeNumber,
      nfeSerie,
    });
    setSubmitting(false);
    onSuccess();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-5 sm:p-7 relative max-h-[92vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">
              Expedição de Pedido · AUTO SHOP
            </span>
            <span className="text-slate-400">·</span>
            <span className="font-mono text-xs font-bold text-slate-600">
              {compePedNumber}
            </span>
          </div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white mt-1">
            {isAlreadyShipped ? 'Detalhes do Envio (Somente Leitura)' : 'Separar Peça e Despachar Envio'}
          </h2>
        </div>

        {isAlreadyShipped && (
          <div className="mt-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Este pedido já foi expedido. Os dados abaixo são somente para consulta e não podem ser alterados.</span>
          </div>
        )}

        <p className="mt-3 text-xs text-slate-600 dark:text-slate-300">
          {isAlreadyShipped
            ? 'Dados de expedição registrados no sistema.'
            : 'Tire a foto da peça embalada, preencha os dados da NF-e e do entregador. Esta ação só pode ser feita uma vez.'}
        </p>

        {deliveryAddress && (
          <div className="mt-3 p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 space-y-1 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-black uppercase text-[10px] text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-blue-600" />
                Local de Entrega (Cotação)
              </span>
              {deliveryAddress.cep && (
                <span className="font-mono font-black text-[11px] bg-blue-600 text-white px-2 py-0.5 rounded">
                  CEP: {deliveryAddress.cep}
                </span>
              )}
            </div>
            <p className="font-bold text-slate-900 dark:text-white">
              {deliveryAddress.street}, {deliveryAddress.number}
              {deliveryAddress.complement ? ` (${deliveryAddress.complement})` : ''} -{' '}
              {deliveryAddress.neighborhood}, {deliveryAddress.city}/{deliveryAddress.state}
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Foto da Peça Embalada */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-blue-600" />
                <span>Foto da Peça Embalada</span>
              </label>
            </div>
            <div className="relative h-44 rounded-2xl overflow-hidden bg-slate-950 border-2 border-slate-300 dark:border-slate-700 shadow-sm">
              <img
                src={packagedPhotoUrl}
                alt="Embalagem"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              {!isAlreadyShipped && (
                <div className="absolute bottom-2.5 right-2.5 flex flex-wrap gap-2">
                  <label className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md transition active:scale-95">
                    <Camera className="w-3.5 h-3.5" />
                    <span>Tirar Foto</span>
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
                            if (ev.target?.result) setPackagedPhotoUrl(ev.target.result as string);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                  <label className="px-3 py-1.5 rounded-xl bg-black/75 hover:bg-black text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition active:scale-95">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Anexar</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = ev => {
                            if (ev.target?.result) setPackagedPhotoUrl(ev.target.result as string);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* Dados da NF-e */}
          <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 space-y-3">
            <span className="text-xs font-black uppercase text-slate-800 dark:text-slate-200 block">
              Dados da Nota Fiscal Eletrônica (NF-e)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Número da NF-e *
                </label>
                <input
                  type="text"
                  value={nfeNumber}
                  onChange={e => setNfeNumber(e.target.value)}
                  placeholder="Ex: 004587"
                  disabled={isAlreadyShipped}
                  className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-60"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Série da NF-e *
                </label>
                <input
                  type="text"
                  value={nfeSerie}
                  onChange={e => setNfeSerie(e.target.value)}
                  placeholder="Ex: 1"
                  disabled={isAlreadyShipped}
                  className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-60"
                  required
                />
              </div>
            </div>
            <p className="text-[11px] text-slate-500">
              Formato no sistema: <strong className="font-mono">NF-e Emitida: {nfeNumber || '---'} - Série {nfeSerie}</strong>
            </p>
          </div>

          {/* Dados do Motoboy */}
          <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 space-y-3">
            <span className="text-xs font-black uppercase text-slate-800 dark:text-slate-200 block">
              Dados do Motoboy / Entregador
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Nome do Motoboy *
                </label>
                <input
                  type="text"
                  value={motoboyName}
                  onChange={e => setMotoboyName(e.target.value)}
                  placeholder="Nome do entregador"
                  disabled={isAlreadyShipped}
                  className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-60"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Telefone / WhatsApp *
                </label>
                <input
                  type="tel"
                  value={motoboyPhone}
                  onChange={e => setMotoboyPhone(e.target.value)}
                  placeholder="11988887777"
                  disabled={isAlreadyShipped}
                  className="w-full px-3 py-2 text-xs font-mono font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-60"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Placa / Modelo do Veículo *
                </label>
                <input
                  type="text"
                  value={motoboyVehicle}
                  onChange={e => setMotoboyVehicle(e.target.value)}
                  placeholder="Ex: Honda CG 160 - Placa BRA-4E19"
                  disabled={isAlreadyShipped}
                  className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-600 uppercase disabled:opacity-60"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Código de Rastreamento *
                </label>
                <input
                  type="text"
                  value={trackingCode}
                  onChange={e => setTrackingCode(e.target.value)}
                  placeholder="Ex: CMP-MOTO-9102"
                  disabled={isAlreadyShipped}
                  className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-600 uppercase disabled:opacity-60"
                  required
                />
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-xs text-blue-900 dark:text-blue-300">
            Lembrete: No momento da entrega o motoboy deve solicitar o <strong>PIN de 4 dígitos</strong> do cliente para dar baixa e liberar o repasse.
          </div>

          {!isAlreadyShipped ? (
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-sm shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition active:scale-98"
            >
              <Truck className="w-4 h-4" />
              <span>Confirmar Envio e Despachar Peça</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-black text-sm flex items-center justify-center gap-2 transition"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Fechar (Somente Leitura)</span>
            </button>
          )}
        </form>
      </div>
    </div>
  );
};