/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  Users,
  Store,
  DollarSign,
  AlertTriangle,
  FileText,
  Sliders,
  Settings,
  Bell,
  RefreshCw,
  Search,
  CheckCircle,
  XCircle,
  Lock,
  Unlock,
  Truck,
  Package,
  Layers,
  ArrowRight,
  TrendingUp,
  RotateCcw,
  Clock,
  Trash2,
  Ban,
  Eye,
  ChevronDown,
  ChevronUp,
  UserCheck,
  Key,
  Check,
  X,
  ShieldAlert,
  FileCheck,
  MapPin,
  ExternalLink,
  BookOpen,
  Camera,
  Archive,
  MessageSquare,
  FilePlus,
  Download,
  Tag,
  Plus,
  Edit2,
  Copy,
  Link2,
  FileDown,
  Save,
  Wallet,
  BarChart3,
  Megaphone
} from 'lucide-react';
import {
  User,
  PartRequest,
  OrderAndPayment,
  SpamTriggerConfig,
  VehicleCategory,
  SupplierTier,
  SupplierPaymentType,
  AuditLog,
  ManufacturerCatalog,
  SupplierSpamModality
} from '../../types';
import { db } from '../../services/db';
import { hasPermission, getIndependentPortalLinks } from '../../services/rbac';
import { downloadCatalogPdf } from '../../services/pdfStorage';
import {
  exportArchivedRecordsPdfReport,
  exportAuditLogsPdfReport,
  exportBottlenecksPdfReport,
  exportCatalogsPdfReport
} from '../../services/pdfReport';
import { SpamOverlay, ActiveSpamPayload } from '../common/SpamOverlay';
import { SpamEditorModal } from './SpamEditorModal';
import { AppEditorTab } from './AppEditorTab';
import { MediaArchiveTab } from './MediaArchiveTab';
import { ChatSupervisionTab } from './ChatSupervisionTab';
import { UserManagementTab } from './UserManagementTab';
import { SplitManagementTab } from './SplitManagementTab';
import { FinancialReportTab } from './FinancialReportTab';
import { ClientAdsAdminTab } from './ClientAdsAdminTab';

interface AdminDashboardProps {
  currentUser: User;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<
    'kpis' | 'autorizacoes' | 'fornecedores' | 'solicitacoes' | 'pedidos' | 'split' | 'relatorio_financeiro' | 'anuncios_clientes' | 'categorias' | 'spams' | 'gargalos' | 'auditoria' | 'comissoes' | 'editar' | 'catalogos' | 'fotos' | 'mensagens' | 'usuarios' | 'arquivo_morto'
  >('kpis');

  // Modals & States
  const [editingSpam, setEditingSpam] = useState<SpamTriggerConfig | null>(null);
  const [isCreatingSpam, setIsCreatingSpam] = useState(false);
  const [generalCommission, setGeneralCommission] = useState(
    db.getCommissionSettings().generalCommissionPercent
  );
  const [distMode, setDistMode] = useState(db.getCommissionSettings().distributionMode);
  const [supplierSearch, setSupplierSearch] = useState('');
  
  // Timer Settings state
  const currentTimers = db.getTimerSettings();
  const [supplierMinutes, setSupplierMinutes] = useState(currentTimers.supplierResponseTimeoutMinutes);
  const [clientMinutes, setClientMinutes] = useState(currentTimers.clientApprovalTimeoutMinutes);
  const [timerSavedSuccess, setTimerSavedSuccess] = useState(false);

