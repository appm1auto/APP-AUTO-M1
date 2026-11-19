/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  X,
  Save,
  Play,
  Eye,
  Plus,
  Trash2,
  Image as ImageIcon,
  CreditCard,
  Megaphone,
  Palette,
  LayoutGrid,
  CheckCircle,
  Send
} from 'lucide-react';
import {
  FontFamilyOption,
  PaymentMethodConfigItem,
  SpamCustomButton,
  SpamCustomField,
  SpamImageItem,
  SpamSectionVisibility,
  SpamTriggerConfig
} from '../../types';
import { db } from '../../services/db';
import { soundEffects } from '../../services/sound';

interface SpamEditorModalProps {
  config: SpamTriggerConfig | null;
  adminId: string;
  onSuccess: () => void;
  onClose: () => void;
  onPreviewSpam?: (draftConfig: SpamTriggerConfig) => void;
}

const DEFAULT_VISIBILITY: SpamSectionVisibility = {
  showTimer: true,
  showPartIdentification: true,
  showPhoto: true,
  showLocation: true,
  showQuoteForm: true,
  showFinancialSummary: true,
  showCustomerData: true,
  showPaymentMethods: true,
};

export const SpamEditorModal: React.FC<SpamEditorModalProps> = ({
  config,
  adminId,
  onSuccess,
  onClose,
  onPreviewSpam,
}) => {
  const isNew = !config;
  const [editorTab, setEditorTab] = useState<'geral' | 'estrutura' | 'pagamentos'>('geral');

  // Aba 1: Geral, Fontes & Cores
  const [type, setType] = useState<SpamTriggerConfig['type']>(config?.type || 'nova_oportunidade');
  const [targetAudience, setTargetAudience] = useState<SpamTriggerConfig['targetAudience']>(
    config?.targetAudience || 'fornecedor'
  );
  const [badgeText, setBadgeText] = useState(config?.badgeText || 'AUTO SHOP ALERTA EM TEMPO REAL');
  const [title, setTitle] = useState(config?.title || '');
  const [subtitle, setSubtitle] = useState(config?.subtitle || '');
  const [fontFamily, setFontFamily] = useState<FontFamilyOption>(config?.fontFamily || 'Inter');
  const [titleFontSize, setTitleFontSize] = useState<'sm' | 'md' | 'lg' | 'xl'>(config?.titleFontSize || 'md');
  const [colorScheme, setColorScheme] = useState<SpamTriggerConfig['colorScheme']>(
    config?.colorScheme || 'orange'
  );
  const [headerBgColor, setHeaderBgColor] = useState(config?.headerBgColor || '#ea580c');
  const [headerTextColor, setHeaderTextColor] = useState(config?.headerTextColor || '#ffffff');
  const [bodyBgColor, setBodyBgColor] = useState(config?.bodyBgColor || '');
  const [bodyTextColor, setBodyTextColor] = useState(config?.bodyTextColor || '');
  const [borderColor, setBorderColor] = useState(config?.borderColor || '#f97316');
  const [actionButtonBgColor, setActionButtonBgColor] = useState(config?.actionButtonBgColor || '#ea580c');
  const [actionButtonTextColor, setActionButtonTextColor] = useState(config?.actionButtonTextColor || '#ffffff');
  const [countdownSeconds, setCountdownSeconds] = useState(config?.countdownSeconds ?? 600);
  const [soundEnabled, setSoundEnabled] = useState(config?.soundEnabled ?? true);
  const [soundType, setSoundType] = useState<SpamTriggerConfig['soundType']>(
    config?.soundType || 'urgent_alarm'
  );
  const [actionButtonLabel, setActionButtonLabel] = useState(
    config?.actionButtonLabel || 'CONFIRMAR AÇÃO'
  );
  const [showDefaultActionButton, setShowDefaultActionButton] = useState(config?.showDefaultActionButton !== false);
  const [isMandatoryAction, setIsMandatoryAction] = useState(config?.isMandatoryAction ?? true);

  // Aba 2: Seções, Campos, Imagens & Botões
  const [sectionVisibility, setSectionVisibility] = useState<SpamSectionVisibility>({
    ...DEFAULT_VISIBILITY,
    ...(config?.sectionVisibility || {}),
  });
  const [customFields, setCustomFields] = useState<SpamCustomField[]>(config?.customFields || []);
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldValue, setNewFieldValue] = useState('');
  const [newFieldType, setNewFieldType] = useState<'text' | 'highlight' | 'input'>('text');

  const [images, setImages] = useState<SpamImageItem[]>(config?.images || []);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newImageCaption, setNewImageCaption] = useState('');

  const [customButtons, setCustomButtons] = useState<SpamCustomButton[]>(config?.customButtons || []);
  const [newBtnLabel, setNewBtnLabel] = useState('');
  const [newBtnBgColor, setNewBtnBgColor] = useState('#2563eb');
  const [newBtnTextColor, setNewBtnTextColor] = useState('#ffffff');
  const [newBtnActionType, setNewBtnActionType] = useState<SpamCustomButton['actionType']>('acknowledge');

  // Aba 3: Meios de Pagamento & Recados Direcionados
  const [paymentMethodsConfig, setPaymentMethodsConfig] = useState<PaymentMethodConfigItem[]>(
    config?.paymentMethodsConfig || db.getCustomizationSettings().paymentMethodsConfig || []
  );
  const [newPayLabel, setNewPayLabel] = useState('');
  const [newPayBadge, setNewPayBadge] = useState('');
  const [newPayInstructions, setNewPayInstructions] = useState('');
  const [globalPaySyncMessage, setGlobalPaySyncMessage] = useState<string | null>(null);

  const [targetedNoticeEnabled, setTargetedNoticeEnabled] = useState(config?.targetedNoticeEnabled ?? false);
  const [targetedMessage, setTargetedMessage] = useState(config?.targetedMessage || '');
  const [targetedAudienceFilter, setTargetedAudienceFilter] = useState<'all' | 'specific'>(
    config?.targetedAudienceFilter || 'all'
  );
  const [targetedUserIds, setTargetedUserIds] = useState<string[]>(config?.targetedUserIds || []);
  const [dispatchFeedback, setDispatchFeedback] = useState<string | null>(null);

  const audienceUsers = db.getUsers().filter(u => u.role === targetAudience);

  const buildDraftConfig = (): SpamTriggerConfig => ({
    id: config?.id || `spam_preview_${Date.now()}`,
    type,
    targetAudience,
    badgeText: badgeText.trim() || undefined,
    title: title.trim() || 'NOVO TEMPLATE DE SPAM AUTO SHOP',
    subtitle: subtitle.trim() || 'Mensagem configurada pelo Administrador.',
    fontFamily,
    titleFontSize,
    colorScheme,
    headerBgColor: headerBgColor || undefined,
    headerTextColor: headerTextColor || undefined,
    bodyBgColor: bodyBgColor || undefined,
    bodyTextColor: bodyTextColor || undefined,
    borderColor: borderColor || undefined,
    actionButtonBgColor: actionButtonBgColor || undefined,
    actionButtonTextColor: actionButtonTextColor || undefined,
    showDefaultActionButton,
    countdownSeconds: Number(countdownSeconds) || 0,
    soundEnabled,
    soundType,
    actionButtonLabel: actionButtonLabel.trim() || 'CONFIRMAR',
    isMandatoryAction,
    sectionVisibility,
    customFields,
    images,
    customButtons,
    paymentMethodsConfig,
    targetedNoticeEnabled,
    targetedMessage: targetedMessage.trim(),
    targetedAudienceFilter,
    targetedUserIds,
  });

  const handleTestSound = () => {
    if (soundType === 'urgent_alarm') soundEffects.playUrgentAlarm();
    else if (soundType === 'cash_success') soundEffects.playCashSuccess();
    else if (soundType === 'delivery_chime') soundEffects.playDeliveryChime();
    else soundEffects.playWarningBeep();
  };

  const handleImageUpload = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImages(prev => [
          ...prev,
          { id: `img_${Date.now()}`, url: reader.result as string, caption: newImageCaption.trim() || file.name },
        ]);
        setNewImageCaption('');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAddImageUrl = () => {
    if (!newImageUrl.trim()) return;
    setImages(prev => [
      ...prev,
      { id: `img_${Date.now()}`, url: newImageUrl.trim(), caption: newImageCaption.trim() || undefined },
    ]);
    setNewImageUrl('');
    setNewImageCaption('');
  };

  const handleAddField = () => {
    if (!newFieldLabel.trim()) return;
    setCustomFields(prev => [
      ...prev,
      {
        id: `fld_${Date.now()}`,
        label: newFieldLabel.trim(),
        value: newFieldValue.trim(),
        fieldType: newFieldType,
      },
    ]);
    setNewFieldLabel('');
    setNewFieldValue('');
  };

  const handleAddButton = () => {
    if (!newBtnLabel.trim()) return;
    setCustomButtons(prev => [
      ...prev,
      {
        id: `btn_${Date.now()}`,
        label: newBtnLabel.trim(),
        bgColor: newBtnBgColor,
        textColor: newBtnTextColor,
        actionType: newBtnActionType,
      },
    ]);
    setNewBtnLabel('');
  };

  const handleAddPaymentMethod = () => {
    if (!newPayLabel.trim()) return;
    const key = newPayLabel
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_');
    setPaymentMethodsConfig(prev => [
      ...prev,
      {
        id: `pay_${Date.now()}`,
        key,
        label: newPayLabel.trim(),
        enabled: true,
        badgeText: newPayBadge.trim() || undefined,
        instructions: newPayInstructions.trim() || undefined,
      },
    ]);
    setNewPayLabel('');
    setNewPayBadge('');
    setNewPayInstructions('');
  };

  const handleSyncGlobalPayments = () => {
    db.updateCustomizationSettings(
      { paymentMethodsConfig },
      adminId
    );
    setGlobalPaySyncMessage('Meios de pagamento sincronizados no Checkout Global!');
    setTimeout(() => setGlobalPaySyncMessage(null), 3500);
  };

  const handleDispatchDirected = () => {
    const msg = targetedMessage.trim() || subtitle.trim();
    if (!msg) {
      setDispatchFeedback('Escreva o recado direcionado ou subtítulo antes de disparar.');
      return;
    }
    if (targetedAudienceFilter === 'specific' && targetedUserIds.length === 0) {
      setDispatchFeedback('Selecione pelo menos 1 destinatário específico.');
      return;
    }
    const draft = buildDraftConfig();
    db.dispatchDirectedSpam(
      draft,
      adminId,
      msg,
      targetedAudienceFilter === 'specific' ? targetedUserIds : undefined
    );
    setDispatchFeedback(
      targetedAudienceFilter === 'specific'
        ? `Recado enviado para ${targetedUserIds.length} usuário(s) selecionado(s)!`
        : `Recado disparado para todos os usuários do perfil ${targetAudience.toUpperCase()}!`
    );
    setTimeout(() => setDispatchFeedback(null), 4000);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const draft = buildDraftConfig();
    const { id: _ignored, ...payload } = draft;
    if (isNew) {
      db.addSpamConfig(payload, adminId);
    } else if (config) {
      db.updateSpamConfig(config.id, payload, adminId);
    }
    onSuccess();
  };

  const toggleUserSelection = (userId: string) => {
    setTargetedUserIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-3xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-5 sm:p-6 relative max-h-[92vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="pb-3 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 pr-8">
          <div>
            <span className="text-[11px] font-bold text-purple-600 uppercase tracking-wider">
              Construtor Visual de SPAM · Controle Total Admin AUTO SHOP
            </span>
            <h2 className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
              {isNew ? 'Criar Novo Template de SPAM' : 'Editar SPAM: Textos, Campos, Imagens, Botões & Pagamentos'}
            </h2>
          </div>

          {onPreviewSpam && (
            <button
              type="button"
              onClick={() => onPreviewSpam(buildDraftConfig())}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs shadow-md flex items-center gap-1.5 transition cursor-pointer self-start sm:self-auto"
            >
              <Eye className="w-4 h-4" />
              <span>Visualizar SPAM</span>
            </button>
          )}
        </div>

        {/* Sub-abas */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-3 border-b border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setEditorTab('geral')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              editorTab === 'geral'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>1. Textos, Fontes & Cores</span>
          </button>
          <button
            type="button"
            onClick={() => setEditorTab('estrutura')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              editorTab === 'estrutura'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>2. Campos, Seções, Imagens & Botões</span>
          </button>
          <button
            type="button"
            onClick={() => setEditorTab('pagamentos')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              editorTab === 'pagamentos'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>3. Pagamentos & Recados Direcionados</span>
          </button>
        </div>

        <form onSubmit={handleSave} className="mt-4 space-y-4">
          {editorTab === 'geral' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Tipo de Gatilho
                  </label>
                  <select
                    value={type}
                    onChange={e => setType(e.target.value as SpamTriggerConfig['type'])}
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                  >
                    <option value="nova_oportunidade">Nova Oportunidade (Cotação)</option>
                    <option value="orcamento_recebido">Orçamento Recebido (Cliente)</option>
                    <option value="venda_confirmada">Venda Confirmada (Fornecedor)</option>
                    <option value="pedido_a_caminho">Pedido a Caminho (Entrega)</option>
                    <option value="alerta_admin_sem_orcamento">Alerta Admin (Gargalo)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Perfil Destino
                  </label>
                  <select
                    value={targetAudience}
                    onChange={e => setTargetAudience(e.target.value as SpamTriggerConfig['targetAudience'])}
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                  >
                    <option value="fornecedor">Fornecedor / Loja</option>
                    <option value="cliente">Cliente</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Selo / Etiqueta do Topo
                  </label>
                  <input
                    type="text"
                    value={badgeText}
                    onChange={e => setBadgeText(e.target.value)}
                    placeholder="Ex: ALERTA URGENTE"
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Título Principal do SPAM *
                </label>
                <input
                  type="text"
                  placeholder="Ex: VENDA CONFIRMADA, VERIFIQUE SE O VALOR JÁ ESTÁ NA CONTA!"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Subtítulo / Escrita Explicativa *
                </label>
                <textarea
                  rows={2}
                  placeholder="Descreva a mensagem exibida ao usuário..."
                  value={subtitle}
                  onChange={e => setSubtitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-600"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Fonte das Letras
                  </label>
                  <select
                    value={fontFamily}
                    onChange={e => setFontFamily(e.target.value as FontFamilyOption)}
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                  >
                    <option value="Inter">Inter (Padrão)</option>
                    <option value="Plus Jakarta Sans">Plus Jakarta Sans</option>
                    <option value="Poppins">Poppins (Moderna)</option>
                    <option value="Roboto">Roboto (Técnica)</option>
                    <option value="Montserrat">Montserrat (Impacto)</option>
                    <option value="JetBrains Mono">JetBrains Mono</option>
                    <option value="Orbitron">Orbitron</option>
                    <option value="Raleway">Raleway</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Tamanho do Título
                  </label>
                  <select
                    value={titleFontSize}
                    onChange={e => setTitleFontSize(e.target.value as 'sm' | 'md' | 'lg' | 'xl')}
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                  >
                    <option value="sm">Compacto</option>
                    <option value="md">Médio (Padrão)</option>
                    <option value="lg">Grande</option>
                    <option value="xl">Extra Grande (Urgência)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Contagem Regressiva (seg)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={countdownSeconds}
                    onChange={e => setCountdownSeconds(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Tema Base do SPAM
                    </label>
                    <select
                      value={colorScheme}
                      onChange={e => setColorScheme(e.target.value as SpamTriggerConfig['colorScheme'])}
                      className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                    >
                      <option value="orange">Laranja (Oportunidade)</option>
                      <option value="yellow">Amarelo (Pagamento)</option>
                      <option value="red">Vermelho (Urgência)</option>
                      <option value="green">Verde (Venda Confirmada)</option>
                      <option value="blue">Azul (Logística)</option>
                      <option value="amber">Âmbar (Radar)</option>
                      <option value="purple">Roxo (Admin)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-[11px]">
                  <label className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                    <span className="font-bold">Fundo Cabeçalho</span>
                    <input type="color" value={headerBgColor} onChange={e => setHeaderBgColor(e.target.value)} className="w-7 h-7 rounded cursor-pointer" />
                  </label>
                  <label className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                    <span className="font-bold">Letra Cabeçalho</span>
                    <input type="color" value={headerTextColor} onChange={e => setHeaderTextColor(e.target.value)} className="w-7 h-7 rounded cursor-pointer" />
                  </label>
                  <label className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                    <span className="font-bold">Borda Card</span>
                    <input type="color" value={borderColor} onChange={e => setBorderColor(e.target.value)} className="w-7 h-7 rounded cursor-pointer" />
                  </label>
                  <label className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                    <span className="font-bold">Botão Ação BG</span>
                    <input type="color" value={actionButtonBgColor} onChange={e => setActionButtonBgColor(e.target.value)} className="w-7 h-7 rounded cursor-pointer" />
                  </label>
                  <label className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                    <span className="font-bold">Botão Ação Letra</span>
                    <input type="color" value={actionButtonTextColor} onChange={e => setActionButtonTextColor(e.target.value)} className="w-7 h-7 rounded cursor-pointer" />
                  </label>
                  <label className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                    <span className="font-bold">Fundo Corpo</span>
                    <input type="color" value={bodyBgColor || '#ffffff'} onChange={e => setBodyBgColor(e.target.value)} className="w-7 h-7 rounded cursor-pointer" />
                  </label>
                </div>
                {bodyBgColor && (
                  <button
                    type="button"
                    onClick={() => {
                      setBodyBgColor('');
                      setBodyTextColor('');
                    }}
                    className="text-[11px] font-bold text-purple-600 hover:underline cursor-pointer"
                  >
                    Restaurar fundo automático (Claro/Escuro)
                  </button>
                )}
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800 dark:text-slate-200">
                    <input
                      type="checkbox"
                      checked={soundEnabled}
                      onChange={e => setSoundEnabled(e.target.checked)}
                      className="rounded text-purple-600"
                    />
                    <span>Alerta Sonoro Ativado</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleTestSound}
                    className="px-2.5 py-1 rounded-lg bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 text-xs font-bold flex items-center gap-1 hover:bg-purple-200 transition cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" /> Testar Som
                  </button>
                </div>
                <select
                  value={soundType}
                  onChange={e => setSoundType(e.target.value as SpamTriggerConfig['soundType'])}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                >
                  <option value="urgent_alarm">Alarme Duplo Urgente (Fornecedor)</option>
                  <option value="cash_success">Arpeggio de Sucesso / Venda Fechada</option>
                  <option value="delivery_chime">Chime de Entrega e Cotações</option>
                  <option value="warning_beep">Bi-beep de Atenção / Admin</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Texto do Botão Principal
                  </label>
                  <input
                    type="text"
                    value={actionButtonLabel}
                    onChange={e => setActionButtonLabel(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                    required
                  />
                </div>
                <div className="flex flex-col justify-end gap-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800 dark:text-slate-200">
                    <input
                      type="checkbox"
                      checked={showDefaultActionButton}
                      onChange={e => setShowDefaultActionButton(e.target.checked)}
                      className="rounded text-purple-600"
                    />
                    <span>Exibir Botão Principal</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800 dark:text-slate-200">
                    <input
                      type="checkbox"
                      checked={isMandatoryAction}
                      onChange={e => setIsMandatoryAction(e.target.checked)}
                      className="rounded text-purple-600"
                    />
                    <span>Ação Obrigatória (Bloqueia fechamento)</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {editorTab === 'estrutura' && (
            <div className="space-y-5">
              {/* Visibilidade dos blocos */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 space-y-2.5">
                <h3 className="text-xs font-black uppercase text-slate-800 dark:text-slate-200">
                  Blocos / Seções Visíveis no SPAM
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  {(
                    [
                      ['showTimer', 'Cronômetro'],
                      ['showPartIdentification', 'Peças Solicitadas'],
                      ['showPhoto', 'Foto da Peça'],
                      ['showLocation', 'Local / CEP'],
                      ['showQuoteForm', 'Form. Orçamento'],
                      ['showFinancialSummary', 'Resumo Financeiro'],
                      ['showCustomerData', 'Dados do Cliente'],
                      ['showPaymentMethods', 'Meios de Pagamento'],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 cursor-pointer font-semibold">
                      <input
                        type="checkbox"
                        checked={sectionVisibility[key] !== false}
                        onChange={e =>
                          setSectionVisibility(prev => ({ ...prev, [key]: e.target.checked }))
                        }
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Campos personalizados */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
                <h3 className="text-xs font-black uppercase text-slate-800 dark:text-slate-200">
                  Adicionar / Remover Campos Customizados ({customFields.length})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <input
                    type="text"
                    placeholder="Rótulo do Campo"
                    value={newFieldLabel}
                    onChange={e => setNewFieldLabel(e.target.value)}
                    className="px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                  <input
                    type="text"
                    placeholder="Texto / Placeholder"
                    value={newFieldValue}
                    onChange={e => setNewFieldValue(e.target.value)}
                    className="px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                  <select
                    value={newFieldType}
                    onChange={e => setNewFieldType(e.target.value as 'text' | 'highlight' | 'input')}
                    className="px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  >
                    <option value="text">Informação (Texto)</option>
                    <option value="highlight">Card Destaque</option>
                    <option value="input">Campo Editável (Input)</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleAddField}
                    className="px-3 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Adicionar Campo
                  </button>
                </div>

                {customFields.length > 0 && (
                  <div className="space-y-1.5">
                    {customFields.map(f => (
                      <div key={f.id} className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs">
                        <div>
                          <strong className="text-slate-900 dark:text-white">{f.label}</strong>
                          <span className="ml-2 text-slate-500">({f.fieldType}) · {f.value}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setCustomFields(prev => prev.filter(item => item.id !== f.id))}
                          className="p-1 text-red-500 hover:bg-red-50 rounded-lg cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Imagens */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
                <h3 className="text-xs font-black uppercase text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-purple-600" />
                  <span>Imagens & Banners do SPAM ({images.length})</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="URL da Imagem (ou envie arquivo)"
                    value={newImageUrl}
                    onChange={e => setNewImageUrl(e.target.value)}
                    className="px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                  <input
                    type="text"
                    placeholder="Legenda da imagem"
                    value={newImageCaption}
                    onChange={e => setNewImageCaption(e.target.value)}
                    className="px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={handleAddImageUrl}
                      className="flex-1 px-3 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold cursor-pointer"
                    >
                      + URL
                    </button>
                    <label className="px-3 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-xs font-bold cursor-pointer flex items-center">
                      Upload
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={e => handleImageUpload(e.target.files?.[0])}
                      />
                    </label>
                  </div>
                </div>

                {images.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {images.map(img => (
                      <div key={img.id} className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5">
                        <img src={img.url} alt={img.caption || 'Banner'} className="w-full h-20 object-cover rounded-lg bg-slate-950" />
                        <div className="flex items-center justify-between gap-1 text-[11px]">
                          <span className="truncate font-semibold">{img.caption || 'Imagem'}</span>
                          <button
                            type="button"
                            onClick={() => setImages(prev => prev.filter(item => item.id !== img.id))}
                            className="text-red-500 hover:bg-red-50 p-1 rounded cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Botões extras */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
                <h3 className="text-xs font-black uppercase text-slate-800 dark:text-slate-200">
                  Botões Extras do SPAM ({customButtons.length})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 items-center">
                  <input
                    type="text"
                    placeholder="Texto do Botão"
                    value={newBtnLabel}
                    onChange={e => setNewBtnLabel(e.target.value)}
                    className="sm:col-span-2 px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                  <select
                    value={newBtnActionType}
                    onChange={e => setNewBtnActionType(e.target.value as SpamCustomButton['actionType'])}
                    className="px-2 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  >
                    <option value="acknowledge">Confirmar Leitura</option>
                    <option value="confirm">Confirmar Venda</option>
                    <option value="open_payment">Abrir Pagamento</option>
                    <option value="dismiss">Fechar / Dispensar</option>
                  </select>
                  <div className="flex items-center gap-2">
                    <input type="color" value={newBtnBgColor} onChange={e => setNewBtnBgColor(e.target.value)} title="Cor do fundo" className="w-8 h-8 rounded cursor-pointer" />
                    <input type="color" value={newBtnTextColor} onChange={e => setNewBtnTextColor(e.target.value)} title="Cor da letra" className="w-8 h-8 rounded cursor-pointer" />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddButton}
                    className="px-3 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold cursor-pointer"
                  >
                    + Botão
                  </button>
                </div>

                {customButtons.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {customButtons.map(btn => (
                      <div key={btn.id} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                        <span
                          style={{ backgroundColor: btn.bgColor, color: btn.textColor }}
                          className="px-2.5 py-0.5 rounded-lg font-bold"
                        >
                          {btn.label}
                        </span>
                        <button
                          type="button"
                          onClick={() => setCustomButtons(prev => prev.filter(item => item.id !== btn.id))}
                          className="text-red-500 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {editorTab === 'pagamentos' && (
            <div className="space-y-5">
              {/* Meios de pagamento configuráveis */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-black uppercase text-slate-800 dark:text-slate-200">
                      Configurar Meios de Pagamento ({paymentMethodsConfig.length})
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Ative, edite, remova ou crie novos meios de pagamento exibidos no SPAM e no Checkout.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSyncGlobalPayments}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
                  >
                    Aplicar também no Checkout Global
                  </button>
                </div>

                {globalPaySyncMessage && (
                  <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4" />
                    <span>{globalPaySyncMessage}</span>
                  </div>
                )}

                <div className="space-y-2">
                  {paymentMethodsConfig.map(m => (
                    <div key={m.id} className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <label className="flex items-center gap-2 font-bold cursor-pointer">
                          <input
                            type="checkbox"
                            checked={m.enabled}
                            onChange={e =>
                              setPaymentMethodsConfig(prev =>
                                prev.map(item => (item.id === m.id ? { ...item, enabled: e.target.checked } : item))
                              )
                            }
                          />
                          <span>{m.label}</span>
                          {m.badgeText && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-black">
                              {m.badgeText}
                            </span>
                          )}
                        </label>
                        <button
                          type="button"
                          onClick={() => setPaymentMethodsConfig(prev => prev.filter(item => item.id !== m.id))}
                          className="text-red-500 hover:bg-red-50 p-1 rounded cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <input
                        type="text"
                        placeholder="Instruções ao usuário..."
                        value={m.instructions || ''}
                        onChange={e =>
                          setPaymentMethodsConfig(prev =>
                            prev.map(item => (item.id === m.id ? { ...item, instructions: e.target.value } : item))
                          )
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[11px]"
                      />
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                  <input
                    type="text"
                    placeholder="Novo meio (Ex: Boleto Bancário)"
                    value={newPayLabel}
                    onChange={e => setNewPayLabel(e.target.value)}
                    className="px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                  <input
                    type="text"
                    placeholder="Selo (Ex: Até 3x)"
                    value={newPayBadge}
                    onChange={e => setNewPayBadge(e.target.value)}
                    className="px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                  <input
                    type="text"
                    placeholder="Instruções de pagamento"
                    value={newPayInstructions}
                    onChange={e => setNewPayInstructions(e.target.value)}
                    className="px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                  <button
                    type="button"
                    onClick={handleAddPaymentMethod}
                    className="px-3 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold cursor-pointer"
                  >
                    + Meio de Pagamento
                  </button>
                </div>
              </div>

              {/* Recados direcionados */}
              <div className="p-4 rounded-2xl border-2 border-indigo-300 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-950/30 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Megaphone className="w-4 h-4 text-indigo-600" />
                    <h3 className="text-xs font-black uppercase text-indigo-900 dark:text-indigo-200">
                      Recados Direcionados em Tela (Disparo Imediato ou Embutido)
                    </h3>
                  </div>
                  <label className="flex items-center gap-1.5 text-xs font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={targetedNoticeEnabled}
                      onChange={e => setTargetedNoticeEnabled(e.target.checked)}
                    />
                    <span>Exibir no Template</span>
                  </label>
                </div>

                <textarea
                  rows={2}
                  placeholder="Digite o recado direcionado para os clientes ou fornecedores selecionados..."
                  value={targetedMessage}
                  onChange={e => setTargetedMessage(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none"
                />

                <div className="flex items-center gap-4 text-xs font-bold">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      checked={targetedAudienceFilter === 'all'}
                      onChange={() => setTargetedAudienceFilter('all')}
                    />
                    <span>Todos de "{targetAudience.toUpperCase()}"</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      checked={targetedAudienceFilter === 'specific'}
                      onChange={() => setTargetedAudienceFilter('specific')}
                    />
                    <span>Usuários Específicos ({targetedUserIds.length})</span>
                  </label>
                </div>

                {targetedAudienceFilter === 'specific' && (
                  <div className="max-h-36 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1.5 p-2 rounded-xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 text-xs">
                    {audienceUsers.map(u => (
                      <label key={u.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={targetedUserIds.includes(u.id)}
                          onChange={() => toggleUserSelection(u.id)}
                        />
                        <span className="truncate font-semibold">{u.companyName || u.name} ({u.phone})</span>
                      </label>
                    ))}
                  </div>
                )}

                {dispatchFeedback && (
                  <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-900 text-xs font-bold">
                    {dispatchFeedback}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleDispatchDirected}
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Disparar Recado Direcionado Agora</span>
                </button>
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-2.5">
            {onPreviewSpam && (
              <button
                type="button"
                onClick={() => onPreviewSpam(buildDraftConfig())}
                className="sm:w-48 py-3.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs shadow-md flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Eye className="w-4 h-4" />
                <span>Visualizar SPAM</span>
              </button>
            )}
            <button
              type="submit"
              className="flex-1 py-3.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black text-sm shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 transition active:scale-98 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{isNew ? 'Criar Novo Template de SPAM' : 'Salvar Configuração do SPAM'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
