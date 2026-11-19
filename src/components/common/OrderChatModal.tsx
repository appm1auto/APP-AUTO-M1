/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Send,
  Camera,
  ShieldCheck,
  Clock,
  UserCheck,
  Store,
  Eye,
  CheckCircle2
} from 'lucide-react';
import { db } from '../../services/db';
import { User, ChatMessage } from '../../types';

interface OrderChatModalProps {
  currentUser: User;
  requestId: string;
  orderId?: string;
  requestNumber: string;
  otherPartyName: string;
  otherPartyRole: string;
  otherPartyAvatar?: string;
  onClose: () => void;
}

export const OrderChatModal: React.FC<OrderChatModalProps> = ({
  currentUser,
  requestId,
  orderId,
  requestNumber,
  otherPartyName,
  otherPartyRole,
  otherPartyAvatar,
  onClose,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [attachedMediaUrl, setAttachedMediaUrl] = useState('');
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadMessages = () => {
    db.markThreadAsRead(currentUser.id, { requestId, orderId });
    const list = db.getChatMessages({ requestId, orderId });
    setMessages(list);
  };

  useEffect(() => {
    loadMessages();
    const unsub = db.subscribe(() => {
      db.markThreadAsRead(currentUser.id, { requestId, orderId });
      const list = db.getChatMessages({ requestId, orderId });
      setMessages(list);
    });
    return () => {
      unsub();
    };
  }, [requestId, orderId, currentUser.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setAttachedMediaUrl(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() && !attachedMediaUrl) return;

    db.sendChatMessage({
      requestId,
      orderId,
      requestNumber,
      senderId: currentUser.id,
      senderName: currentUser.companyName || currentUser.name,
      senderRole: currentUser.role,
      message: inputText.trim(),
      mediaUrl: attachedMediaUrl || undefined,
      isAdminIntervention: false,
    });

    setInputText('');
    setAttachedMediaUrl('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col h-[85vh] max-h-[700px] relative overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl overflow-hidden bg-slate-200 dark:bg-slate-800 flex items-center justify-center shrink-0 border border-slate-300 dark:border-slate-700">
              {otherPartyAvatar ? (
                <img src={otherPartyAvatar} alt={otherPartyName} className="w-full h-full object-cover" />
              ) : otherPartyRole === 'fornecedor' ? (
                <Store className="w-5 h-5 text-emerald-600" />
              ) : (
                <UserCheck className="w-5 h-5 text-blue-600" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <strong className="text-sm font-black text-slate-900 dark:text-white truncate max-w-[180px]">
                  {otherPartyName}
                </strong>
                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                  {otherPartyRole}
                </span>
              </div>
              <span className="text-[11px] text-slate-500 font-mono">
                Chamado: {requestNumber}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Supervision Banner */}
        <div className="bg-purple-50 dark:bg-purple-950/40 px-3 py-1.5 border-b border-purple-100 dark:border-purple-900/50 flex items-center justify-between text-[11px] text-purple-700 dark:text-purple-300 font-semibold shrink-0">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            Supervisionado em tempo real pela moderação oficial AUTO SHOP.
          </span>
          <span className="text-[10px] text-purple-500 uppercase">LGPD Segura</span>
        </div>

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 text-xs p-6 space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                💬
              </div>
              <p className="font-bold">Nenhuma mensagem neste chamado ainda.</p>
              <p className="text-[11px] text-slate-500">
                Tire dúvidas técnicas sobre a peça, prazos ou combine detalhes de envio diretamente.
              </p>
            </div>
          ) : (
            messages.map(msg => {
              const isMine = msg.senderId === currentUser.id;

              if (msg.isAdminIntervention) {
                return (
                  <div key={msg.id} className="p-3 rounded-2xl bg-purple-100/80 dark:bg-purple-950/60 border border-purple-300 dark:border-purple-800 my-2 shadow-xs">
                    <div className="flex items-center gap-1.5 text-purple-900 dark:text-purple-200 text-xs font-black mb-1">
                      <ShieldCheck className="w-4 h-4 text-purple-600" />
                      <span>{msg.senderName}</span>
                      <span className="text-[9px] bg-purple-600 text-white px-1.5 py-0.5 rounded uppercase">
                        Oficial
                      </span>
                    </div>
                    <p className="text-xs text-purple-950 dark:text-purple-100 font-medium">
                      {msg.message}
                    </p>
                    <span className="text-[10px] text-purple-400 block text-right mt-1">
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                );
              }

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl p-3 shadow-xs text-xs space-y-1.5 ${
                      isMine
                        ? 'bg-blue-600 text-white rounded-br-none'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-bl-none border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {!isMine && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                          {msg.senderName}
                        </span>
                        {msg.isSac && (
                          <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-red-600 text-white">
                            SAC
                          </span>
                        )}
                      </div>
                    )}

                    {isMine && msg.isSac && (
                      <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-red-600 text-white inline-block">
                        Chamado SAC
                      </span>
                    )}

                    {msg.message && <p className="leading-relaxed font-medium">{msg.message}</p>}

                    {msg.mediaUrl && (
                      <button
                        type="button"
                        onClick={() => setPreviewPhoto(msg.mediaUrl || null)}
                        className="rounded-xl overflow-hidden border border-white/20 block cursor-pointer group mt-1"
                      >
                        <img
                          src={msg.mediaUrl}
                          alt="Foto no chat"
                          className="max-h-40 w-auto object-cover group-hover:scale-105 transition"
                        />
                      </button>
                    )}

                    <span
                      className={`text-[9px] block text-right font-mono ${
                        isMine ? 'text-blue-200' : 'text-slate-400'
                      }`}
                    >
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Attached Photo Preview */}
        {attachedMediaUrl && (
          <div className="p-2 bg-slate-100 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <img src={attachedMediaUrl} alt="Anexo" className="w-10 h-10 object-cover rounded-lg" />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Foto anexada pronta para envio
              </span>
            </div>
            <button
              type="button"
              onClick={() => setAttachedMediaUrl('')}
              className="text-xs text-red-600 hover:underline font-bold px-2 py-1"
            >
              Remover
            </button>
          </div>
        )}

        {/* Input Bar */}
        <form onSubmit={handleSendMessage} className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2 shrink-0">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="image/*"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            title="Tirar foto ou anexar imagem da peça"
          >
            <Camera className="w-4 h-4" />
          </button>

          <input
            type="text"
            placeholder="Digite sua mensagem..."
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-600"
          />

          <button
            type="submit"
            disabled={!inputText.trim() && !attachedMediaUrl}
            className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold transition cursor-pointer shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Lightbox photo preview */}
      {previewPhoto && (
        <div className="fixed inset-0 z-60 bg-black/85 flex items-center justify-center p-4">
          <div className="relative max-w-xl w-full bg-slate-900 rounded-2xl p-3 space-y-2">
            <div className="flex justify-between items-center text-white text-xs font-bold pb-2 border-b border-slate-800">
              <span>Foto Ampliada</span>
              <button onClick={() => setPreviewPhoto(null)} className="cursor-pointer text-slate-400 hover:text-white">✕</button>
            </div>
            <img src={previewPhoto} alt="Ampliada" className="max-h-[70vh] w-auto mx-auto object-contain rounded-xl" />
          </div>
        </div>
      )}
    </div>
  );
};
