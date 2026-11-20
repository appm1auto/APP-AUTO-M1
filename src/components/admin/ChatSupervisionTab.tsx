/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  ShieldCheck,
  Send,
  Camera,
  Search,
  Filter,
  Eye,
  CheckCircle2,
  Clock,
  UserCheck,
  Store,
  Loader2,
  X
} from 'lucide-react';
import { db } from '../../services/db';
import { User } from '../../types';

interface ChatSupervisionTabProps {
  adminUser: User;
}

export const ChatSupervisionTab: React.FC<ChatSupervisionTabProps> = ({ adminUser }) => {
  const [, setTick] = useState(0);
  const [selectedThreadKey, setSelectedThreadKey] = useState<string>('todos');
  const [targetThreadKey, setTargetThreadKey] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [intercessionText, setIntercessionText] = useState('');
  const [intercessionMediaUrl, setIntercessionMediaUrl] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [sending, setSending] = useState(false);
  const [activeMediaPreview, setActiveMediaPreview] = useState<string | null>(null);
  const [sentSuccess, setSentSuccess] = useState(false);
  const intercessionInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const refresh = () => setTick(t => t + 1);
    const unsub = db.subscribe(refresh);
    window.addEventListener('compe:chat_message', refresh);
    return () => {
      unsub();
      window.removeEventListener('compe:chat_message', refresh);
    };
  }, []);

  const allMessages = db.getChatMessages();
  const requests = db.getRequests();
  const orders = db.getOrders();
  const users = db.getUsers();

  useEffect(() => {
    db.markAllAdminMessagesRead(adminUser.id);
  }, [adminUser.id, allMessages.length]);

  const getMessageThreadKey = (m: { requestId?: string; orderId?: string }) =>
    m.requestId || m.orderId || 'geral';

  // Constroi índice único de conversas (chamados + pedidos + threads SAC)
  const threadMap = new Map<
    string,
    {
      key: string;
      requestId: string;
      orderId?: string;
      requestNumber: string;
      label: string;
      lastMessageAt: string;
      messageCount: number;
      hasSac: boolean;
    }
  >();

  requests.forEach(req => {
    const linkedOrd = orders.find(o => o.requestId === req.id);
    threadMap.set(req.id, {
      key: req.id,
      requestId: req.id,
      orderId: linkedOrd?.id,
      requestNumber: req.requestNumber || req.id,
      label: `${req.requestNumber} · ${req.partName} (${req.customerName})`,
      lastMessageAt: req.createdAt,
      messageCount: 0,
      hasSac: false,
    });
  });

  allMessages.forEach(m => {
    const key = getMessageThreadKey(m);
    const req = requests.find(r => r.id === m.requestId || r.id === key);
    const ord = orders.find(o => o.id === m.orderId || o.requestId === key);
    const existing = threadMap.get(key);
    if (existing) {
      existing.messageCount += 1;
      if (new Date(m.createdAt).getTime() > new Date(existing.lastMessageAt).getTime()) {
        existing.lastMessageAt = m.createdAt;
      }
      if (m.isSac) existing.hasSac = true;
      if (!existing.orderId && m.orderId) existing.orderId = m.orderId;
    } else {
      threadMap.set(key, {
        key,
        requestId: m.requestId || req?.id || key,
        orderId: m.orderId || ord?.id,
        requestNumber: m.requestNumber || req?.requestNumber || ord?.orderNumber || key,
        label: `${m.requestNumber || req?.requestNumber || ord?.orderNumber || key} · ${
          req?.partName || ord?.partName || m.senderName
        }`,
        lastMessageAt: m.createdAt,
        messageCount: 1,
        hasSac: Boolean(m.isSac),
      });
    }
  });

  const threadsWithMessages = Array.from(threadMap.values())
    .filter(t => t.messageCount > 0)
    .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());

  const allTargetThreads = Array.from(threadMap.values()).sort(
    (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
  );

  const effectiveTargetKey =
    (targetThreadKey && threadMap.has(targetThreadKey) ? targetThreadKey : '') ||
    (selectedThreadKey !== 'todos' && threadMap.has(selectedThreadKey) ? selectedThreadKey : '') ||
    threadsWithMessages[0]?.key ||
    allTargetThreads[0]?.key ||
    '';

  const filteredMessages = [...allMessages]
    .filter(msg => {
      if (selectedThreadKey !== 'todos' && getMessageThreadKey(msg) !== selectedThreadKey) {
        return false;
      }
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        return (
          msg.message.toLowerCase().includes(q) ||
          msg.senderName.toLowerCase().includes(q) ||
          (msg.requestNumber && msg.requestNumber.toLowerCase().includes(q))
        );
      }
      return true;
    })
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const handleFocusIntervention = (threadKey: string) => {
    setSelectedThreadKey(threadKey);
    setTargetThreadKey(threadKey);
    setTimeout(() => {
      intercessionInputRef.current?.focus();
    }, 50);
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const res = await db.compressAndUploadImageFile(file, 1024, 0.8);
      if (res.ok && res.url) {
        setIntercessionMediaUrl(res.url);
      } else {
        const reader = new FileReader();
        reader.onload = ev => {
          if (typeof ev.target?.result === 'string') {
            setIntercessionMediaUrl(ev.target.result);
          }
        };
        reader.readAsDataURL(file);
      }
    } finally {
      setUploadingPhoto(false);
      e.target.value = '';
    }
  };

  const handleSendIntercession = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = intercessionText.trim();
    if ((!text && !intercessionMediaUrl) || sending) return;

    const thread = effectiveTargetKey ? threadMap.get(effectiveTargetKey) : undefined;
    const targetReqId = thread?.requestId || 'sac_geral';
    const targetOrdId = thread?.orderId;
    const targetReqNumber = thread?.requestNumber || 'SAC-ADMIN';

    setSending(true);
    try {
      await db.sendChatMessageRemote({
        requestId: targetReqId,
        orderId: targetOrdId,
        requestNumber: targetReqNumber.startsWith('#') ? targetReqNumber : `#${targetReqNumber}`,
        senderId: adminUser.id,
        senderName: 'AUTO SHOP Mediação & Suporte Oficial',
        senderRole: 'admin',
        message: text || 'Anexo enviado pela moderação',
        mediaUrl: intercessionMediaUrl || undefined,
        isAdminIntervention: true,
      });

      setIntercessionText('');
      setIntercessionMediaUrl('');
      setSentSuccess(true);
      setTimeout(() => setSentSuccess(false), 3000);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Info Banner */}
      <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-2xl bg-purple-100 dark:bg-purple-950/60 flex items-center justify-center text-purple-600 shrink-0">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">
                Supervisão de Comunicação & Intercessão Administrativa
              </h2>
              <p className="text-xs text-slate-500">
                Todas as mensagens e fotos entre clientes e fornecedores aparecem aqui em tempo real com opção de intervenção imediata.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs flex-wrap">
          <span className="px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-bold">
            Mensagens: {allMessages.length}
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-bold">
            Intervenções Admin: {allMessages.filter(m => m.isAdminIntervention).length}
          </span>
        </div>
      </div>

      {/* Quick Conversation Pills */}
      {threadsWithMessages.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setSelectedThreadKey('todos')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
              selectedThreadKey === 'todos'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            Todas as Conversas ({allMessages.length})
          </button>
          {threadsWithMessages.map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                setSelectedThreadKey(t.key);
                setTargetThreadKey(t.key);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 cursor-pointer ${
                selectedThreadKey === t.key
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-purple-400'
              }`}
            >
              <span>{t.requestNumber}</span>
              <span className="opacity-75">({t.messageCount})</span>
              {t.hasSac && (
                <span className="text-[9px] px-1 py-0.5 rounded bg-red-600 text-white uppercase">SAC</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Buscar por texto, nome de cliente, fornecedor ou chamado..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-600"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={selectedThreadKey}
            onChange={e => {
              setSelectedThreadKey(e.target.value);
              if (e.target.value !== 'todos') setTargetThreadKey(e.target.value);
            }}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none"
          >
            <option value="todos">Todos os Chamados / Conversas</option>
            {threadsWithMessages.map(t => (
              <option key={t.key} value={t.key}>
                {t.label} ({t.messageCount} msgs)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Messages Thread Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Messages List (2 cols) */}
        <div className="lg:col-span-2 space-y-3">
          {filteredMessages.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-400">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-bold text-sm">Nenhuma mensagem encontrada para o filtro selecionado.</p>
            </div>
          ) : (
            filteredMessages.map(msg => {
              const sender = users.find(u => u.id === msg.senderId);
              const threadKey = getMessageThreadKey(msg);
              return (
                <div
                  key={msg.id}
                  className={`p-4 rounded-2xl border transition ${
                    msg.isAdminIntervention
                      ? 'bg-purple-50/80 dark:bg-purple-950/30 border-purple-300 dark:border-purple-800 ring-1 ring-purple-400/40'
                      : msg.senderRole === 'cliente'
                      ? 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900'
                      : 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                        msg.isAdminIntervention
                          ? 'bg-purple-600 text-white shadow-sm'
                          : msg.senderRole === 'cliente'
                          ? 'bg-blue-600 text-white'
                          : 'bg-emerald-600 text-white'
                      }`}>
                        {msg.isAdminIntervention ? (
                          <ShieldCheck className="w-4 h-4" />
                        ) : msg.senderRole === 'cliente' ? (
                          <UserCheck className="w-4 h-4" />
                        ) : (
                          <Store className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <strong className="text-xs font-black text-slate-900 dark:text-white">
                            {sender?.companyName || sender?.name || msg.senderName}
                          </strong>
                          {sender?.phone && (
                            <span className="text-[10px] font-mono text-slate-500">
                              ({sender.phone})
                            </span>
                          )}
                          {msg.isSac && (
                            <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-red-600 text-white">
                              CHAMADO SAC
                            </span>
                          )}
                          <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                            msg.isAdminIntervention
                              ? 'bg-purple-200 text-purple-900 dark:bg-purple-900 dark:text-purple-200'
                              : msg.senderRole === 'cliente'
                              ? 'bg-blue-200 text-blue-900 dark:bg-blue-900 dark:text-blue-200'
                              : 'bg-emerald-200 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-200'
                          }`}>
                            {msg.isAdminIntervention ? 'Intercessão Admin' : msg.senderRole}
                          </span>
                        </div>
                        {msg.requestNumber && (
                          <span className="text-[10px] text-slate-500 font-mono">
                            Referência: {msg.requestNumber}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleFocusIntervention(threadKey)}
                        className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-black cursor-pointer transition"
                      >
                        Intervir nesta conversa
                      </button>
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-medium pl-10">
                    {msg.message}
                  </p>

                  {/* Attached Media/Photo in chat */}
                  {msg.mediaUrl && (
                    <div className="mt-3 pl-10">
                      <button
                        type="button"
                        onClick={() => setActiveMediaPreview(msg.mediaUrl || null)}
                        className="group relative rounded-xl overflow-hidden border border-slate-300 dark:border-slate-700 hover:ring-2 hover:ring-purple-500 transition cursor-pointer"
                      >
                        <img
                          src={msg.mediaUrl}
                          alt="Anexo de mensagem"
                          className="w-36 h-24 object-cover group-hover:scale-105 transition"
                        />
                        <span className="absolute bottom-1 right-1 bg-black/70 text-white text-[9px] px-1.5 py-0.5 rounded flex items-center gap-1">
                          <Eye className="w-2.5 h-2.5" /> Ampliar
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Admin Intercession Form (1 col) */}
        <div className="space-y-4">
          <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border-2 border-purple-500/40 shadow-lg space-y-4 sticky top-24">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <ShieldCheck className="w-5 h-5 text-purple-600" />
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Realizar Intercessão Oficial
                </h3>
                <p className="text-[11px] text-slate-500">
                  Envie orientação instantânea para cliente e fornecedor na conversa selecionada.
                </p>
              </div>
            </div>

            {sentSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Intercessão enviada e salva em tempo real!</span>
              </div>
            )}

            <form onSubmit={handleSendIntercession} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Conversa / Chamado Alvo
                </label>
                <select
                  value={effectiveTargetKey}
                  onChange={e => {
                    setTargetThreadKey(e.target.value);
                    setSelectedThreadKey(e.target.value || 'todos');
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white outline-none"
                >
                  {allTargetThreads.length === 0 && (
                    <option value="">Canal Geral / SAC</option>
                  )}
                  {allTargetThreads.map(t => (
                    <option key={t.key} value={t.key}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Mensagem de Intervenção Administrativa
                </label>
                <textarea
                  ref={intercessionInputRef}
                  rows={4}
                  placeholder="Ex: Suporte AUTO SHOP: Orientamos as partes sobre prazo, compatibilidade ou envio..."
                  value={intercessionText}
                  onChange={e => setIntercessionText(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-600 outline-none"
                />
              </div>

              {intercessionMediaUrl && (
                <div className="flex items-center justify-between p-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2">
                    <img src={intercessionMediaUrl} alt="Anexo admin" className="w-10 h-10 rounded-lg object-cover" />
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Imagem pronta</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIntercessionMediaUrl('')}
                    className="p-1 text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <div className="flex items-center gap-2">
                <label className="px-3 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer hover:bg-slate-100">
                  {uploadingPhoto ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                  <span>Foto</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploadingPhoto || sending}
                    onChange={handlePhotoSelect}
                  />
                </label>

                <button
                  type="submit"
                  disabled={(!intercessionText.trim() && !intercessionMediaUrl) || sending || uploadingPhoto}
                  className="flex-1 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-black text-xs shadow-md transition active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>ENVIAR INTERVENÇÃO</span>
                </button>
              </div>
            </form>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 space-y-1">
              <strong className="block text-slate-700 dark:text-slate-300">Regras de Mediação:</strong>
              <p>• O Admin acompanha e intervém em qualquer conversa instantaneamente.</p>
              <p>• Todas as mensagens são salvas no banco de dados e auditadas.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox Modal for Photo */}
      {activeMediaPreview && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative max-w-2xl w-full bg-slate-900 rounded-3xl p-4 border border-slate-700 shadow-2xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-sm font-bold text-white flex items-center gap-2">
                <Camera className="w-4 h-4 text-purple-400" />
                <span>Foto Anexada na Conversa</span>
              </span>
              <button
                onClick={() => setActiveMediaPreview(null)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="flex items-center justify-center max-h-[70vh] overflow-hidden rounded-2xl bg-black">
              <img
                src={activeMediaPreview}
                alt="Foto do chat"
                className="max-h-[65vh] w-auto object-contain rounded-xl"
              />
            </div>
            <div className="text-right">
              <button
                onClick={() => setActiveMediaPreview(null)}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition cursor-pointer"
              >
                Fechar Foto
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
