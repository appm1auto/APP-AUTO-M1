/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Type,
  Palette,
  FileText,
  Save,
  RotateCcw,
  CheckCircle,
  Eye,
  Sparkles,
  ShieldCheck,
  Smartphone,
  Store,
  Layers,
  Sliders,
  Check,
  Image as ImageIcon,
  Upload,
  Trash2,
  Globe,
  RefreshCw,
  Volume2,
  CreditCard,
  Plus,
  Play,
  LayoutGrid
} from 'lucide-react';
import {
  AlarmEventKey,
  AlarmToneOption,
  AppCustomizationSettings,
  FontFamilyOption,
  PaymentMethodConfigItem,
} from '../../types';
import { db } from '../../services/db';
import { soundEffects } from '../../services/sound';

interface AppEditorTabProps {
  adminId: string;
}

const AVAILABLE_FONTS: { name: FontFamilyOption; label: string; description: string; sample: string }[] = [
  {
    name: 'Plus Jakarta Sans',
    label: 'Plus Jakarta Sans',
    description: 'Padrão AUTO SHOP: Moderno, automotivo, esportivo e ultra legível.',
    sample: 'Amortecedor Corolla R$ 320,00',
  },
  {
    name: 'Inter',
    label: 'Inter UI',
    description: 'Design neutro, limpo e corporativo estilo Apple / Uber.',
    sample: 'Amortecedor Corolla R$ 320,00',
  },
  {
    name: 'Montserrat',
    label: 'Montserrat',
    description: 'Forte, geométrico, imponente para marcas de luxo.',
    sample: 'Amortecedor Corolla R$ 320,00',
  },
  {
    name: 'Poppins',
    label: 'Poppins',
    description: 'Formas arredondadas, acolhedor e visual moderno.',
    sample: 'Amortecedor Corolla R$ 320,00',
  },
  {
    name: 'Roboto',
    label: 'Roboto',
    description: 'Clássico do Android, objetivo e equilibrado.',
    sample: 'Amortecedor Corolla R$ 320,00',
  },
  {
    name: 'Orbitron',
    label: 'Orbitron',
    description: 'Futurista e tecnológico com temática automotiva e motores.',
    sample: 'AMORTECEDOR COROLLA R$ 320,00',
  },
  {
    name: 'JetBrains Mono',
    label: 'JetBrains Mono',
    description: 'Alta precisão mecânica, ideal para códigos OEM e chassi.',
    sample: 'OEM-48510-02870 COROLLA 2018',
  },
  {
    name: 'Raleway',
    label: 'Raleway',
    description: 'Elegante, traços finos e estética premium.',
    sample: 'Amortecedor Corolla R$ 320,00',
  },
];

const PRESET_BRAND_COLORS = [
  { name: 'Azul AUTO SHOP Oficial', hex: '#2563eb' },
  { name: 'Azul Marinho Real', hex: '#1d4ed8' },
  { name: 'Preto Automotivo', hex: '#0f172a' },
  { name: 'Vermelho Esportivo', hex: '#dc2626' },
  { name: 'Verde Turbo', hex: '#059669' },
  { name: 'Laranja Racing', hex: '#ea580c' },
  { name: 'Dourado Escudo AUTO SHOP', hex: '#d97706' },
  { name: 'Roxo Titanium', hex: '#7c3aed' },
];