  // Expanded UI states
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);
  const [selectedMediaPreview, setSelectedMediaPreview] = useState<string | null>(null);

  // Catalog States (Gerenciamento de PDFs)
  const [catalogName, setCatalogName] = useState('');
  const [catalogCategory, setCatalogCategory] = useState('');
  const [catalogFile, setCatalogFile] = useState<File | null>(null);
  const catalogFileInputRef = useRef<HTMLInputElement>(null);

  // Links Independentes & Preview de SPAM
  const [copiedPortalRole, setCopiedPortalRole] = useState<string | null>(null);
  const [selectedTestSpamId, setSelectedTestSpamId] = useState<string>(db.getSpamsConfig()[0]?.id || '');
  const [previewSpamPayload, setPreviewSpamPayload] = useState<ActiveSpamPayload | null>(null);

  // CRUD states para Gargalos, Auditoria, Catálogos e Arquivo Morto
  const [editingBottleneck, setEditingBottleneck] = useState<PartRequest | null>(null);
  const [editReqPartName, setEditReqPartName] = useState('');
  const [editReqRadius, setEditReqRadius] = useState<number>(50);
  const [editReqStatus, setEditReqStatus] = useState<PartRequest['status']>('aguardando_orcamentos');
  const [deletingBottleneck, setDeletingBottleneck] = useState<PartRequest | null>(null);

  const [editingAuditLog, setEditingAuditLog] = useState<AuditLog | null>(null);
  const [editAuditAction, setEditAuditAction] = useState('');
  const [editAuditDetails, setEditAuditDetails] = useState('');
  const [deletingAuditLog, setDeletingAuditLog] = useState<AuditLog | null>(null);

  const [editingCatalogItem, setEditingCatalogItem] = useState<ManufacturerCatalog | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [editCatManufacturer, setEditCatManufacturer] = useState('');
  const [editCatCategory, setEditCatCategory] = useState('');
  const [editCatModels, setEditCatModels] = useState('');
  const [editCatFile, setEditCatFile] = useState<File | null>(null);
  const [deletingCatalogItem, setDeletingCatalogItem] = useState<ManufacturerCatalog | null>(null);

  const [editingArchiveOrder, setEditingArchiveOrder] = useState<OrderAndPayment | null>(null);
  const [editOrderPartName, setEditOrderPartName] = useState('');
  const [editOrderVehicle, setEditOrderVehicle] = useState('');
  const [editOrderTotal, setEditOrderTotal] = useState<number>(0);
  const [editOrderTransfer, setEditOrderTransfer] = useState<number>(0);
  const [editOrderStatus, setEditOrderStatus] = useState<OrderAndPayment['deliveryStatus']>('entregue');
  const [deletingArchiveOrder, setDeletingArchiveOrder] = useState<OrderAndPayment | null>(null);

  // Category & Subcategory CRUD States
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryVehicleType, setNewCategoryVehicleType] = useState<VehicleCategory>('carro');
  const [editingCategory, setEditingCategory] = useState<{ id: string; name: string; vehicleType: VehicleCategory } | null>(null);
  const [newSubcategoryByCat, setNewSubcategoryByCat] = useState<Record<string, string>>({});
  const [editingSubcategory, setEditingSubcategory] = useState<{ catId: string; subId: string; name: string } | null>(null);

  // Classificação prévia obrigatória para aprovação de Fornecedores
  const [pendingTierMap, setPendingTierMap] = useState<Record<string, SupplierTier>>({});
  const [pendingPaymentMap, setPendingPaymentMap] = useState<Record<string, SupplierPaymentType>>({});
  const [pendingCommissionMap, setPendingCommissionMap] = useState<Record<string, number>>({});
  const [pendingModalityMap, setPendingModalityMap] = useState<Record<string, string>>({});

  // CRUD de Classificação / Modalidade de SPAM do Fornecedor (Escrita, Condição, Porcentagem)
  const [editingModalityId, setEditingModalityId] = useState<string | null>(null);
  const [modEscrita, setModEscrita] = useState('');
  const [modCondicao, setModCondicao] = useState('');
  const [modPorcentagem, setModPorcentagem] = useState<number>(10);
  const [modBaseTier, setModBaseTier] = useState<SupplierTier>('opcao_2');
  const [modFeedback, setModFeedback] = useState<string | null>(null);

  const openSpamPreview = (cfg: SpamTriggerConfig) => {
    setPreviewSpamPayload({
      config: cfg,
      isPreviewMode: true,
      requestNumber: 'CHAM-TESTE-901',
      orderNumber: 'PED-TESTE-404',
      partName: 'Amortecedor Dianteiro + Kit Coxim (Exemplo Teste)',
      categoryName: 'Carros / Passeio',
      partSubcategory: 'Suspensão',
      vehicleSummary: 'Volkswagen Gol 1.6 MSI (2022)',
      neighborhood: 'Moema',
      city: 'São Paulo',
      fullAddress: 'Av. Ibirapuera, 2100 - Moema, São Paulo - SP',
      deliveryCep: '04028-001',
      distanceKm: 7.4,
      priceSummary: 'R$ 540,00',
      partPriceSummary: 'R$ 490,00',
      shippingPriceSummary: 'R$ 50,00',
      supplierTransferSummary: 'R$ 441,00',
      paymentMethodText: 'PIX Instantâneo',
      customerName: 'João Silva (Simulação)',
      customerPhone: '(11) 99999-0000',
      customerDocument: '123.456.789-00',
      supplierTier: 'opcao_2',
      onAction: () => setPreviewSpamPayload(null),
      onDismissOptional: () => setPreviewSpamPayload(null),
    });
  };

  const handleCopyPortalLink = async (roleKey: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedPortalRole(roleKey);
      setTimeout(() => setCopiedPortalRole(null), 2500);
    } catch {
      setCopiedPortalRole(roleKey);
      setTimeout(() => setCopiedPortalRole(null), 2500);
    }
  };

  const catalogs = db.getCatalogs ? db.getCatalogs() : [];
  const adminCategories = db.getCategories();
  const unreadMessagesCount = db.getUnreadChatCountForUser(currentUser.id, 'admin');

  // Data queries
  const users = db.getUsers();
  const clients = users.filter(u => u.role === 'cliente');
  const suppliers = users.filter(u => u.role === 'fornecedor');
  const pendingSuppliers = suppliers.filter(u => u.status === 'pendente');
  const requests = db.getRequests();
  const orders = db.getOrders();
  const quotes = db.getQuotes();
  const auditLogs = db.getAuditLogs();
  const spams = db.getSpamsConfig();
  const commissionSettings = db.getCommissionSettings();

  // Metrics
  const requestsWithoutQuotes = requests.filter(r => db.getQuotes(r.id).length === 0);
  const totalGMV = orders.reduce((sum, o) => sum + o.totalAmount, 0);
  const totalPlatformCommissions = orders.reduce((sum, o) => sum + o.platformCommissionAmount, 0);
  const pendingTransfers = orders
    .filter(o => o.deliveryStatus !== 'entregue')
    .reduce((sum, o) => sum + o.supplierTransferAmount, 0);
  const releasedTransfers = orders
    .filter(o => o.deliveryStatus === 'entregue')
    .reduce((sum, o) => sum + o.supplierTransferAmount, 0);

  const [, setTick] = useState(0);
  useEffect(() => {
    db.processExpiredRequests();
    const unsub = db.subscribe(() => setTick(t => t + 1));
    const timer = setInterval(() => {
      db.processExpiredRequests();
      setTick(t => t + 1);
    }, 5000);
    return () => {
      unsub();
      clearInterval(timer);
    };
  }, []);

  const handleUpdateSupplierStatus = (supplierId: string, status: User['status']) => {
    db.updateUserStatus(supplierId, status, currentUser.id);
  };

  const handleUpdateSupplierRadius = (supplierId: string, radiusKm: number) => {
    db.setSupplierRadius(supplierId, radiusKm);
  };

  const handleUpdateSupplierTier = (supplierId: string, tier: SupplierTier) => {
    db.updateUser(
      supplierId,
      { supplierTier: tier, isClassifiedByAdmin: true },
      currentUser.id
    );
  };

  const handleUpdateSupplierModality = (supplierId: string, modalityId: string) => {
    const mod = db.getSupplierModalities().find(m => m.id === modalityId);
    if (!mod) return;
    db.updateUser(
      supplierId,
      {
        supplierModalityId: mod.id,
        supplierTier: mod.baseTier,
        supplierClassificationEscrita: mod.escrita,
        supplierClassificationCondicao: mod.condicao,
        supplierClassificationPercent: mod.porcentagem,
        commissionRateOverride: mod.porcentagem,
        isClassifiedByAdmin: true,
      },
      currentUser.id
    );
  };

  const handleAuthorizeSupplier = (supplierId: string) => {
    const sup = suppliers.find(s => s.id === supplierId);
    const modalities = db.getSupplierModalities();
    const chosenModalityId = pendingModalityMap[supplierId] || sup?.supplierModalityId || '';
    const chosenMod = modalities.find(m => m.id === chosenModalityId);
    const chosenTier: SupplierTier = chosenMod?.baseTier || pendingTierMap[supplierId] || sup?.supplierTier || 'opcao_2';
    const chosenRadius = sup?.serviceRadiusKm !== undefined ? sup.serviceRadiusKm : 50;
    const chosenPayment: SupplierPaymentType = pendingPaymentMap[supplierId] || sup?.supplierPaymentType || 'compe_split';
    const chosenCommission =
      pendingCommissionMap[supplierId] ??
      chosenMod?.porcentagem ??
      sup?.commissionRateOverride ??
      commissionSettings.generalCommissionPercent;
    const tierLabel =
      chosenMod?.escrita ||
      sup?.supplierClassificationEscrita ||
      (chosenTier === 'opcao_1' ? '1ª Opção' : chosenTier === 'opcao_2' ? '2ª Opção' : '3ª Opção');
    if (confirm(`Autorizar e classificar "${sup?.companyName || sup?.name}" como ${tierLabel} (Raio: ${chosenRadius === 0 ? 'Sem Limite' : `${chosenRadius} km`}) para operar na AUTO SHOP?`)) {
      db.authorizeSupplier(supplierId, currentUser.id, {
        supplierTier: chosenTier,
        serviceRadiusKm: chosenRadius,
        supplierPaymentType: chosenPayment,
        commissionRateOverride: chosenCommission,
        supplierModalityId: chosenMod?.id || sup?.supplierModalityId,
        supplierClassificationEscrita: chosenMod?.escrita || sup?.supplierClassificationEscrita,
        supplierClassificationCondicao: chosenMod?.condicao || sup?.supplierClassificationCondicao,
        supplierClassificationPercent: chosenCommission,
      });
    }
  };

  const handleRejectSupplier = (supplierId: string) => {
    const sup = suppliers.find(s => s.id === supplierId);
    const reason = prompt(`Informe o motivo da recusa para "${sup?.companyName || sup?.name}":`, 'Documentação cadastral incompleta ou reprovada');
    if (reason !== null) {
      db.rejectSupplierApplication(supplierId, currentUser.id, reason);
    }
  };

  const handleCancelRequest = (requestId: string) => {
    const req = requests.find(r => r.id === requestId);
    if (confirm(`Deseja realmente cancelar a solicitação ${req?.requestNumber || requestId}?`)) {
      db.cancelRequest(requestId, currentUser.id, 'Cancelado pelo Administrador');
    }
  };

  const handleDeleteRequest = (requestId: string) => {
    const req = requests.find(r => r.id === requestId);
    if (confirm(`ATENÇÃO: Deseja EXCLUIR PERMANENTEMENTE a solicitação ${req?.requestNumber || requestId} e todos os seus orçamentos do banco de dados?`)) {
      db.deleteRequest(requestId, currentUser.id);
    }
  };

  const handleCancelOrder = (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (confirm(`Deseja cancelar e estornar o pedido ${order?.orderNumber || orderId}?`)) {
      db.cancelOrder(orderId, currentUser.id, 'Cancelado e estornado pelo Administrador');
    }
  };

  const handleDeleteOrder = (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (confirm(`ATENÇÃO: Deseja EXCLUIR PERMANENTEMENTE o pedido ${order?.orderNumber || orderId} do banco de dados?`)) {
      db.deleteOrder(orderId, currentUser.id);
    }
  };

  const handleSaveTimerSettings = (e: React.FormEvent) => {
    e.preventDefault();
    db.updateTimerSettings(
      {
        supplierResponseTimeoutMinutes: Math.max(1, Number(supplierMinutes)),
        clientApprovalTimeoutMinutes: Math.max(1, Number(clientMinutes)),
      },
      currentUser.id
    );
    setTimerSavedSuccess(true);
    setTimeout(() => setTimerSavedSuccess(false), 3500);
  };

  const handleExpandSearch = (requestId: string) => {
    db.expandSearchRadius(requestId, currentUser.id);
    alert('Raio de busca expandido em +50km e contagem estendida por 15 minutos!');
  };

  const handleSaveCommissions = (e: React.FormEvent) => {
    e.preventDefault();
    db.updateCommissionSettings(
      {
        generalCommissionPercent: Number(generalCommission),
        distributionMode: distMode,
      },
      currentUser.id
    );
    alert('Configurações de comissão e distribuição salvas!');
  };

  // Função para salvar catálogo no DB central (acessível por Clientes e Fornecedores)
  const handleSaveCatalog = () => {
    if (!catalogName || !catalogCategory || !catalogFile) {
      alert('Por favor, preencha todos os campos obrigatórios e anexe o PDF.');
      return;
    }

    if (db.saveCatalog) {
      db.saveCatalog({
        id: Date.now().toString(),
        name: catalogName,
        category: catalogCategory,
        fileName: catalogFile.name,
        fileSize: (catalogFile.size / 1024 / 1024).toFixed(2) + ' MB',
        uploadDate: new Date().toLocaleDateString('pt-BR'),
        adminId: currentUser.id,
        file: catalogFile // O serviço db deve lidar com o upload (Firebase Storage, S3, ou base64)
      });
      alert('✅ Catálogo salvo com sucesso! Agora está disponível para download no App de Clientes e Fornecedores.');
    } else {
      alert('⚠️ Função db.saveCatalog não encontrada. Verifique seu arquivo services/db.ts');
    }

    // Limpa o formulário
    setCatalogName('');
    setCatalogCategory('');
    setCatalogFile(null);
    if (catalogFileInputRef.current) {
      catalogFileInputRef.current.value = '';
    }
  };

  // Função para excluir catálogo do DB central
  const handleDeleteCatalog = (catalogId: string, catalogName: string) => {
    if (confirm(`Deseja excluir o catálogo "${catalogName}"? Ele sumirá imediatamente do App dos clientes e fornecedores.`)) {
      if (db.deleteCatalog) {
        db.deleteCatalog(catalogId, currentUser.id);
        alert('Catálogo excluído com sucesso.');
      } else {
        alert('⚠️ Função db.deleteCatalog não encontrada. Verifique seu arquivo services/db.ts');
      }
    }
  };

  if (currentUser.role !== 'admin' || !hasPermission(currentUser, 'admin:master_control')) {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 rounded-3xl bg-white dark:bg-slate-900 border-2 border-red-300 dark:border-red-900 text-center space-y-3 shadow-xl">
        <Lock className="w-12 h-12 text-red-600 mx-auto" />
        <h2 className="text-xl font-black text-slate-900 dark:text-white">Acesso Negado (RBAC)</h2>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          O Painel Administrativo Master exige autenticação exclusiva de Administrador ativo.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Admin Top Header Banner */}
      <div className="p-5 sm:p-6 rounded-3xl bg-slate-900 text-white border border-slate-800 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-white">
                Painel Administrativo AUTO SHOP
              </h1>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                Super Admin
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Gestão central de transações, segurança, regras de split e auditoria LGPD.
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            if (confirm('Deseja restaurar o banco de dados para a demonstração original?')) {
              db.resetToDefaults();
            }
          }}
          className="px-3.5 py-2 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition self-start sm:self-auto"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Restaurar Demonstração</span>
        </button>
      </div>

      {/* Admin Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('kpis')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
            activeTab === 'kpis'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Indicadores & Faturamento</span>
        </button>

        <button
          onClick={() => setActiveTab('autorizacoes')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
            activeTab === 'autorizacoes'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
          <span>Autorizar Fornecedores</span>
          {pendingSuppliers.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-black text-[10px] animate-pulse">
              {pendingSuppliers.length} pendente{pendingSuppliers.length > 1 ? 's' : ''}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('fornecedores')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
            activeTab === 'fornecedores'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Store className="w-3.5 h-3.5" />
          <span>Lojas Credenciadas ({suppliers.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('solicitacoes')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
            activeTab === 'solicitacoes'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Solicitações ({requests.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('pedidos')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
            activeTab === 'pedidos'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          <span>Pedidos & Entregas (PIN) ({orders.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('split')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'split'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Wallet className="w-3.5 h-3.5 text-emerald-500" />
          <span>Split & Subcontas ({db.getSplitTransactions().length})</span>
        </button>

        <button
          onClick={() => setActiveTab('relatorio_financeiro')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'relatorio_financeiro'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-emerald-700 dark:text-emerald-300 bg-emerald-50/70 dark:bg-emerald-950/40 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-900'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Relatório Financeiro</span>
        </button>

        <button
          onClick={() => setActiveTab('anuncios_clientes')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'anuncios_clientes'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-amber-700 dark:text-amber-300 bg-amber-50/70 dark:bg-amber-950/40 hover:bg-amber-100 border border-amber-200 dark:border-amber-900'
          }`}
        >
          <Megaphone className="w-3.5 h-3.5" />
          <span>ANÚNCIOS ({db.getClientAdsSettings().items.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('categorias')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'categorias'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Tag className="w-3.5 h-3.5" />
          <span>Categorias ({adminCategories.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('spams')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
            activeTab === 'spams'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Tempos & Editor de SPAMs</span>
        </button>

        <button
          onClick={() => setActiveTab('gargalos')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
            activeTab === 'gargalos'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Radar de Gargalos</span>
          {requestsWithoutQuotes.length > 0 && (
            <span className="w-5 h-5 rounded-full bg-red-600 text-white text-[10px] font-black flex items-center justify-center animate-pulse">
              {requestsWithoutQuotes.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('comissoes')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
            activeTab === 'comissoes'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          <span>Comissões & Distribuição</span>
        </button>

        <button
          onClick={() => setActiveTab('auditoria')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
            activeTab === 'auditoria'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Auditoria LGPD</span>
        </button>

        <button
          onClick={() => setActiveTab('catalogos')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
            activeTab === 'catalogos'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Catálogos PDF</span>
        </button>

        <button
          onClick={() => setActiveTab('fotos')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
            activeTab === 'fotos'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Camera className="w-3.5 h-3.5" />
          <span>Arquivo de Fotos & Mídias</span>
        </button>

        <button
          onClick={() => setActiveTab('mensagens')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'mensagens'
              ? 'bg-purple-600 text-white shadow-sm'
              : unreadMessagesCount > 0
              ? 'bg-amber-500 text-slate-950 animate-pulse ring-2 ring-amber-300 font-black'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>💬 Comunicação & Intercessão ({db.getChatMessages().length})</span>
          {unreadMessagesCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-black">
              {unreadMessagesCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('usuarios')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
            activeTab === 'usuarios'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>👥 Gestão de Usuários ({users.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('arquivo_morto')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
            activeTab === 'arquivo_morto'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Archive className="w-3.5 h-3.5" />
          <span>🗄️ Arquivo Morto (&gt; 30 dias)</span>
        </button>

        <button
          onClick={() => setActiveTab('editar')}
          className={`px-4 py-2 text-xs font-black rounded-xl transition whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
            activeTab === 'editar'
              ? 'bg-amber-500 text-slate-900 shadow-sm ring-2 ring-amber-300'
              : 'text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 border border-amber-200 dark:border-amber-900'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>✏️ Editar Fontes, Cores & Escritas</span>
        </button>
      </div>

      {/* TAB 1: KPIS & METRICS */}
      {activeTab === 'kpis' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-xs text-slate-500 font-semibold block">Volume Total Transacionado (GMV)</span>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-1 tabular-nums">
                R$ {totalGMV.toFixed(2)}
              </p>
              <span className="text-[10px] text-emerald-600 font-bold mt-1 block">
                {orders.length} pedidos confirmados
              </span>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-xs text-slate-500 font-semibold block">Receita AUTO SHOP (Comissões)</span>
              <p className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1 tabular-nums">
                R$ {totalPlatformCommissions.toFixed(2)}
              </p>
              <span className="text-[10px] text-slate-400 mt-1 block">
                Média de {commissionSettings.generalCommissionPercent}% sobre peças
              </span>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-xs text-slate-500 font-semibold block">Repasses Pendentes (Aguardando PIN)</span>
              <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1 tabular-nums">
                R$ {pendingTransfers.toFixed(2)}
              </p>
              <span className="text-[10px] text-amber-600 font-semibold mt-1 block">
                Retidos com segurança até a entrega
              </span>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-xs text-slate-500 font-semibold block">Repasses Liberados (PIN Validado)</span>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
                R$ {releasedTransfers.toFixed(2)}
              </p>
              <span className="text-[10px] text-emerald-600 font-semibold mt-1 block">
                100% auditados pelo sistema
              </span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Ecossistema em Tempo Real
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
                <span className="text-slate-500">Clientes Cadastrados:</span>
                <strong className="block text-lg font-bold text-slate-900 dark:text-white mt-1">
                  {clients.length}
                </strong>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
                <span className="text-slate-500">Lojas & Desmanches Ativos:</span>
                <strong className="block text-lg font-bold text-slate-900 dark:text-white mt-1">
                  {suppliers.filter(s => s.status === 'ativo').length}
                </strong>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
                <span className="text-slate-500">Cotações Transacionadas:</span>
                <strong className="block text-lg font-bold text-slate-900 dark:text-white mt-1">
                  {quotes.length}
                </strong>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
                <span className="text-slate-500">Fornecedores Pendentes:</span>
                <strong className="block text-lg font-bold text-amber-600 mt-1">
                  {pendingSuppliers.length}
                </strong>
              </div>
            </div>
          </div>

          {/* Monitor em Tempo Real de Rotinas & Mudanças de Status (Cliente ↔ Fornecedor) */}
          {(() => {
            const openCount = requests.filter(r => r.status === 'aguardando_orcamentos').length;
            const quotedRequestsCount = requests.filter(r => r.status === 'orcamentos_recebidos').length;
            const awaitingClientAcceptanceQuotesCount = db.getQuotes().filter(q => q.status === 'pendente').length;
            const retryExpansionCount = requests.filter(
              r => r.status === 'aguardando_orcamentos' && ((r.searchAttempt || 1) > 1 || r.autoExpanded)
            ).length;
            const noSupplierCount = requests.filter(
              r => r.status === 'sem_fornecedor' || r.closedReason === 'nenhum_fornecedor_disponivel'
            ).length;
            const waitingBankConfirmCount = orders.filter(
              o => o.paymentStatus === 'confirmado' && o.supplierReceiptConfirmed === false
            ).length;
            const inTransitCount = orders.filter(
              o => (o.deliveryStatus === 'compra_confirmada' && o.supplierReceiptConfirmed !== false) || o.deliveryStatus === 'a_caminho'
            ).length;
            const deliveredCount = orders.filter(o => o.deliveryStatus === 'entregue').length;

            const timelineEvents = [
              ...requests.flatMap(r =>
                (r.statusHistory || []).map(h => ({
                  ...h,
                  entityCode: r.requestNumber,
                  entityTitle: r.partName,
                  entityKind: 'SOLICITAÇÃO' as const,
                }))
              ),
              ...orders.flatMap(o =>
                (o.statusHistory || []).map(h => ({
                  ...h,
                  entityCode: o.orderNumber,
                  entityTitle: o.partName,
                  entityKind: 'PEDIDO' as const,
                }))
              ),
            ]
              .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
              .slice(0, 20);

            return (
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border-2 border-purple-200 dark:border-purple-900/60 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                    <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
                      Monitor de Rotinas e Mudanças de Status em Tempo Real (Cliente ↔ Fornecedor)
                    </h3>
                  </div>
                  <span className="text-[11px] font-bold text-purple-600 dark:text-purple-300">
                    Atualização automática ao vivo
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 text-xs">
                  <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900">
                    <span className="text-[10px] font-bold uppercase text-blue-700 dark:text-blue-300 block">Aguardando Cotação</span>
                    <strong className="text-lg font-black text-blue-900 dark:text-white">{openCount}</strong>
                  </div>
                  <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900">
                    <span className="text-[10px] font-bold uppercase text-purple-700 dark:text-purple-300 block">Com Propostas ({awaitingClientAcceptanceQuotesCount})</span>
                    <strong className="text-lg font-black text-purple-900 dark:text-white">{quotedRequestsCount}</strong>
                  </div>
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900">
                    <span className="text-[10px] font-bold uppercase text-amber-700 dark:text-amber-300 block">Rebusca (+100/500km)</span>
                    <strong className="text-lg font-black text-amber-900 dark:text-white">{retryExpansionCount}</strong>
                  </div>
                  <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900">
                    <span className="text-[10px] font-bold uppercase text-red-700 dark:text-red-300 block">Sem Fornecedor</span>
                    <strong className="text-lg font-black text-red-700 dark:text-red-300">{noSupplierCount}</strong>
                  </div>
                  <div className="p-3 rounded-xl bg-yellow-50 dark:bg-yellow-950/40 border border-yellow-300 dark:border-yellow-900">
                    <span className="text-[10px] font-bold uppercase text-yellow-800 dark:text-yellow-300 block">Conf. Conta Loja</span>
                    <strong className="text-lg font-black text-yellow-900 dark:text-white">{waitingBankConfirmCount}</strong>
                  </div>
                  <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900">
                    <span className="text-[10px] font-bold uppercase text-indigo-700 dark:text-indigo-300 block">Separação / Em Rota</span>
                    <strong className="text-lg font-black text-indigo-900 dark:text-white">{inTransitCount}</strong>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900">
                    <span className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-300 block">Entregues (PIN)</span>
                    <strong className="text-lg font-black text-emerald-700 dark:text-emerald-300">{deliveredCount}</strong>
                  </div>
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {timelineEvents.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">
                      Nenhuma transição de rotina registrada ainda nesta sessão.
                    </p>
                  ) : (
                    timelineEvents.map(ev => (
                      <div
                        key={ev.id}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                              ev.entityKind === 'PEDIDO'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                            }`}>
                              {ev.entityKind} {ev.entityCode}
                            </span>
                            <strong className="text-slate-900 dark:text-white">{ev.stage}</strong>
                            {ev.radiusKm !== undefined && (
                              <span className="text-[10px] font-mono bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded">
                                {ev.radiusKm} km
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-600 dark:text-slate-300">
                            <strong>{ev.entityTitle}:</strong> {ev.details}
                          </p>
                        </div>
                        <div className="text-[10px] font-mono text-slate-500 shrink-0 sm:text-right">
                          <span className="block font-bold uppercase text-slate-700 dark:text-slate-300">
                            {ev.actorRole}{ev.actorName ? ` · ${ev.actorName}` : ''}
                          </span>
                          <span>{new Date(ev.timestamp).toLocaleString('pt-BR')}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })()}

          {/* Card Exclusivo Admin: 3 Links Independentes de Acesso */}
          {(() => {
            const portalLinks = getIndependentPortalLinks();
            return (
              <div className="p-5 rounded-2xl bg-slate-900 text-white border border-purple-500/40 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-300">
                      <Link2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-wider text-white">
                        Links Independentes de Acesso por Perfil (Exclusivo Admin)
                      </h3>
                      <p className="text-[11px] text-slate-300">
                        A tela principal (/) é exclusiva do Cliente. Cada perfil acessa somente sua própria área, sem enxergar os demais portais.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                  {[
                    { key: 'cliente', label: '1. Link CLIENTE (Principal /)', url: portalLinks.cliente, badge: 'bg-blue-600' },
                    { key: 'fornecedor', label: '2. Link FORNECEDOR (Homologado)', url: portalLinks.fornecedor, badge: 'bg-emerald-600' },
                    { key: 'admin', label: '3. Link ADMIN (Restrito Master)', url: portalLinks.admin, badge: 'bg-purple-600' },
                  ].map(item => (
                    <div key={item.key} className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700 space-y-2.5">
                      <span className={`inline-block text-[10px] font-black uppercase px-2 py-0.5 rounded ${item.badge} text-white`}>
                        {item.label}
                      </span>
                      <div className="p-2 rounded-lg bg-slate-950 font-mono text-[11px] text-slate-200 break-all border border-slate-700">
                        {item.url}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleCopyPortalLink(item.key, item.url)}
                          className="flex-1 py-1.5 px-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-[11px] flex items-center justify-center gap-1 cursor-pointer transition"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>{copiedPortalRole === item.key ? 'Copiado!' : 'Copiar Link'}</span>
                        </button>
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="py-1.5 px-3 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-[11px] flex items-center gap-1 transition"
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> Abrir
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* NOVA TAB: AUTORIZAÇÃO E LIBERAÇÃO DE FORNECEDORES */}
      {activeTab === 'autorizacoes' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-500" />
                <span>Autorizações e Liberações de Fornecedores</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Supervisão de lojas e desmanches que se cadastraram e aguardam aprovação para começar a receber chamados no raio configurado.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" />
              <span>Aguardando Análise e Liberação ({pendingSuppliers.length})</span>
            </h3>

            {pendingSuppliers.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Nenhum cadastro pendente de liberação!
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  Todos os fornecedores cadastrados já foram avaliados e liberados pelo administrador.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {pendingSuppliers.map(sup => (
                  <div
                    key={sup.id}
                    className="p-5 rounded-2xl bg-white dark:bg-slate-900 border-2 border-amber-300 dark:border-amber-700/60 shadow-md space-y-4"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-black text-slate-900 dark:text-white">
                            {sup.companyName || sup.name}
                          </h3>
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800 animate-pulse">
                            Pendente de Classificação e Aprovação
                          </span>
                        </div>
                        <span className="text-xs font-semibold text-slate-500">
                          Responsável: {sup.name} · Telefone/WhatsApp: {sup.phone}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleAuthorizeSupplier(sup.id)}
                          className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer"
                        >
                          <Check className="w-4 h-4" />
                          <span>Classificar, Autorizar e Liberar</span>
                        </button>
                        <button
                          onClick={() => handleRejectSupplier(sup.id)}
                          className="px-3.5 py-2.5 rounded-xl border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 font-bold text-xs transition flex items-center gap-1 cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                          <span>Recusar</span>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 space-y-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Documento & Localização:</span>
                        <strong className="font-mono text-slate-800 dark:text-slate-200 block">{sup.document}</strong>
                        <span className="text-[10px] text-slate-600 dark:text-slate-300 block">
                          CEP: <strong className="font-mono">{sup.address?.cep || 'Não informado'}</strong>
                          {sup.address?.city ? ` (${sup.address.city}/${sup.address.state})` : ''}
                        </span>
                        {(sup.coordinates || sup.address?.coordinates) && (
                          <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400 block">
                            Geo: {(sup.coordinates || sup.address?.coordinates)!.lat.toFixed(4)}, {(sup.coordinates || sup.address?.coordinates)!.lng.toFixed(4)}
                          </span>
                        )}
                        <span className="text-[10px] text-slate-500 block">
                          Categorias: <strong>{sup.categoriesSupplied?.join(', ') || 'Não informadas'}</strong>
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 space-y-1.5">
                        <span className="text-[10px] uppercase font-bold text-blue-700 dark:text-blue-300 block">
                          1. Classificação / Modalidade de SPAM:
                        </span>
                        <select
                          value={pendingModalityMap[sup.id] || sup.supplierModalityId || ''}
                          onChange={(e) => {
                            const mId = e.target.value;
                            setPendingModalityMap(prev => ({ ...prev, [sup.id]: mId }));
                            const mod = db.getSupplierModalities().find(m => m.id === mId);
                            if (mod) {
                              setPendingTierMap(prev => ({ ...prev, [sup.id]: mod.baseTier }));
                              setPendingCommissionMap(prev => ({ ...prev, [sup.id]: mod.porcentagem }));
                            }
                          }}
                          className="w-full px-2.5 py-1.5 rounded-lg border-2 border-blue-400 bg-white dark:bg-slate-900 text-xs font-black text-blue-700 dark:text-blue-300 outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
                        >
                          <option value="">Selecionar modalidade cadastrada...</option>
                          {db.getSupplierModalities().map(mod => (
                            <option key={mod.id} value={mod.id}>
                              {mod.escrita} ({mod.porcentagem}%)
                            </option>
                          ))}
                        </select>
                        <select
                          value={pendingTierMap[sup.id] || sup.supplierTier || 'opcao_2'}
                          onChange={(e) => setPendingTierMap(prev => ({ ...prev, [sup.id]: e.target.value as SupplierTier }))}
                          className="w-full px-2 py-1 rounded-lg border border-blue-300 bg-white dark:bg-slate-900 text-[11px] font-bold text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
                        >
                          <option value="opcao_1">Estrutura Base: 1ª Opção</option>
                          <option value="opcao_2">Estrutura Base: 2ª Opção</option>
                          <option value="opcao_3">Estrutura Base: 3ª Opção</option>
                        </select>
                      </div>

                      <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900">
                        <span className="text-[10px] uppercase font-bold text-purple-700 dark:text-purple-300 block mb-1">
                          2. Raio de Atuação (CEP Base: {sup.address?.cep || 'N/D'}):
                        </span>
                        <div className="flex items-center gap-1.5">
                          <select
                            value={[0, 5, 10, 15, 25, 30, 50, 100, 200, 500, 1000].includes(sup.serviceRadiusKm ?? 50) ? (sup.serviceRadiusKm ?? 50) : -1}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              if (val >= 0) handleUpdateSupplierRadius(sup.id, val);
                            }}
                            className="flex-1 px-2 py-1.5 rounded-lg border-2 border-purple-400 bg-white dark:bg-slate-900 text-xs font-black text-purple-700 dark:text-purple-300 outline-none focus:ring-2 focus:ring-purple-600 cursor-pointer"
                          >
                            <option value={5}>5 km</option>
                            <option value={10}>10 km</option>
                            <option value={15}>15 km</option>
                            <option value={25}>25 km</option>
                            <option value={30}>30 km</option>
                            <option value={50}>50 km</option>
                            <option value={100}>100 km</option>
                            <option value={200}>200 km</option>
                            <option value={500}>500 km</option>
                            <option value={1000}>1000 km</option>
                            <option value={0}>SEM LIMITE</option>
                            {![0, 5, 10, 15, 25, 30, 50, 100, 200, 500, 1000].includes(sup.serviceRadiusKm ?? 50) && (
                              <option value={-1}>{sup.serviceRadiusKm} km (Personalizado)</option>
                            )}
                          </select>
                          <input
                            type="number"
                            min={0}
                            max={5000}
                            value={sup.serviceRadiusKm !== undefined ? sup.serviceRadiusKm : 50}
                            onChange={(e) => {
                              const n = Math.max(0, Number(e.target.value) || 0);
                              handleUpdateSupplierRadius(sup.id, n);
                            }}
                            title="Digite um raio exato em km (0 = Sem Limite)"
                            className="w-16 px-2 py-1.5 rounded-lg border border-purple-300 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-center text-purple-800 dark:text-purple-200 outline-none"
                          />
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 space-y-1.5">
                        <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-300 block">
                          3. Modalidade & Taxa (%):
                        </span>
                        <div className="flex items-center gap-1.5">
                          <select
                            value={pendingPaymentMap[sup.id] || sup.supplierPaymentType || 'compe_split'}
                            onChange={(e) => setPendingPaymentMap(prev => ({ ...prev, [sup.id]: e.target.value as SupplierPaymentType }))}
                            className="flex-1 px-2 py-1 rounded-lg border border-emerald-300 bg-white dark:bg-slate-900 text-[11px] font-bold text-slate-800 dark:text-slate-200"
                          >
                            <option value="compe_split">Split AUTO SHOP</option>
                            <option value="direto_fornecedor">Direto Fornecedor</option>
                          </select>
                          <input
                            type="number"
                            min={0}
                            max={50}
                            value={pendingCommissionMap[sup.id] ?? sup.commissionRateOverride ?? commissionSettings.generalCommissionPercent}
                            onChange={(e) => setPendingCommissionMap(prev => ({ ...prev, [sup.id]: Number(e.target.value) }))}
                            className="w-14 px-2 py-1 rounded-lg border border-emerald-300 bg-white dark:bg-slate-900 text-[11px] font-mono font-bold text-center text-slate-800 dark:text-slate-200"
                            title="Taxa da plataforma (%)"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Fornecedores Ativos e Liberados ({suppliers.filter(s => s.status === 'ativo').length})
            </h3>
            <p className="text-xs text-slate-500">
              Esses fornecedores possuem autorização ativa para responder chamados e transacionar na plataforma AUTO SHOP. Para gerenciar bloqueios ou detalhes, utilize a aba "Lojas Credenciadas".
            </p>
          </div>
        </div>
      )}

      {/* TAB 2: GESTÃO DE FORNECEDORES */}
      {activeTab === 'fornecedores' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Gestão de Fornecedores e Desmanches Credenciados ({suppliers.length})
            </h2>
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar por nome ou CNPJ..."
                value={supplierSearch}
                onChange={e => setSupplierSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-600"
              />
            </div>
          </div>

          <div className="space-y-3">
            {suppliers
              .filter(s => (s.companyName || s.name).toLowerCase().includes(supplierSearch.toLowerCase()) || s.document.includes(supplierSearch))
              .map(sup => (
                <div
                  key={sup.id}
                  className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        {sup.companyName || sup.name}
                      </h3>
                      <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded ${
                        sup.status === 'ativo'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : sup.status === 'pendente'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                      }`}>
                        {sup.status}
                      </span>
                    </div>

                    <div className="text-xs text-slate-500 space-x-2">
                      <span>CNPJ: <strong className="font-mono">{sup.document}</strong></span>
                      <span>·</span>
                      <span>Contato: {sup.name} ({sup.phone})</span>
                      <span>·</span>
                      <span>Nota: <strong>{sup.rating?.toFixed(1) || '5.0'}★</strong></span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 pt-1">
                      <span>Categorias: <strong>{sup.categoriesSupplied?.join(', ') || 'Todas'}</strong></span>
                      <span>·</span>
                      <span className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-blue-700 dark:text-blue-300">Modalidade SPAM:</span>
                        <select
                          value={sup.supplierModalityId || ''}
                          onChange={(e) => {
                            if (e.target.value) {
                              handleUpdateSupplierModality(sup.id, e.target.value);
                            }
                          }}
                          className="px-2 py-0.5 rounded-lg border-2 border-blue-300 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/60 text-xs font-black text-blue-700 dark:text-blue-300 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                        >
                          <option value="">Selecionar modalidade...</option>
                          {db.getSupplierModalities().map(mod => (
                            <option key={mod.id} value={mod.id}>
                              {mod.escrita} · {mod.porcentagem}%
                            </option>
                          ))}
                        </select>
                        <select
                          value={sup.supplierTier || 'opcao_2'}
                          onChange={(e) => handleUpdateSupplierTier(sup.id, e.target.value as SupplierTier)}
                          className="px-2 py-0.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] font-bold text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
                        >
                          <option value="opcao_1">1ª Opção</option>
                          <option value="opcao_2">2ª Opção</option>
                          <option value="opcao_3">3ª Opção</option>
                        </select>
                      </span>
                      {(sup.supplierClassificationEscrita || sup.supplierClassificationCondicao) && (
                        <span className="text-[11px] px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-semibold">
                          {sup.supplierClassificationEscrita || ''}
                          {sup.supplierClassificationCondicao ? ` · ${sup.supplierClassificationCondicao}` : ''}
                          {sup.supplierClassificationPercent !== undefined ? ` (${sup.supplierClassificationPercent}%)` : ''}
                        </span>
                      )}
                      <span className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-purple-700 dark:text-purple-300">Raio de Atuação:</span>
                        <select
                          value={[0, 5, 10, 15, 25, 30, 50, 100, 200, 500, 1000].includes(sup.serviceRadiusKm ?? 50) ? (sup.serviceRadiusKm ?? 50) : -1}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            if (val >= 0) handleUpdateSupplierRadius(sup.id, val);
                          }}
                          className="px-2 py-0.5 rounded-lg border-2 border-purple-300 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/60 text-xs font-black text-purple-700 dark:text-purple-300 outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
                        >
                          <option value={5}>5 km</option>
                          <option value={10}>10 km</option>
                          <option value={15}>15 km</option>
                          <option value={25}>25 km</option>
                          <option value={30}>30 km</option>
                          <option value={50}>50 km</option>
                          <option value={100}>100 km</option>
                          <option value={200}>200 km</option>
                          <option value={500}>500 km</option>
                          <option value={1000}>1000 km</option>
                          <option value={0}>SEM LIMITE</option>
                          {![0, 5, 10, 15, 25, 30, 50, 100, 200, 500, 1000].includes(sup.serviceRadiusKm ?? 50) && (
                            <option value={-1}>{sup.serviceRadiusKm} km</option>
                          )}
                        </select>
                        <input
                          type="number"
                          min={0}
                          max={5000}
                          value={sup.serviceRadiusKm !== undefined ? sup.serviceRadiusKm : 50}
                          onChange={(e) => handleUpdateSupplierRadius(sup.id, Math.max(0, Number(e.target.value) || 0))}
                          title="Raio exato em km (0 = Sem Limite)"
                          className="w-16 px-2 py-0.5 rounded-lg border border-purple-300 dark:border-purple-800 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-center text-purple-800 dark:text-purple-200 outline-none"
                        />
                        <span className="text-[11px] font-mono text-slate-500">km (CEP: {sup.address?.cep || 'N/D'})</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {sup.status === 'pendente' ? (
                      <button
                        onClick={() => handleAuthorizeSupplier(sup.id)}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition"
                      >
                        Autorizar Loja
                      </button>
                    ) : sup.status === 'ativo' ? (
                      <button
                        onClick={() => handleUpdateSupplierStatus(sup.id, 'bloqueado')}
                        className="px-3 py-1.5 rounded-xl border border-red-300 text-red-600 text-xs font-bold hover:bg-red-50 transition"
                      >
                        Bloquear Acesso
                      </button>
                    ) : (
                      <button
                        onClick={() => handleUpdateSupplierStatus(sup.id, 'ativo')}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition"
                      >
                        Reativar Loja
                      </button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* TAB 3: SOLICITAÇÕES & CLIENTES */}
      {activeTab === 'solicitacoes' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Supervisão de Solicitações no Sistema ({requests.length})
              </h2>
              <p className="text-xs text-slate-500">
                Acompanhe em tempo real todos os chamados criados por clientes, visualize cotações recebidas, amplie o raio de busca ou cancele/exclua registros.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {requests.map(req => {
              const reqQuotes = db.getQuotes(req.id);
              const isExpanded = expandedRequestId === req.id;

              return (
                <div
                  key={req.id}
                  className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm p-4 space-y-3 text-xs"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-black text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950 px-2 py-0.5 rounded">
                          {req.requestNumber}
                        </span>
                        <span className="text-slate-400">·</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {req.customerName} ({req.customerPhone})
                        </span>
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                          req.status === 'finalizado' ? 'bg-emerald-100 text-emerald-800' :
                          req.status === 'sem_fornecedor' ? 'bg-red-100 text-red-800' :
                          req.status === 'cancelado' ? 'bg-slate-200 text-slate-700' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {req.status === 'sem_fornecedor' ? 'NENHUM FORNECEDOR DISPONÍVEL' : req.status}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          Tentativa {req.searchAttempt || 1}/{req.maxSearchAttempts || 4}
                        </span>
                        {req.clientGpsVerified && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            ✓ GPS Cliente
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        {req.partName} — {req.vehicleBrand} {req.vehicleModel} ({req.vehicleYear})
                      </h3>

                      <span className="text-slate-500 block">
                        {(req.categoryName || req.partSubcategory) && (
                          <span className="font-bold text-purple-600 dark:text-purple-400 mr-2">
                            [{req.categoryName || req.vehicleType}{req.partSubcategory ? ` · ${req.partSubcategory}` : ''}]
                          </span>
                        )}
                        Destino: {req.deliveryAddress.neighborhood}, {req.deliveryAddress.city} - {req.deliveryAddress.state} · CEP: {req.deliveryAddress.cep} · Raio Atual: {req.searchRadiusKm} km
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2.5 py-1 rounded text-[10px] font-extrabold uppercase ${
                        reqQuotes.length > 0
                          ? 'bg-emerald-100 text-emerald-800'
                          : req.status === 'sem_fornecedor'
                          ? 'bg-red-600 text-white'
                          : 'bg-red-100 text-red-800 animate-pulse'
                      }`}>
                        {reqQuotes.length === 0 && req.status === 'sem_fornecedor'
                          ? '0 OFERTAS RECEBIDAS'
                          : `${reqQuotes.length} ${reqQuotes.length === 1 ? 'oferta' : 'ofertas'}${reqQuotes.length > 0 ? ` · Menor: R$ ${reqQuotes[0].totalPrice.toFixed(2)}` : ''}`}
                      </span>

                      <button
                        onClick={() => setExpandedRequestId(isExpanded ? null : req.id)}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>{isExpanded ? 'Ocultar Propostas' : 'Ver Propostas'}</span>
                      </button>

                      <button
                        onClick={() => handleExpandSearch(req.id)}
                        className="px-2.5 py-1.5 rounded-lg border border-purple-300 text-purple-700 dark:text-purple-300 dark:border-purple-800 hover:bg-purple-50 font-bold transition cursor-pointer"
                        title="Expandir raio de busca e notificar fornecedores distantes"
                      >
                        +50km
                      </button>

                      {req.status !== 'cancelado' && (
                        <button
                          onClick={() => handleCancelRequest(req.id)}
                          className="px-2.5 py-1.5 rounded-lg border border-amber-300 text-amber-700 dark:text-amber-300 dark:border-amber-800 hover:bg-amber-50 font-bold transition flex items-center gap-1 cursor-pointer"
                          title="Cancelar chamado"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          <span>Cancelar</span>
                        </button>
                      )}

                      <button
                        onClick={() => handleDeleteRequest(req.id)}
                        className="px-2.5 py-1.5 rounded-lg border border-red-300 text-red-600 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/40 font-bold transition flex items-center gap-1 cursor-pointer"
                        title="Excluir chamado permanentemente"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Excluir</span>
                      </button>
                    </div>
                  </div>

                  {(() => {
                    const mainPhotos =
                      req.mediaUrls && req.mediaUrls.length > 0
                        ? req.mediaUrls
                        : req.mediaUrl
                        ? [req.mediaUrl]
                        : [];
                    const extraPartsWithPhotos = (req.extraParts || []).filter(
                      ep => ep.mediaUrls && ep.mediaUrls.length > 0
                    );
                    const totalPhotos =
                      mainPhotos.length +
                      extraPartsWithPhotos.reduce((acc, ep) => acc + (ep.mediaUrls?.length || 0), 0);

                    if (totalPhotos === 0) return null;

                    return (
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">
                          Fotos Enviadas pelo Cliente ({totalPhotos}):
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {mainPhotos.map((photoUrl, idx) => (
                            <div key={`${req.id}-adm-main-${idx}`} className="relative group">
                              <img
                                src={photoUrl}
                                alt={`${req.partName} ${idx + 1}`}
                                className="w-14 h-14 object-cover rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer hover:opacity-80 transition"
                                onClick={() => setSelectedMediaPreview(photoUrl)}
                              />
                              <span className="absolute bottom-0.5 right-0.5 bg-black/75 text-white text-[9px] font-bold px-1 rounded">
                                P1 #{idx + 1}
                              </span>
                            </div>
                          ))}
                          {extraPartsWithPhotos.map((ep, epIdx) =>
                            (ep.mediaUrls || []).map((photoUrl, pIdx) => (
                              <div key={`${req.id}-adm-extra-${epIdx}-${pIdx}`} className="relative group">
                                <img
                                  src={photoUrl}
                                  alt={`${ep.partName || 'Peça extra'} ${pIdx + 1}`}
                                  className="w-14 h-14 object-cover rounded-lg border border-purple-300 dark:border-purple-700 cursor-pointer hover:opacity-80 transition"
                                  onClick={() => setSelectedMediaPreview(photoUrl)}
                                />
                                <span className="absolute bottom-0.5 right-0.5 bg-purple-700 text-white text-[9px] font-bold px-1 rounded">
                                  P{epIdx + 2} #{pIdx + 1}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {isExpanded && (
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                      <h4 className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                        Propostas Recebidas ({reqQuotes.length} — ordenadas do menor preço para o maior):
                      </h4>
                      {reqQuotes.length === 0 ? (
                        <p className="text-slate-500 italic text-xs">Nenhum fornecedor enviou proposta para este chamado ainda.</p>
                      ) : (
                        <div className="space-y-2">
                          {reqQuotes.map((q, idx) => {
                            const sup = suppliers.find(s => s.id === q.supplierId);
                            const orderForReq = orders.find(o => o.requestId === req.id);
                            const isAccepted = q.status === 'aceito' || (orderForReq && orderForReq.quoteId === q.id);
                            const isRejected = !isAccepted && (q.status === 'rejeitado' || Boolean(orderForReq));
                            return (
                              <div
                                key={q.id}
                                className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                                  idx === 0
                                    ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800'
                                    : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700'
                                }`}
                              >
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                                      idx === 0
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                                    }`}>
                                      {idx === 0 ? '1º Menor Preço' : `${idx + 1}º lugar`}
                                    </span>
                                    <span className="font-bold text-slate-900 dark:text-white">
                                      {sup?.companyName || sup?.name || 'Loja Credenciada'}
                                    </span>
                                    {sup?.phone && (
                                      <span className="text-[10px] text-slate-500">({sup.phone})</span>
                                    )}
                                  </div>
                                  <span className="text-[11px] text-slate-500 block">
                                    Marca: <strong>{q.brand}</strong> · Condição: <strong className="uppercase">{q.condition}</strong> · Entrega: {q.deliveryDays} dia(s) · Garantia: {q.warrantyDays} dias
                                  </span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className="text-right">
                                    <span className="font-mono font-black text-sm text-emerald-600 dark:text-emerald-400 block">
                                      R$ {q.totalPrice.toFixed(2)}
                                    </span>
                                    <span className="text-[10px] text-slate-400">
                                      Peça: R$ {q.partPrice.toFixed(2)} + Frete: R$ {q.shippingPrice.toFixed(2)}
                                    </span>
                                  </div>
                                  <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${
                                    isAccepted
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : isRejected
                                      ? 'bg-slate-200 text-slate-700'
                                      : 'bg-amber-100 text-amber-800'
                                  }`}>
                                    {isAccepted ? 'ACEITA · PAGO' : isRejected ? 'ENCERRADA' : 'AGUARDANDO CLIENTE'}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                  {req.statusHistory && req.statusHistory.length > 0 && (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                      <span className="text-[10px] font-black uppercase text-slate-400 block">
                        Linha do Tempo em Tempo Real ({req.statusHistory.length} etapas):
                      </span>
                      <div className="flex flex-col gap-1 max-h-36 overflow-y-auto">
                        {[...req.statusHistory].reverse().map(ev => (
                          <div
                            key={ev.id}
                            className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/70 text-[11px]"
                          >
                            <div>
                              <strong className="text-slate-900 dark:text-white mr-1.5">{ev.stage}:</strong>
                              <span className="text-slate-600 dark:text-slate-300">{ev.details}</span>
                            </div>
                            <span className="text-[10px] font-mono text-slate-400 shrink-0">
                              {new Date(ev.timestamp).toLocaleTimeString('pt-BR')} ({ev.actorRole})
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* NOVA TAB: PEDIDOS & ENTREGAS COM PIN */}
      {activeTab === 'pedidos' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Package className="w-5 h-5 text-purple-600" />
                <span>Gestão Central de Pedidos, Entregas & PIN ({orders.length})</span>
              </h2>
              <p className="text-xs text-slate-500">
                Supervisão de pedidos pagos, PINs de validação de entrega, repasses retidos e cancelamento/estorno de pedidos.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {orders.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <Package className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Nenhum pedido registrado no momento.
                </h4>
              </div>
            ) : (
              orders.map(order => {
                const sup = suppliers.find(s => s.id === order.supplierId);
                const clientUser = clients.find(c => c.id === order.customerId);

                return (
                  <div
                    key={order.id}
                    className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 text-xs"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-black text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950 px-2 py-0.5 rounded">
                            {order.orderNumber}
                          </span>
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                            order.deliveryStatus === 'entregue' ? 'bg-emerald-100 text-emerald-800' :
                            order.paymentStatus === 'estornado' ? 'bg-red-100 text-red-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            Entrega: {order.deliveryStatus} · Pagamento: {order.paymentStatus}
                          </span>
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                            order.supplierReceiptConfirmed === false
                              ? 'bg-amber-100 text-amber-800 animate-pulse'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {order.supplierReceiptConfirmed === false
                              ? '⏳ Aguardando Loja Confirmar Conta'
                              : '✓ Loja Confirmou Conta'}
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1">
                          {order.partName}
                        </h3>
                        <span className="text-slate-500">
                          Cliente: {clientUser?.name || 'Cliente'} · Fornecedor: {sup?.companyName || sup?.name || 'Autopeças'}
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 flex items-center gap-3">
                        <Key className="w-5 h-5 text-purple-600 shrink-0" />
                        <div>
                          <span className="text-[10px] uppercase font-bold text-purple-700 dark:text-purple-300 block">
                            PIN de Entrega:
                          </span>
                          <strong className="font-mono text-base font-black text-purple-700 dark:text-purple-200">
                            {order.pinDeliveryCode}
                          </strong>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Valor Total:</span>
                        <strong className="font-mono text-slate-900 dark:text-white">R$ {order.totalAmount.toFixed(2)}</strong>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Comissão Plataforma:</span>
                        <strong className="font-mono text-purple-600">R$ {order.platformCommissionAmount.toFixed(2)}</strong>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Repasse Líquido:</span>
                        <strong className="font-mono text-emerald-600">R$ {order.supplierTransferAmount.toFixed(2)}</strong>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Status do Repasse:</span>
                        <strong className={order.deliveryStatus === 'entregue' ? 'text-emerald-600' : 'text-amber-600'}>
                          {order.deliveryStatus === 'entregue' ? 'Liberado na Conta' : 'Retido (Aguardando PIN)'}
                        </strong>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                      {order.paymentStatus !== 'estornado' && (
                        <button
                          onClick={() => handleCancelOrder(order.id)}
                          className="px-3 py-1.5 rounded-lg border border-amber-300 text-amber-700 dark:text-amber-300 dark:border-amber-800 hover:bg-amber-50 font-bold transition flex items-center gap-1 cursor-pointer"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          <span>Cancelar / Estornar Pedido</span>
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteOrder(order.id)}
                        className="px-3 py-1.5 rounded-lg border border-red-300 text-red-600 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/40 font-bold transition flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Excluir Pedido</span>
                      </button>
                    </div>

                    {order.statusHistory && order.statusHistory.length > 0 && (
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                        <span className="text-[10px] font-black uppercase text-slate-400 block">
                          Rotina do Pedido em Tempo Real ({order.statusHistory.length} etapas):
                        </span>
                        <div className="flex flex-col gap-1 max-h-36 overflow-y-auto">
                          {[...order.statusHistory].reverse().map(ev => (
                            <div
                              key={ev.id}
                              className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/70 text-[11px]"
                            >
                              <div>
                                <strong className="text-slate-900 dark:text-white mr-1.5">{ev.stage}:</strong>
                                <span className="text-slate-600 dark:text-slate-300">{ev.details}</span>
                              </div>
                              <span className="text-[10px] font-mono text-slate-400 shrink-0">
                                {new Date(ev.timestamp).toLocaleTimeString('pt-BR')} ({ev.actorRole})
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 4: RADAR DE GARGALOS E DISPUTAS */}
      {activeTab === 'gargalos' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
              <div className="text-xs text-purple-900 dark:text-purple-200">
                <strong>Radar Automático de Gargalos:</strong> Detecta solicitações que ultrapassaram o tempo limite de 15 minutos sem propostas, pedidos com atraso na separação ou aguardando confirmação do PIN.
              </div>
            </div>
            <button
              type="button"
              onClick={() => exportBottlenecksPdfReport(requestsWithoutQuotes)}
              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs shadow-md flex items-center gap-1.5 transition cursor-pointer shrink-0 self-start sm:self-auto"
            >
              <FileDown className="w-4 h-4" />
              <span>Gerar e Baixar Relatório em PDF</span>
            </button>
          </div>

          <div className="space-y-3">
            {requestsWithoutQuotes.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Nenhum gargalo detectado!
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  Todas as solicitações ativas possuem cotações válidas dentro do prazo limite.
                </p>
              </div>
            ) : (
              requestsWithoutQuotes.map(req => (
                <div
                  key={req.id}
                  className="p-5 rounded-2xl bg-white dark:bg-slate-900 border-2 border-red-500/50 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-extrabold uppercase bg-red-100 text-red-800 px-2 py-0.5 rounded">
                        Gargalo: 0 Orçamentos após 15 minutos
                      </span>
                      <span className="text-[10px] font-mono font-bold text-slate-500">
                        {req.requestNumber} · Raio: {req.searchRadiusKm} km
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1">
                      {req.partName} — {req.vehicleBrand} {req.vehicleModel}
                    </h3>
                    <span className="text-xs text-slate-500 block">
                      Cliente: {req.customerName} · Local: {req.deliveryAddress.neighborhood}, {req.deliveryAddress.city}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingBottleneck(req);
                        setEditReqPartName(req.partName);
                        setEditReqRadius(req.searchRadiusKm);
                        setEditReqStatus(req.status);
                      }}
                      className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-1 cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" /> Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => exportBottlenecksPdfReport([req])}
                      className="px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold text-xs flex items-center gap-1 cursor-pointer"
                    >
                      <FileDown className="w-3.5 h-3.5" /> PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingBottleneck(req)}
                      className="px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/60 text-red-600 font-bold text-xs flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Excluir
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExpandSearch(req.id)}
                      className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md transition cursor-pointer"
                    >
                      Intervir & Expandir Raio
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* NOVA TAB: CATEGORIAS & SUBCATEGORIAS */}
      {activeTab === 'categorias' && (
        <div className="space-y-6">
          <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-purple-100 dark:bg-purple-950/60 flex items-center justify-center text-purple-600 shrink-0">
                <Tag className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white">
                  Gestão de Categorias & Subcategorias
                </h2>
                <p className="text-xs text-slate-500">
                  Cadastre as categorias de veículos/equipamentos e suas respectivas subcategorias de peças. Elas aparecem imediatamente nos chamados dos clientes e no cadastro de fornecedores.
                </p>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newCategoryName.trim()) return;
                db.addCategory(newCategoryName.trim(), newCategoryVehicleType, currentUser.id);
                setNewCategoryName('');
              }}
              className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800"
            >
              <input
                type="text"
                placeholder="Nome da Nova Categoria (ex: Veículos Leves, Náutica...)"
                value={newCategoryName}
                onChange={e => setNewCategoryName(e.target.value)}
                className="sm:col-span-2 px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-600"
                required
              />
              <select
                value={newCategoryVehicleType}
                onChange={e => setNewCategoryVehicleType(e.target.value as VehicleCategory)}
                className="px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-600"
              >
                <option value="carro">Tipo: Veículos / Carros</option>
                <option value="moto">Tipo: Motos</option>
                <option value="caminhao">Tipo: Caminhões & Diesel</option>
                <option value="agricola">Tipo: Máquinas Agrícolas</option>
                <option value="industrial">Tipo: Máquinas Industriais</option>
                <option value="outros">Tipo: Outros Veículos</option>
              </select>
              <button
                type="submit"
                className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-md transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Criar Categoria</span>
              </button>
            </form>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {adminCategories.map(cat => {
              const isEditingThisCat = editingCategory?.id === cat.id;
              return (
                <div
                  key={cat.id}
                  className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4"
                >
                  <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                    {isEditingThisCat ? (
                      <div className="flex-1 flex flex-wrap gap-2">
                        <input
                          type="text"
                          value={editingCategory.name}
                          onChange={e => setEditingCategory({ ...editingCategory, name: e.target.value })}
                          className="flex-1 min-w-[140px] px-2.5 py-1.5 rounded-lg border border-purple-400 bg-white dark:bg-slate-800 text-xs font-bold"
                        />
                        <select
                          value={editingCategory.vehicleType}
                          onChange={e => setEditingCategory({ ...editingCategory, vehicleType: e.target.value as VehicleCategory })}
                          className="px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold"
                        >
                          <option value="carro">Carros</option>
                          <option value="moto">Motos</option>
                          <option value="caminhao">Caminhões</option>
                          <option value="agricola">Agrícola</option>
                          <option value="industrial">Industrial</option>
                          <option value="outros">Outros</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            if (editingCategory.name.trim()) {
                              db.updateCategory(cat.id, { name: editingCategory.name, vehicleType: editingCategory.vehicleType }, currentUser.id);
                            }
                            setEditingCategory(null);
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold cursor-pointer"
                        >
                          Salvar
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingCategory(null)}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-bold cursor-pointer"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <div>
                        <h3 className="text-base font-black text-slate-900 dark:text-white">{cat.name}</h3>
                        <span className="text-[10px] font-bold uppercase text-purple-600 dark:text-purple-400">
                          Vínculo: {cat.vehicleType || 'carro'} · {cat.subcategories.length} subcategorias
                        </span>
                      </div>
                    )}

                    {!isEditingThisCat && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setEditingCategory({ id: cat.id, name: cat.name, vehicleType: cat.vehicleType || 'carro' })}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/40 cursor-pointer"
                          title="Editar Categoria"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Deseja excluir a categoria "${cat.name}" e todas as suas subcategorias?`)) {
                              db.deleteCategory(cat.id, currentUser.id);
                            }
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                          title="Excluir Categoria"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Subcategories list */}
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                      Subcategorias (Peças / Sistemas):
                    </span>
                    {cat.subcategories.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">Nenhuma subcategoria cadastrada ainda.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {cat.subcategories.map(sub => {
                          const isEditingSub = editingSubcategory?.catId === cat.id && editingSubcategory?.subId === sub.id;
                          return isEditingSub ? (
                            <div key={sub.id} className="flex items-center gap-1 bg-purple-50 dark:bg-purple-950/40 p-1 rounded-lg border border-purple-300">
                              <input
                                type="text"
                                value={editingSubcategory.name}
                                onChange={e => setEditingSubcategory({ ...editingSubcategory, name: e.target.value })}
                                className="px-2 py-0.5 text-xs rounded border border-purple-300 bg-white dark:bg-slate-800 w-32"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  if (editingSubcategory.name.trim()) {
                                    db.updateSubcategory(cat.id, sub.id, editingSubcategory.name, currentUser.id);
                                  }
                                  setEditingSubcategory(null);
                                }}
                                className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-bold cursor-pointer"
                              >
                                OK
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingSubcategory(null)}
                                className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px] font-bold cursor-pointer"
                              >
                                X
                              </button>
                            </div>
                          ) : (
                            <div
                              key={sub.id}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200"
                            >
                              <span>{sub.name}</span>
                              <button
                                type="button"
                                onClick={() => setEditingSubcategory({ catId: cat.id, subId: sub.id, name: sub.name })}
                                className="text-slate-400 hover:text-purple-600 cursor-pointer"
                                title="Renomear Subcategoria"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => db.deleteSubcategory(cat.id, sub.id, currentUser.id)}
                                className="text-slate-400 hover:text-red-600 cursor-pointer"
                                title="Excluir Subcategoria"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Add subcategory form */}
                  <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <input
                      type="text"
                      placeholder="Nova subcategoria (ex: Freios, Motor, Farol...)"
                      value={newSubcategoryByCat[cat.id] || ''}
                      onChange={e => setNewSubcategoryByCat({ ...newSubcategoryByCat, [cat.id]: e.target.value })}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const val = (newSubcategoryByCat[cat.id] || '').trim();
                          if (val) {
                            db.addSubcategory(cat.id, val, currentUser.id);
                            setNewSubcategoryByCat({ ...newSubcategoryByCat, [cat.id]: '' });
                          }
                        }
                      }}
                      className="flex-1 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs outline-none focus:ring-2 focus:ring-purple-600"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const val = (newSubcategoryByCat[cat.id] || '').trim();
                        if (!val) return;
                        db.addSubcategory(cat.id, val, currentUser.id);
                        setNewSubcategoryByCat({ ...newSubcategoryByCat, [cat.id]: '' });
                      }}
                      className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Adicionar</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 5: TEMPOS & EDITOR DE SPAMS */}
      {activeTab === 'spams' && (
        <div className="space-y-6">
          <form
            onSubmit={handleSaveTimerSettings}
            className="p-6 rounded-2xl bg-white dark:bg-slate-900 border-2 border-purple-500/40 shadow-lg space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-purple-600" />
                  <span>Configuração dos Tempos de Chamados & SPAM em Tela</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Edite aqui os minutos exatos que cada perfil tem para responder aos chamados antes que o pedido expire ou encerre na tela.
                </p>
              </div>

              {timerSavedSuccess && (
                <div className="px-3.5 py-1.5 rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold text-xs flex items-center gap-1.5 animate-bounce">
                  <Check className="w-4 h-4" />
                  <span>Tempos salvos com sucesso!</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  Tempo Limite para o Fornecedor Responder (Minutos):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={180}
                    value={supplierMinutes}
                    onChange={e => setSupplierMinutes(Number(e.target.value))}
                    className="w-28 px-3 py-2 text-base font-mono font-black rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-600"
                    required
                  />
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">minutos (padrão: 15 min)</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Tempo ativo no card de cada chamado para o fornecedor analisar, anexar preço e enviar proposta. Ao zerar sem resposta, o chamado expira e some da tela.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  Tempo Limite para o Cliente Responder (Minutos):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={240}
                    value={clientMinutes}
                    onChange={e => setClientMinutes(Number(e.target.value))}
                    className="w-28 px-3 py-2 text-base font-mono font-black rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-600"
                    required
                  />
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">minutos (padrão: 60 min)</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Tempo exibido no cronômetro regressivo dos cards de orçamentos para o cliente decidir e aprovar a compra.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md transition cursor-pointer"
              >
                Salvar Novos Tempos dos Cronômetros
              </button>

              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={selectedTestSpamId}
                  onChange={e => setSelectedTestSpamId(e.target.value)}
                  className="px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  {spams.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.title} ({s.targetAudience.toUpperCase()})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    const tpl = spams.find(s => s.id === selectedTestSpamId) || spams[0];
                    if (tpl) openSpamPreview(tpl);
                  }}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs shadow-md flex items-center gap-1.5 cursor-pointer transition"
                >
                  <Eye className="w-4 h-4" />
                  <span>Visualizar SPAM</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const tpl = spams.find(s => s.id === selectedTestSpamId) || spams[0];
                    if (tpl) {
                      setIsCreatingSpam(false);
                      setEditingSpam(tpl);
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white font-black text-xs shadow-md flex items-center gap-1.5 cursor-pointer transition"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Editar SPAM</span>
                </button>
              </div>
            </div>
          </form>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Templates Visuais de SPAM Sobreposto aos Perfis
              </h3>
              <p className="text-xs text-slate-500">
                Adicione, edite ou remova campos, escritos, letras, cores, botões, imagens, meios de pagamento e envie recados direcionados.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingSpam(null);
                setIsCreatingSpam(true);
              }}
              className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xs shadow-md flex items-center gap-1.5 transition cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Criar Novo Template</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {spams.map(spam => (
              <div
                key={spam.id}
                className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-100 dark:border-slate-800">
                    <span className="font-extrabold uppercase tracking-wider text-purple-600">
                      Para {spam.targetAudience.toUpperCase()}
                    </span>
                    <span className="font-mono text-[10px] text-slate-400">
                      Contagem: {spam.countdownSeconds > 0 ? `${spam.countdownSeconds}s` : 'Sem timer'}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 dark:text-white mt-2">
                    {spam.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                    {spam.subtitle}
                  </p>

                  <div className="flex items-center gap-2 mt-3 text-xs flex-wrap">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      spam.colorScheme === 'red' ? 'bg-red-100 text-red-800' :
                      spam.colorScheme === 'green' ? 'bg-emerald-100 text-emerald-800' :
                      spam.colorScheme === 'orange' ? 'bg-orange-100 text-orange-800' :
                      spam.colorScheme === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
                      spam.colorScheme === 'blue' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                    }`}>
                      Cor: {spam.colorScheme}
                    </span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-500">
                      Som: {spam.soundType}
                    </span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-500">
                      {spam.isMandatoryAction ? 'Travado (Obrigatório)' : 'Opcional'}
                    </span>
                    {(spam.customFields?.length || 0) > 0 && (
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-bold">
                        {spam.customFields?.length} campo(s)
                      </span>
                    )}
                    {(spam.images?.length || 0) > 0 && (
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-bold">
                        {spam.images?.length} img(ns)
                      </span>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 truncate max-w-[160px]">
                    Botão: "{spam.actionButtonLabel}"
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {spam.id.startsWith('spam_custom_') && (
                      <button
                        type="button"
                        onClick={() => db.deleteSpamConfig(spam.id, currentUser.id)}
                        className="p-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition cursor-pointer"
                        title="Excluir Template Customizado"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => openSpamPreview(spam)}
                      className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs shadow-sm flex items-center gap-1 transition cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Visualizar SPAM</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreatingSpam(false);
                        setEditingSpam(spam);
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-sm transition cursor-pointer"
                    >
                      Editar SPAM
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* CADASTRO DE CLASSIFICAÇÃO / MODALIDADE DE SPAM DO FORNECEDOR */}
          <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border-2 border-indigo-200 dark:border-indigo-900/70 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <Tag className="w-4 h-4 text-indigo-600" />
                  <span>Classificação / Modalidade de SPAM do Fornecedor</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Cadastre a escrita, a condição e a porcentagem (%). Tudo o que for configurado aqui aparece exatamente igual no perfil do fornecedor.
                </p>
              </div>
              {modFeedback && (
                <span className="px-3 py-1 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
                  {modFeedback}
                </span>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!modEscrita.trim() || !modCondicao.trim()) {
                  setModFeedback('Preencha a escrita e a condição da modalidade.');
                  return;
                }
                db.saveSupplierModality(
                  {
                    id: editingModalityId || undefined,
                    escrita: modEscrita.trim(),
                    condicao: modCondicao.trim(),
                    porcentagem: Number(modPorcentagem),
                    baseTier: modBaseTier,
                  },
                  currentUser.id
                );
                setEditingModalityId(null);
                setModEscrita('');
                setModCondicao('');
                setModPorcentagem(10);
                setModBaseTier('opcao_2');
                setModFeedback('Classificação / Modalidade salva com sucesso!');
                setTimeout(() => setModFeedback(null), 3500);
              }}
              className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900 space-y-3"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                    Escrita / Título da Classificação (exibido no perfil do fornecedor) *
                  </label>
                  <input
                    type="text"
                    value={modEscrita}
                    onChange={e => setModEscrita(e.target.value)}
                    placeholder="Ex: Parceiro Ouro · Atendimento Prioritário SP"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-600"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                      Porcentagem (%) *
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="0.1"
                      value={modPorcentagem}
                      onChange={e => setModPorcentagem(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-black outline-none focus:ring-2 focus:ring-indigo-600"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                      Estrutura SPAM
                    </label>
                    <select
                      value={modBaseTier}
                      onChange={e => setModBaseTier(e.target.value as SupplierTier)}
                      className="w-full px-2.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-none"
                    >
                      <option value="opcao_1">1ª Opção</option>
                      <option value="opcao_2">2ª Opção</option>
                      <option value="opcao_3">3ª Opção</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                  Condição Completa (regras, prazo ou benefícios exibidos ao fornecedor) *
                </label>
                <textarea
                  rows={2}
                  value={modCondicao}
                  onChange={e => setModCondicao(e.target.value)}
                  placeholder="Ex: Repasse via Split automático em até 24h · Resposta rápida em 15 min · Raio regional configurado"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-600"
                  required
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-sm flex items-center gap-1.5 cursor-pointer transition"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{editingModalityId ? 'Atualizar Classificação' : 'Cadastrar Classificação / Modalidade'}</span>
                </button>
                {editingModalityId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingModalityId(null);
                      setModEscrita('');
                      setModCondicao('');
                      setModPorcentagem(10);
                      setModBaseTier('opcao_2');
                    }}
                    className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
                  >
                    Cancelar Edição
                  </button>
                )}
              </div>
            </form>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {db.getSupplierModalities().map((mod: SupplierSpamModality) => (
                <div
                  key={mod.id}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col justify-between gap-3"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300">
                        {mod.baseTier === 'opcao_1' ? '1ª Opção' : mod.baseTier === 'opcao_2' ? '2ª Opção' : '3ª Opção'}
                      </span>
                      <span className="text-xs font-mono font-black px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300">
                        {mod.porcentagem}%
                      </span>
                    </div>
                    <h4 className="text-sm font-black text-slate-900 dark:text-white leading-snug">
                      {mod.escrita}
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-line">
                      {mod.condicao}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingModalityId(mod.id);
                        setModEscrita(mod.escrita);
                        setModCondicao(mod.condicao);
                        setModPorcentagem(mod.porcentagem);
                        setModBaseTier(mod.baseTier);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>Editar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        db.deleteSupplierModality(mod.id, currentUser.id);
                        if (editingModalityId === mod.id) {
                          setEditingModalityId(null);
                          setModEscrita('');
                          setModCondicao('');
                        }
                      }}
                      className="p-1.5 rounded-lg border border-red-200 dark:border-red-900 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                      title="Excluir Modalidade"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: COMISSÕES & DISTRIBUIÇÃO */}
      {activeTab === 'comissoes' && (
        <form onSubmit={handleSaveCommissions} className="max-w-xl p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            Parâmetros Gerais de Comissões e Algoritmo de Distribuição
          </h2>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Comissão Padrão da Plataforma AUTO SHOP (%)
            </label>
            <input
              type="number"
              min={1}
              max={30}
              value={generalCommission}
              onChange={e => setGeneralCommission(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm font-bold font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-600"
              required
            />
            <span className="text-[11px] text-slate-500 mt-1 block">
              Dedução automática no split de pagamento do gateway.
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Modo de Distribuição de Solicitações (§6)
            </label>
            <select
              value={distMode}
              onChange={e => setDistMode(e.target.value as any)}
              className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-600"
            >
              <option value="automatic">Automático (por categoria + região + disponibilidade)</option>
              <option value="priority">Por Prioridade (Nível 1 a 5 das lojas)</option>
              <option value="manual">Manual (Admin direciona cada cotação)</option>
            </select>
          </div>

          <button
            type="submit"
            className="py-3 px-5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md transition"
          >
            Salvar Regras de Comissão e Distribuição
          </button>
        </form>
      )}

      {/* TAB 7: AUDITORIA LGPD */}
      {activeTab === 'auditoria' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Registro Imutável de Auditoria e Conformidade LGPD ({auditLogs.length} eventos)
            </h2>
            <button
              type="button"
              onClick={() => exportAuditLogsPdfReport(auditLogs)}
              className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-purple-600 hover:bg-slate-800 dark:hover:bg-purple-700 text-white font-black text-xs shadow-md flex items-center gap-1.5 transition cursor-pointer self-start sm:self-auto"
            >
              <FileDown className="w-4 h-4" />
              <span>Gerar e Baixar Relatório em PDF</span>
            </button>
          </div>

          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="p-3">Data / Hora</th>
                    <th className="p-3">Usuário</th>
                    <th className="p-3">Perfil</th>
                    <th className="p-3">Ação Registrada</th>
                    <th className="p-3">Detalhes Imutáveis</th>
                    <th className="p-3">IP</th>
                    <th className="p-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {auditLogs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                      <td className="p-3 font-mono text-[11px] whitespace-nowrap text-slate-500">
                        {new Date(log.timestamp).toLocaleString('pt-BR')}
                      </td>
                      <td className="p-3 font-semibold whitespace-nowrap text-slate-800 dark:text-slate-200">
                        {log.userPhone}
                      </td>
                      <td className="p-3">
                        <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                          {log.userRole}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        {log.action}
                      </td>
                      <td className="p-3 text-slate-600 dark:text-slate-300 max-w-xs truncate" title={log.details}>
                        {log.details}
                      </td>
                      <td className="p-3 font-mono text-[10px] text-slate-400 whitespace-nowrap">
                        {log.ipAddress}
                      </td>
                      <td className="p-3 whitespace-nowrap text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingAuditLog(log);
                              setEditAuditAction(log.action);
                              setEditAuditDetails(log.details);
                            }}
                            className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-[11px] cursor-pointer"
                            title="Editar"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => exportAuditLogsPdfReport([log])}
                            className="px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold text-[11px] cursor-pointer"
                            title="Baixar PDF deste evento"
                          >
                            PDF
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingAuditLog(log)}
                            className="px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-950/60 text-red-600 font-bold text-[11px] cursor-pointer"
                            title="Excluir"
                          >
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 8: EDITAR FONTES, CORES E ESCRITAS DO APP */}
      {activeTab === 'editar' && (
        <AppEditorTab adminId={currentUser.id} />
      )}

      {/* TAB 9: CATÁLOGOS PDF DE FABRICANTES (INTEGRADO AO DB PARA CLIENTES/FORNECEDORES) */}
      {activeTab === 'catalogos' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-purple-600" />
                <span>Gerenciamento de Catálogos e Manuais em PDF</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Anexe manuais de peças e catálogos de fabricantes organizados por categoria. <strong className="text-purple-600">Estes arquivos ficarão disponíveis para download imediato no App de Clientes e Fornecedores.</strong>
              </p>
            </div>
          </div>

          {/* Formulário de Cadastro de Catálogo */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FilePlus className="w-4 h-4 text-purple-600" />
              Cadastrar / Anexar Novo Catálogo de Fabricante em PDF
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Nome do Catálogo / Fabricante *
                </label>
                <input
                  type="text"
                  placeholder="Ex: Manual de Peças Bosch"
                  value={catalogName}
                  onChange={(e) => setCatalogName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-600"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Categoria de Veículo *
                </label>
                <select
                  value={catalogCategory}
                  onChange={(e) => setCatalogCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-600"
                >
                  <option value="">Selecione a categoria...</option>
                  {adminCategories.map(cat => (
                    <option key={cat.id} value={cat.name}>{cat.name}</option>
                  ))}
                  <option value="Todas as Categorias">Todas as Categorias</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Arquivo PDF *
                </label>
                <div className="relative">
                  <input
                    ref={catalogFileInputRef}
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => setCatalogFile(e.target.files ? e.target.files[0] : null)}
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-600 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-purple-100 file:text-purple-700 hover:file:bg-purple-200 dark:file:bg-purple-900 dark:file:text-purple-300 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={handleSaveCatalog}
                className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md transition flex items-center gap-2 cursor-pointer"
              >
                <FilePlus className="w-4 h-4" />
                <span>Anexar e Salvar Catálogo no Sistema</span>
              </button>
            </div>
          </div>

          {/* Lista de Catálogos Existentes */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-600" />
                Catálogos Oficiais de Fabricantes (PDF) ({catalogs.length})
              </h3>
              <button
                type="button"
                onClick={() => exportCatalogsPdfReport(catalogs)}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs shadow-md flex items-center gap-1.5 transition cursor-pointer self-start sm:self-auto"
              >
                <FileDown className="w-4 h-4" />
                <span>Gerar e Baixar Relatório em PDF</span>
              </button>
            </div>

            {catalogs.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 border-dashed">
                <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Nenhum catálogo cadastrado ainda.
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  Utilize o formulário acima para adicionar o primeiro manual de peças em PDF e facilitar a vida das autopeças.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {catalogs.map((cat) => (
                  <div
                    key={cat.id}
                    className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 hover:border-purple-300 dark:hover:border-purple-700 transition flex flex-col justify-between"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-950/40 flex items-center justify-center text-red-600 shrink-0">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1">
                              {cat.name || cat.title}
                            </h4>
                            <span className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 px-1.5 py-0.5 rounded">
                              {cat.category}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
                        <span className="font-mono">{cat.fileSize}</span>
                        <span>{cat.uploadDate || new Date(cat.uploadedAt).toLocaleDateString('pt-BR')}</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCatalogItem(cat);
                            setEditCatName(cat.title || cat.name || '');
                            setEditCatManufacturer(cat.manufacturer || '');
                            setEditCatCategory(cat.category || '');
                            setEditCatModels(cat.compatibleModels || '');
                            setEditCatFile(null);
                          }}
                          className="flex-1 py-1.5 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-[11px] flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Edit2 className="w-3 h-3" /> Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => exportCatalogsPdfReport([cat])}
                          className="flex-1 py-1.5 px-2 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold text-[11px] flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <FileDown className="w-3 h-3" /> PDF
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingCatalogItem(cat)}
                          className="flex-1 py-1.5 px-2 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-950/60 text-red-600 font-bold text-[11px] flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" /> Excluir
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={async () => {
                          const ok = await downloadCatalogPdf(cat);
                          if (ok) {
                            db.incrementCatalogDownload(cat.id);
                          }
                        }}
                        className="w-full py-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/40 text-purple-700 dark:text-purple-300 font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer border border-purple-200 dark:border-purple-800"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Baixar / Visualizar PDF Original</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 10: ARQUIVO CENTRAL DE FOTOS E MÍDIAS */}
      {activeTab === 'fotos' && (
        <MediaArchiveTab adminId={currentUser.id} />
      )}

      {/* TAB 11: COMUNICAÇÃO & INTERCESSÃO */}
      {activeTab === 'mensagens' && (
        <ChatSupervisionTab adminUser={currentUser} />
      )}

      {/* TAB 12: GESTÃO CENTRAL DE USUÁRIOS */}
      {activeTab === 'usuarios' && (
        <UserManagementTab adminUser={currentUser} />
      )}

      {/* TAB: SPLIT DE PAGAMENTO & SUBCONTAS */}
      {activeTab === 'split' && (
        <SplitManagementTab currentUser={currentUser} />
      )}

      {/* TAB: RELATÓRIO FINANCEIRO COMPLETO */}
      {activeTab === 'relatorio_financeiro' && <FinancialReportTab />}

      {/* TAB: ANÚNCIOS PARA CLIENTES (3s ABERTURA + RODAPÉ PROGRAMÁVEL) */}
      {activeTab === 'anuncios_clientes' && (
        <ClientAdsAdminTab currentUser={currentUser} />
      )}

      {/* TAB 13: ARQUIVO MORTO (> 30 DIAS) */}
      {activeTab === 'arquivo_morto' && (
        <div className="space-y-6">
          <div className="p-4 sm:p-5 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <Archive className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <strong className="block font-black text-sm text-purple-950 dark:text-purple-100">
                  Arquivo Morto Permanente AUTO SHOP (&gt; 30 Dias)
                </strong>
                <p>
                  Todas as solicitações, orçamentos e pedidos permanecem ativos nas telas de clientes e fornecedores por 30 dias. Após esse período, os registros são transferidos automaticamente para este Arquivo Morto.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => exportArchivedRecordsPdfReport(db.getOrders(true), db.getRequests(true))}
              className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xs shadow-md flex items-center gap-1.5 transition cursor-pointer shrink-0 self-start sm:self-auto"
            >
              <FileDown className="w-4 h-4" />
              <span>Gerar e Baixar Relatório em PDF</span>
            </button>
          </div>

          {(() => {
            const archived = db.getArchivedRecords();
            const allReqs = db.getRequests(true);
            const allOrds = db.getOrders(true);
            return (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total de Chamados Salvos</span>
                    <strong className="text-2xl font-black text-slate-900 dark:text-white font-mono">{allReqs.length}</strong>
                    <span className="text-[11px] text-slate-500 block mt-0.5">{archived.requests.length} transferidos para arquivo morto (&gt; 30d)</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total de Pedidos & NF-e</span>
                    <strong className="text-2xl font-black text-emerald-600 font-mono">{allOrds.length}</strong>
                    <span className="text-[11px] text-slate-500 block mt-0.5">{archived.orders.length} pedidos arquivados permanentemente</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Auditoria & Logs Gravados</span>
                    <strong className="text-2xl font-black text-purple-600 font-mono">{auditLogs.length}</strong>
                    <span className="text-[11px] text-slate-500 block mt-0.5">100% dos cliques de SPAM e aceite de termos</span>
                  </div>
                </div>

                <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                      <FileCheck className="w-4 h-4 text-emerald-600" />
                      <span>Registros e Transações Preservadas Permanentemente</span>
                    </h3>
                    <span className="text-xs font-mono text-slate-400">Total: {allOrds.length} transações</span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                      <thead className="bg-slate-100 dark:bg-slate-800 text-[10px] uppercase font-black tracking-wider text-slate-500">
                        <tr>
                          <th className="py-2.5 px-3">Pedido / Chamado</th>
                          <th className="py-2.5 px-3">Peça / Veículo</th>
                          <th className="py-2.5 px-3">Valor Total</th>
                          <th className="py-2.5 px-3">Repasse / Split</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3">PIN / Chave NF-e</th>
                          <th className="py-2.5 px-3">Data Original</th>
                          <th className="py-2.5 px-3">Classificação</th>
                          <th className="py-2.5 px-3 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                        {allOrds.map(ord => {
                          const isArchived = new Date(ord.createdAt).getTime() < (Date.now() - 30 * 24 * 3600 * 1000);
                          return (
                            <tr key={ord.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                              <td className="py-3 px-3 font-mono font-black text-blue-600 dark:text-blue-400">
                                {ord.orderNumber}
                              </td>
                              <td className="py-3 px-3">
                                <strong className="text-slate-900 dark:text-white block">{ord.partName}</strong>
                                <span className="text-[11px] text-slate-500">{ord.vehicleSummary}</span>
                              </td>
                              <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-white">
                                R$ {ord.totalAmount.toFixed(2)}
                              </td>
                              <td className="py-3 px-3 font-mono text-emerald-600">
                                R$ {ord.supplierTransferAmount.toFixed(2)}
                              </td>
                              <td className="py-3 px-3">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                  ord.deliveryStatus === 'entregue'
                                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                                    : 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                                }`}>
                                  {ord.deliveryStatus}
                                </span>
                              </td>
                              <td className="py-3 px-3 font-mono text-[11px]">
                                PIN: {ord.pinDeliveryCode}
                              </td>
                              <td className="py-3 px-3 text-slate-500">
                                {new Date(ord.createdAt).toLocaleDateString('pt-BR')}
                              </td>
                              <td className="py-3 px-3">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                                  isArchived
                                    ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300'
                                    : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                                }`}>
                                  {isArchived ? 'Arquivo Morto (>30d)' : 'Janela Ativa (<=30d)'}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-right whitespace-nowrap">
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingArchiveOrder(ord);
                                      setEditOrderPartName(ord.partName);
                                      setEditOrderVehicle(ord.vehicleSummary);
                                      setEditOrderTotal(ord.totalAmount);
                                      setEditOrderTransfer(ord.supplierTransferAmount);
                                      setEditOrderStatus(ord.deliveryStatus);
                                    }}
                                    className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-[11px] cursor-pointer"
                                  >
                                    Editar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => exportArchivedRecordsPdfReport([ord], [])}
                                    className="px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold text-[11px] cursor-pointer"
                                  >
                                    PDF
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeletingArchiveOrder(ord)}
                                    className="px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-950/60 text-red-600 font-bold text-[11px] cursor-pointer"
                                  >
                                    Excluir
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* High-res Media Lightbox Modal */}
      {selectedMediaPreview && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative max-w-3xl w-full bg-slate-900 rounded-3xl p-4 border border-slate-700 shadow-2xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-sm font-bold text-white flex items-center gap-2">
                <Camera className="w-4 h-4 text-purple-400" />
                <span>Foto Original do Pedido / Peça</span>
              </span>
              <button
                onClick={() => setSelectedMediaPreview(null)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-center justify-center max-h-[75vh] overflow-hidden rounded-2xl bg-black">
              <img
                src={selectedMediaPreview}
                alt="Foto original"
                className="max-h-[70vh] w-auto object-contain rounded-xl"
              />
            </div>
            <div className="text-right">
              <button
                onClick={() => setSelectedMediaPreview(null)}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition cursor-pointer"
              >
                Fechar Visualização
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modais Editar / Excluir das 5 Seções */}
      {editingBottleneck && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm">
          <form
            onSubmit={e => {
              e.preventDefault();
              db.updateRequest(
                editingBottleneck.id,
                {
                  partName: editReqPartName.trim() || editingBottleneck.partName,
                  searchRadiusKm: Number(editReqRadius) || editingBottleneck.searchRadiusKm,
                  status: editReqStatus,
                },
                currentUser.id
              );
              setEditingBottleneck(null);
            }}
            className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Editar Chamado ({editingBottleneck.requestNumber})
              </h3>
              <button type="button" onClick={() => setEditingBottleneck(null)} className="cursor-pointer">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">Peça Solicitada</label>
              <input
                type="text"
                value={editReqPartName}
                onChange={e => setEditReqPartName(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1">Raio de Busca (km)</label>
                <input
                  type="number"
                  min={5}
                  value={editReqRadius}
                  onChange={e => setEditReqRadius(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Status</label>
                <select
                  value={editReqStatus}
                  onChange={e => setEditReqStatus(e.target.value as PartRequest['status'])}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  <option value="aguardando_orcamentos">Aguardando Orçamentos</option>
                  <option value="orcamentos_recebidos">Orçamentos Recebidos</option>
                  <option value="pedido_confirmado">Pedido Confirmado</option>
                  <option value="cancelada">Cancelada</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditingBottleneck(null)} className="px-4 py-2 rounded-xl border text-xs font-bold cursor-pointer">
                Cancelar
              </button>
              <button type="submit" className="px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-black flex items-center gap-1 cursor-pointer">
                <Save className="w-3.5 h-3.5" /> Salvar
              </button>
            </div>
          </form>
        </div>
      )}

      {deletingBottleneck && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border-2 border-red-400 p-5 space-y-4 shadow-2xl">
            <h3 className="text-base font-black text-red-600">Excluir Chamado do Radar?</h3>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Confirma a exclusão permanente do chamado <strong>{deletingBottleneck.requestNumber}</strong> ({deletingBottleneck.partName})?
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDeletingBottleneck(null)} className="px-4 py-2 rounded-xl border text-xs font-bold cursor-pointer">
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  db.deleteRequest(deletingBottleneck.id, currentUser.id);
                  setDeletingBottleneck(null);
                }}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-black cursor-pointer"
              >
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}

      {editingAuditLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm">
          <form
            onSubmit={e => {
              e.preventDefault();
              db.updateAuditLog(
                editingAuditLog.id,
                { action: editAuditAction.trim(), details: editAuditDetails.trim() },
                currentUser.id
              );
              setEditingAuditLog(null);
            }}
            className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Editar Registro de Auditoria
              </h3>
              <button type="button" onClick={() => setEditingAuditLog(null)} className="cursor-pointer">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">Ação Registrada</label>
              <input
                type="text"
                value={editAuditAction}
                onChange={e => setEditAuditAction(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">Detalhes</label>
              <textarea
                rows={3}
                value={editAuditDetails}
                onChange={e => setEditAuditDetails(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditingAuditLog(null)} className="px-4 py-2 rounded-xl border text-xs font-bold cursor-pointer">
                Cancelar
              </button>
              <button type="submit" className="px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-black flex items-center gap-1 cursor-pointer">
                <Save className="w-3.5 h-3.5" /> Salvar
              </button>
            </div>
          </form>
        </div>
      )}

      {deletingAuditLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border-2 border-red-400 p-5 space-y-4 shadow-2xl">
            <h3 className="text-base font-black text-red-600">Excluir Evento de Auditoria?</h3>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Confirma a exclusão do registro <strong>{deletingAuditLog.action}</strong>?
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDeletingAuditLog(null)} className="px-4 py-2 rounded-xl border text-xs font-bold cursor-pointer">
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  db.deleteAuditLog(deletingAuditLog.id, currentUser.id);
                  setDeletingAuditLog(null);
                }}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-black cursor-pointer"
              >
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}

      {editingCatalogItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm">
          <form
            onSubmit={e => {
              e.preventDefault();
              db.updateCatalog(
                editingCatalogItem.id,
                {
                  title: editCatName,
                  name: editCatName,
                  manufacturer: editCatManufacturer,
                  category: editCatCategory,
                  compatibleModels: editCatModels,
                },
                currentUser.id,
                editCatFile
              );
              setEditingCatalogItem(null);
            }}
            className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Editar Catálogo Oficial (PDF)
              </h3>
              <button type="button" onClick={() => setEditingCatalogItem(null)} className="cursor-pointer">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">Nome / Título do Catálogo *</label>
              <input
                type="text"
                value={editCatName}
                onChange={e => setEditCatName(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1">Fabricante</label>
                <input
                  type="text"
                  value={editCatManufacturer}
                  onChange={e => setEditCatManufacturer(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Categoria</label>
                <select
                  value={editCatCategory}
                  onChange={e => setEditCatCategory(e.target.value)}
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
              <label className="block text-xs font-bold mb-1">Modelos Compatíveis</label>
              <input
                type="text"
                value={editCatModels}
                onChange={e => setEditCatModels(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">Substituir Arquivo PDF (opcional)</label>
              <input
                type="file"
                accept="application/pdf"
                onChange={e => setEditCatFile(e.target.files?.[0] || null)}
                className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditingCatalogItem(null)} className="px-4 py-2 rounded-xl border text-xs font-bold cursor-pointer">
                Cancelar
              </button>
              <button type="submit" className="px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-black flex items-center gap-1 cursor-pointer">
                <Save className="w-3.5 h-3.5" /> Salvar
              </button>
            </div>
          </form>
        </div>
      )}

      {deletingCatalogItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border-2 border-red-400 p-5 space-y-4 shadow-2xl">
            <h3 className="text-base font-black text-red-600">Excluir Catálogo PDF?</h3>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Deseja excluir permanentemente o catálogo <strong>{deletingCatalogItem.name || deletingCatalogItem.title}</strong>?
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDeletingCatalogItem(null)} className="px-4 py-2 rounded-xl border text-xs font-bold cursor-pointer">
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (db.deleteCatalog) db.deleteCatalog(deletingCatalogItem.id, currentUser.id);
                  else db.deleteManufacturerCatalog(deletingCatalogItem.id, currentUser.id);
                  setDeletingCatalogItem(null);
                }}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-black cursor-pointer"
              >
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}

      {editingArchiveOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm">
          <form
            onSubmit={e => {
              e.preventDefault();
              db.updateOrder(
                editingArchiveOrder.id,
                {
                  partName: editOrderPartName.trim() || editingArchiveOrder.partName,
                  vehicleSummary: editOrderVehicle.trim() || editingArchiveOrder.vehicleSummary,
                  totalAmount: Number(editOrderTotal) || editingArchiveOrder.totalAmount,
                  supplierTransferAmount: Number(editOrderTransfer) || editingArchiveOrder.supplierTransferAmount,
                  deliveryStatus: editOrderStatus,
                },
                currentUser.id
              );
              setEditingArchiveOrder(null);
            }}
            className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Editar Registro ({editingArchiveOrder.orderNumber})
              </h3>
              <button type="button" onClick={() => setEditingArchiveOrder(null)} className="cursor-pointer">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">Peça</label>
              <input
                type="text"
                value={editOrderPartName}
                onChange={e => setEditOrderPartName(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">Veículo</label>
              <input
                type="text"
                value={editOrderVehicle}
                onChange={e => setEditOrderVehicle(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs font-bold mb-1">Total (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editOrderTotal}
                  onChange={e => setEditOrderTotal(Number(e.target.value))}
                  className="w-full px-2.5 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Repasse (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editOrderTransfer}
                  onChange={e => setEditOrderTransfer(Number(e.target.value))}
                  className="w-full px-2.5 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Status</label>
                <select
                  value={editOrderStatus}
                  onChange={e => setEditOrderStatus(e.target.value as OrderAndPayment['deliveryStatus'])}
                  className="w-full px-2 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  <option value="compra_confirmada">Compra Confirmada</option>
                  <option value="peca_separada">Peça Separada</option>
                  <option value="a_caminho">A Caminho</option>
                  <option value="entregue">Entregue</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditingArchiveOrder(null)} className="px-4 py-2 rounded-xl border text-xs font-bold cursor-pointer">
                Cancelar
              </button>
              <button type="submit" className="px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-black flex items-center gap-1 cursor-pointer">
                <Save className="w-3.5 h-3.5" /> Salvar
              </button>
            </div>
          </form>
        </div>
      )}

      {deletingArchiveOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border-2 border-red-400 p-5 space-y-4 shadow-2xl">
            <h3 className="text-base font-black text-red-600">Excluir Registro do Arquivo Morto?</h3>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Confirma a exclusão permanente do pedido <strong>{deletingArchiveOrder.orderNumber}</strong> ({deletingArchiveOrder.partName})?
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDeletingArchiveOrder(null)} className="px-4 py-2 rounded-xl border text-xs font-bold cursor-pointer">
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  db.deleteOrder(deletingArchiveOrder.id, currentUser.id);
                  setDeletingArchiveOrder(null);
                }}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-black cursor-pointer"
              >
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SPAM Editor Modal (Editar ou Criar Novo) */}
      {(editingSpam || isCreatingSpam) && (
        <SpamEditorModal
          config={isCreatingSpam ? null : editingSpam}
          adminId={currentUser.id}
          onPreviewSpam={openSpamPreview}
          onSuccess={() => {
            setEditingSpam(null);
            setIsCreatingSpam(false);
          }}
          onClose={() => {
            setEditingSpam(null);
            setIsCreatingSpam(false);
          }}
        />
      )}

      {/* Pré-visualização em Tela do SPAM (Modo Teste Admin) */}
      <SpamOverlay spam={previewSpamPayload} />
    </div>
  );
};