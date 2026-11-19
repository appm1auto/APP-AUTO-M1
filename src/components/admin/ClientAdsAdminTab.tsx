/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  CheckCircle,
  Edit2,
  ExternalLink,
  Eye,
  Film,
  Image as ImageIcon,
  Link2,
  Megaphone,
  Plus,
  Save,
  Sliders,
  Tag,
  Trash2,
  Type,
  Upload,
  X,
} from 'lucide-react';
import {
  ClientAdItem,
  ClientAdMediaType,
  ClientAdsFooterMode,
  ClientAdsFooterSize,
  ClientAdsSettings,
  User,
} from '../../types';
import { db } from '../../services/db';

interface ClientAdsAdminTabProps {
  currentUser: User;
}

export const ClientAdsAdminTab: React.FC<ClientAdsAdminTabProps> = ({ currentUser }) => {
  const [settings, setSettings] = useState<ClientAdsSettings>(() => db.getClientAdsSettings());
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [previewSplashAd, setPreviewSplashAd] = useState<ClientAdItem | null>(null);

  // Draft numeric fields (permite digitar livremente sem resetar ao apagar)
  const [splashSecInput, setSplashSecInput] = useState(String(settings.startupSplashSeconds || 3));
  const [intervalSecInput, setIntervalSecInput] = useState(String(settings.intervalSeconds || 5));
  const [periodicIntervalInput, setPeriodicIntervalInput] = useState(
    String(settings.periodicIntervalSeconds || 20)
  );
  const [periodicDurationInput, setPeriodicDurationInput] = useState(
    String(settings.periodicDurationSeconds || 8)
  );
  const [customHeightInput, setCustomHeightInput] = useState(
    settings.footerCustomHeightPx ? String(settings.footerCustomHeightPx) : ''
  );

  // Formulário de Adição / Edição de Anúncio
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adTitle, setAdTitle] = useState('');
  const [adDescription, setAdDescription] = useState('');
  const [adMediaType, setAdMediaType] = useState<ClientAdMediaType>('image');
  const [adMediaUrl, setAdMediaUrl] = useState('');
  const [adLinkUrl, setAdLinkUrl] = useState('');
  const [adLinkLabel, setAdLinkLabel] = useState('Ver Oferta');
  const [adPrice, setAdPrice] = useState('');
  const [adDurationSeconds, setAdDurationSeconds] = useState('');
  const [adActive, setAdActive] = useState(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const unsub = db.subscribe(() => {
      const latest = db.getClientAdsSettings();
      setSettings(latest);
      setSplashSecInput(String(latest.startupSplashSeconds || 3));
      setIntervalSecInput(String(latest.intervalSeconds || 5));
      setPeriodicIntervalInput(String(latest.periodicIntervalSeconds || 20));
      setPeriodicDurationInput(String(latest.periodicDurationSeconds || 8));
      setCustomHeightInput(latest.footerCustomHeightPx ? String(latest.footerCustomHeightPx) : '');
    });
    return () => {
      unsub();
    };
  }, []);

  const showSavedNotice = (msg: string) => {
    setErrorMsg(null);
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleSaveSettings = (
    nextPartial: Partial<ClientAdsSettings>,
    msg = 'Programação de anúncios salva!'
  ) => {
    const updated = db.updateClientAdsSettings(nextPartial, currentUser.id);
    setSettings(updated);
    showSavedNotice(msg);
  };

  const commitTimingSettings = () => {
    const startupSplashSeconds = Math.max(1, parseInt(splashSecInput, 10) || 3);
    const intervalSeconds = Math.max(1, parseInt(intervalSecInput, 10) || 5);
    const periodicIntervalSeconds = Math.max(2, parseInt(periodicIntervalInput, 10) || 20);
    const periodicDurationSeconds = Math.max(2, parseInt(periodicDurationInput, 10) || 8);
    const parsedHeight = parseInt(customHeightInput, 10);
    const footerCustomHeightPx =
      Number.isFinite(parsedHeight) && parsedHeight >= 56 && parsedHeight <= 320
        ? parsedHeight
        : undefined;

    setSplashSecInput(String(startupSplashSeconds));
    setIntervalSecInput(String(intervalSeconds));
    setPeriodicIntervalInput(String(periodicIntervalSeconds));
    setPeriodicDurationInput(String(periodicDurationSeconds));
    setCustomHeightInput(footerCustomHeightPx ? String(footerCustomHeightPx) : '');

    handleSaveSettings(
      {
        startupSplashSeconds,
        intervalSeconds,
        periodicIntervalSeconds,
        periodicDurationSeconds,
        footerCustomHeightPx,
      },
      'Programação de tempo e tamanho salva no App dos Clientes!'
    );
  };

  const resetForm = () => {
    setEditingId(null);
    setAdTitle('');
    setAdDescription('');
    setAdMediaType('image');
    setAdMediaUrl('');
    setAdLinkUrl('');
    setAdLinkLabel('Ver Oferta');
    setAdPrice('');
    setAdDurationSeconds('');
    setAdActive(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUploadAdMedia = async (file: File) => {
    setIsUploadingMedia(true);
    setErrorMsg(null);
    try {
      const res = await db.uploadSharedMediaFile(file);
      if (res.ok && res.url) {
        setAdMediaUrl(res.url);
        if (file.type.startsWith('video/')) setAdMediaType('video');
        else if (file.type.startsWith('image/')) setAdMediaType('image');
        showSavedNotice(`Arquivo "${res.fileName || file.name}" carregado com sucesso.`);
      } else {
        setErrorMsg(res.message || 'Falha ao enviar arquivo de mídia.');
      }
    } finally {
      setIsUploadingMedia(false);
    }
  };

  const handleSaveAdItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adTitle.trim()) {
      setErrorMsg('Informe o título da propaganda / produto.');
      return;
    }
    if ((adMediaType === 'image' || adMediaType === 'video') && !adMediaUrl.trim()) {
      setErrorMsg(
        `Anexe ou informe a URL ${adMediaType === 'video' ? 'do vídeo curto' : 'da foto'}.`
      );
      return;
    }

    const parsedPrice = parseFloat(adPrice.replace(',', '.'));
    const parsedDuration = parseInt(adDurationSeconds, 10);
    const nowIso = new Date().toISOString();

    const currentItems = [...(settings.items || [])];
    if (editingId) {
      const updatedItems = currentItems.map(item =>
        item.id === editingId
          ? {
              ...item,
              title: adTitle.trim(),
              description: adDescription.trim() || undefined,
              mediaType: adMediaType,
              mediaUrl: adMediaUrl.trim() || undefined,
              linkUrl: adLinkUrl.trim() || undefined,
              linkLabel: adLinkLabel.trim() || undefined,
              price: Number.isFinite(parsedPrice) && parsedPrice > 0 ? parsedPrice : undefined,
              durationSeconds:
                Number.isFinite(parsedDuration) && parsedDuration > 0 ? parsedDuration : undefined,
              active: adActive,
              updatedAt: nowIso,
            }
          : item
      );
      handleSaveSettings({ items: updatedItems }, 'Anúncio atualizado no App dos Clientes!');
    } else {
      const newItem: ClientAdItem = {
        id: `ad_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        title: adTitle.trim(),
        description: adDescription.trim() || undefined,
        mediaType: adMediaType,
        mediaUrl: adMediaUrl.trim() || undefined,
        linkUrl: adLinkUrl.trim() || undefined,
        linkLabel: adLinkLabel.trim() || undefined,
        price: Number.isFinite(parsedPrice) && parsedPrice > 0 ? parsedPrice : undefined,
        durationSeconds:
          Number.isFinite(parsedDuration) && parsedDuration > 0 ? parsedDuration : undefined,
        active: adActive,
        order: currentItems.length,
        createdAt: nowIso,
      };
      handleSaveSettings(
        { items: [...currentItems, newItem] },
        'Novo anúncio publicado no App dos Clientes!'
      );
    }

    resetForm();
  };

  const handleEditItem = (item: ClientAdItem) => {
    setEditingId(item.id);
    setAdTitle(item.title);
    setAdDescription(item.description || '');
    setAdMediaType(item.mediaType);
    setAdMediaUrl(item.mediaUrl || '');
    setAdLinkUrl(item.linkUrl || '');
    setAdLinkLabel(item.linkLabel || 'Ver Oferta');
    setAdPrice(item.price !== undefined ? String(item.price) : '');
    setAdDurationSeconds(item.durationSeconds !== undefined ? String(item.durationSeconds) : '');
    setAdActive(item.active);
  };

  const handleToggleItemActive = (id: string) => {
    const updatedItems = settings.items.map(item =>
      item.id === id ? { ...item, active: !item.active } : item
    );
    handleSaveSettings({ items: updatedItems }, 'Visibilidade do anúncio atualizada.');
  };

  const handleMoveItem = (index: number, direction: -1 | 1) => {
    const sorted = [...settings.items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= sorted.length) return;
    const temp = sorted[index];
    sorted[index] = sorted[targetIdx];
    sorted[targetIdx] = temp;
    const reordered = sorted.map((item, idx) => ({ ...item, order: idx }));
    handleSaveSettings({ items: reordered }, 'Ordem sequencial do carrossel atualizada.');
  };

  const handleDeleteItem = (id: string) => {
    const remaining = settings.items
      .filter(item => item.id !== id)
      .map((item, idx) => ({ ...item, order: idx }));
    handleSaveSettings({ items: remaining }, 'Anúncio removido.');
    setConfirmDeleteId(null);
    if (editingId === id) resetForm();
  };

  const sortedItems = [...(settings.items || [])].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0)
  );
  const firstActiveItem = sortedItems.find(i => i.active) || sortedItems[0];

  return (
    <div className="space-y-6">
      {/* Banner Header */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-600 to-amber-600 text-white shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-3 rounded-2xl bg-white/20 shrink-0">
            <Megaphone className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-black">
              ANÚNCIOS — Carrossel & Tela Inicial do App dos Clientes
            </h2>
            <p className="text-xs text-amber-50 mt-0.5">
              Adicione fotos, vídeos curtos, textos, links e preços de produtos. Exiba na frente da tela nos 3 segundos iniciais ao abrir o app e em carrossel programável no rodapé (sequencial em segundos, pausado, fixo ou de tempos em tempos).
            </p>
          </div>
        </div>

        <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-black/25 font-black text-xs cursor-pointer shrink-0">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={e =>
              handleSaveSettings(
                { enabled: e.target.checked },
                e.target.checked
                  ? 'Sistema de anúncios ativado!'
                  : 'Anúncios desativados para clientes.'
              )
            }
            className="w-4 h-4 accent-white"
          />
          <span>Anúncios Ativos</span>
        </label>
      </div>

      {feedback && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-xs font-bold text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/60 border border-red-300 dark:border-red-800 text-xs font-bold text-red-700 dark:text-red-300">
          {errorMsg}
        </div>
      )}

      {/* Programação da Tela Inicial (3s) e Carrossel no Rodapé */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-purple-600" />
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
              Programação de Abertura (3s) & Rodapé do App do Cliente
            </h3>
          </div>

          <div className="flex items-center gap-2">
            {firstActiveItem && (
              <button
                type="button"
                onClick={() => {
                  const target =
                    (settings.startupAdItemId &&
                      sortedItems.find(i => i.id === settings.startupAdItemId)) ||
                    firstActiveItem;
                  setPreviewSplashAd(target);
                }}
                className="px-3 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-xs font-black flex items-center gap-1.5 cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Pré-visualizar Abertura ({splashSecInput || 3}s)</span>
              </button>
            )}
            <button
              type="button"
              onClick={commitTimingSettings}
              className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Salvar Programação</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Bloco 1: Abertura na Frente da Tela */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
            <label className="flex items-center gap-2 text-xs font-black text-slate-900 dark:text-white cursor-pointer">
              <input
                type="checkbox"
                checked={settings.showOnStartupSplash}
                onChange={e =>
                  handleSaveSettings({ showOnStartupSplash: e.target.checked })
                }
                className="w-4 h-4 accent-amber-500"
              />
              <span>Aparecer na Frente da Tela ao Abrir o App (3s iniciais)</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  Duração Inicial (segundos)
                </label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={splashSecInput}
                  onChange={e => setSplashSecInput(e.target.value)}
                  onBlur={commitTimingSettings}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  Anúncio de Destaque Inicial
                </label>
                <select
                  value={settings.startupAdItemId || ''}
                  onChange={e =>
                    handleSaveSettings({ startupAdItemId: e.target.value || undefined })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold"
                >
                  <option value="">1º Anúncio Ativo da Lista</option>
                  {sortedItems.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Bloco 2: Propaganda Sequencial no Rodapé */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
            <label className="flex items-center gap-2 text-xs font-black text-slate-900 dark:text-white cursor-pointer">
              <input
                type="checkbox"
                checked={settings.footerEnabled}
                onChange={e => handleSaveSettings({ footerEnabled: e.target.checked })}
                className="w-4 h-4 accent-amber-500"
              />
              <span>Exibir Propaganda no Rodapé (Parte de Baixo do App)</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  Modo de Exibição
                </label>
                <select
                  value={settings.footerMode}
                  onChange={e =>
                    handleSaveSettings({
                      footerMode: e.target.value as ClientAdsFooterMode,
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold"
                >
                  <option value="sequential">Sequencial (Segundos)</option>
                  <option value="paused">Pausado</option>
                  <option value="fixed">Fixo</option>
                  <option value="periodic">De Tempos em Tempos</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  Tamanho no Rodapé
                </label>
                <select
                  value={settings.footerSize}
                  onChange={e =>
                    handleSaveSettings({
                      footerSize: e.target.value as ClientAdsFooterSize,
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold"
                >
                  <option value="compact">Compacto</option>
                  <option value="medium">Médio</option>
                  <option value="large">Grande</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  Altura Exata (px, opcional)
                </label>
                <input
                  type="number"
                  min={56}
                  max={320}
                  value={customHeightInput}
                  onChange={e => setCustomHeightInput(e.target.value)}
                  onBlur={commitTimingSettings}
                  placeholder="Automática"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono font-bold"
                />
              </div>
            </div>

            {settings.footerMode === 'sequential' && (
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">
                    Tempo de cada slide (segundos)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={intervalSecInput}
                    onChange={e => setIntervalSecInput(e.target.value)}
                    onBlur={commitTimingSettings}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono font-bold"
                  />
                </div>
                <label className="flex items-center gap-2 pt-5 text-xs font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.allowUserPause}
                    onChange={e =>
                      handleSaveSettings({ allowUserPause: e.target.checked })
                    }
                    className="w-4 h-4 accent-amber-500"
                  />
                  <span>Cliente pode pausar</span>
                </label>
              </div>
            )}

            {settings.footerMode === 'fixed' && (
              <div className="text-xs">
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  Anúncio Fixo Selecionado
                </label>
                <select
                  value={settings.fixedAdItemId || ''}
                  onChange={e =>
                    handleSaveSettings({ fixedAdItemId: e.target.value || undefined })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold"
                >
                  <option value="">1º Anúncio Ativo</option>
                  {sortedItems.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {settings.footerMode === 'periodic' && (
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">
                    Aparecer a cada (segundos)
                  </label>
                  <input
                    type="number"
                    min={2}
                    max={600}
                    value={periodicIntervalInput}
                    onChange={e => setPeriodicIntervalInput(e.target.value)}
                    onBlur={commitTimingSettings}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">
                    Permanecer visível (segundos)
                  </label>
                  <input
                    type="number"
                    min={2}
                    max={120}
                    value={periodicDurationInput}
                    onChange={e => setPeriodicDurationInput(e.target.value)}
                    onBlur={commitTimingSettings}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono font-bold"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Formulário para Adicionar / Editar Anúncio */}
      <form
        onSubmit={handleSaveAdItem}
        className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4"
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-amber-500" />
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
              {editingId ? 'Editar Anúncio Selecionado' : 'Adicionar Novo Anúncio ao Carrossel'}
            </h3>
          </div>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              Cancelar Edição
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="md:col-span-2">
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
              Título / Nome do Produto ou Oferta *
            </label>
            <input
              type="text"
              value={adTitle}
              onChange={e => setAdTitle(e.target.value)}
              placeholder="Ex: Kit Embreagem Luk Original + Instalação"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold"
              required
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
              Tipo de Mídia *
            </label>
            <select
              value={adMediaType}
              onChange={e => setAdMediaType(e.target.value as ClientAdMediaType)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold"
            >
              <option value="image">Foto / Imagem</option>
              <option value="video">Vídeo Curto (MP4/WebM)</option>
              <option value="text">Somente Texto / Aviso</option>
            </select>
          </div>
        </div>

        <div className="text-xs">
          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
            Texto / Descrição da Oferta
          </label>
          <textarea
            rows={2}
            value={adDescription}
            onChange={e => setAdDescription(e.target.value)}
            placeholder="Descreva condições, garantia ou mensagem promocional para o cliente..."
            className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
          />
        </div>

        {adMediaType !== 'text' && (
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2.5 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                {adMediaType === 'video' ? (
                  <Film className="w-4 h-4 text-purple-600" />
                ) : (
                  <ImageIcon className="w-4 h-4 text-blue-600" />
                )}
                <span>
                  {adMediaType === 'video'
                    ? 'Enviar Vídeo Curto ou Colar URL'
                    : 'Enviar Foto ou Colar URL'}
                </span>
              </span>

              <label className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer self-start sm:self-auto">
                <Upload className="w-3.5 h-3.5" />
                <span>{isUploadingMedia ? 'Enviando...' : 'Carregar do Computador/Celular'}</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={adMediaType === 'video' ? 'video/*' : 'image/*'}
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) handleUploadAdMedia(f);
                  }}
                />
              </label>
            </div>

            <input
              type="text"
              value={adMediaUrl}
              onChange={e => setAdMediaUrl(e.target.value)}
              placeholder="Ou cole o link direto da foto/vídeo (https://... ou /api/media/...)"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-[11px]"
            />

            {adMediaUrl && (
              <div className="pt-1 flex items-center gap-3">
                {adMediaType === 'video' ? (
                  <video
                    src={adMediaUrl}
                    controls
                    muted
                    className="h-20 w-32 rounded-xl bg-black object-contain border border-slate-700"
                  />
                ) : (
                  <img
                    src={adMediaUrl}
                    alt="Prévia"
                    className="h-20 w-24 rounded-xl bg-slate-900 object-contain border border-slate-300 dark:border-slate-700"
                  />
                )}
                <span className="text-[11px] text-emerald-600 font-bold">
                  Mídia pronta para exibição no carrossel!
                </span>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
              Preço do Produto (R$)
            </label>
            <div className="relative">
              <Tag className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="number"
                step="0.01"
                min="0"
                value={adPrice}
                onChange={e => setAdPrice(e.target.value)}
                placeholder="Ex: 249.90"
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
              Link de Destino (Opcional)
            </label>
            <div className="relative">
              <Link2 className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={adLinkUrl}
                onChange={e => setAdLinkUrl(e.target.value)}
                placeholder="https://..."
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
              Texto do Botão do Link
            </label>
            <input
              type="text"
              value={adLinkLabel}
              onChange={e => setAdLinkLabel(e.target.value)}
              placeholder="Ver Oferta"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
              Tempo Individual (seg, opcional)
            </label>
            <input
              type="number"
              min="1"
              max="120"
              value={adDurationSeconds}
              onChange={e => setAdDurationSeconds(e.target.value)}
              placeholder={`Padrão (${settings.intervalSeconds}s)`}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
            <input
              type="checkbox"
              checked={adActive}
              onChange={e => setAdActive(e.target.checked)}
              className="w-4 h-4 accent-emerald-600"
            />
            <span>Ativar imediatamente para clientes</span>
          </label>

          <button
            type="submit"
            disabled={isUploadingMedia}
            className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs shadow-md flex items-center gap-2 cursor-pointer transition"
          >
            <Save className="w-4 h-4" />
            <span>{editingId ? 'Salvar Alterações do Anúncio' : 'Adicionar Anúncio ao Carrossel'}</span>
          </button>
        </div>
      </form>

      {/* Lista Sequencial dos Anúncios Cadastrados */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
          Anúncios Cadastrados no Carrossel ({sortedItems.length})
        </h3>

        {sortedItems.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
            Nenhum anúncio cadastrado ainda. Use o formulário acima para adicionar fotos, vídeos curtos, textos, links e preços.
          </div>
        ) : (
          <div className="space-y-3">
            {sortedItems.map((item, idx) => (
              <div
                key={item.id}
                className={`p-3.5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  item.active
                    ? 'border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-900 opacity-60'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {item.mediaType === 'image' && item.mediaUrl ? (
                    <img
                      src={item.mediaUrl}
                      alt={item.title}
                      className="w-16 h-16 rounded-xl object-cover bg-slate-900 border border-slate-200 dark:border-slate-700 shrink-0"
                    />
                  ) : item.mediaType === 'video' && item.mediaUrl ? (
                    <video
                      src={item.mediaUrl}
                      muted
                      className="w-16 h-16 rounded-xl object-cover bg-black border border-slate-700 shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center shrink-0">
                      <Type className="w-6 h-6" />
                    </div>
                  )}

                  <div className="min-w-0 space-y-1 text-xs">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono font-black text-[10px] px-1.5 py-0.5 rounded bg-slate-900 text-white">
                        #{idx + 1}
                      </span>
                      <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                        {item.mediaType === 'image'
                          ? 'Foto'
                          : item.mediaType === 'video'
                          ? 'Vídeo'
                          : 'Texto'}
                      </span>
                      {typeof item.price === 'number' && item.price > 0 && (
                        <span className="font-mono font-black text-[11px] px-2 py-0.5 rounded bg-emerald-600 text-white">
                          R$ {item.price.toFixed(2)}
                        </span>
                      )}
                      {item.durationSeconds && (
                        <span className="text-[10px] font-mono text-slate-500">
                          {item.durationSeconds}s
                        </span>
                      )}
                    </div>
                    <strong className="text-sm text-slate-900 dark:text-white block truncate">
                      {item.title}
                    </strong>
                    {item.description && (
                      <p className="text-[11px] text-slate-500 line-clamp-1">{item.description}</p>
                    )}
                    {item.linkUrl && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 font-semibold">
                        <ExternalLink className="w-3 h-3" /> {item.linkUrl}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                  <button
                    type="button"
                    onClick={() => setPreviewSplashAd(item)}
                    className="p-2 rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 cursor-pointer"
                    title="Pré-visualizar na tela"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveItem(idx, -1)}
                    disabled={idx === 0}
                    className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 disabled:opacity-30 cursor-pointer"
                    title="Mover para cima"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveItem(idx, 1)}
                    disabled={idx === sortedItems.length - 1}
                    className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 disabled:opacity-30 cursor-pointer"
                    title="Mover para baixo"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleItemActive(item.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer ${
                      item.active
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {item.active ? 'Ativo' : 'Oculto'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEditItem(item)}
                    className="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Edit2 className="w-3 h-3" /> Editar
                  </button>

                  {confirmDeleteId === item.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleDeleteItem(item.id)}
                        className="px-2.5 py-1.5 rounded-lg bg-red-600 text-white text-[11px] font-black cursor-pointer"
                      >
                        Confirmar
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-2 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-[11px] font-bold cursor-pointer"
                      >
                        Não
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(item.id)}
                      className="p-2 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-950/60 text-red-600 cursor-pointer"
                      title="Excluir anúncio"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de Pré-visualização de Abertura no Admin */}
      {previewSplashAd && (
        <div className="fixed inset-0 z-[105] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border-2 border-amber-400 shadow-2xl overflow-hidden">
            <div className="px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white flex items-center justify-between">
              <span className="text-xs font-black uppercase">
                Prévia no App do Cliente ({splashSecInput || 3}s iniciais)
              </span>
              <button
                type="button"
                onClick={() => setPreviewSplashAd(null)}
                className="p-1 rounded-full hover:bg-white/20 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {previewSplashAd.mediaType === 'image' && previewSplashAd.mediaUrl && (
              <div className="h-52 bg-slate-950">
                <img
                  src={previewSplashAd.mediaUrl}
                  alt={previewSplashAd.title}
                  className="w-full h-full object-contain"
                />
              </div>
            )}
            {previewSplashAd.mediaType === 'video' && previewSplashAd.mediaUrl && (
              <div className="h-52 bg-black">
                <video
                  src={previewSplashAd.mediaUrl}
                  autoPlay
                  muted
                  loop
                  controls
                  className="w-full h-full object-contain"
                />
              </div>
            )}
            <div className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <h4 className="font-black text-base text-slate-900 dark:text-white">
                  {previewSplashAd.title}
                </h4>
                {typeof previewSplashAd.price === 'number' && previewSplashAd.price > 0 && (
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-mono font-black text-xs shrink-0">
                    R$ {previewSplashAd.price.toFixed(2)}
                  </span>
                )}
              </div>
              {previewSplashAd.description && (
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  {previewSplashAd.description}
                </p>
              )}
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setPreviewSplashAd(null)}
                  className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold cursor-pointer"
                >
                  Fechar Prévia
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