export const AppEditorTab: React.FC<AppEditorTabProps> = ({ adminId }) => {
  const [settings, setSettings] = useState<AppCustomizationSettings>(db.getCustomizationSettings());
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<
    'logo' | 'fontes' | 'cores' | 'escritas' | 'abas_campos' | 'alarmes_pagamentos' | 'preview'
  >('logo');

  const handleImageFileUpload = (
    field: 'logoUrl' | 'faviconUrl' | 'clientHeroImageUrl' | 'portalClienteImageUrl' | 'portalFornecedorImageUrl' | 'defaultPartImageUrl',
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      updateField(field, dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    db.updateCustomizationSettings(settings, adminId);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleConfirmReset = () => {
    const def = db.resetCustomizationSettings(adminId);
    setSettings(def);
    setConfirmResetOpen(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const updateField = <K extends keyof AppCustomizationSettings>(
    field: K,
    value: AppCustomizationSettings[K]
  ) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
              <Sliders className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">
              Painel de Edição e Customização Visual
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-xl">
            Edite o logotipo, favicon, escolha fontes, ajuste as cores das letras e botões e personalize todas as escritas, slogans e mensagens do aplicativo AUTO SHOP.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 w-full md:w-auto flex-wrap">
          {confirmResetOpen ? (
            <div className="flex items-center gap-1.5 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 px-3 py-1.5 rounded-xl">
              <span className="text-[11px] font-bold text-red-700 dark:text-red-300">Confirmar restauração?</span>
              <button
                type="button"
                onClick={handleConfirmReset}
                className="px-2.5 py-1 rounded-lg bg-red-600 text-white text-[11px] font-black cursor-pointer"
              >
                Sim
              </button>
              <button
                type="button"
                onClick={() => setConfirmResetOpen(false)}
                className="px-2 py-1 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-bold cursor-pointer"
              >
                Não
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmResetOpen(true)}
              className="flex-1 md:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 transition cursor-pointer"
              title="Restaurar valores de fábrica"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Restaurar Padrão</span>
            </button>
          )}

          <button
            onClick={handleSave}
            className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 active:scale-98 text-white text-xs font-black shadow-md shadow-purple-600/30 transition cursor-pointer"
          >
            {saveSuccess ? (
              <>
                <CheckCircle className="w-4 h-4 text-emerald-300 animate-bounce" />
                <span>Salvo com Sucesso!</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Salvar Alterações</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3 overflow-x-auto">
        <button
          onClick={() => setActiveSection('logo')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeSection === 'logo'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <ImageIcon className="w-4 h-4" />
          <span>0. Imagens, Logo & Favicon</span>
        </button>

        <button
          onClick={() => setActiveSection('fontes')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeSection === 'fontes'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <Type className="w-4 h-4" />
          <span>1. Tipografia e Fontes</span>
        </button>

        <button
          onClick={() => setActiveSection('cores')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeSection === 'cores'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <Palette className="w-4 h-4" />
          <span>2. Cores das Letras e Acentos</span>
        </button>

        <button
          onClick={() => setActiveSection('escritas')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeSection === 'escritas'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>3. Escritas & Portais</span>
        </button>

        <button
          onClick={() => setActiveSection('abas_campos')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeSection === 'abas_campos'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <LayoutGrid className="w-4 h-4" />
          <span>4. Abas & Campos (Cliente/Fornecedor)</span>
        </button>

        <button
          onClick={() => setActiveSection('alarmes_pagamentos')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeSection === 'alarmes_pagamentos'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <Volume2 className="w-4 h-4" />
          <span>5. Alarmes & Pagamentos</span>
        </button>

        <button
          onClick={() => setActiveSection('preview')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeSection === 'preview'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <Eye className="w-4 h-4" />
          <span>6. Pré-visualização</span>
        </button>
      </div>

      {/* SECTION 0: LOGO & FAVICON SELECTION */}
      {activeSection === 'logo' && (
        <div className="space-y-6">
          <div className="bg-purple-50/60 dark:bg-purple-950/30 p-4 rounded-2xl border border-purple-200 dark:border-purple-900">
            <h3 className="text-sm font-black text-purple-900 dark:text-purple-200 flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-purple-600" />
              <span>Gerenciamento de Logotipo e Favicon do Aplicativo</span>
            </h3>
            <p className="text-xs text-purple-800 dark:text-purple-300 mt-1">
              Adicione imagens personalizadas do seu computador ou celular, insira links diretos, remova o logotipo para usar apenas a tipografia oficial ou restaure o ícone e logo originais da AUTO SHOP com um clique.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Logo Configuration Card */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600">
                    <ImageIcon className="w-5 h-5" />
                  </span>
                  <div>
                    <h4 className="text-sm font-black text-slate-900 dark:text-white">
                      Logotipo Principal do App
                    </h4>
                    <span className="text-[11px] text-slate-500">
                      Exibido no cabeçalho em todas as telas (Cliente, Fornecedor e Admin).
                    </span>
                  </div>
                </div>
              </div>

              {/* Logo Preview Box */}
              <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-center min-h-[120px]">
                {settings.logoUrl !== '' ? (
                  <img
                    src={settings.logoUrl || '/assets/aistudio/M1_AUTO_LOGO_3c381c58.jpg'}
                    alt="Logo Prévia"
                    className="max-h-20 w-auto rounded-lg object-contain drop-shadow-md"
                  />
                ) : (
                  <div className="text-center py-4">
                    <span className="text-xs font-bold text-slate-400 block">
                      (Nenhum logo ativo — O app exibirá apenas a marca tipográfica "{settings.appName}")
                    </span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Substituir por arquivo de imagem:
                </label>
                <div className="flex items-center gap-2">
                  <label className="flex-1 cursor-pointer inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition">
                    <Upload className="w-4 h-4" />
                    <span>Upload de Logo (PNG, JPG, SVG)</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={e => handleImageFileUpload('logoUrl', e)}
                      className="hidden"
                    />
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Ou informe uma URL direta da imagem:
                  </label>
                  <input
                    type="text"
                    placeholder="https://exemplo.com/logo.png"
                    value={settings.logoUrl || ''}
                    onChange={e => updateField('logoUrl', e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-600"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => updateField('logoUrl', '')}
                    className="flex-1 px-3 py-2 rounded-xl border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Excluir Logo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => updateField('logoUrl', '/assets/aistudio/M1_AUTO_LOGO_3c381c58.jpg')}
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 text-xs font-bold text-slate-700 dark:text-slate-300 transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Restaurar AUTO SHOP</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Favicon Configuration Card */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-600">
                    <Globe className="w-5 h-5" />
                  </span>
                  <div>
                    <h4 className="text-sm font-black text-slate-900 dark:text-white">
                      Favicon do Navegador (Aba & Atalho)
                    </h4>
                    <span className="text-[11px] text-slate-500">
                      Ícone pequeno exibido na aba do navegador e ao instalar o app como PWA.
                    </span>
                  </div>
                </div>
              </div>

              {/* Favicon Preview Box */}
              <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-center min-h-[120px]">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xs">
                  <img
                    src={settings.faviconUrl || '/assets/aistudio/M1_AUTO_LOGO_3c381c58.jpg'}
                    alt="Favicon Prévia"
                    className="w-10 h-10 object-contain rounded-lg"
                  />
                  <div className="text-left text-xs">
                    <span className="font-bold text-slate-800 dark:text-slate-200 block">Aba do Navegador</span>
                    <span className="text-[10px] text-slate-400">{settings.appName} — {settings.appSlogan}</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Substituir por arquivo de ícone:
                </label>
                <div className="flex items-center gap-2">
                  <label className="flex-1 cursor-pointer inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-sm transition">
                    <Upload className="w-4 h-4" />
                    <span>Upload de Favicon (SVG, PNG, ICO)</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={e => handleImageFileUpload('faviconUrl', e)}
                      className="hidden"
                    />
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Ou informe uma URL direta do Favicon:
                  </label>
                  <input
                    type="text"
                    placeholder="https://exemplo.com/favicon.ico"
                    value={settings.faviconUrl || ''}
                    onChange={e => updateField('faviconUrl', e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-600"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => updateField('faviconUrl', '/assets/aistudio/M1_AUTO_LOGO_3c381c58.jpg')}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 text-xs font-bold text-slate-700 dark:text-slate-300 transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Restaurar Favicon Padrão</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Portal Banners & Part Default Images */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {([
              {
                key: 'clientHeroImageUrl' as const,
                title: 'Banner Principal do App do Cliente',
                desc: 'Imagem de fundo exibida no topo do painel do Cliente autenticado.',
                fallback: '/src/assets/images/compe_hero_autoparts_1793928394704.jpg',
              },
              {
                key: 'portalClienteImageUrl' as const,
                title: 'Imagem de Capa · Link Independente Cliente',
                desc: 'Banner opcional na tela de acesso do Cliente (/) quando deslogado.',
                fallback: '/assets/aistudio/M1_AUTO_LOGO_3c381c58.jpg',
              },
              {
                key: 'portalFornecedorImageUrl' as const,
                title: 'Imagem de Capa · Link Independente Fornecedor',
                desc: 'Banner opcional na tela de acesso do Fornecedor (/fornecedor).',
                fallback: '/assets/aistudio/M1_AUTO_LOGO_3c381c58.jpg',
              },
              {
                key: 'defaultPartImageUrl' as const,
                title: 'Imagem Padrão de Peças (Fallback)',
                desc: 'Exibida quando uma solicitação ou cotação não possui foto anexada.',
                fallback: '/src/assets/images/compe_hero_autoparts_1793928394704.jpg',
              },
            ]).map(item => (
              <div key={item.key} className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                <div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white">{item.title}</h4>
                  <p className="text-[11px] text-slate-500">{item.desc}</p>
                </div>
                <div className="h-28 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-center overflow-hidden">
                  {settings[item.key] ? (
                    <img src={settings[item.key]} alt={item.title} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs text-slate-400">Sem imagem configurada</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex-1 cursor-pointer inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Imagem</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={e => handleImageFileUpload(item.key, e)}
                      className="hidden"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => updateField(item.key, '')}
                    className="px-3 py-2 rounded-xl border border-red-300 text-red-600 text-xs font-bold cursor-pointer"
                  >
                    Remover
                  </button>
                  <button
                    type="button"
                    onClick={() => updateField(item.key, item.fallback)}
                    className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold cursor-pointer"
                  >
                    Padrão
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Ou cole a URL da imagem..."
                  value={settings[item.key] || ''}
                  onChange={e => updateField(item.key, e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 1: FONTS SELECTION */}
      {activeSection === 'fontes' && (
        <div className="space-y-4">
          <div className="bg-purple-50/60 dark:bg-purple-950/30 p-4 rounded-2xl border border-purple-200 dark:border-purple-900">
            <h3 className="text-sm font-black text-purple-900 dark:text-purple-200 flex items-center gap-2">
              <Type className="w-4 h-4 text-purple-600" />
              <span>Escolha a Tipografia Principal do Aplicativo</span>
            </h3>
            <p className="text-xs text-purple-800 dark:text-purple-300 mt-1">
              A fonte selecionada será aplicada automaticamente em todo o app (telas do cliente, fornecedor, admin e modais).
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {AVAILABLE_FONTS.map(font => {
              const isSelected = settings.fontFamily === font.name;
              return (
                <div
                  key={font.name}
                  onClick={() => updateField('fontFamily', font.name)}
                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'border-purple-600 bg-purple-50/50 dark:bg-purple-950/40 shadow-md ring-2 ring-purple-600/30'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                  style={{ fontFamily: font.name }}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-black text-slate-900 dark:text-white">
                        {font.label}
                      </span>
                      {isSelected && (
                        <span className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center shrink-0">
                          <Check className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 font-sans leading-tight">
                      {font.description}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 font-sans block mb-1">Amostra:</span>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                      {font.sample}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Scale options */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-3">
            <h4 className="text-xs font-black uppercase text-slate-500 tracking-wider">
              Tamanho Geral da Tipografia
            </h4>
            <div className="flex items-center gap-3">
              {(['compact', 'normal', 'large'] as const).map(scale => (
                <button
                  key={scale}
                  onClick={() => updateField('fontSizeScale', scale)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold border transition ${
                    settings.fontSizeScale === scale
                      ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {scale === 'compact' ? 'Compacto (Alta Densidade)' : scale === 'normal' ? 'Padrão (Equilibrado)' : 'Ampliado (Mais Legível)'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: COLORS */}
      {activeSection === 'cores' && (
        <div className="space-y-5">
          <div className="bg-blue-50/60 dark:bg-blue-950/30 p-4 rounded-2xl border border-blue-200 dark:border-blue-900">
            <h3 className="text-sm font-black text-blue-900 dark:text-blue-200 flex items-center gap-2">
              <Palette className="w-4 h-4 text-blue-600" />
              <span>Personalização das Cores das Letras e Acentos</span>
            </h3>
            <p className="text-xs text-blue-800 dark:text-blue-300 mt-1">
              Defina a paleta de cores institucional que rege os textos, destaques, botões de ação e títulos em todo o sistema.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Color 1: Primary Brand / Main Action */}
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white">
                    Cor Principal da Marca / Botões de Ação
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Utilizada nos botões de compra, solicitação, confirmação e elementos principais.
                  </p>
                </div>
                <div
                  className="w-9 h-9 rounded-xl border border-slate-300 shadow-xs shrink-0"
                  style={{ backgroundColor: settings.primaryBrandColor }}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={settings.primaryBrandColor}
                  onChange={e => updateField('primaryBrandColor', e.target.value)}
                  className="w-10 h-10 rounded-lg cursor-pointer border border-slate-300"
                />
                <input
                  type="text"
                  value={settings.primaryBrandColor}
                  onChange={e => updateField('primaryBrandColor', e.target.value)}
                  className="flex-1 px-3 py-2 text-xs font-mono font-bold uppercase rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <div>
                <span className="text-[10px] text-slate-400 font-bold block mb-2">Paleta Rápida Sugerida:</span>
                <div className="flex flex-wrap gap-2">
                  {PRESET_BRAND_COLORS.map(c => (
                    <button
                      key={c.hex}
                      onClick={() => updateField('primaryBrandColor', c.hex)}
                      className={`w-7 h-7 rounded-lg border-2 transition hover:scale-110 ${
                        settings.primaryBrandColor.toLowerCase() === c.hex.toLowerCase()
                          ? 'border-black dark:border-white ring-2 ring-purple-500'
                          : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c.hex }}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Color 2: Primary Text Color */}
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white">
                    Cor dos Textos e Títulos Principais
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Cor de destaque para títulos, valores em reais, nomes de peças e cabeçalhos.
                  </p>
                </div>
                <div
                  className="w-9 h-9 rounded-xl border border-slate-300 shadow-xs shrink-0"
                  style={{ backgroundColor: settings.primaryTextColor }}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={settings.primaryTextColor}
                  onChange={e => updateField('primaryTextColor', e.target.value)}
                  className="w-10 h-10 rounded-lg cursor-pointer border border-slate-300"
                />
                <input
                  type="text"
                  value={settings.primaryTextColor}
                  onChange={e => updateField('primaryTextColor', e.target.value)}
                  className="flex-1 px-3 py-2 text-xs font-mono font-bold uppercase rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <div className="flex items-center gap-2">
                {[
                  { name: 'Preto Profundo', hex: '#0f172a' },
                  { name: 'Preto Grafite', hex: '#18181b' },
                  { name: 'Azul Meia-Noite', hex: '#1e293b' },
                  { name: 'Azul Escuro Real', hex: '#1e3a8a' },
                ].map(c => (
                  <button
                    key={c.hex}
                    onClick={() => updateField('primaryTextColor', c.hex)}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-50"
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Color 3: Secondary Text Color */}
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white">
                    Cor dos Textos Secundários e Legendas
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Utilizada em descrições, prazos de entrega, garantias e termos explicativos.
                  </p>
                </div>
                <div
                  className="w-9 h-9 rounded-xl border border-slate-300 shadow-xs shrink-0"
                  style={{ backgroundColor: settings.secondaryTextColor }}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={settings.secondaryTextColor}
                  onChange={e => updateField('secondaryTextColor', e.target.value)}
                  className="w-10 h-10 rounded-lg cursor-pointer border border-slate-300"
                />
                <input
                  type="text"
                  value={settings.secondaryTextColor}
                  onChange={e => updateField('secondaryTextColor', e.target.value)}
                  className="flex-1 px-3 py-2 text-xs font-mono font-bold uppercase rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
            </div>

            {/* Color 4: Accent Color (Gold/Yellow) */}
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white">
                    Cor de Destaque e Badges (Dourado Touro)
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Utilizada em estrelas de avaliação, badges de recomendação e alerta visual.
                  </p>
                </div>
                <div
                  className="w-9 h-9 rounded-xl border border-slate-300 shadow-xs shrink-0"
                  style={{ backgroundColor: settings.accentColor }}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={settings.accentColor}
                  onChange={e => updateField('accentColor', e.target.value)}
                  className="w-10 h-10 rounded-lg cursor-pointer border border-slate-300"
                />
                <input
                  type="text"
                  value={settings.accentColor}
                  onChange={e => updateField('accentColor', e.target.value)}
                  className="flex-1 px-3 py-2 text-xs font-mono font-bold uppercase rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: EDIT ALL APP TEXTS */}
      {activeSection === 'escritas' && (
        <div className="space-y-6">
          <div className="bg-amber-50/70 dark:bg-amber-950/30 p-4 rounded-2xl border border-amber-200 dark:border-amber-900">
            <h3 className="text-sm font-black text-amber-900 dark:text-amber-200 flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-600" />
              <span>Edição Completa de Todas as Escritas e Slogans do App</span>
            </h3>
            <p className="text-xs text-amber-800 dark:text-amber-300 mt-1">
              Altere qualquer frase, slogan, chamada de ação ou aviso do sistema. As alterações têm efeito imediato nas telas correspondentes.
            </p>
          </div>

          {/* Group 1: Brand & Slogans */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <h4 className="text-sm font-black text-slate-900 dark:text-white">
                1. Identidade, Nome Oficial e Slogans
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Nome Principal da Marca
                </label>
                <input
                  type="text"
                  value={settings.appName}
                  onChange={e => updateField('appName', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Complemento da Marca (ex: ONLINE)
                </label>
                <input
                  type="text"
                  value={settings.appSubtitle}
                  onChange={e => updateField('appSubtitle', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Slogan Oficial (Exibido no topo e rodapé)
                </label>
                <input
                  type="text"
                  value={settings.appSlogan}
                  onChange={e => updateField('appSlogan', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Tagline / Frase de Impacto do Banner
                </label>
                <input
                  type="text"
                  value={settings.appTagline}
                  onChange={e => updateField('appTagline', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Site Oficial
                </label>
                <input
                  type="text"
                  value={settings.headerWebsite}
                  onChange={e => updateField('headerWebsite', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Link / Domínio do App
                </label>
                <input
                  type="text"
                  value={settings.appDomain || ''}
                  onChange={e => updateField('appDomain', e.target.value)}
                  placeholder="auto.m1br.com.br"
                  className="w-full px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  WhatsApp Oficial
                </label>
                <input
                  type="text"
                  value={settings.whatsappNumber || ''}
                  onChange={e => updateField('whatsappNumber', e.target.value)}
                  placeholder="11 96212-2694"
                  className="w-full px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Mensagem de Encerramento (Rodapé)
                </label>
                <input
                  type="text"
                  value={settings.footerText}
                  onChange={e => updateField('footerText', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Group 2: Client App Texts */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <Smartphone className="w-4 h-4 text-blue-500" />
              <h4 className="text-sm font-black text-slate-900 dark:text-white">
                2. Escritas e Chamadas do App do Cliente
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Título de Boas-Vindas
                </label>
                <input
                  type="text"
                  value={settings.clientWelcomeTitle}
                  onChange={e => updateField('clientWelcomeTitle', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Texto do Botão de Solicitação
                </label>
                <input
                  type="text"
                  value={settings.requestButtonText}
                  onChange={e => updateField('requestButtonText', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Placeholder da Barra de Busca
                </label>
                <input
                  type="text"
                  value={settings.clientSearchPlaceholder}
                  onChange={e => updateField('clientSearchPlaceholder', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Título do Card de Orçamentos
                </label>
                <input
                  type="text"
                  value={settings.quotesTitle}
                  onChange={e => updateField('quotesTitle', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Subtítulo do Card de Orçamentos
                </label>
                <input
                  type="text"
                  value={settings.quotesSubtitle}
                  onChange={e => updateField('quotesSubtitle', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Aviso de Segurança do PIN de Entrega (4 dígitos)
                </label>
                <input
                  type="text"
                  value={settings.pinSecurityNotice}
                  onChange={e => updateField('pinSecurityNotice', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Group 3: Supplier Portal Texts */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <Store className="w-4 h-4 text-emerald-500" />
              <h4 className="text-sm font-black text-slate-900 dark:text-white">
                3. Escritas do Portal do Fornecedor (Autopeças)
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Título da Central de Vendas
                </label>
                <input
                  type="text"
                  value={settings.supplierWelcomeTitle}
                  onChange={e => updateField('supplierWelcomeTitle', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Texto do Alerta Urgente (SPAM 15 min)
                </label>
                <input
                  type="text"
                  value={settings.supplierOpportunityAlert}
                  onChange={e => updateField('supplierOpportunityAlert', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Texto do Botão de Envio de Proposta
                </label>
                <input
                  type="text"
                  value={settings.supplierSubmitQuoteText}
                  onChange={e => updateField('supplierSubmitQuoteText', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Instrução de Foto da Embalagem
                </label>
                <input
                  type="text"
                  value={settings.supplierShipNotice}
                  onChange={e => updateField('supplierShipNotice', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Texto da Tela de Validação do PIN de Entrega
                </label>
                <input
                  type="text"
                  value={settings.supplierPinValidationText}
                  onChange={e => updateField('supplierPinValidationText', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Group 4: Policies & Privacy */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <ShieldCheck className="w-4 h-4 text-purple-500" />
              <h4 className="text-sm font-black text-slate-900 dark:text-white">
                4. Textos de Privacidade LGPD e Políticas
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Regra de Privacidade de Endereço (Bairro + Cidade)
                </label>
                <input
                  type="text"
                  value={settings.privacyRuleNotice}
                  onChange={e => updateField('privacyRuleNotice', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Termos e Políticas de Garantia
                </label>
                <input
                  type="text"
                  value={settings.warrantyPolicyText}
                  onChange={e => updateField('warrantyPolicyText', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Group 5: Independent Portals Texts */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <Globe className="w-4 h-4 text-blue-600" />
              <h4 className="text-sm font-black text-slate-900 dark:text-white">
                5. Escritas dos Portais Independentes (Cliente & Fornecedor)
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Badge Portal Cliente</label>
                <input type="text" value={settings.portalClienteBadge || ''} onChange={e => updateField('portalClienteBadge', e.target.value)} className="w-full px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Título Portal Cliente</label>
                <input type="text" value={settings.portalClienteTitle || ''} onChange={e => updateField('portalClienteTitle', e.target.value)} className="w-full px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Descrição Portal Cliente</label>
                <input type="text" value={settings.portalClienteDesc || ''} onChange={e => updateField('portalClienteDesc', e.target.value)} className="w-full px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Botão Entrar (Cliente)</label>
                <input type="text" value={settings.portalClienteBtnLogin || ''} onChange={e => updateField('portalClienteBtnLogin', e.target.value)} className="w-full px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Botão Cadastrar (Cliente)</label>
                <input type="text" value={settings.portalClienteBtnRegister || ''} onChange={e => updateField('portalClienteBtnRegister', e.target.value)} className="w-full px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
              </div>

              <div className="md:col-span-2 border-t border-slate-100 dark:border-slate-800 pt-2" />

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Badge Portal Fornecedor</label>
                <input type="text" value={settings.portalFornecedorBadge || ''} onChange={e => updateField('portalFornecedorBadge', e.target.value)} className="w-full px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Título Portal Fornecedor</label>
                <input type="text" value={settings.portalFornecedorTitle || ''} onChange={e => updateField('portalFornecedorTitle', e.target.value)} className="w-full px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Descrição Portal Fornecedor</label>
                <input type="text" value={settings.portalFornecedorDesc || ''} onChange={e => updateField('portalFornecedorDesc', e.target.value)} className="w-full px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Botão Entrar (Fornecedor)</label>
                <input type="text" value={settings.portalFornecedorBtnLogin || ''} onChange={e => updateField('portalFornecedorBtnLogin', e.target.value)} className="w-full px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Botão Cadastrar (Fornecedor)</label>
                <input type="text" value={settings.portalFornecedorBtnRegister || ''} onChange={e => updateField('portalFornecedorBtnRegister', e.target.value)} className="w-full px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4: TABS & FORM FIELDS (CLIENTE & FORNECEDOR) */}
      {activeSection === 'abas_campos' && (
        <div className="space-y-6">
          <div className="bg-blue-50/60 dark:bg-blue-950/30 p-4 rounded-2xl border border-blue-200 dark:border-blue-900">
            <h3 className="text-sm font-black text-blue-900 dark:text-blue-200 flex items-center gap-2">
              <LayoutGrid className="w-4 h-4 text-blue-600" />
              <span>Controle Total de Abas e Campos (Cliente & Fornecedor)</span>
            </h3>
            <p className="text-xs text-blue-800 dark:text-blue-300 mt-1">
              Renomeie, oculte ou exiba qualquer aba e campo de formulário usados por Clientes e Fornecedores. Clique em "Salvar Alterações" no topo para publicar.
            </p>
          </div>

          {/* Client Tabs & Supplier Tabs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-3">
              <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-blue-600" />
                <span>Abas do Painel do Cliente</span>
              </h4>
              <div className="space-y-2.5">
                {Object.entries(settings.clientTabs || {}).map(([tabKey, cfg]) => (
                  <div key={tabKey} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={cfg.visible}
                      onChange={e =>
                        updateField('clientTabs', {
                          ...(settings.clientTabs || {}),
                          [tabKey]: { ...cfg, visible: e.target.checked },
                        })
                      }
                      className="w-4 h-4 rounded text-blue-600 cursor-pointer shrink-0"
                      title="Exibir/Ocultar aba"
                    />
                    <input
                      type="text"
                      value={cfg.label}
                      onChange={e =>
                        updateField('clientTabs', {
                          ...(settings.clientTabs || {}),
                          [tabKey]: { ...cfg, label: e.target.value },
                        })
                      }
                      className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs font-bold"
                    />
                    <span className="text-[10px] font-mono text-slate-400 shrink-0">{tabKey}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-3">
              <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Store className="w-4 h-4 text-emerald-600" />
                <span>Abas do Portal do Fornecedor</span>
              </h4>
              <div className="space-y-2.5">
                {Object.entries(settings.supplierTabs || {}).map(([tabKey, cfg]) => (
                  <div key={tabKey} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={cfg.visible}
                      onChange={e =>
                        updateField('supplierTabs', {
                          ...(settings.supplierTabs || {}),
                          [tabKey]: { ...cfg, visible: e.target.checked },
                        })
                      }
                      className="w-4 h-4 rounded text-emerald-600 cursor-pointer shrink-0"
                      title="Exibir/Ocultar aba"
                    />
                    <input
                      type="text"
                      value={cfg.label}
                      onChange={e =>
                        updateField('supplierTabs', {
                          ...(settings.supplierTabs || {}),
                          [tabKey]: { ...cfg, label: e.target.value },
                        })
                      }
                      className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs font-bold"
                    />
                    <span className="text-[10px] font-mono text-slate-400 shrink-0">{tabKey}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Form Fields Config */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-3">
              <h4 className="text-sm font-black text-slate-900 dark:text-white">
                Campos de Solicitação (Cliente)
              </h4>
              <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                {Object.entries(settings.clientFields || {}).map(([fieldKey, cfg]) => (
                  <div key={fieldKey} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={cfg.visible}
                          onChange={e =>
                            updateField('clientFields', {
                              ...(settings.clientFields || {}),
                              [fieldKey]: { ...cfg, visible: e.target.checked },
                            })
                          }
                          className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                        />
                        <span>Visível</span>
                      </label>
                      <span className="text-[10px] font-mono text-slate-400">{fieldKey}</span>
                    </div>
                    <input
                      type="text"
                      value={cfg.label}
                      placeholder="Título do campo"
                      onChange={e =>
                        updateField('clientFields', {
                          ...(settings.clientFields || {}),
                          [fieldKey]: { ...cfg, label: e.target.value },
                        })
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs font-bold"
                    />
                    <input
                      type="text"
                      value={cfg.placeholder || ''}
                      placeholder="Texto de exemplo (placeholder)"
                      onChange={e =>
                        updateField('clientFields', {
                          ...(settings.clientFields || {}),
                          [fieldKey]: { ...cfg, placeholder: e.target.value },
                        })
                      }
                      className="w-full px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px]"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-3">
              <h4 className="text-sm font-black text-slate-900 dark:text-white">
                Campos de Orçamento (Fornecedor)
              </h4>
              <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                {Object.entries(settings.supplierFields || {}).map(([fieldKey, cfg]) => (
                  <div key={fieldKey} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={cfg.visible}
                          onChange={e =>
                            updateField('supplierFields', {
                              ...(settings.supplierFields || {}),
                              [fieldKey]: { ...cfg, visible: e.target.checked },
                            })
                          }
                          className="w-4 h-4 rounded text-emerald-600 cursor-pointer"
                        />
                        <span>Visível</span>
                      </label>
                      <span className="text-[10px] font-mono text-slate-400">{fieldKey}</span>
                    </div>
                    <input
                      type="text"
                      value={cfg.label}
                      placeholder="Título do campo"
                      onChange={e =>
                        updateField('supplierFields', {
                          ...(settings.supplierFields || {}),
                          [fieldKey]: { ...cfg, label: e.target.value },
                        })
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs font-bold"
                    />
                    <input
                      type="text"
                      value={cfg.placeholder || ''}
                      placeholder="Texto de exemplo (placeholder)"
                      onChange={e =>
                        updateField('supplierFields', {
                          ...(settings.supplierFields || {}),
                          [fieldKey]: { ...cfg, placeholder: e.target.value },
                        })
                      }
                      className="w-full px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px]"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 5: ALARMS & PAYMENT METHODS */}
      {activeSection === 'alarmes_pagamentos' && (
        <div className="space-y-6">
          {/* Alarms Manager */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Volume2 className="w-5 h-5 text-amber-600" />
                <div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white">
                    Configuração Global de Alarmes Sonoros (Cliente & Fornecedor)
                  </h4>
                  <p className="text-xs text-slate-500">
                    Escolha o toque, intensidade do volume, repetições ou desative alarmes por evento.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {(
                [
                  { key: 'nova_oportunidade', label: 'Chamado: Nova Oportunidade (Fornecedor)' },
                  { key: 'venda_confirmada', label: 'Venda Confirmada / Pagamento (Fornecedor)' },
                  { key: 'orcamento_recebido', label: 'Orçamento Recebido (Cliente)' },
                  { key: 'pedido_a_caminho', label: 'Pedido a Caminho / Rastreio (Cliente)' },
                  { key: 'mensagem_chat', label: 'Nova Mensagem no Chat / SAC' },
                  { key: 'alerta_admin', label: 'Alerta / Recado Direcionado' },
                ] as { key: AlarmEventKey; label: string }[]
              ).map(ev => {
                const cfg = settings.alarmSettings?.[ev.key] || {
                  enabled: true,
                  tone: 'urgent_alarm' as AlarmToneOption,
                  volume: 0.25,
                  repeatCount: 1,
                };
                const updateAlarm = (patch: Partial<typeof cfg>) => {
                  updateField('alarmSettings', {
                    ...(settings.alarmSettings || {}),
                    [ev.key]: { ...cfg, ...patch },
                  } as AppCustomizationSettings['alarmSettings']);
                };
                return (
                  <div key={ev.key} className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-black text-slate-900 dark:text-white">
                        <input
                          type="checkbox"
                          checked={cfg.enabled}
                          onChange={e => updateAlarm({ enabled: e.target.checked })}
                          className="w-4 h-4 rounded text-purple-600 cursor-pointer"
                        />
                        <span>{ev.label}</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => soundEffects.playTone(cfg.tone, cfg.volume, cfg.repeatCount)}
                        className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-black flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        <Play className="w-3 h-3" />
                        <span>Testar Som</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <select
                        value={cfg.tone}
                        onChange={e => updateAlarm({ tone: e.target.value as AlarmToneOption })}
                        className="px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-semibold text-[11px]"
                      >
                        <option value="urgent_alarm">Sirene Urgente</option>
                        <option value="cash_success">Caixa / Venda</option>
                        <option value="delivery_chime">Sino Suave</option>
                        <option value="warning_beep">Bipe Aviso</option>
                        <option value="chat_tone">Toque Chat/SAC</option>
                        <option value="siren_pulse">Pulso Duplo</option>
                      </select>

                      <div className="flex flex-col">
                        <span className="text-[10px] text-slate-400">Volume: {Math.round(cfg.volume * 100)}%</span>
                        <input
                          type="range"
                          min={0.05}
                          max={1}
                          step={0.05}
                          value={cfg.volume}
                          onChange={e => updateAlarm({ volume: Number(e.target.value) })}
                          className="w-full"
                        />
                      </div>

                      <select
                        value={cfg.repeatCount}
                        onChange={e => updateAlarm({ repeatCount: Number(e.target.value) })}
                        className="px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-semibold text-[11px]"
                      >
                        <option value={1}>1x Toque</option>
                        <option value={2}>2x Toques</option>
                        <option value={3}>3x Toques</option>
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Payment Methods Manager */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-600" />
                <div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white">
                    Meios de Pagamento Padrão do Checkout
                  </h4>
                  <p className="text-xs text-slate-500">
                    Adicione, edite, ative ou remova meios de pagamento exibidos aos clientes no fechamento do pedido.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  const newItem: PaymentMethodConfigItem = {
                    id: `pay_${Date.now()}`,
                    key: `custom_${Date.now()}`,
                    label: 'Novo Meio de Pagamento',
                    enabled: true,
                    instructions: 'Instruções personalizadas de pagamento.',
                    badgeText: 'Disponível',
                  };
                  updateField('paymentMethodsConfig', [...(settings.paymentMethodsConfig || []), newItem]);
                }}
                className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Adicionar Meio de Pagamento</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {(settings.paymentMethodsConfig || []).map((pm, idx) => (
                <div key={pm.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                  <label className="md:col-span-2 flex items-center gap-2 text-xs font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pm.enabled}
                      onChange={e => {
                        const list = [...(settings.paymentMethodsConfig || [])];
                        list[idx] = { ...pm, enabled: e.target.checked };
                        updateField('paymentMethodsConfig', list);
                      }}
                      className="w-4 h-4 rounded text-emerald-600 cursor-pointer"
                    />
                    <span>Ativo</span>
                  </label>

                  <input
                    type="text"
                    value={pm.label}
                    placeholder="Nome (ex: PIX, Boleto)"
                    onChange={e => {
                      const list = [...(settings.paymentMethodsConfig || [])];
                      list[idx] = { ...pm, label: e.target.value };
                      updateField('paymentMethodsConfig', list);
                    }}
                    className="md:col-span-3 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs font-bold"
                  />

                  <input
                    type="text"
                    value={pm.badgeText || ''}
                    placeholder="Selo (ex: Instantâneo)"
                    onChange={e => {
                      const list = [...(settings.paymentMethodsConfig || [])];
                      list[idx] = { ...pm, badgeText: e.target.value };
                      updateField('paymentMethodsConfig', list);
                    }}
                    className="md:col-span-2 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs"
                  />

                  <input
                    type="text"
                    value={pm.instructions || ''}
                    placeholder="Instruções ao cliente"
                    onChange={e => {
                      const list = [...(settings.paymentMethodsConfig || [])];
                      list[idx] = { ...pm, instructions: e.target.value };
                      updateField('paymentMethodsConfig', list);
                    }}
                    className="md:col-span-4 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs"
                  />

                  <button
                    type="button"
                    onClick={() => {
                      const list = (settings.paymentMethodsConfig || []).filter(p => p.id !== pm.id);
                      updateField('paymentMethodsConfig', list);
                    }}
                    className="md:col-span-1 p-1.5 rounded-lg text-red-600 hover:bg-red-50 flex items-center justify-center cursor-pointer"
                    title="Remover meio de pagamento"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4: LIVE PREVIEW */}
      {activeSection === 'preview' && (
        <div className="space-y-4">
          <div className="bg-slate-900 text-white p-4 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider">
                Demonstração em Tempo Real
              </span>
              <h3 className="text-base font-black">
                Como os usuários verão a aplicação com suas alterações
              </h3>
            </div>
            <span
              className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700"
            >
              Fonte: {settings.fontFamily}
            </span>
          </div>

          <div
            className="p-6 rounded-3xl bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 shadow-xl space-y-6"
            style={{ fontFamily: settings.fontFamily }}
          >
            {/* Header simulation */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <img
                  src={settings.logoUrl || '/assets/aistudio/M1_AUTO_LOGO_3c381c58.jpg'}
                  alt="Logo"
                  className="h-10 w-auto rounded-lg object-contain bg-slate-900 p-0.5"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className="text-xl font-black tracking-tight"
                      style={{ color: settings.primaryTextColor }}
                    >
                      {settings.appName} {settings.appSubtitle}
                    </span>
                    <span
                      className="text-[10px] font-black px-2 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: settings.primaryBrandColor }}
                    >
                      Oficial
                    </span>
                  </div>
                  <span
                    className="text-xs font-bold"
                    style={{ color: settings.secondaryTextColor }}
                  >
                    {settings.appSlogan} · {settings.headerWebsite}
                  </span>
                </div>
              </div>
            </div>

            {/* Banner simulation */}
            <div
              className="p-5 rounded-2xl text-white space-y-2 shadow-lg"
              style={{
                background: `linear-gradient(135deg, ${settings.primaryBrandColor} 0%, #0f172a 100%)`,
              }}
            >
              <span
                className="text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full inline-block"
                style={{ backgroundColor: settings.accentColor, color: '#000000' }}
              >
                PROMOÇÃO & AGILIDADE
              </span>
              <h3 className="text-xl font-black">
                {settings.clientWelcomeTitle}
              </h3>
              <p className="text-xs opacity-90 max-w-xl">
                {settings.appTagline}
              </p>
            </div>

            {/* Sample Part Card with high-contrast container */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center gap-4">
              <div className="compe-img-card w-28 h-24 shrink-0 flex items-center justify-center p-2">
                <img
                  src="/src/assets/images/compe_hero_autoparts_1793928394704.jpg"
                  alt="Amortecedor Corolla"
                  className="max-h-full max-w-full object-contain compe-img-vibrant"
                />
              </div>

              <div className="flex-1 space-y-1 text-center sm:text-left">
                <span
                  className="text-[10px] font-bold uppercase tracking-wider"
                  style={{ color: settings.primaryBrandColor }}
                >
                  Toyota Corolla 2018 · Suspensão
                </span>
                <h4
                  className="text-base font-black"
                  style={{ color: settings.primaryTextColor }}
                >
                  Amortecedor Dianteiro Original Nakata
                </h4>
                <p
                  className="text-xs"
                  style={{ color: settings.secondaryTextColor }}
                >
                  {settings.quotesSubtitle}
                </p>
                <p className="text-[11px] text-slate-500 font-mono">
                  {settings.privacyRuleNotice}
                </p>
              </div>

              <div className="text-center sm:text-right shrink-0 space-y-2">
                <div
                  className="text-2xl font-black"
                  style={{ color: settings.primaryTextColor }}
                >
                  R$ 320,00
                </div>
                <button
                  className="px-5 py-2.5 rounded-xl text-white font-extrabold text-xs shadow-md transition hover:opacity-90 cursor-pointer"
                  style={{ backgroundColor: settings.primaryBrandColor }}
                >
                  {settings.requestButtonText}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
