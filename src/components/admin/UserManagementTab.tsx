/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Edit2,
  Trash2,
  ShieldCheck,
  ShieldAlert,
  Search,
  CheckCircle,
  XCircle,
  Phone,
  Lock,
  MapPin,
  Camera,
  Store,
  UserCheck,
  X,
  KeyRound,
  RefreshCw,
  FileText,
  Film,
  Link2,
  Upload,
  Plus,
  ExternalLink,
  Image as ImageIcon,
  MessageSquare,
  FileSpreadsheet,
  Download,
  AlertTriangle
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { db } from '../../services/db';
import {
  formatCep,
  isValidCep,
  lookupAddressAndGeoByCep,
  estimateCoordinatesFromCep,
} from '../../services/geolocation';
import { normalizeBrPhoneDigits } from '../../services/phone';
import {
  User,
  UserRole,
  PersonType,
  DeliveryAddress,
  SupplierTier,
  SupplierPaymentType,
  VehicleCategory,
  PaymentGatewayProvider,
  GatewaySubaccountStatus,
  UserSharedMaterial,
  UserSharedMaterialType
} from '../../types';

interface UserManagementTabProps {
  adminUser: User;
}

export const UserManagementTab: React.FC<UserManagementTabProps> = ({ adminUser }) => {
  const [roleFilter, setRoleFilter] = useState<'todos' | UserRole>('todos');
  const [search, setSearch] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [, setRefreshTick] = useState(0);
  const [isSyncingUsers, setIsSyncingUsers] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [pendingDeleteUser, setPendingDeleteUser] = useState<User | null>(null);
  const [isSavingUser, setIsSavingUser] = useState(false);

  // Excel import/export states
  const excelInputRef = useRef<HTMLInputElement>(null);
  const [excelImportModalOpen, setExcelImportModalOpen] = useState(false);
  const [excelParsedRows, setExcelParsedRows] = useState<Array<Record<string, unknown>>>([]);
  const [excelFileName, setExcelFileName] = useState('');
  const [excelImportMode, setExcelImportMode] = useState<'skip_duplicates' | 'update_existing'>('skip_duplicates');
  const [isImportingExcel, setIsImportingExcel] = useState(false);
  const [excelImportReport, setExcelImportReport] = useState<{
    createdCount: number;
    updatedCount: number;
    skippedDuplicates: number;
    errors: Array<{ row: number; name?: string; phone?: string; reason: string }>;
    duplicateDetails: Array<{ row: number; name?: string; phone?: string; reason: string }>;
  } | null>(null);

  useEffect(() => {
    const unsub = db.subscribe(() => setRefreshTick(t => t + 1));
    void db.syncFromServer(true);
    return () => {
      unsub();
    };
  }, []);

  // Form states for Add / Edit
  const [formName, setFormName] = useState('');
  const [formCompanyName, setFormCompanyName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formPassword, setFormPassword] = useState('1234');
  const [formRole, setFormRole] = useState<UserRole>('cliente');
  const [formPersonType, setFormPersonType] = useState<PersonType>('PF');
  const [formDocument, setFormDocument] = useState('');
  const [formAvatar, setFormAvatar] = useState('');
  const [formStatus, setFormStatus] = useState<User['status']>('ativo');
  const [formAddress, setFormAddress] = useState<DeliveryAddress>({
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: 'São Paulo',
    state: 'SP',
    cep: '',
  });

  const [formSupplierTier, setFormSupplierTier] = useState<SupplierTier>('opcao_2');
  const [formModalityId, setFormModalityId] = useState<string>('');
  const [formClassEscrita, setFormClassEscrita] = useState<string>('');
  const [formClassCondicao, setFormClassCondicao] = useState<string>('');
  const [formClassPercent, setFormClassPercent] = useState<number>(10);
  const [formSupplierPaymentType, setFormSupplierPaymentType] = useState<SupplierPaymentType>('compe_split');
  const [formCommissionRate, setFormCommissionRate] = useState<number>(10);
  const [formBankPix, setFormBankPix] = useState<string>('');
  const [formGatewayProvider, setFormGatewayProvider] = useState<PaymentGatewayProvider>('asaas');
  const [formGatewayWalletId, setFormGatewayWalletId] = useState<string>('');
  const [formGatewayAccountStatus, setFormGatewayAccountStatus] = useState<GatewaySubaccountStatus>('nao_configurada');
  const [formEquipmentTypes, setFormEquipmentTypes] = useState<VehicleCategory[]>(['carro', 'moto']);
  const [formSupplierCategoryIds, setFormSupplierCategoryIds] = useState<string[]>([]);
  const [formSubcategoriesSupplied, setFormSubcategoriesSupplied] = useState<string[]>([]);
  const [formServiceRadiusKm, setFormServiceRadiusKm] = useState<number>(50);

  // Materiais, Contratos, PDFs, Imagens, Vídeos, Links e Recados enviados pelo Admin ao Usuário
  const [formSharedMaterials, setFormSharedMaterials] = useState<UserSharedMaterial[]>([]);
  const [matType, setMatType] = useState<UserSharedMaterialType>('pdf');
  const [matTitle, setMatTitle] = useState('');
  const [matUrl, setMatUrl] = useState('');
  const [matText, setMatText] = useState('');
  const [matFile, setMatFile] = useState<File | null>(null);
  const [matUploading, setMatUploading] = useState(false);
  const [matError, setMatError] = useState<string | null>(null);
  const matFileInputRef = useRef<HTMLInputElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const users = db.getUsers();
  const adminCategories = db.getCategories();

  const filteredUsers = users.filter(u => {
    if (roleFilter !== 'todos' && u.role !== roleFilter) return false;
    if (search.trim() !== '') {
      const q = search.toLowerCase();
      return (
        u.name.toLowerCase().includes(q) ||
        (u.companyName && u.companyName.toLowerCase().includes(q)) ||
        u.phone.includes(q) ||
        u.document.includes(q)
      );
    }
    return true;
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setFormAvatar(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const openAddModal = () => {
    setFormError(null);
    setEditingUser(null);
    setFormName('');
    setFormCompanyName('');
    setFormPhone('');
    setFormPassword('1234');
    setFormRole('cliente');
    setFormPersonType('PF');
    setFormDocument('');
    setFormAvatar('');
    setFormStatus('ativo');
    setFormSupplierTier('opcao_2');
    setFormModalityId('');
    setFormClassEscrita('');
    setFormClassCondicao('');
    setFormClassPercent(10);
    setFormSupplierPaymentType('compe_split');
    setFormCommissionRate(10);
    setFormBankPix('');
    setFormGatewayProvider('asaas');
    setFormGatewayWalletId('');
    setFormGatewayAccountStatus('nao_configurada');
    setFormEquipmentTypes(['carro', 'moto']);
    const defaultCats = adminCategories.filter(c => c.vehicleType === 'carro' || c.vehicleType === 'moto');
    setFormSupplierCategoryIds(defaultCats.map(c => c.id));
    setFormSubcategoriesSupplied([]);
    setFormServiceRadiusKm(50);
    setFormSharedMaterials([]);
    setMatType('pdf');
    setMatTitle('');
    setMatUrl('');
    setMatText('');
    setMatFile(null);
    setMatError(null);
    setFormAddress({
      street: '',
      number: '',
      complement: '',
      neighborhood: '',
      city: 'São Paulo',
      state: 'SP',
      cep: '',
    });
    setIsAddModalOpen(true);
  };

  const openEditModal = (u: User) => {
    setFormError(null);
    setEditingUser(u);
    setFormName(u.name);
    setFormCompanyName(u.companyName || '');
    setFormPhone(u.phone);
    setFormPassword(u.password || '1234');
    setFormRole(u.role);
    setFormPersonType(u.personType || 'PF');
    setFormDocument(u.document);
    setFormAvatar(u.avatarUrl || '');
    setFormStatus(u.status);
    setFormSupplierTier(u.supplierTier || 'opcao_2');
    setFormModalityId(u.supplierModalityId || '');
    setFormClassEscrita(u.supplierClassificationEscrita || '');
    setFormClassCondicao(u.supplierClassificationCondicao || '');
    setFormClassPercent(u.supplierClassificationPercent ?? u.commissionRateOverride ?? 10);
    setFormSupplierPaymentType(u.supplierPaymentType || 'compe_split');
    setFormCommissionRate(u.commissionRateOverride ?? u.supplierClassificationPercent ?? 10);
    setFormBankPix(u.gatewayPixKey || u.bankAccountOrPix || '');
    setFormGatewayProvider(u.gatewayProvider || 'asaas');
    setFormGatewayWalletId(u.gatewayWalletId || '');
    setFormGatewayAccountStatus(u.gatewayAccountStatus || 'nao_configurada');
    const equips = u.equipmentTypesSupplied || ['carro', 'moto'];
    setFormEquipmentTypes(equips);
    const inferredCatIds =
      u.supplierCategoryIds && u.supplierCategoryIds.length > 0
        ? u.supplierCategoryIds
        : adminCategories
            .filter(c => c.vehicleType && equips.includes(c.vehicleType))
            .map(c => c.id);
    setFormSupplierCategoryIds(inferredCatIds);
    setFormSubcategoriesSupplied(u.subcategoriesSupplied || u.categoriesSupplied || []);
    setFormServiceRadiusKm(u.serviceRadiusKm !== undefined ? u.serviceRadiusKm : 50);
    setFormSharedMaterials(Array.isArray(u.adminSharedMaterials) ? [...u.adminSharedMaterials] : []);
    setMatType('pdf');
    setMatTitle('');
    setMatUrl('');
    setMatText('');
    setMatFile(null);
    setMatError(null);
    setFormAddress(u.address || {
      street: '',
      number: '',
      complement: '',
      neighborhood: '',
      city: 'São Paulo',
      state: 'SP',
      cep: '',
    });
    setIsAddModalOpen(true);
  };

  const handleAdminCepChange = async (rawCep: string) => {
    const formatted = formatCep(rawCep);
    setFormAddress(prev => ({ ...prev, cep: formatted }));
    if (formatted.replace(/\D/g, '').length === 8) {
      const geo = await lookupAddressAndGeoByCep(formatted);
      if (geo.success) {
        setFormAddress(prev => ({
          ...prev,
          cep: geo.cep,
          street: geo.street || prev.street,
          neighborhood: geo.neighborhood || prev.neighborhood,
          city: geo.city || prev.city,
          state: geo.state || prev.state,
          coordinates: geo.coordinates,
        }));
      }
    }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (formRole === 'fornecedor' && !isValidCep(formAddress.cep)) {
      setFormError('CEP válido (8 dígitos) é obrigatório para Fornecedores, pois define a geolocalização e o raio de atuação.');
      return;
    }
    const cleanPhone = normalizeBrPhoneDigits(formPhone) || formPhone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setFormError('Informe um celular válido com DDD (10 ou 11 dígitos).');
      return;
    }
    if (!formPassword.trim() || formPassword.trim().length < 4) {
      setFormError('A senha de acesso deve ter no mínimo 4 caracteres.');
      return;
    }

    const resolvedCoords =
      formAddress.coordinates ||
      (isValidCep(formAddress.cep)
        ? estimateCoordinatesFromCep(formAddress.cep, formAddress.state)
        : undefined);
    const normalizedFormAddress: DeliveryAddress = {
      ...formAddress,
      cep: formAddress.cep ? formatCep(formAddress.cep) : '',
      coordinates: resolvedCoords,
    };

    const selectedCategoryObjects = adminCategories.filter(c => formSupplierCategoryIds.includes(c.id));
    const derivedEquipmentTypes = Array.from(
      new Set([
        ...formEquipmentTypes,
        ...(selectedCategoryObjects.map(c => c.vehicleType).filter(Boolean) as VehicleCategory[]),
      ])
    );
    const selectedCategoryNames = selectedCategoryObjects.map(c => c.name);

    setIsSavingUser(true);
    try {
      if (editingUser) {
        const res = await db.updateUserRemote(
          editingUser.id,
          {
            name: formName.trim(),
            companyName: formCompanyName.trim() || undefined,
            phone: cleanPhone,
            password: formPassword.trim() || editingUser.password,
            role: formRole,
            personType: formPersonType,
            document: formDocument.trim(),
            avatarUrl: formAvatar || undefined,
            status: formStatus,
            address: normalizedFormAddress,
            coordinates: resolvedCoords,
            supplierTier: formRole === 'fornecedor' ? formSupplierTier : undefined,
            supplierModalityId: formRole === 'fornecedor' ? (formModalityId || undefined) : undefined,
            supplierClassificationEscrita: formRole === 'fornecedor' ? (formClassEscrita.trim() || undefined) : undefined,
            supplierClassificationCondicao: formRole === 'fornecedor' ? (formClassCondicao.trim() || undefined) : undefined,
            supplierClassificationPercent: formRole === 'fornecedor' ? formClassPercent : undefined,
            isClassifiedByAdmin: formRole === 'fornecedor' ? formStatus === 'ativo' : undefined,
            isAvailableForOrders: formRole === 'fornecedor' ? formStatus === 'ativo' : undefined,
            approvedAt:
              formRole === 'fornecedor' && formStatus === 'ativo'
                ? editingUser.approvedAt || new Date().toISOString()
                : editingUser.approvedAt,
            approvedByAdminId:
              formRole === 'fornecedor' && formStatus === 'ativo'
                ? editingUser.approvedByAdminId || adminUser.id
                : editingUser.approvedByAdminId,
            supplierPaymentType: formRole === 'fornecedor' ? formSupplierPaymentType : undefined,
            commissionRateOverride: formRole === 'fornecedor' ? formClassPercent : undefined,
            bankAccountOrPix: formRole === 'fornecedor' ? formBankPix : undefined,
            gatewayProvider: formRole === 'fornecedor' ? formGatewayProvider : undefined,
            gatewayPixKey: formRole === 'fornecedor' ? (formBankPix.trim() || undefined) : undefined,
            gatewayWalletId: formRole === 'fornecedor' ? (formGatewayWalletId.trim() || undefined) : undefined,
            gatewayAccountStatus: formRole === 'fornecedor' ? formGatewayAccountStatus : undefined,
            supplierCategoryIds: formRole === 'fornecedor' ? formSupplierCategoryIds : undefined,
            categoriesSupplied:
              formRole === 'fornecedor'
                ? Array.from(new Set([...selectedCategoryNames, ...formSubcategoriesSupplied]))
                : undefined,
            subcategoriesSupplied: formRole === 'fornecedor' ? formSubcategoriesSupplied : undefined,
            equipmentTypesSupplied: formRole === 'fornecedor' ? derivedEquipmentTypes : undefined,
            serviceRadiusKm: formRole === 'fornecedor' ? formServiceRadiusKm : 0,
            adminSharedMaterials: formSharedMaterials,
          },
          adminUser.id
        );
        if (!res.ok) {
          setFormError(res.message || 'Erro ao atualizar usuário.');
          return;
        }
        setActionNotice(`Usuário "${formName.trim()}" atualizado no banco central.`);
      } else {
        const res = await db.createUserRemote(
          {
            name: formName.trim(),
            companyName: formCompanyName.trim() || undefined,
            phone: cleanPhone,
            email: '',
            password: formPassword.trim() || '1234',
            role: formRole,
            personType: formPersonType,
            document: formDocument.trim(),
            avatarUrl: formAvatar || undefined,
            status: formStatus,
            address: normalizedFormAddress,
            coordinates: resolvedCoords,
            supplierTier: formRole === 'fornecedor' ? formSupplierTier : undefined,
            supplierModalityId: formRole === 'fornecedor' ? (formModalityId || undefined) : undefined,
            supplierClassificationEscrita: formRole === 'fornecedor' ? (formClassEscrita.trim() || undefined) : undefined,
            supplierClassificationCondicao: formRole === 'fornecedor' ? (formClassCondicao.trim() || undefined) : undefined,
            supplierClassificationPercent: formRole === 'fornecedor' ? formClassPercent : undefined,
            isClassifiedByAdmin: formRole === 'fornecedor' ? formStatus === 'ativo' : undefined,
            approvedAt: formRole === 'fornecedor' && formStatus === 'ativo' ? new Date().toISOString() : undefined,
            approvedByAdminId: formRole === 'fornecedor' && formStatus === 'ativo' ? adminUser.id : undefined,
            supplierPaymentType: formRole === 'fornecedor' ? formSupplierPaymentType : undefined,
            commissionRateOverride: formRole === 'fornecedor' ? formClassPercent : undefined,
            bankAccountOrPix: formRole === 'fornecedor' ? formBankPix : undefined,
            gatewayProvider: formRole === 'fornecedor' ? formGatewayProvider : undefined,
            gatewayPixKey: formRole === 'fornecedor' ? (formBankPix.trim() || undefined) : undefined,
            gatewayWalletId: formRole === 'fornecedor' ? (formGatewayWalletId.trim() || undefined) : undefined,
            gatewayAccountStatus: formRole === 'fornecedor' ? formGatewayAccountStatus : undefined,
            supplierCategoryIds: formRole === 'fornecedor' ? formSupplierCategoryIds : undefined,
            categoriesSupplied:
              formRole === 'fornecedor'
                ? Array.from(new Set([...selectedCategoryNames, ...formSubcategoriesSupplied]))
                : [],
            subcategoriesSupplied: formRole === 'fornecedor' ? formSubcategoriesSupplied : undefined,
            equipmentTypesSupplied: formRole === 'fornecedor' ? derivedEquipmentTypes : undefined,
            serviceRadiusKm: formRole === 'fornecedor' ? formServiceRadiusKm : 0,
            adminSharedMaterials: formSharedMaterials,
            citiesCovered: formAddress.city ? [formAddress.city] : ['São Paulo'],
            isAvailableForOrders: formRole === 'fornecedor' && formStatus === 'ativo',
            rating: 5.0,
            totalRatings: 0,
            totalSales: 0,
          },
          adminUser.id
        );
        if (!res.ok) {
          setFormError(res.message || 'Erro ao cadastrar usuário no servidor.');
          return;
        }
        setActionNotice(`Usuário "${formName.trim()}" salvo com sucesso no banco central!`);
      }

      setIsAddModalOpen(false);
    } finally {
      setIsSavingUser(false);
    }
  };

  const handleDeleteUser = (u: User) => {
    if (u.id === adminUser.id) {
      setActionNotice('Você não pode excluir sua própria conta de administrador.');
      return;
    }
    setPendingDeleteUser(u);
  };

  const confirmDeleteUser = async () => {
    if (!pendingDeleteUser) return;
    const deletedName = pendingDeleteUser.name;
    const targetId = pendingDeleteUser.id;
    setPendingDeleteUser(null);
    await db.deleteUserRemote(targetId, adminUser.id);
    setActionNotice(`Usuário "${deletedName}" removido permanentemente do banco central.`);
  };

  const handleManualSync = async () => {
    setIsSyncingUsers(true);
    await db.syncFromServer(true);
    setIsSyncingUsers(false);
    setActionNotice(`Base centralizada sincronizada (${db.getUsers().length} usuários carregados).`);
  };

  const handleDownloadUsersExcel = () => {
    const allUsers = db.getUsers();
    const rows = allUsers.map(u => ({
      'ID': u.id,
      'Perfil': u.role,
      'Status': u.status,
      'Nome Completo': u.name,
      'Empresa / Loja': u.companyName || '',
      'Telefone (WhatsApp DDD)': u.phone,
      'Tipo Pessoa (PF/PJ)': u.personType,
      'CPF / CNPJ': u.document || '',
      'Senha (Protegida)': '***PROTEGIDA***',
      'CEP': u.address?.cep || '',
      'Rua': u.address?.street || '',
      'Numero': u.address?.number || '',
      'Complemento': u.address?.complement || '',
      'Bairro': u.address?.neighborhood || '',
      'Cidade': u.address?.city || '',
      'UF': u.address?.state || '',
      'Raio (km)': u.role === 'fornecedor' ? (u.serviceRadiusKm ?? 50) : 0,
      'Tier Fornecedor': u.role === 'fornecedor' ? (u.supplierTier || '') : '',
      'Chave PIX / Gateway': u.role === 'fornecedor' ? (u.gatewayPixKey || u.bankAccountOrPix || '') : '',
      'Gateway Provider': u.role === 'fornecedor' ? (u.gatewayProvider || 'asaas') : '',
      'Wallet ID': u.role === 'fornecedor' ? (u.gatewayWalletId || '') : '',
      'Criado Em': u.createdAt ? new Date(u.createdAt).toLocaleString('pt-BR') : '',
    }));

    const instructionsRows = [
      { Campo: 'Perfil', Regra: 'cliente | fornecedor | admin' },
      { Campo: 'Status', Regra: 'ativo | pendente | bloqueado' },
      { Campo: 'Telefone (WhatsApp DDD)', Regra: 'Obrigatório e único (10 ou 11 dígitos com DDD, ex: 11987654321)' },
      { Campo: 'CPF / CNPJ', Regra: '11 dígitos (CPF) ou 14 dígitos (CNPJ) · Impede duplicidade entre usuários' },
      { Campo: 'Senha (Protegida)', Regra: 'Por segurança a planilha nunca exporta senhas reais. Na atualização deixe ***PROTEGIDA*** ou vazio para manter a senha atual. Para NOVOS cadastros informe uma senha inicial com mínimo 4 caracteres.' },
      { Campo: 'Tier Fornecedor', Regra: 'opcao_1 | opcao_2 | opcao_3 (opcional para clientes)' },
    ];

    const wb = XLSX.utils.book_new();
    const wsUsers = XLSX.utils.json_to_sheet(rows);
    wsUsers['!cols'] = [
      { wch: 24 }, { wch: 12 }, { wch: 12 }, { wch: 28 }, { wch: 28 },
      { wch: 20 }, { wch: 12 }, { wch: 20 }, { wch: 18 }, { wch: 12 },
      { wch: 28 }, { wch: 10 }, { wch: 16 }, { wch: 18 }, { wch: 18 },
      { wch: 6 }, { wch: 10 }, { wch: 15 }, { wch: 26 }, { wch: 15 },
      { wch: 24 }, { wch: 20 },
    ];
    const wsInfo = XLSX.utils.json_to_sheet(instructionsRows);
    wsInfo['!cols'] = [{ wch: 26 }, { wch: 90 }];

    XLSX.utils.book_append_sheet(wb, wsUsers, 'Usuarios_AUTO_SHOP');
    XLSX.utils.book_append_sheet(wb, wsInfo, 'Instrucoes_Importacao');

    const dateTag = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `usuarios-autoshop-${dateTag}.xlsx`);
    setActionNotice(`Planilha Excel gerada com ${allUsers.length} usuário(s) e senhas protegidas.`);
  };

  const handleExcelFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = wb.SheetNames[0];
      if (!firstSheetName) {
        setActionNotice('Planilha vazia: nenhuma aba encontrada.');
        return;
      }
      const ws = wb.Sheets[firstSheetName];
      const rawJson = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });

      const pickCol = (row: Record<string, unknown>, aliases: string[]): unknown => {
        const normalizedMap = new Map<string, unknown>();
        Object.entries(row).forEach(([k, v]) => {
          const nk = k
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim()
            .toLowerCase();
          normalizedMap.set(nk, v);
        });
        for (const alias of aliases) {
          const na = alias
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim()
            .toLowerCase();
          if (normalizedMap.has(na)) return normalizedMap.get(na);
        }
        return '';
      };

      const normalizedRows = rawJson.map((row, idx) => ({
        rowNumber: idx + 2,
        id: pickCol(row, ['ID', 'id']),
        role: pickCol(row, ['Perfil', 'role', 'tipo']),
        status: pickCol(row, ['Status', 'situacao']),
        name: pickCol(row, ['Nome Completo', 'Nome', 'name']),
        companyName: pickCol(row, ['Empresa / Loja', 'Empresa', 'Loja', 'Razao Social', 'companyName']),
        phone: pickCol(row, ['Telefone (WhatsApp DDD)', 'Telefone', 'Celular', 'WhatsApp', 'phone']),
        personType: pickCol(row, ['Tipo Pessoa (PF/PJ)', 'Tipo Pessoa', 'PF/PJ', 'personType']),
        document: pickCol(row, ['CPF / CNPJ', 'CPF/CNPJ', 'Documento', 'CPF', 'CNPJ', 'document']),
        password: pickCol(row, ['Senha (Protegida)', 'Senha Inicial', 'Senha', 'PIN', 'password']),
        cep: pickCol(row, ['CEP', 'cep']),
        street: pickCol(row, ['Rua', 'Logradouro', 'Endereco', 'street']),
        number: pickCol(row, ['Numero', 'Nº', 'No', 'number']),
        complement: pickCol(row, ['Complemento', 'complement']),
        neighborhood: pickCol(row, ['Bairro', 'neighborhood']),
        city: pickCol(row, ['Cidade', 'city']),
        state: pickCol(row, ['UF', 'Estado', 'state']),
        serviceRadiusKm: pickCol(row, ['Raio (km)', 'Raio', 'serviceRadiusKm']),
        supplierTier: pickCol(row, ['Tier Fornecedor', 'Tier', 'Opcao', 'supplierTier']),
        bankAccountOrPix: pickCol(row, ['Chave PIX / Gateway', 'Chave PIX', 'PIX', 'bankAccountOrPix']),
        gatewayProvider: pickCol(row, ['Gateway Provider', 'Gateway', 'gatewayProvider']),
        gatewayWalletId: pickCol(row, ['Wallet ID', 'Wallet', 'gatewayWalletId']),
      }));

      setExcelParsedRows(normalizedRows);
      setExcelFileName(file.name);
      setExcelImportReport(null);
      setExcelImportModalOpen(true);
    } catch {
      setActionNotice('Não foi possível ler o arquivo Excel (.xlsx). Verifique se o formato é válido.');
    } finally {
      if (excelInputRef.current) excelInputRef.current.value = '';
    }
  };

  const handleConfirmExcelImport = async () => {
    if (excelParsedRows.length === 0) return;
    setIsImportingExcel(true);
    try {
      const res = await db.importUsersRemote(excelParsedRows, excelImportMode, adminUser.id);
      setExcelImportReport({
        createdCount: res.createdCount,
        updatedCount: res.updatedCount,
        skippedDuplicates: res.skippedDuplicates,
        errors: res.errors,
        duplicateDetails: res.duplicateDetails,
      });
      if (res.ok) {
        setActionNotice(
          `Importação concluída: ${res.createdCount} criado(s), ${res.updatedCount} atualizado(s), ${res.skippedDuplicates} duplicidade(s) ignorada(s), ${res.errors.length} erro(s).`
        );
      } else if (res.message) {
        setActionNotice(res.message);
      }
    } finally {
      setIsImportingExcel(false);
    }
  };

  return (
    <div className="space-y-6">
      {actionNotice && (
        <div className="p-3 rounded-2xl bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800 flex items-center justify-between gap-2 text-xs font-bold text-purple-800 dark:text-purple-200">
          <span>{actionNotice}</span>
          <button
            type="button"
            onClick={() => setActionNotice(null)}
            className="p-1 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {pendingDeleteUser && (
        <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-xs font-bold text-red-800 dark:text-red-200">
            Deseja realmente EXCLUIR permanentemente o usuário "{pendingDeleteUser.name}" ({pendingDeleteUser.role})? Essa ação não pode ser desfeita.
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setPendingDeleteUser(null)}
              className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirmDeleteUser}
              className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-xs font-bold text-white cursor-pointer"
            >
              Confirmar Exclusão
            </button>
          </div>
        </div>
      )}

      {/* Top Banner */}
      <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-purple-100 dark:bg-purple-950/60 flex items-center justify-center text-purple-600 shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white">
              Gestão Central de Usuários (Controle Total)
            </h2>
            <p className="text-xs text-slate-500">
              Banco centralizado em tempo real para todos os dispositivos (PC, Celular e Tablet).
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          <input
            ref={excelInputRef}
            type="file"
            accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            onChange={handleExcelFileSelected}
            className="hidden"
          />

          <button
            type="button"
            onClick={handleDownloadUsersExcel}
            className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Baixar Planilha Excel (.xlsx)</span>
          </button>

          <button
            type="button"
            onClick={() => excelInputRef.current?.click()}
            className="px-3.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Enviar Planilha Excel (.xlsx)</span>
          </button>

          <button
            type="button"
            onClick={handleManualSync}
            disabled={isSyncingUsers}
            className="px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-2 transition cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncingUsers ? 'animate-spin' : ''}`} />
            <span>{isSyncingUsers ? 'Sincronizando...' : 'Atualizar Banco'}</span>
          </button>

          <button
            onClick={openAddModal}
            className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center gap-2 shadow-md transition active:scale-98 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Adicionar Novo Usuário</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Buscar por nome, telefone, CPF/CNPJ ou comércio..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-600"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          {(['todos', 'cliente', 'fornecedor', 'admin'] as const).map(role => (
            <button
              key={role}
              onClick={() => setRoleFilter(role)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition capitalize whitespace-nowrap cursor-pointer ${
                roleFilter === role
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              {role === 'todos' ? `Todos (${users.length})` : role}
            </button>
          ))}
        </div>
      </div>

      {/* Users Table / Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredUsers.map(u => (
          <div
            key={u.id}
            className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between gap-3 hover:border-purple-300 transition"
          >
            <div>
              {/* Card Header: Avatar + Name + Role Badge */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0 flex items-center justify-center">
                    {u.avatarUrl ? (
                      <img src={u.avatarUrl} alt={u.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-black text-sm text-slate-400">
                        {u.name.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div>
                    <strong className="block text-sm font-black text-slate-900 dark:text-white truncate max-w-[180px]">
                      {u.name}
                    </strong>
                    {u.companyName && u.companyName !== u.name && (
                      <span className="text-[11px] text-slate-500 block truncate max-w-[180px]">
                        {u.companyName}
                      </span>
                    )}
                    <span className={`inline-block text-[9px] font-black uppercase px-2 py-0.5 rounded-full mt-1 ${
                      u.role === 'cliente'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                        : u.role === 'fornecedor'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                    }`}>
                      {u.role}
                    </span>
                  </div>
                </div>

                <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                  u.status === 'ativo'
                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                    : u.status === 'pendente'
                    ? 'bg-amber-50 text-amber-600 border border-amber-200'
                    : 'bg-red-50 text-red-600 border border-red-200'
                }`}>
                  {u.status}
                </span>
              </div>

              {/* User details */}
              <div className="mt-3 space-y-1.5 text-xs text-slate-600 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Phone className="w-3 h-3 text-slate-400" />
                    WhatsApp:
                  </span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {u.phone}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <KeyRound className="w-3 h-3 text-slate-400" />
                    Senha PIN:
                  </span>
                  <span className="font-mono font-black text-purple-600 bg-purple-50 dark:bg-purple-950/60 px-2 py-0.5 rounded">
                    {u.password || '1234'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span>Documento:</span>
                  <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                    {u.document || 'Não informado'}
                  </span>
                </div>

                {u.address && (
                  <div className="flex items-start gap-1 text-[11px] text-slate-500 pt-1">
                    <MapPin className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                    <span className="truncate">
                      {u.address.street}, {u.address.number} - {u.address.neighborhood}, {u.address.city}/{u.address.state}
                    </span>
                  </div>
                )}

                {u.role === 'fornecedor' && (
                  <div className="flex items-center justify-between gap-2 pt-1 text-[10px]">
                    <span className="font-bold text-slate-500">
                      Gateway Split ({(u.gatewayProvider || 'asaas').toUpperCase()}):
                    </span>
                    <span className={`font-mono font-bold px-1.5 py-0.5 rounded ${
                      u.gatewayAccountStatus === 'ativa' && u.gatewayWalletId
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                    }`}>
                      {u.gatewayWalletId ? u.gatewayWalletId : 'Carteira pendente'}
                    </span>
                  </div>
                )}

                {u.role === 'fornecedor' && ((u.equipmentTypesSupplied && u.equipmentTypesSupplied.length > 0) || (u.subcategoriesSupplied && u.subcategoriesSupplied.length > 0)) && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {u.equipmentTypesSupplied?.map(eq => (
                      <span key={eq} className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
                        {eq === 'carro' ? 'Carros' : eq === 'moto' ? 'Motos' : eq === 'caminhao' ? 'Diesel/Caminhões' : eq === 'agricola' ? 'Agrícola' : eq === 'industrial' ? 'Industrial' : 'Outros'}
                      </span>
                    ))}
                    {u.subcategoriesSupplied?.slice(0, 4).map(sub => (
                      <span key={sub} className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                        {sub}
                      </span>
                    ))}
                    {u.subcategoriesSupplied && u.subcategoriesSupplied.length > 4 && (
                      <span className="text-[9px] font-bold text-slate-400 px-1">
                        +{u.subcategoriesSupplied.length - 4}
                      </span>
                    )}
                  </div>
                )}

                {u.role === 'fornecedor' && u.supplierClassificationEscrita && (
                  <div className="text-[10px] px-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-900 text-indigo-800 dark:text-indigo-200 font-bold">
                    {u.supplierClassificationEscrita} ({u.supplierClassificationPercent ?? u.commissionRateOverride ?? 10}%)
                  </div>
                )}

                {(u.adminSharedMaterials?.length || 0) > 0 && (
                  <div className="text-[10px] px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-200 font-bold flex items-center gap-1">
                    <FileText className="w-3 h-3 shrink-0" />
                    <span>{u.adminSharedMaterials!.length} documento(s) / recado(s) do Admin</span>
                  </div>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => openEditModal(u)}
                className="flex-1 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Edit2 className="w-3 h-3" />
                <span>Editar</span>
              </button>

              <button
                type="button"
                onClick={() => handleDeleteUser(u)}
                className="p-1.5 rounded-lg border border-red-200 dark:border-red-900 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition cursor-pointer"
                title="Excluir Usuário"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add / Edit Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 relative max-h-[92vh] overflow-y-auto">
            <button
              onClick={() => setIsAddModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white mb-4">
              {editingUser ? `Editar Usuário: ${editingUser.name}` : 'Cadastrar Novo Usuário no Sistema'}
            </h3>

            <form onSubmit={handleSaveUser} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Tipo de Perfil
                  </label>
                  <select
                    value={formRole}
                    onChange={e => setFormRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold outline-none"
                  >
                    <option value="cliente">Cliente / Motorista</option>
                    <option value="fornecedor">Fornecedor (Autopeças)</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Status da Conta
                  </label>
                  <select
                    value={formStatus}
                    onChange={e => setFormStatus(e.target.value as User['status'])}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold outline-none"
                  >
                    <option value="ativo">Ativo (Liberado)</option>
                    <option value="pendente">Pendente de Autorização</option>
                    <option value="bloqueado">Bloqueado</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nome Completo
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold outline-none"
                  required
                />
              </div>

              {formRole === 'fornecedor' && (
                <div className="space-y-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Nome da Loja / Razão Social
                    </label>
                    <input
                      type="text"
                      value={formCompanyName}
                      onChange={e => setFormCompanyName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold outline-none"
                    />
                  </div>

                  {/* Classificação / Modalidade de SPAM do Fornecedor (Cadastrada pelo Admin) */}
                  <div className="p-3 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/30 border-2 border-indigo-300 dark:border-indigo-800 space-y-2.5">
                    <label className="block text-xs font-black text-indigo-800 dark:text-indigo-200">
                      Classificação / Modalidade de SPAM do Fornecedor *
                    </label>

                    <select
                      value={formModalityId}
                      onChange={e => {
                        const chosenId = e.target.value;
                        setFormModalityId(chosenId);
                        const mod = db.getSupplierModalities().find(m => m.id === chosenId);
                        if (mod) {
                          setFormSupplierTier(mod.baseTier);
                          setFormClassEscrita(mod.escrita);
                          setFormClassCondicao(mod.condicao);
                          setFormClassPercent(mod.porcentagem);
                          setFormCommissionRate(mod.porcentagem);
                        }
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-600"
                    >
                      <option value="">Personalizada / Selecionar Modalidade do Admin...</option>
                      {db.getSupplierModalities().map(mod => (
                        <option key={mod.id} value={mod.id}>
                          {mod.escrita} ({mod.porcentagem}%)
                        </option>
                      ))}
                    </select>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 mb-0.5">
                          Escrita (aparece no perfil do prestador)
                        </label>
                        <input
                          type="text"
                          value={formClassEscrita}
                          onChange={e => setFormClassEscrita(e.target.value)}
                          placeholder="Ex: Parceiro Ouro · 2ª Opção"
                          className="w-full px-2.5 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 text-xs font-bold outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 mb-0.5">
                          Estrutura Base SPAM
                        </label>
                        <select
                          value={formSupplierTier}
                          onChange={e => setFormSupplierTier(e.target.value as SupplierTier)}
                          className="w-full px-2 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 text-xs font-bold outline-none"
                        >
                          <option value="opcao_1">1ª Opção</option>
                          <option value="opcao_2">2ª Opção</option>
                          <option value="opcao_3">3ª Opção</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 mb-0.5">
                        Condição (aparece no perfil do prestador)
                      </label>
                      <textarea
                        rows={2}
                        value={formClassCondicao}
                        onChange={e => setFormClassCondicao(e.target.value)}
                        placeholder="Ex: Split automático na conta · Raio regional · Repasse imediato"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 text-xs outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Forma de Pagamento
                      </label>
                      <select
                        value={formSupplierPaymentType}
                        onChange={e => setFormSupplierPaymentType(e.target.value as SupplierPaymentType)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold outline-none"
                      >
                        <option value="compe_split">Split Automático AUTO SHOP no Gateway</option>
                        <option value="direto_fornecedor">Pagamento Direto na Conta / PIX do Fornecedor</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Porcentagem / Comissão (%)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={formClassPercent}
                        onChange={e => {
                          const val = Number(e.target.value);
                          setFormClassPercent(val);
                          setFormCommissionRate(val);
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Chave PIX ou Conta de Recebimento (Gateway Split)
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: 04.882.190/0001-55 ou Banco / Agência / Conta"
                      value={formBankPix}
                      onChange={e => setFormBankPix(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Gateway Split
                      </label>
                      <select
                        value={formGatewayProvider}
                        onChange={e => setFormGatewayProvider(e.target.value as PaymentGatewayProvider)}
                        className="w-full px-2.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold outline-none"
                      >
                        <option value="asaas">Asaas</option>
                        <option value="mercadopago">Mercado Pago</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Wallet / Collector ID
                      </label>
                      <input
                        type="text"
                        placeholder="wal_asaas_..."
                        value={formGatewayWalletId}
                        onChange={e => setFormGatewayWalletId(e.target.value)}
                        className="w-full px-2.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Status Subconta
                      </label>
                      <select
                        value={formGatewayAccountStatus}
                        onChange={e => setFormGatewayAccountStatus(e.target.value as GatewaySubaccountStatus)}
                        className="w-full px-2.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold outline-none"
                      >
                        <option value="nao_configurada">Não Configurada</option>
                        <option value="em_analise">Em Análise</option>
                        <option value="ativa">Ativa</option>
                        <option value="rejeitada">Rejeitada</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-purple-700 dark:text-purple-300 mb-1">
                      Raio de Atuação por Perímetro (Definido pelo Admin em km · 0 = Sem Limite)
                    </label>
                    <div className="flex items-center gap-2">
                      <select
                        value={[0, 5, 10, 15, 25, 30, 50, 100, 200, 500, 1000].includes(formServiceRadiusKm) ? formServiceRadiusKm : -1}
                        onChange={e => {
                          const val = Number(e.target.value);
                          if (val >= 0) setFormServiceRadiusKm(val);
                        }}
                        className="flex-1 px-3 py-2 rounded-xl border-2 border-purple-400 bg-white dark:bg-slate-800 text-xs font-black text-purple-700 dark:text-purple-300 outline-none cursor-pointer focus:ring-2 focus:ring-purple-600"
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
                        <option value={0}>SEM LIMITE (Brasil Inteiro)</option>
                        {![0, 5, 10, 15, 25, 30, 50, 100, 200, 500, 1000].includes(formServiceRadiusKm) && (
                          <option value={-1}>{formServiceRadiusKm} km (Personalizado)</option>
                        )}
                      </select>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={0}
                          max={5000}
                          value={formServiceRadiusKm}
                          onChange={e => setFormServiceRadiusKm(Math.max(0, Number(e.target.value) || 0))}
                          className="w-20 px-2.5 py-2 rounded-xl border-2 border-purple-400 bg-white dark:bg-slate-800 text-xs font-mono font-black text-center text-purple-700 dark:text-purple-300 outline-none"
                        />
                        <span className="text-xs font-bold text-purple-700 dark:text-purple-300">km</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Categorias e Subcategorias Atendidas (Cadastradas pelo Admin)
                    </label>
                    <div className="space-y-2 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 max-h-60 overflow-y-auto">
                      {adminCategories.map(cat => {
                        const isCatSelected = formSupplierCategoryIds.includes(cat.id);
                        return (
                          <div key={cat.id} className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700">
                            <label className="flex items-center gap-2 text-xs font-black text-slate-900 dark:text-white cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isCatSelected}
                                onChange={() => {
                                  if (isCatSelected) {
                                    setFormSupplierCategoryIds(formSupplierCategoryIds.filter(id => id !== cat.id));
                                    if (cat.vehicleType) {
                                      setFormEquipmentTypes(formEquipmentTypes.filter(t => t !== cat.vehicleType));
                                    }
                                  } else {
                                    setFormSupplierCategoryIds([...formSupplierCategoryIds, cat.id]);
                                    if (cat.vehicleType && !formEquipmentTypes.includes(cat.vehicleType)) {
                                      setFormEquipmentTypes([...formEquipmentTypes, cat.vehicleType]);
                                    }
                                  }
                                }}
                                className="w-3.5 h-3.5 rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                              />
                              <span>{cat.name}</span>
                            </label>

                            {cat.subcategories.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-2 pl-5">
                                {cat.subcategories.map(sub => {
                                  const isSubSelected = formSubcategoriesSupplied.includes(sub.name);
                                  return (
                                    <label
                                      key={sub.id}
                                      className={`flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-semibold cursor-pointer transition ${
                                        isSubSelected
                                          ? 'bg-purple-100 dark:bg-purple-950/60 border-purple-400 text-purple-800 dark:text-purple-200'
                                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isSubSelected}
                                        onChange={() => {
                                          if (isSubSelected) {
                                            setFormSubcategoriesSupplied(formSubcategoriesSupplied.filter(s => s !== sub.name));
                                          } else {
                                            setFormSubcategoriesSupplied([...formSubcategoriesSupplied, sub.name]);
                                            if (!isCatSelected) {
                                              setFormSupplierCategoryIds([...formSupplierCategoryIds, cat.id]);
                                              if (cat.vehicleType && !formEquipmentTypes.includes(cat.vehicleType)) {
                                                setFormEquipmentTypes([...formEquipmentTypes, cat.vehicleType]);
                                              }
                                            }
                                          }
                                        }}
                                        className="w-3 h-3 rounded text-purple-600 cursor-pointer"
                                      />
                                      <span>{sub.name}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Celular (WhatsApp com DDD)
                  </label>
                  <input
                    type="tel"
                    value={formPhone}
                    onChange={e => setFormPhone(e.target.value)}
                    placeholder="11987654321"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Senha de Acesso (Mín 4 Dígitos)
                  </label>
                  <input
                    type="text"
                    value={formPassword}
                    onChange={e => setFormPassword(e.target.value)}
                    placeholder="1234"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-bold text-purple-600 outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    CPF ou CNPJ
                  </label>
                  <input
                    type="text"
                    value={formDocument}
                    onChange={e => setFormDocument(e.target.value)}
                    placeholder="000.000.000-00"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Foto / Logo (Upload ou URL)
                  </label>
                  <div className="flex items-center gap-1.5">
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
                      className="px-2.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>{formAvatar ? 'Trocar' : 'Arquivo'}</span>
                    </button>
                    <input
                      type="text"
                      placeholder="Ou cole URL da foto"
                      value={formAvatar.startsWith('data:') ? 'Imagem carregada' : formAvatar}
                      onChange={e => setFormAvatar(e.target.value)}
                      className="flex-1 px-2.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Address inputs */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Endereço Completo {formRole === 'fornecedor' ? '(CEP obrigatório p/ Geolocalização)' : ''}
                  </span>
                  {formAddress.coordinates && (
                    <span className="text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded">
                      GPS: {formAddress.coordinates.lat.toFixed(4)}, {formAddress.coordinates.lng.toFixed(4)}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder={formRole === 'fornecedor' ? 'CEP * (00000-000)' : 'CEP'}
                    maxLength={9}
                    value={formAddress.cep}
                    onChange={e => handleAdminCepChange(e.target.value)}
                    required={formRole === 'fornecedor'}
                    className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Cidade"
                    value={formAddress.city}
                    onChange={e => setFormAddress({ ...formAddress, city: e.target.value })}
                    className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs outline-none"
                  />
                  <input
                    type="text"
                    placeholder="UF"
                    maxLength={2}
                    value={formAddress.state}
                    onChange={e => setFormAddress({ ...formAddress, state: e.target.value.toUpperCase() })}
                    className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs uppercase outline-none"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="Rua / Avenida"
                    value={formAddress.street}
                    onChange={e => setFormAddress({ ...formAddress, street: e.target.value })}
                    className="col-span-2 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Nº"
                    value={formAddress.number}
                    onChange={e => setFormAddress({ ...formAddress, number: e.target.value })}
                    className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs outline-none"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    placeholder="Bairro"
                    value={formAddress.neighborhood}
                    onChange={e => setFormAddress({ ...formAddress, neighborhood: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs outline-none"
                  />
                </div>
              </div>

              {/* Documentos em PDF, Imagens, Vídeos, Links, Contratos, Promoções e Recados do Admin */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
                <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border-2 border-amber-300 dark:border-amber-800 space-y-3">
                  <div>
                    <h4 className="text-xs font-black uppercase text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Contratos, PDFs, Imagens, Vídeos, Links e Recados (Admin → Fornecedor)</span>
                    </h4>
                    <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5">
                      Tudo o que você adicionar aqui aparecerá exatamente igual no perfil do fornecedor para visualização e download.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 mb-0.5">
                        Tipo de Conteúdo
                      </label>
                      <select
                        value={matType}
                        onChange={e => {
                          setMatType(e.target.value as UserSharedMaterialType);
                          setMatFile(null);
                          setMatUrl('');
                          setMatError(null);
                        }}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-amber-300 dark:border-amber-800 bg-white dark:bg-slate-900 text-xs font-bold outline-none"
                      >
                        <option value="pdf">Documento PDF (Contrato)</option>
                        <option value="image">Imagem / Arte / Banner</option>
                        <option value="video">Vídeo Informativo</option>
                        <option value="link">Link Externo</option>
                        <option value="text">Texto / Promoção / Recado</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 mb-0.5">
                        Título / Assunto
                      </label>
                      <input
                        type="text"
                        value={matTitle}
                        onChange={e => setMatTitle(e.target.value)}
                        placeholder="Ex: Contrato de Credenciamento 2026, Promoção da Semana..."
                        className="w-full px-2.5 py-1.5 rounded-lg border border-amber-300 dark:border-amber-800 bg-white dark:bg-slate-900 text-xs font-semibold outline-none"
                      />
                    </div>
                  </div>

                  {(matType === 'pdf' || matType === 'image' || matType === 'video') && (
                    <div className="space-y-2">
                      <input
                        ref={matFileInputRef}
                        type="file"
                        accept={
                          matType === 'pdf'
                            ? 'application/pdf,.pdf'
                            : matType === 'image'
                            ? 'image/*'
                            : 'video/*'
                        }
                        onChange={e => {
                          const f = e.target.files?.[0] || null;
                          setMatFile(f);
                          setMatError(null);
                          if (f && !matTitle.trim()) {
                            setMatTitle(f.name.replace(/\.[^.]+$/, ''));
                          }
                        }}
                        className="hidden"
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => matFileInputRef.current?.click()}
                          className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>
                            {matFile
                              ? `${matFile.name} (${(matFile.size / 1024 / 1024).toFixed(2)} MB)`
                              : `Selecionar ${matType === 'pdf' ? 'PDF' : matType === 'image' ? 'Imagem' : 'Vídeo'}`}
                          </span>
                        </button>
                        <input
                          type="text"
                          value={matUrl}
                          onChange={e => setMatUrl(e.target.value)}
                          placeholder={`Ou cole URL direta do ${matType.toUpperCase()}`}
                          className="flex-1 min-w-[160px] px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs outline-none"
                        />
                      </div>
                    </div>
                  )}

                  {matType === 'link' && (
                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 mb-0.5">
                        URL do Link *
                      </label>
                      <input
                        type="url"
                        value={matUrl}
                        onChange={e => setMatUrl(e.target.value)}
                        placeholder="https://..."
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs outline-none"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 mb-0.5">
                      {matType === 'text'
                        ? 'Texto Escrito (Recado / Promoção / Informação exata) *'
                        : 'Texto / Observação Adicional (Opcional)'}
                    </label>
                    <textarea
                      rows={matType === 'text' ? 3 : 2}
                      value={matText}
                      onChange={e => setMatText(e.target.value)}
                      placeholder="Digite exatamente o recado, contrato, instrução ou promoção que o fornecedor verá..."
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs outline-none"
                    />
                  </div>

                  {matError && (
                    <p className="text-[11px] font-bold text-red-600 dark:text-red-400">
                      {matError}
                    </p>
                  )}

                  <button
                    type="button"
                    disabled={matUploading}
                    onClick={async () => {
                      setMatError(null);
                      if (!matTitle.trim() && !matFile && !matText.trim() && !matUrl.trim()) {
                        setMatError('Preencha o título e anexe um arquivo, link ou texto.');
                        return;
                      }
                      if (matType === 'text' && !matText.trim()) {
                        setMatError('Escreva o texto/recado/promoção que deseja enviar.');
                        return;
                      }
                      if (matType === 'link' && !matUrl.trim()) {
                        setMatError('Informe a URL do link.');
                        return;
                      }
                      if ((matType === 'pdf' || matType === 'image' || matType === 'video') && !matFile && !matUrl.trim()) {
                        setMatError('Selecione um arquivo ou informe a URL.');
                        return;
                      }

                      let finalUrl = matUrl.trim() || undefined;
                      let fileName = matFile?.name;
                      let mimeType = matFile?.type;
                      let fileSize: string | undefined;

                      if (matFile) {
                        setMatUploading(true);
                        const upRes = await db.uploadSharedMediaFile(matFile);
                        setMatUploading(false);
                        if (!upRes.ok || !upRes.url) {
                          setMatError(upRes.message || 'Falha no upload do arquivo.');
                          return;
                        }
                        finalUrl = upRes.url;
                        fileName = upRes.fileName || matFile.name;
                        mimeType = upRes.mimeType || matFile.type;
                        const bytes = upRes.sizeBytes || matFile.size;
                        fileSize =
                          bytes >= 1024 * 1024
                            ? `${(bytes / (1024 * 1024)).toFixed(2)} MB`
                            : `${Math.max(1, Math.round(bytes / 1024))} KB`;
                      }

                      const newItem: UserSharedMaterial = {
                        id: `mat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                        type: matType,
                        title: matTitle.trim() || fileName || 'Comunicado do Admin',
                        textContent: matText.trim() || undefined,
                        url: finalUrl,
                        fileName,
                        fileSize,
                        mimeType,
                        createdAt: new Date().toISOString(),
                        addedByAdminId: adminUser.id,
                      };

                      setFormSharedMaterials(prev => [newItem, ...prev]);
                      setMatTitle('');
                      setMatUrl('');
                      setMatText('');
                      setMatFile(null);
                      if (matFileInputRef.current) matFileInputRef.current.value = '';
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer transition"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{matUploading ? 'Enviando arquivo para o servidor...' : 'Adicionar Documento / Mídia / Recado'}</span>
                  </button>

                  {formSharedMaterials.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-amber-200 dark:border-amber-800">
                      <span className="text-[10px] font-black uppercase text-amber-900 dark:text-amber-200 block">
                        Anexos e Recados Vinculados ({formSharedMaterials.length}):
                      </span>
                      {formSharedMaterials.map(item => (
                        <div
                          key={item.id}
                          className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-slate-700 flex items-start justify-between gap-2 text-xs"
                        >
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 text-[9px] font-black uppercase">
                                {item.type}
                              </span>
                              <strong className="text-slate-900 dark:text-white truncate">{item.title}</strong>
                              {item.fileSize && (
                                <span className="text-[10px] text-slate-400 font-mono">{item.fileSize}</span>
                              )}
                            </div>
                            {item.fileName && (
                              <span className="text-[10px] font-mono text-slate-500 block truncate">
                                Arquivo: {item.fileName}
                              </span>
                            )}
                            {item.url && (
                              <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400 block truncate">
                                {item.url.startsWith('data:') ? 'Arquivo anexado localmente' : item.url}
                              </span>
                            )}
                            {item.textContent && (
                              <p className="text-[11px] text-slate-600 dark:text-slate-300 whitespace-pre-wrap line-clamp-2">
                                {item.textContent}
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              void db.deleteSharedMediaFile(item.url);
                              setFormSharedMaterials(prev => prev.filter(m => m.id !== item.id));
                            }}
                            className="p-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 cursor-pointer shrink-0"
                            title="Remover item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {formError && (
                <p className="text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/60 p-2.5 rounded-xl border border-red-200 dark:border-red-900">
                  {formError}
                </p>
              )}

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingUser}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-bold shadow-md cursor-pointer"
                >
                  {isSavingUser ? 'Salvando no servidor...' : editingUser ? 'Salvar Alterações' : 'Cadastrar Usuário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Importação Excel (.xlsx) */}
      {excelImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto space-y-4">
            <button
              type="button"
              onClick={() => setExcelImportModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Importação em Massa via Excel (.xlsx)
                </h3>
                <p className="text-xs text-slate-500">
                  Arquivo: <strong className="font-mono">{excelFileName}</strong> · {excelParsedRows.length} linha(s) lida(s)
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
              <span className="block text-xs font-black text-slate-800 dark:text-slate-200">
                Regra para Cadastros Existentes (Deduplicação por Telefone & CPF/CNPJ):
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <label className={`p-2.5 rounded-xl border-2 cursor-pointer flex items-start gap-2 ${excelImportMode === 'skip_duplicates' ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40' : 'border-slate-200 dark:border-slate-700'}`}>
                  <input
                    type="radio"
                    name="excelImportMode"
                    checked={excelImportMode === 'skip_duplicates'}
                    onChange={() => setExcelImportMode('skip_duplicates')}
                    className="mt-0.5 accent-blue-600"
                  />
                  <div>
                    <strong className="block text-slate-900 dark:text-white">Ignorar duplicados (Recomendado)</strong>
                    <span className="text-[11px] text-slate-500">Insere apenas usuários novos e bloqueia celulares ou CPF/CNPJ repetidos.</span>
                  </div>
                </label>
                <label className={`p-2.5 rounded-xl border-2 cursor-pointer flex items-start gap-2 ${excelImportMode === 'update_existing' ? 'border-amber-600 bg-amber-50/70 dark:bg-amber-950/40' : 'border-slate-200 dark:border-slate-700'}`}>
                  <input
                    type="radio"
                    name="excelImportMode"
                    checked={excelImportMode === 'update_existing'}
                    onChange={() => setExcelImportMode('update_existing')}
                    className="mt-0.5 accent-amber-600"
                  />
                  <div>
                    <strong className="block text-slate-900 dark:text-white">Atualizar existentes sem alterar senhas</strong>
                    <span className="text-[11px] text-slate-500">Atualiza dados cadastrais mantendo a senha original se marcada como ***PROTEGIDA***.</span>
                  </div>
                </label>
              </div>
            </div>

            {excelImportReport ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900">
                    <span className="block text-lg font-black text-emerald-700 dark:text-emerald-300">{excelImportReport.createdCount}</span>
                    <span className="text-[10px] font-bold uppercase text-emerald-600">Criados</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900">
                    <span className="block text-lg font-black text-blue-700 dark:text-blue-300">{excelImportReport.updatedCount}</span>
                    <span className="text-[10px] font-bold uppercase text-blue-600">Atualizados</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900">
                    <span className="block text-lg font-black text-amber-700 dark:text-amber-300">{excelImportReport.skippedDuplicates}</span>
                    <span className="text-[10px] font-bold uppercase text-amber-600">Duplicados Ignorados</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900">
                    <span className="block text-lg font-black text-red-700 dark:text-red-300">{excelImportReport.errors.length}</span>
                    <span className="text-[10px] font-bold uppercase text-red-600">Erros</span>
                  </div>
                </div>

                {excelImportReport.duplicateDetails.length > 0 && (
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 max-h-36 overflow-y-auto space-y-1 text-xs">
                    <strong className="text-amber-800 dark:text-amber-200 block">Registros Duplicados Preservados:</strong>
                    {excelImportReport.duplicateDetails.map((d, i) => (
                      <div key={i} className="text-[11px] text-amber-700 dark:text-amber-300">
                        Linha {d.row} ({d.name || 'Sem nome'} · {d.phone || 'S/ tel'}): {d.reason}
                      </div>
                    ))}
                  </div>
                )}

                {excelImportReport.errors.length > 0 && (
                  <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 max-h-40 overflow-y-auto space-y-1 text-xs">
                    <strong className="text-red-800 dark:text-red-200 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Erros de Validação:
                    </strong>
                    {excelImportReport.errors.map((err, i) => (
                      <div key={i} className="text-[11px] text-red-700 dark:text-red-300">
                        Linha {err.row} ({err.name || 'Sem nome'} · {err.phone || 'S/ tel'}): {err.reason}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 max-h-48 overflow-y-auto text-xs space-y-1">
                <strong className="block text-slate-700 dark:text-slate-300 mb-1">Pré-visualização (primeiras linhas):</strong>
                {excelParsedRows.slice(0, 8).map((r, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 py-1 border-b border-slate-100 dark:border-slate-800 last:border-0 text-[11px]">
                    <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                      L{String(r.rowNumber)}: {String(r.name || '—')}
                    </span>
                    <span className="font-mono text-slate-500">
                      {String(r.phone || '—')} · {String(r.role || 'cliente')}
                    </span>
                  </div>
                ))}
                {excelParsedRows.length > 8 && (
                  <span className="text-[11px] text-slate-400 block pt-1">
                    +{excelParsedRows.length - 8} linha(s) adicional(is)...
                  </span>
                )}
              </div>
            )}

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setExcelImportModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold cursor-pointer"
              >
                {excelImportReport ? 'Fechar' : 'Cancelar'}
              </button>
              {!excelImportReport && (
                <button
                  type="button"
                  disabled={isImportingExcel || excelParsedRows.length === 0}
                  onClick={handleConfirmExcelImport}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-black flex items-center gap-1.5 shadow-md cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>{isImportingExcel ? 'Importando com segurança...' : 'Confirmar Importação no Banco'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
