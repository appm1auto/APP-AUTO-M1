/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  Camera,
  Search,
  Eye,
  X,
  ShieldCheck,
  Edit2,
  Trash2,
  FileDown,
  Save,
  Upload
} from 'lucide-react';
import { db } from '../../services/db';
import { exportMediaArchivePdfReport, MediaArchivePdfItem } from '../../services/pdfReport';

interface MediaArchiveTabProps {
  adminId?: string;
}

type ArchiveItem = ReturnType<typeof db.getAllMediaArchive>[number];

export const MediaArchiveTab: React.FC<MediaArchiveTabProps> = ({ adminId = 'usr_admin_1' }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'todos' | 'solicitacao' | 'cotacao' | 'embalagem'>('todos');
  const [, setTick] = useState(0);
  const [selectedPhoto, setSelectedPhoto] = useState<{
    url: string;
    title: string;
    subtitle: string;
    ref: string;
    author: string;
    date: string;
  } | null>(null);

  const [editingItem, setEditingItem] = useState<ArchiveItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editMediaUrl, setEditMediaUrl] = useState('');
  const [confirmDeleteItem, setConfirmDeleteItem] = useState<ArchiveItem | null>(null);

  useEffect(() => {
    const unsub = db.subscribe(() => setTick(t => t + 1));
    return () => {
      unsub();
    };
  }, []);

  const allMedia = db.getAllMediaArchive();

  const filteredMedia = allMedia.filter(item => {
    if (filterType !== 'todos' && item.type !== filterType) return false;
    if (searchTerm.trim() !== '') {
      const q = searchTerm.toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        item.referenceNumber.toLowerCase().includes(q) ||
        item.authorName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const toPdfItems = (list: ArchiveItem[]): MediaArchivePdfItem[] =>
    list.map(item => ({
      id: item.id,
      type: item.type,
      mediaUrl: item.mediaUrl,
      title: item.title,
      subtitle: item.subtitle,
      date: item.date,
      referenceNumber: item.referenceNumber,
      authorName: item.authorName,
    }));

  const handleOpenEdit = (item: ArchiveItem) => {
    setEditingItem(item);
    setEditTitle(item.title);
    setEditMediaUrl(item.mediaUrl);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    db.updateMediaArchiveItem(
      editingItem.sourceType,
      editingItem.sourceId,
      {
        title: editTitle.trim() || editingItem.title,
        mediaUrl: editMediaUrl.trim() || editingItem.mediaUrl,
      },
      adminId
    );
    setEditingItem(null);
  };

  const handlePhotoUpload = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setEditMediaUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-5">
      {/* Search & Header */}
      <div className="p-5 sm:p-6 rounded-3xl bg-slate-900 text-white border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
              <Camera className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-black text-white">
                  Arquivo Central de Imagens e Pedidos
                </h2>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  Banco de Dados Seguro
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Todas as fotos tiradas e anexadas por clientes e fornecedores arquivadas no formato original com rastreabilidade total.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono font-bold text-slate-300 bg-slate-800 px-3 py-2 rounded-xl border border-slate-700">
              {filteredMedia.length} mídias
            </span>
            <button
              type="button"
              onClick={() => exportMediaArchivePdfReport(toPdfItems(filteredMedia))}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-md flex items-center gap-1.5 transition cursor-pointer"
            >
              <FileDown className="w-4 h-4" />
              <span>Gerar e Baixar Relatório em PDF</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nº do pedido, peça, marca ou nome do autor..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-xs text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {(['todos', 'solicitacao', 'cotacao', 'embalagem'] as const).map(type => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  filterType === type
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {type === 'todos'
                  ? 'Todas as Fotos'
                  : type === 'solicitacao'
                  ? 'Solicitações (Cliente)'
                  : type === 'cotacao'
                  ? 'Cotações (Fornecedor)'
                  : 'Expedição / Embalados'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Media Grid */}
      {filteredMedia.length === 0 ? (
        <div className="p-10 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <Camera className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
            Nenhuma foto encontrada no arquivo
          </h4>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredMedia.map(item => (
            <div
              key={item.id}
              className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col justify-between hover:border-blue-500 transition group"
            >
              <div
                className="relative h-44 bg-slate-950 overflow-hidden cursor-pointer"
                onClick={() =>
                  setSelectedPhoto({
                    url: item.mediaUrl,
                    title: item.title,
                    subtitle: item.subtitle,
                    ref: item.referenceNumber,
                    author: item.authorName,
                    date: item.date,
                  })
                }
              >
                <img
                  src={item.mediaUrl}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute top-2 left-2">
                  <span
                    className={`text-[10px] font-black uppercase px-2 py-0.5 rounded shadow-sm text-white ${
                      item.type === 'solicitacao'
                        ? 'bg-blue-600'
                        : item.type === 'cotacao'
                        ? 'bg-emerald-600'
                        : 'bg-purple-600'
                    }`}
                  >
                    {item.type}
                  </span>
                </div>
                <div className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-black/75 text-white backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-opacity">
                  <Eye className="w-4 h-4" />
                </div>
              </div>

              <div className="p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                    {item.referenceNumber}
                  </span>
                  <span>{new Date(item.date).toLocaleDateString('pt-BR')}</span>
                </div>
                <h4 className="font-black text-slate-900 dark:text-white line-clamp-1">
                  {item.title}
                </h4>
                <p className="text-slate-500 text-[11px] line-clamp-1">
                  {item.subtitle}
                </p>
                <div className="text-[11px] text-slate-400">
                  Autor: <strong className="text-slate-700 dark:text-slate-300">{item.authorName}</strong>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(item)}
                    className="flex-1 py-1.5 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-[11px] flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Edit2 className="w-3 h-3" /> Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => exportMediaArchivePdfReport(toPdfItems([item]), item.referenceNumber)}
                    className="flex-1 py-1.5 px-2 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold text-[11px] flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <FileDown className="w-3 h-3" /> PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteItem(item)}
                    className="py-1.5 px-2 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 font-bold text-[11px] flex items-center justify-center gap-1 cursor-pointer"
                    title="Excluir mídia"
                  >
                    <Trash2 className="w-3 h-3" /> Excluir
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Photo Zoom Modal */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/90 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-3xl rounded-3xl bg-slate-900 border border-slate-800 overflow-hidden shadow-2xl relative">
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/60 text-white hover:bg-black/90 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="max-h-[65vh] bg-black flex items-center justify-center overflow-hidden">
              <img
                src={selectedPhoto.url}
                alt={selectedPhoto.title}
                className="max-h-[65vh] w-auto object-contain mx-auto"
                referrerPolicy="no-referrer"
              />
            </div>

            <div className="p-5 sm:p-6 bg-slate-900 text-white space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-blue-400">
                  Referência: {selectedPhoto.ref}
                </span>
                <span className="text-xs text-slate-400">
                  {new Date(selectedPhoto.date).toLocaleString('pt-BR')}
                </span>
              </div>
              <h3 className="text-lg font-black text-white">{selectedPhoto.title}</h3>
              <p className="text-xs text-slate-300">{selectedPhoto.subtitle}</p>
              <div className="pt-2 border-t border-slate-800 text-xs text-slate-400 flex items-center justify-between">
                <span>
                  Registrado por: <strong className="text-white">{selectedPhoto.author}</strong>
                </span>
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <ShieldCheck className="w-4 h-4" /> Imagem Original Autêntica
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Media Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm">
          <form
            onSubmit={handleSaveEdit}
            className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Editar Registro de Mídia ({editingItem.referenceNumber})
              </h3>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Título / Peça / Marca
              </label>
              <input
                type="text"
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                URL da Imagem ou Nova Foto
              </label>
              <input
                type="text"
                value={editMediaUrl}
                onChange={e => setEditMediaUrl(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 mb-2"
              />
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold cursor-pointer">
                <Upload className="w-3.5 h-3.5" /> Enviar Nova Foto
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => handlePhotoUpload(e.target.files?.[0])}
                />
              </label>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" /> Salvar Alterações
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {confirmDeleteItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border-2 border-red-400 p-5 space-y-4 shadow-2xl">
            <h3 className="text-base font-black text-red-600">Excluir Mídia Arquivada?</h3>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Confirma a exclusão da imagem vinculada a <strong>{confirmDeleteItem.referenceNumber}</strong> ({confirmDeleteItem.title})?
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setConfirmDeleteItem(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  db.deleteMediaArchiveItem(
                    confirmDeleteItem.sourceType,
                    confirmDeleteItem.sourceId,
                    adminId
                  );
                  setConfirmDeleteItem(null);
                }}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-black cursor-pointer"
              >
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
