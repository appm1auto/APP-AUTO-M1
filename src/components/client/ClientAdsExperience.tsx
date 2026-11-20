/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Megaphone,
  Pause,
  Play,
  Tag,
  X,
} from 'lucide-react';
import { ClientAdItem, ClientAdsSettings } from '../../types';
import { db } from '../../services/db';

interface ClientAdsExperienceProps {
  currentUserId: string;
}

const sanitizeHref = (raw?: string): string | null => {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('/')) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^[a-z0-9.-]+\.[a-z]{2,}/i.test(trimmed)) return `https://${trimmed}`;
  return null;
};

const formatPrice = (item: ClientAdItem): string | null => {
  if (typeof item.price === 'number' && Number.isFinite(item.price) && item.price > 0) {
    return `R$ ${item.price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (item.priceLabel && item.priceLabel.trim()) return item.priceLabel.trim();
  return null;
};

export const ClientAdsExperience: React.FC<ClientAdsExperienceProps> = ({ currentUserId }) => {
  const [settings, setSettings] = useState<ClientAdsSettings>(() => db.getClientAdsSettings());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userPaused, setUserPaused] = useState(false);

  // Startup splash (3 seconds default, configurable by Admin; triggers once per app open/mount)
  const [splashOpen, setSplashOpen] = useState(false);
  const [splashRemainingSec, setSplashRemainingSec] = useState(0);
  const hasTriggeredSplashRef = useRef(false);

  useEffect(() => {
    hasTriggeredSplashRef.current = false;
  }, [currentUserId]);

  useEffect(() => {
    const sync = () => setSettings(db.getClientAdsSettings());
    const unsub = db.subscribe(sync);
    return () => {
      unsub();
    };
  }, []);

  const activeItems = useMemo(
    () =>
      (settings.items || [])
        .filter(item => item.active)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [settings.items]
  );

  // Trigger startup front-of-screen splash whenever client opens the app
  useEffect(() => {
    if (hasTriggeredSplashRef.current) return;
    if (!settings.enabled || !settings.showOnStartupSplash || activeItems.length === 0) {
      return;
    }
    hasTriggeredSplashRef.current = true;
    const durationSec = Math.max(1, Number(settings.startupSplashSeconds) || 3);
    setSplashRemainingSec(durationSec);
    setSplashOpen(true);
  }, [settings.enabled, settings.showOnStartupSplash, settings.startupSplashSeconds, activeItems.length]);

  useEffect(() => {
    if (!splashOpen) return;
    if (splashRemainingSec <= 0) {
      setSplashOpen(false);
      return;
    }
    const timer = setTimeout(() => {
      setSplashRemainingSec(s => {
        if (s <= 1) {
          setSplashOpen(false);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearTimeout(timer);
  }, [splashOpen, splashRemainingSec]);

  // Keep currentIndex within bounds
  useEffect(() => {
    if (activeItems.length === 0) {
      setCurrentIndex(0);
    } else if (currentIndex >= activeItems.length) {
      setCurrentIndex(0);
    }
  }, [activeItems.length, currentIndex]);

  // Sequential rotation mode
  useEffect(() => {
    if (
      !settings.enabled ||
      !settings.footerEnabled ||
      activeItems.length <= 1 ||
      settings.footerMode !== 'sequential' ||
      userPaused
    ) {
      return;
    }
    const currentItem = activeItems[currentIndex % activeItems.length];
    const durationMs = Math.max(1, currentItem?.durationSeconds || settings.intervalSeconds || 5) * 1000;
    const timer = setTimeout(() => {
      setCurrentIndex(prev => (prev + 1) % activeItems.length);
    }, durationMs);
    return () => clearTimeout(timer);
  }, [
    settings.enabled,
    settings.footerEnabled,
    settings.footerMode,
    settings.intervalSeconds,
    activeItems,
    currentIndex,
    userPaused,
  ]);

  // Periodic ("de tempos em tempos") mantém a propaganda na tela e avança o slide apenas no tempo definido pelo Admin
  useEffect(() => {
    if (!settings.enabled || !settings.footerEnabled || activeItems.length <= 1) return;
    if (settings.footerMode !== 'periodic' || userPaused) return;

    const waitMs = Math.max(2, Number(settings.periodicIntervalSeconds) || 20) * 1000;
    const timer = setTimeout(() => {
      setCurrentIndex(prev => (prev + 1) % activeItems.length);
    }, waitMs);

    return () => clearTimeout(timer);
  }, [
    settings.enabled,
    settings.footerEnabled,
    settings.footerMode,
    settings.periodicIntervalSeconds,
    activeItems.length,
    currentIndex,
    userPaused,
  ]);

  if (!settings.enabled || activeItems.length === 0) return null;

  const splashAd =
    (settings.startupAdItemId && activeItems.find(i => i.id === settings.startupAdItemId)) ||
    activeItems[0];

  const fixedAd =
    settings.footerMode === 'fixed'
      ? (settings.fixedAdItemId && activeItems.find(i => i.id === settings.fixedAdItemId)) || activeItems[0]
      : null;

  const displayedAd = fixedAd || activeItems[currentIndex % activeItems.length];
  const showFooterBar = settings.footerEnabled && Boolean(displayedAd);

  const size = settings.footerSize || 'medium';
  const splashLink = sanitizeHref(splashAd?.linkUrl);
  const footerLink = sanitizeHref(displayedAd?.linkUrl);
  const splashPrice = splashAd ? formatPrice(splashAd) : null;
  const footerPrice = displayedAd ? formatPrice(displayedAd) : null;
  const customFooterStyle: React.CSSProperties = {
    backgroundColor: displayedAd?.bgColor || undefined,
    color: displayedAd?.textColor || undefined,
    minHeight:
      settings.footerCustomHeightPx && settings.footerCustomHeightPx >= 56
        ? `${settings.footerCustomHeightPx}px`
        : undefined,
  };

  return (
    <>
      {/* 1. PROPAGANDA DE ABERTURA NA FRENTE DA TELA (3s padrão, programável pelo Admin) */}
      {splashOpen && splashAd && (
        <div
          role="dialog"
          aria-label="Destaque Promocional AUTO SHOP"
          className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
        >
          <div
            style={{
              backgroundColor: splashAd.bgColor || undefined,
              color: splashAd.textColor || undefined,
            }}
            className="relative w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border-2 border-amber-400 shadow-2xl overflow-hidden"
          >
            <div className="px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider">
                <Megaphone className="w-4 h-4 shrink-0" />
                <span>Oferta em Destaque AUTO SHOP</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-black/30 text-[11px] font-mono font-black tabular-nums">
                  Fecha em {splashRemainingSec}s
                </span>
                <button
                  type="button"
                  onClick={() => setSplashOpen(false)}
                  className="p-1 rounded-full hover:bg-white/20 transition cursor-pointer"
                  aria-label="Fechar anúncio"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {splashAd.mediaType === 'image' && splashAd.mediaUrl && (
              <div className="w-full h-56 sm:h-64 bg-slate-950 overflow-hidden">
                <img
                  src={splashAd.mediaUrl}
                  alt={splashAd.title}
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
            )}

            {splashAd.mediaType === 'video' && splashAd.mediaUrl && (
              <div className="w-full h-56 sm:h-64 bg-black overflow-hidden">
                <video
                  src={splashAd.mediaUrl}
                  autoPlay
                  muted
                  loop
                  playsInline
                  controls
                  className="w-full h-full object-contain"
                />
              </div>
            )}

            <div className="p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white leading-snug">
                  {splashAd.title}
                </h3>
                {splashPrice && (
                  <span className="px-3 py-1 rounded-xl bg-emerald-600 text-white font-mono font-black text-sm shrink-0 tabular-nums shadow-sm">
                    {splashPrice}
                  </span>
                )}
              </div>

              {splashAd.description && (
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                  {splashAd.description}
                </p>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSplashOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Continuar para o App
                </button>
                {splashLink && (
                  <a
                    href={splashLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black flex items-center gap-1.5 shadow-md"
                  >
                    <span>{splashAd.linkLabel || 'Ver Oferta'}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. CARROSSEL / PROPAGANDA NO RODAPÉ DO APP DO CLIENTE (PROGRAMÁVEL) */}
      {showFooterBar && displayedAd && (
        <aside
          aria-label="Anúncios AUTO SHOP"
          className="sticky bottom-2 z-30 mt-6 rounded-2xl border-2 border-amber-400/80 dark:border-amber-600 bg-white/95 dark:bg-slate-900/95 shadow-2xl backdrop-blur-md overflow-hidden transition-all flex flex-col justify-center"
          style={customFooterStyle}
        >
          <div
            className={`flex items-center justify-between gap-3 ${
              size === 'compact'
                ? 'p-2.5'
                : size === 'large'
                ? 'p-4 sm:p-5'
                : 'p-3 sm:p-3.5'
            }`}
          >
            {/* Mídia (Foto ou Vídeo Curto) */}
            {displayedAd.mediaType === 'image' && displayedAd.mediaUrl && (
              <div
                className={`rounded-xl overflow-hidden bg-slate-950 border border-slate-200 dark:border-slate-700 shrink-0 ${
                  size === 'compact'
                    ? 'w-12 h-12'
                    : size === 'large'
                    ? 'w-28 h-24 sm:w-40 sm:h-28'
                    : 'w-20 h-16 sm:w-24 sm:h-20'
                }`}
              >
                <img
                  src={displayedAd.mediaUrl}
                  alt={displayedAd.title}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
            )}

            {displayedAd.mediaType === 'video' && displayedAd.mediaUrl && (
              <div
                className={`rounded-xl overflow-hidden bg-black border border-slate-700 shrink-0 ${
                  size === 'compact'
                    ? 'w-16 h-12'
                    : size === 'large'
                    ? 'w-32 h-24 sm:w-44 sm:h-28'
                    : 'w-24 h-16 sm:w-28 sm:h-20'
                }`}
              >
                <video
                  src={displayedAd.mediaUrl}
                  autoPlay
                  muted
                  loop
                  playsInline
                  controls={size === 'large'}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {displayedAd.mediaType === 'text' && (
              <div
                className={`rounded-xl bg-amber-100 dark:bg-amber-950/70 text-amber-600 dark:text-amber-300 flex items-center justify-center shrink-0 ${
                  size === 'compact' ? 'w-10 h-10' : size === 'large' ? 'w-14 h-14' : 'w-12 h-12'
                }`}
              >
                <Megaphone className="w-5 h-5" />
              </div>
            )}

            {/* Texto, Preço e Link */}
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500 text-slate-950">
                  Patrocinado AUTO SHOP
                </span>
                {footerPrice && (
                  <span className="text-[11px] font-mono font-black px-2 py-0.5 rounded bg-emerald-600 text-white tabular-nums flex items-center gap-1">
                    <Tag className="w-3 h-3" />
                    {footerPrice}
                  </span>
                )}
                {settings.footerMode === 'paused' && (
                  <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    Pausado
                  </span>
                )}
              </div>

              <h4
                className={`font-black text-slate-900 dark:text-white truncate ${
                  size === 'compact' ? 'text-xs' : size === 'large' ? 'text-base' : 'text-sm'
                }`}
              >
                {displayedAd.title}
              </h4>

              {displayedAd.description && size !== 'compact' && (
                <p
                  className={`text-slate-600 dark:text-slate-300 ${
                    size === 'large' ? 'text-xs line-clamp-2' : 'text-[11px] line-clamp-1'
                  }`}
                >
                  {displayedAd.description}
                </p>
              )}
            </div>

            {/* Ações: Link + Navegação do Carrossel */}
            <div className="flex items-center gap-1.5 shrink-0">
              {footerLink && (
                <a
                  href={footerLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black flex items-center gap-1 shadow-sm transition"
                >
                  <span className="hidden sm:inline">{displayedAd.linkLabel || 'Acessar'}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}

              {activeItems.length > 1 && settings.footerMode !== 'fixed' && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentIndex(prev => (prev - 1 + activeItems.length) % activeItems.length)
                    }
                    className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
                    aria-label="Anúncio anterior"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  {settings.footerMode === 'sequential' && settings.allowUserPause && (
                    <button
                      type="button"
                      onClick={() => setUserPaused(p => !p)}
                      className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
                      aria-label={userPaused ? 'Retomar carrossel' : 'Pausar carrossel'}
                      title={userPaused ? 'Retomar rotação' : 'Pausar rotação'}
                    >
                      {userPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setCurrentIndex(prev => (prev + 1) % activeItems.length)}
                    className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
                    aria-label="Próximo anúncio"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {activeItems.length > 1 && settings.footerMode !== 'fixed' && size !== 'compact' && (
            <div className="px-3 pb-2 flex items-center justify-center gap-1.5">
              {activeItems.map((item, idx) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  aria-label={`Ir para anúncio ${idx + 1}`}
                  className={`h-1.5 rounded-full transition-all cursor-pointer ${
                    idx === currentIndex % activeItems.length
                      ? 'w-5 bg-amber-500'
                      : 'w-1.5 bg-slate-300 dark:bg-slate-700'
                  }`}
                />
              ))}
            </div>
          )}
        </aside>
      )}
    </>
  );
};
