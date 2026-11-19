/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  LogOut,
  Smartphone,
  Monitor,
  Sun,
  Moon,
  Lock
} from 'lucide-react';
import { AppCustomizationSettings, User, UserRole } from '../../types';
import { db } from '../../services/db';
import { isSupplierClassifiedAndApproved } from '../../services/rbac';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderProps {
  currentUser: User | null;
  activeRole: UserRole | 'gateway';
  isPhoneFrameMode: boolean;
  onTogglePhoneFrame: () => void;
  onLogoutToPortalSelect: () => void;
  onOpenAuthModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  isPhoneFrameMode,
  onTogglePhoneFrame,
  onLogoutToPortalSelect,
  onOpenAuthModal,
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

  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.classList.contains('dark');
    }
    return false;
  });

  const toggleTheme = () => {
    if (typeof document !== 'undefined') {
      const willBeDark = !isDark;
      setIsDark(willBeDark);
      try {
        if (willBeDark) {
          document.documentElement.classList.add('dark');
          localStorage.setItem('compe_theme', 'dark');
        } else {
          document.documentElement.classList.remove('dark');
          localStorage.setItem('compe_theme', 'light');
        }
      } catch {
        // ignore restricted storage on mobile private browsing
      }
    }
  };

  const userRole = currentUser?.role;
  const supplierPending =
    currentUser?.role === 'fornecedor' && !isSupplierClassifiedAndApproved(currentUser);
  const brandColor = custom.primaryBrandColor || '#2563eb';

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors shadow-sm">
      <div className="max-w-7xl mx-auto px-2.5 sm:px-6 h-16 sm:h-20 flex items-center justify-between gap-2 sm:gap-3">
        {/* Brand Zone */}
        <div className="flex items-center gap-2 sm:gap-3.5 min-w-0 flex-1">
          {custom.logoUrl !== '' && (
            <div className="p-1 rounded-xl sm:rounded-2xl bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-center shrink-0">
              <img
                src={custom.logoUrl || '/assets/aistudio/M1_AUTO_LOGO_3c381c58.jpg'}
                alt={`${custom.appName} - ${custom.appSlogan}`}
                className="h-10 sm:h-14 md:h-16 w-auto rounded-lg object-contain drop-shadow-md hover:scale-105 transition-transform"
              />
            </div>
          )}
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <span className="text-lg sm:text-2xl md:text-3xl font-black tracking-tight text-slate-950 dark:text-white truncate">
                {custom.appName}
              </span>
              {custom.appSubtitle && (
                <span
                  className="text-[10px] sm:text-xs font-extrabold shrink-0 hidden sm:inline"
                  style={{ color: brandColor }}
                >
                  {custom.appSubtitle}
                </span>
              )}
              {currentUser && userRole && (
                <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full border hidden sm:inline-block shrink-0 ${
                  userRole === 'cliente'
                    ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-900'
                    : userRole === 'fornecedor'
                    ? supplierPending
                      ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900'
                    : 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-900'
                }`}>
                  {userRole === 'cliente'
                    ? 'App do Cliente'
                    : userRole === 'fornecedor'
                    ? supplierPending
                      ? 'Fornecedor (Em Análise)'
                      : 'Portal do Fornecedor'
                    : 'Super Administrador'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[10px] sm:text-xs font-bold text-slate-600 dark:text-slate-400 truncate">
                {custom.appSlogan}
              </span>
              {(custom.headerWebsite || custom.whatsappNumber) && (
                <span className="hidden lg:inline-flex items-center gap-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400 shrink-0">
                  {custom.headerWebsite && <span>· {custom.headerWebsite}</span>}
                  {custom.whatsappNumber && (
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                      · WhatsApp: {custom.whatsappNumber}
                    </span>
                  )}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Zone */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {/* Smartphone Mockup Frame Toggle */}
          <button
            onClick={onTogglePhoneFrame}
            className={`hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
              isPhoneFrameMode
                ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-50'
            }`}
            title="Alternar entre tela do celular real e visualização expandida"
          >
            {isPhoneFrameMode ? (
              <>
                <Monitor className="w-3.5 h-3.5" />
                <span>Modo Expandido</span>
              </>
            ) : (
              <>
                <Smartphone className="w-3.5 h-3.5 text-blue-600" />
                <span>Tela do Celular</span>
              </>
            )}
          </button>

          {/* Modo Dia e Noite Toggle */}
          <button
            onClick={toggleTheme}
            className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
            title={isDark ? 'Alternar para Modo Dia (Claro)' : 'Alternar para Modo Noite (Escuro)'}
          >
            {isDark ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Modo Dia</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-indigo-500" />
                <span className="hidden sm:inline">Modo Noite</span>
              </>
            )}
          </button>

          <PWAInstallButton />

          {/* User Account / Login vs Logout */}
          {currentUser ? (
            <div className="flex items-center gap-1.5 sm:gap-2 pl-1.5 sm:pl-2 border-l border-slate-200 dark:border-slate-800">
              <div className="hidden lg:flex flex-col text-right">
                <span className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[140px]">
                  {currentUser.companyName || currentUser.name}
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  {currentUser.phone}
                </span>
              </div>

              <button
                onClick={onLogoutToPortalSelect}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition cursor-pointer"
                title="Sair da Conta"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sair</span>
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuthModal}
              className="flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-xl hover:brightness-110 text-white text-xs font-black shadow-sm transition cursor-pointer"
              style={{ backgroundColor: brandColor }}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Entrar</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
