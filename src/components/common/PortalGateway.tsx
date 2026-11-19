/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  UserCheck,
  Store,
  ShieldCheck,
  ArrowRight,
  Car,
  Bike,
  Truck,
  Tractor,
  Lock,
  CheckCircle,
  Clock,
  Globe,
  Smartphone,
  MessageCircle,
} from 'lucide-react';
import { AppCustomizationSettings, UserRole } from '../../types';
import { db } from '../../services/db';

interface PortalGatewayProps {
  portalTarget: UserRole;
  onSelectPortal: (role: UserRole, initialTab?: 'login' | 'register') => void;
  onOpenAuthModal: () => void;
}

export const PortalGateway: React.FC<PortalGatewayProps> = ({
  portalTarget,
  onSelectPortal,
}) => {
  const [custom, setCustom] = useState<AppCustomizationSettings>(() =>
    db.getCustomizationSettings()
  );

  useEffect(() => {
    const unsub = db.subscribe(() => {
      setCustom(db.getCustomizationSettings());
    });
    return () => {
      unsub();
    };
  }, []);

  const brandColor = custom.primaryBrandColor || '#2563eb';
  const primaryText = custom.primaryTextColor || '#0f172a';
  const secondaryText = custom.secondaryTextColor || '#475569';
  const activeLogo = custom.logoUrl || '/assets/aistudio/M1_AUTO_LOGO_3c381c58.jpg';
  const siteUrl = custom.headerWebsite || 'www.m1br.com.br';
  const appDomainUrl = custom.appDomain || custom.appSubtitle || 'auto.m1br.com.br';
  const whatsappDisplay = custom.whatsappNumber || '11 96212-2694';
  const whatsappDigits = whatsappDisplay.replace(/\D/g, '');
  const whatsappLink = whatsappDigits ? `https://wa.me/${whatsappDigits.startsWith('55') ? whatsappDigits : `55${whatsappDigits}`}` : '#';

  const rawBanner =
    portalTarget === 'cliente'
      ? custom.portalClienteImageUrl || custom.clientHeroImageUrl
      : portalTarget === 'fornecedor'
      ? custom.portalFornecedorImageUrl
      : '';
  const heroBanner = rawBanner && rawBanner !== activeLogo ? rawBanner : '';

  return (
    <div className="max-w-4xl mx-auto py-6 sm:py-10 px-3 sm:px-4 space-y-8 animate-in fade-in duration-300">
      {/* Brand Header */}
      <div className="text-center space-y-3">
        {custom.logoUrl !== '' && (
          <div className="inline-block relative p-2 rounded-3xl bg-slate-950 shadow-2xl border border-slate-800">
            <img
              src={activeLogo}
              alt={`${custom.appName} — ${custom.appSlogan}`}
              className="h-24 sm:h-32 w-auto mx-auto rounded-2xl object-contain hover:scale-105 transition-transform"
            />
          </div>
        )}

        <div>
          <h1
            className="text-3xl sm:text-4xl font-black tracking-tight dark:text-white"
            style={{ color: primaryText }}
          >
            {custom.appName}
          </h1>
          <p
            className="text-base sm:text-xl font-extrabold mt-1 dark:text-blue-400"
            style={{ color: brandColor }}
          >
            {custom.appSlogan}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mt-3 text-xs font-bold">
            <a
              href={`https://${siteUrl.replace(/^https?:\/\//, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 shadow-xs hover:border-blue-400 transition"
            >
              <Globe className="w-3.5 h-3.5 text-blue-600" />
              <span>Site: {siteUrl}</span>
            </a>
            <a
              href={`https://${appDomainUrl.replace(/^https?:\/\//, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 shadow-xs hover:border-blue-400 transition"
            >
              <Smartphone className="w-3.5 h-3.5 text-indigo-600" />
              <span>App: {appDomainUrl}</span>
            </a>
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 shadow-xs hover:bg-emerald-100 transition"
            >
              <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
              <span>WhatsApp: {whatsappDisplay}</span>
            </a>
          </div>
        </div>
      </div>

      {/* Optional Custom Cover Banner for Portal */}
      {heroBanner && (
        <div className="max-w-2xl mx-auto rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-lg bg-slate-900">
          <img
            src={heroBanner}
            alt="Capa do Portal"
            className="w-full max-h-56 object-cover"
          />
        </div>
      )}

      {/* STRICTLY ISOLATED SINGLE PORTAL CARD */}
      <div className="max-w-xl mx-auto">
        {portalTarget === 'cliente' && (
          <div
            className="rounded-3xl bg-white dark:bg-slate-900 border-2 p-6 sm:p-8 shadow-2xl transition-all flex flex-col justify-between"
            style={{ borderColor: `${brandColor}55` }}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${brandColor}18`, color: brandColor }}
                >
                  <UserCheck className="w-7 h-7" />
                </div>
                <span
                  className="text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full border"
                  style={{
                    color: brandColor,
                    backgroundColor: `${brandColor}12`,
                    borderColor: `${brandColor}40`,
                  }}
                >
                  {custom.portalClienteBadge}
                </span>
              </div>

              <div>
                <h2
                  className="text-2xl font-black dark:text-white"
                  style={{ color: primaryText }}
                >
                  {custom.portalClienteTitle}
                </h2>
                <p
                  className="text-sm mt-2 leading-relaxed dark:text-slate-300"
                  style={{ color: secondaryText }}
                >
                  {custom.portalClienteDesc}
                </p>
              </div>

              <ul className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300 pt-3 border-t border-slate-100 dark:border-slate-800">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Cadastro direto com liberação imediata por Celular e Senha</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Solicitação rápida de peças por categoria e subcategoria</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Comparação transparente das melhores ofertas e prazos</span>
                </li>
                <li className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-blue-500 shrink-0" />
                  <span>Entrega validada com código PIN de segurança</span>
                </li>
              </ul>
            </div>

            <div className="pt-6 space-y-2.5">
              <button
                onClick={() => onSelectPortal('cliente', 'login')}
                className="w-full py-4 px-5 rounded-2xl text-white font-black text-sm shadow-lg flex items-center justify-center gap-2 transition hover:brightness-110 active:scale-98 cursor-pointer"
                style={{ backgroundColor: brandColor }}
              >
                <Lock className="w-4 h-4" />
                <span>{custom.portalClienteBtnLogin}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => onSelectPortal('cliente', 'register')}
                className="w-full py-3 px-4 rounded-2xl border-2 text-xs font-extrabold transition hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                style={{ borderColor: `${brandColor}44`, color: brandColor }}
              >
                {custom.portalClienteBtnRegister}
              </button>
            </div>
          </div>
        )}

        {portalTarget === 'fornecedor' && (
          <div className="rounded-3xl bg-white dark:bg-slate-900 border-2 border-emerald-500/40 p-6 sm:p-8 shadow-2xl transition-all flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                  <Store className="w-7 h-7" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-3 py-1 rounded-full border border-amber-200 dark:border-amber-900">
                  {custom.portalFornecedorBadge}
                </span>
              </div>

              <div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">
                  {custom.portalFornecedorTitle}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-300 mt-2 leading-relaxed">
                  {custom.portalFornecedorDesc}
                </p>
              </div>

              <ul className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300 pt-3 border-t border-slate-100 dark:border-slate-800">
                <li className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>Requer autorização, classificação e raio definidos pela administração</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Alertas de Nova Oportunidade dentro do seu perímetro em km</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Confirmação de venda e envio com endereço exato do comprador</span>
                </li>
                <li className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Acesso exclusivo autenticado por Celular e Senha</span>
                </li>
              </ul>
            </div>

            <div className="pt-6 space-y-2.5">
              <button
                onClick={() => onSelectPortal('fornecedor', 'login')}
                className="w-full py-4 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 transition active:scale-98 cursor-pointer"
              >
                <Lock className="w-4 h-4" />
                <span>{custom.portalFornecedorBtnLogin}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => onSelectPortal('fornecedor', 'register')}
                className="w-full py-3 px-4 rounded-2xl border-2 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 font-extrabold text-xs transition cursor-pointer"
              >
                {custom.portalFornecedorBtnRegister}
              </button>
            </div>
          </div>
        )}

        {portalTarget === 'admin' && (
          <div className="rounded-3xl bg-white dark:bg-slate-900 border-2 border-purple-500/40 p-6 sm:p-8 shadow-2xl transition-all flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="w-14 h-14 rounded-2xl bg-purple-100 dark:bg-purple-950 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
                  <ShieldCheck className="w-7 h-7" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 px-3 py-1 rounded-full border border-purple-200 dark:border-purple-900">
                  Acesso Restrito · Master
                </span>
              </div>

              <div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">
                  Painel Administrativo Master
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-300 mt-2 leading-relaxed">
                  Gestão global e segura do sistema {custom.appName}: homologação de fornecedores, customização total visual, editor de SPAMs, relatórios PDF e auditoria.
                </p>
              </div>

              <ul className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300 pt-3 border-t border-slate-100 dark:border-slate-800">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-purple-500 shrink-0" />
                  <span>Controle dos 3 links independentes de acesso</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-purple-500 shrink-0" />
                  <span>Edição completa de cores, fontes, abas, campos, imagens e alarmes</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-purple-500 shrink-0" />
                  <span>Construtor e pré-visualização ao vivo de SPAMs e recados</span>
                </li>
                <li className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-purple-500 shrink-0" />
                  <span>Sem cadastro público (acesso exclusivo por credenciais Master)</span>
                </li>
              </ul>
            </div>

            <div className="pt-6">
              <button
                onClick={() => onSelectPortal('admin', 'login')}
                className="w-full py-4 px-5 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-black text-sm shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 transition active:scale-98 cursor-pointer"
              >
                <Lock className="w-4 h-4" />
                <span>Login Administrativo</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer Strip */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 text-white flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 sm:gap-4 text-slate-300 font-semibold">
          <span className="flex items-center gap-1.5"><Car className="w-4 h-4 text-blue-400" /> Automóveis</span>
          <span>·</span>
          <span className="flex items-center gap-1.5"><Bike className="w-4 h-4 text-blue-400" /> Motos</span>
          <span>·</span>
          <span className="flex items-center gap-1.5"><Truck className="w-4 h-4 text-blue-400" /> Caminhões</span>
          <span>·</span>
          <span className="flex items-center gap-1.5"><Tractor className="w-4 h-4 text-blue-400" /> Máquinas</span>
        </div>

        <div className="text-center sm:text-right space-y-0.5">
          <span className="font-black text-amber-300 block">
            {custom.appName} — {custom.appSlogan}
          </span>
          <span className="text-[11px] text-slate-300 block font-semibold">
            Site: {siteUrl} · App: {appDomainUrl} · WhatsApp: {whatsappDisplay}
          </span>
        </div>
      </div>
    </div>
  );
};
