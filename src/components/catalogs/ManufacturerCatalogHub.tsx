/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Search,
  Download,
  Car,
  Bike,
  Truck,
  Tractor,
  Cog,
  Plus,
  Trash2,
  CheckCircle,
  Info,
  Edit2,
  FileDown,
  X,
  Save,
  AlertTriangle
} from 'lucide-react';
import { ManufacturerCatalog } from '../../types';
import { db } from '../../services/db';
import { downloadCatalogPdf } from '../../services/pdfStorage';
import { exportCatalogsPdfReport } from '../../services/pdfReport';

interface ManufacturerCatalogHubProps {
  isAdminView?: boolean;
  adminId?: string;
  onSelectOemCode?: (code: string) => void;
}

export const ManufacturerCatalogHub: React.FC<ManufacturerCatalogHubProps> = ({
  isAdminView = false,
  adminId = 'usr_admin_1',
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('todos');
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const unsub = db.subscribe(() => setTick(t => t + 1));
    return () => {
      unsub();
    };
  }, []);

  // New catalog modal / form states for Admin
  const adminCategories = db.getCategories();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newManufacturer, setNewManufacturer] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<string>(adminCategories[0]?.name || 'carro');
  const [newCompatibleModels, setNewCompatibleModels] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPdfFile, setNewPdfFile] = useState<File | null>(null);

  // Edit / Delete modal states for Admin
  const [editingCatalog, setEditingCatalog] = useState<ManufacturerCatalog | null>(null);
  const [editManufacturer, setEditManufacturer] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editCompatibleModels, setEditCompatibleModels] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPdfFile, setEditPdfFile] = useState<File | null>(null);
  const [deletingCatalog, setDeletingCatalog] = useState<ManufacturerCatalog | null>(null);

  const catalogs = db.getManufacturerCatalogs(searchTerm, selectedCategory);

  const categories = [
    { id: 'todos', label: 'Todos os Catálogos', icon: <BookOpen className="w-3.5 h-3.5" /> },
    { id: 'carro', label: 'Carros / Passeio', icon: <Car className="w-3.5 h-3.5" /> },
    { id: 'moto', label: 'Motos', icon: <Bike className="w-3.5 h-3.5" /> },
    { id: 'caminhao', label: 'Caminhões & Diesel', icon: <Truck className="w-3.5 h-3.5" /> },
    { id: 'agricola', label: 'Máquinas Agrícolas', icon: <Tractor className="w-3.5 h-3.5" /> },
    { id: 'industrial', label: 'Industrial & Outros', icon: <Cog className="w-3.5 h-3.5" /> },
  ];

  const handleDownload = async (catalog: ManufacturerCatalog) => {
    setFeedbackError(null);
    const ok = await downloadCatalogPdf(catalog);
    if (!ok) {
      setFeedbackError('O arquivo PDF original não foi encontrado para download. Solicite ao administrador que reenvie o PDF.');
      return;
    }
    db.incrementCatalogDownload(catalog.id);
    setDownloadSuccess(catalog.id);
    setTimeout(() => setDownloadSuccess(null), 3000);
  };

  const handleAddCatalog = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackError(null);
    if (!newManufacturer || !newTitle || !newPdfFile) {
      setFeedbackError('Preencha fabricante, título e anexe o arquivo PDF real.');
      return;
    }

    db.addManufacturerCatalog(
      {
        manufacturer: newManufacturer,
        title: newTitle,
        category: newCategory,
        compatibleModels: newCompatibleModels || 'Todos os modelos da linha',
        description: newDescription || 'Catálogo oficial de peças de reposição e códigos OEM.',
        fileSize: `${(newPdfFile.size / 1024 / 1024).toFixed(2)} MB`,
        pdfUrl: '#',
        pdfFileName: newPdfFile.name,
      },
      adminId,
      newPdfFile
    );

    setShowAddForm(false);
    setNewManufacturer('');
    setNewTitle('');
    setNewCompatibleModels('');
    setNewDescription('');
    setNewPdfFile(null);
  };

  const openEditModal = (cat: ManufacturerCatalog) => {
    setEditingCatalog(cat);
    setEditManufacturer(cat.manufacturer || '');
    setEditTitle(cat.title || cat.name || '');
    setEditCategory(cat.category || '');
    setEditCompatibleModels(cat.compatibleModels || '');
    setEditDescription(cat.description || '');
    setEditPdfFile(null);
  };

  const handleSaveEditCatalog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCatalog) return;
    db.updateCatalog(
      editingCatalog.id,
      {
        manufacturer: editManufacturer,
        title: editTitle,
        name: editTitle,
        category: editCategory,
        compatibleModels: editCompatibleModels,
        description: editDescription,
      },
      adminId,
      editPdfFile
    );
    setEditingCatalog(null);
  };

  return (
    <div className="space-y-5">
      {feedbackError && (
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-200 text-xs font-bold flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {feedbackError}
          </span>
          <button type="button" onClick={() => setFeedbackError(null)} className="cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header with Search Bar */}
      <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-black text-white">
                  Catálogos Oficiais de Fabricantes (PDF)
                </h2>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  Códigos OEM
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Baixe manuais e catálogos técnicos em PDF adicionados pela administração para consulta de códigos OEM e autopeças.
              </p>
            </div>
          </div>

          {isAdminView && (
            <div className="flex items-center gap-2 flex-wrap self-start md:self-auto">
              <button
                type="button"
                onClick={() => exportCatalogsPdfReport(catalogs)}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md flex items-center gap-1.5 transition cursor-pointer"
              >
                <FileDown className="w-4 h-4" />
                <span>Gerar e Baixar Relatório em PDF</span>
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(!showAddForm)}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md flex items-center gap-1.5 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{showAddForm ? 'Fechar Formulário' : '+ Anexar Novo Catálogo PDF'}</span>
              </button>
            </div>
          )}
        </div>

        <div className="relative">
          <Search className="w-5 h-5 absolute left-3.5 top-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Pesquise por marca (Nakata, Bosch, Cofap...), modelo (Gol, Corolla, Titan...) ou tipo de peça..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3 rounded-2xl bg-white/10 dark:bg-slate-800/80 border border-white/20 dark:border-slate-700 text-sm text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3.5 top-3 text-xs text-slate-400 hover:text-white cursor-pointer"
            >
              Limpar
            </button>
          )}
        </div>

        <div className="p-3 rounded-xl bg-black/40 border border-white/10 flex items-start gap-2.5 text-xs text-slate-300">
          <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <span>
            <strong>Dica Rápida:</strong> Baixe o PDF do fabricante do seu veículo, localize o <strong>Código OEM</strong> da peça desejada e digite-o no campo de busca ou solicitação da AUTO SHOP para receber cotações mais precisas dos fornecedores!
          </span>
        </div>
      </div>

      {/* Admin Add Form */}
      {isAdminView && showAddForm && (
        <form onSubmit={handleAddCatalog} className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-black text-slate-900 dark:text-white">
              Cadastrar / Anexar Novo Catálogo de Fabricante em PDF
            </h3>
            <span className="text-xs text-slate-500">Exibido na página inicial de clientes e fornecedores</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Fabricante / Marca *
              </label>
              <input
                type="text"
                placeholder="Ex: Nakata, Bosch, Valeo, Dana"
                value={newManufacturer}
                onChange={e => setNewManufacturer(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-600"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Título do Catálogo *
              </label>
              <input
                type="text"
                placeholder="Ex: Catálogo Suspensão & Direção 2024"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-600"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Categoria de Veículo *
              </label>
              <select
                value={newCategory}
                onChange={e => setNewCategory(e.target.value)}
                className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-600"
              >
                {adminCategories.map(cat => (
                  <option key={cat.id} value={cat.name}>{cat.name}</option>
                ))}
                <option value="Todas as Categorias">Todas as Categorias</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Modelos de Veículos Compatíveis
              </label>
              <input
                type="text"
                placeholder="Ex: Gol, Palio, Onix, HB20, Corolla, Civic"
                value={newCompatibleModels}
                onChange={e => setNewCompatibleModels(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Anexar Arquivo PDF Real *
              </label>
              <input
                type="file"
                accept="application/pdf"
                onChange={e => setNewPdfFile(e.target.files ? e.target.files[0] : null)}
                className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Descrição e Instruções de Consulta
            </label>
            <textarea
              rows={2}
              placeholder="Descreva o que o usuário vai encontrar no PDF..."
              value={newDescription}
              onChange={e => setNewDescription(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md cursor-pointer"
            >
              Salvar e Disponibilizar aos Usuários
            </button>
          </div>
        </form>
      )}

      {/* Category Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl transition whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
              selectedCategory === cat.id
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
            }`}
          >
            {cat.icon}
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      {/* Catalogs Grid */}
      {catalogs.length === 0 ? (
        <div className="p-10 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 border-dashed">
          <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
            {searchTerm ? `Nenhum catálogo encontrado com o termo "${searchTerm}"` : 'Nenhum catálogo disponível no momento.'}
          </h4>
          <p className="text-xs text-slate-500 mt-1">
            {searchTerm
              ? 'Tente buscar por outro termo ou selecione outra categoria.'
              : 'Novos catálogos e manuais em PDF adicionados pelo Administrador aparecerão aqui para download.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {catalogs.map(cat => (
            <div
              key={cat.id}
              className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:border-blue-500/50 hover:shadow-md transition flex flex-col justify-between gap-4"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 text-[11px] font-black uppercase">
                      {cat.manufacturer}
                    </span>
                    <span className="text-[10px] uppercase font-bold text-slate-400">
                      {cat.category}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    {cat.fileSize}
                  </span>
                </div>

                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  {cat.title}
                </h3>

                <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                  {cat.description}
                </p>

                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 text-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                    Modelos Compatíveis no Catálogo:
                  </span>
                  <span className="text-slate-800 dark:text-slate-200 font-semibold line-clamp-2">
                    {cat.compatibleModels}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] text-slate-400 font-medium">
                  {cat.downloadsCount} downloads
                </span>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {isAdminView && (
                    <>
                      <button
                        type="button"
                        onClick={() => openEditModal(cat)}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
                        title="Editar catálogo"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Editar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => exportCatalogsPdfReport([cat])}
                        className="px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-1 cursor-pointer"
                        title="Gerar Relatório PDF deste catálogo"
                      >
                        <FileDown className="w-3.5 h-3.5" />
                        <span>PDF</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingCatalog(cat)}
                        className="px-2.5 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/40 text-red-600 text-xs font-bold flex items-center gap-1 cursor-pointer"
                        title="Excluir catálogo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Excluir</span>
                      </button>
                    </>
                  )}

                  <button
                    onClick={() => handleDownload(cat)}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                  >
                    {downloadSuccess === cat.id ? (
                      <>
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-300" />
                        <span>Baixado!</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-3.5 h-3.5" />
                        <span>Baixar PDF (1 Clique)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {isAdminView && editingCatalog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm">
          <form
            onSubmit={handleSaveEditCatalog}
            className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Editar Catálogo Oficial
              </h3>
              <button type="button" onClick={() => setEditingCatalog(null)} className="cursor-pointer">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1">Fabricante *</label>
                <input
                  type="text"
                  value={editManufacturer}
                  onChange={e => setEditManufacturer(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Categoria *</label>
                <select
                  value={editCategory}
                  onChange={e => setEditCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  {adminCategories.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                  <option value="Todas as Categorias">Todas as Categorias</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold mb-1">Título *</label>
              <input
                type="text"
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold mb-1">Modelos Compatíveis</label>
              <input
                type="text"
                value={editCompatibleModels}
                onChange={e => setEditCompatibleModels(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-bold mb-1">Descrição</label>
              <textarea
                rows={2}
                value={editDescription}
                onChange={e => setEditDescription(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-bold mb-1">Substituir Arquivo PDF (opcional)</label>
              <input
                type="file"
                accept="application/pdf"
                onChange={e => setEditPdfFile(e.target.files?.[0] || null)}
                className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingCatalog(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" /> Salvar Catálogo
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {isAdminView && deletingCatalog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border-2 border-red-400 p-5 space-y-4 shadow-2xl">
            <h3 className="text-base font-black text-red-600">Excluir Catálogo PDF?</h3>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Deseja remover permanentemente o catálogo <strong>{deletingCatalog.title || deletingCatalog.name}</strong>?
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setDeletingCatalog(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  db.deleteManufacturerCatalog(deletingCatalog.id, adminId);
                  setDeletingCatalog(null);
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
