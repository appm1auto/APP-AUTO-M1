/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Phone,
  Lock,
  UserCheck,
  Store,
  Camera,
  MapPin,
  CheckCircle2,
  ArrowRight,
  ShieldAlert,
  ShieldCheck,
  Eye,
  EyeOff,
  Clock,
  Navigation,
  Loader2,
  Wallet
} from 'lucide-react';
import { auth } from '../../services/auth';
import { db } from '../../services/db';
import { formatBrPhone } from '../../services/phone';
import { getPortalTargetFromLocation } from '../../services/rbac';
import {
  formatCep,
  isValidCep,
  lookupAddressAndGeoByCep,
  getCurrentDeviceCoordinates,
  estimateCoordinatesFromCep,
} from '../../services/geolocation';
import {
  UserRole,
  PersonType,
  DeliveryAddress,
  VehicleCategory,
  PaymentGatewayProvider,
} from '../../types';

interface AuthModalProps {
  targetPortalRole?: UserRole;
  initialTab?: 'login' | 'register';
  onClose: () => void;
  onLoginSuccess: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  targetPortalRole,
  initialTab = 'login',
  onClose,
  onLoginSuccess,
}) => {
  const custom = db.getCustomizationSettings();
  const lockedPortalRole: UserRole = targetPortalRole || getPortalTargetFromLocation();
  const [activePortalRole, setActivePortalRole] = useState<UserRole>(lockedPortalRole);
  const isAdminPortal = activePortalRole === 'admin';
  const [tab, setTab] = useState<'login' | 'register'>(
    lockedPortalRole === 'admin' ? 'login' : initialTab
  );
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPortalMismatchError, setIsPortalMismatchError] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Registration Form State (somente 'cliente' | 'fornecedor')
  const [regRole, setRegRole] = useState<'cliente' | 'fornecedor'>(
    targetPortalRole === 'fornecedor' ? 'fornecedor' : 'cliente'
  );
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [personType, setPersonType] = useState<PersonType>(
    targetPortalRole === 'fornecedor' ? 'PJ' : 'PF'
  );
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPasswordConfirm, setRegPasswordConfirm] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string>('');
  const adminCategories = db.getCategories();
  const [equipmentTypes, setEquipmentTypes] = useState<VehicleCategory[]>(['carro', 'moto']);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(() =>
    adminCategories.filter(c => c.vehicleType === 'carro' || c.vehicleType === 'moto').map(c => c.id)
  );
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([]);

  // Full Address & Geolocation State
  const [address, setAddress] = useState<DeliveryAddress>({
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    cep: '',
    coordinates: undefined,
  });
  const [isLoadingCep, setIsLoadingCep] = useState(false);
  const [cepStatusError, setCepStatusError] = useState<string | null>(null);
  const [geoSourceLabel, setGeoSourceLabel] = useState<string>('');
  const [isLocatingGps, setIsLocatingGps] = useState(false);

  // Gateway & Subconta (Split) State para Fornecedor
  const [gatewayProvider, setGatewayProvider] = useState<PaymentGatewayProvider>('asaas');
  const [gatewayPixKey, setGatewayPixKey] = useState('');
  const [gatewayWalletId, setGatewayWalletId] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [bankAgency, setBankAgency] = useState('');
  const [bankAccount, setBankAccount] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const errorBannerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActivePortalRole(targetPortalRole || getPortalTargetFromLocation());
  }, [targetPortalRole]);

  useEffect(() => {
    if (isAdminPortal && tab !== 'login') {
      setTab('login');
    }
    if (activePortalRole === 'fornecedor') {
      setRegRole('fornecedor');
      setPersonType('PJ');
    } else if (activePortalRole === 'cliente') {
      setRegRole('cliente');
      setPersonType('PF');
    }
  }, [activePortalRole, isAdminPortal, tab]);

  useEffect(() => {
    if (error && errorBannerRef.current) {
      errorBannerRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [error]);

  const formatPhone = (val: string) => formatBrPhone(val);

  const handleCepChange = async (rawVal: string) => {
    const formatted = formatCep(rawVal);
    const clean = formatted.replace(/\D/g, '');
    setCepStatusError(null);
    setAddress(prev => ({ ...prev, cep: formatted }));

    if (clean.length < 8) {
      setGeoSourceLabel('');
      setAddress(prev => ({ ...prev, cep: formatted, coordinates: undefined }));
      if (clean.length > 0 && regRole === 'fornecedor') {
        setCepStatusError('Digite o CEP completo com 8 dígitos para definir sua geolocalização.');
      }
      return;
    }

    setIsLoadingCep(true);
    const result = await lookupAddressAndGeoByCep(formatted);
    setIsLoadingCep(false);

    if (!result.success) {
      setCepStatusError(result.error || 'CEP não encontrado. Verifique e tente novamente.');
      setAddress(prev => ({
        ...prev,
        cep: formatted,
        coordinates: result.coordinates,
      }));
      return;
    }

    setAddress(prev => ({
      ...prev,
      cep: result.cep,
      street: result.street || prev.street,
      neighborhood: result.neighborhood || prev.neighborhood,
      city: result.city || prev.city,
      state: result.state || prev.state,
      coordinates: result.coordinates,
    }));
    setGeoSourceLabel(
      result.source === 'brasilapi'
        ? 'Geolocalização obtida via CEP (BrasilAPI)'
        : result.source === 'nominatim_street' || result.source === 'photon'
        ? 'Geolocalização exata da rua/CEP obtida (OSM)'
        : result.source === 'nominatim_cep' || result.source === 'nominatim_city'
        ? 'Geolocalização obtida via CEP (OSM)'
        : 'Geolocalização calculada pela faixa de CEP'
    );
  };

  const handleUseDeviceGps = async () => {
    setIsLocatingGps(true);
    setCepStatusError(null);
    try {
      const coords = await getCurrentDeviceCoordinates();
      setAddress(prev => ({ ...prev, coordinates: coords }));
      setGeoSourceLabel('GPS do dispositivo confirmado');
    } catch (err: any) {
      setCepStatusError(err?.message || 'Não foi possível obter GPS do dispositivo.');
    } finally {
      setIsLocatingGps(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError('A imagem deve ter no máximo 10MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (!dataUrl) return;

      // Comprime e redimensiona imagem de celular para evitar estourar quota do localStorage/sincronização
      const img = new Image();
      img.onload = () => {
        try {
          const maxDim = 420;
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            setAvatarPreview(canvas.toDataURL('image/jpeg', 0.78));
          } else {
            setAvatarPreview(dataUrl);
          }
        } catch {
          setAvatarPreview(dataUrl);
        }
      };
      img.onerror = () => setAvatarPreview(dataUrl);
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError(null);
    setIsPortalMismatchError(false);
    setSuccessMsg(null);
    setIsSubmitting(true);

    try {
      const res = await auth.loginWithPasswordRemote(phone, password, activePortalRole);
      if (!res.success) {
        setIsPortalMismatchError(
          Boolean(res.portalMismatch || (res.actualRole && res.actualRole !== activePortalRole))
        );
        setError(res.message);
        return;
      }

      setSuccessMsg(res.message);
      setTimeout(() => {
        onLoginSuccess();
        onClose();
      }, 350);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError(null);
    setIsPortalMismatchError(false);
    setSuccessMsg(null);

    if (isAdminPortal) {
      setIsPortalMismatchError(true);
      setError('Contas de Administrador não podem ser criadas via cadastro público.');
      return;
    }

    if (!name.trim() || name.trim().length < 2) {
      setError('Informe seu nome completo ou do responsável.');
      return;
    }

    if (regRole === 'fornecedor' && !companyName.trim()) {
      setError('Informe o nome da loja / Razão Social.');
      return;
    }

    if (!regPhone || regPhone.replace(/\D/g, '').length < 10) {
      setError('Informe um número de celular válido com DDD.');
      return;
    }

    if (!documentNumber || documentNumber.replace(/\D/g, '').length < 11) {
      setError('Informe um CPF ou CNPJ válido.');
      return;
    }

    if (regPassword.trim().length < 4) {
      setError('A senha deve ter no mínimo 4 caracteres.');
      return;
    }

    if (regPassword.trim() !== regPasswordConfirm.trim()) {
      setError('A confirmação da senha não confere com a senha digitada.');
      return;
    }

    if (!isValidCep(address.cep)) {
      setError(
        regRole === 'fornecedor'
          ? 'CEP válido (8 dígitos) é obrigatório no cadastro do Fornecedor para definir a geolocalização e o raio de atuação dos chamados.'
          : 'Informe um CEP válido com 8 dígitos.'
      );
      setCepStatusError('Informe um CEP válido com 8 dígitos.');
      return;
    }

    if (regRole === 'fornecedor' && selectedCategoryIds.length === 0) {
      setError('Selecione ao menos uma categoria de peça ou veículo atendida pela loja.');
      return;
    }

    setIsSubmitting(true);
    try {
      let resolvedCoords = address.coordinates;
      let resolvedCity = address.city.trim();
      let resolvedState = address.state.trim().toUpperCase();
      let resolvedStreet = address.street.trim();
      let resolvedNeighborhood = address.neighborhood.trim();

      if (!resolvedCoords || !resolvedCity || !resolvedState) {
        const geoLookup = await lookupAddressAndGeoByCep(address.cep);
        if (geoLookup.success) {
          resolvedCoords = resolvedCoords || geoLookup.coordinates;
          if (!resolvedCity && geoLookup.city) resolvedCity = geoLookup.city;
          if (!resolvedState && geoLookup.state) resolvedState = geoLookup.state;
          if (!resolvedStreet && geoLookup.street) resolvedStreet = geoLookup.street;
          if (!resolvedNeighborhood && geoLookup.neighborhood) resolvedNeighborhood = geoLookup.neighborhood;
          setAddress(prev => ({
            ...prev,
            city: resolvedCity || prev.city,
            state: resolvedState || prev.state,
            street: resolvedStreet || prev.street,
            neighborhood: resolvedNeighborhood || prev.neighborhood,
            coordinates: resolvedCoords || prev.coordinates,
          }));
        }
      }

      if (!resolvedCity || !resolvedState) {
        setError('Informe a Cidade e o Estado (UF) para concluir seu endereço.');
        return;
      }

      const ensuredAddress: DeliveryAddress = {
        ...address,
        street: resolvedStreet || 'Área Urbana (CEP)',
        number: address.number.trim() || 'S/N',
        neighborhood: resolvedNeighborhood || 'Centro',
        city: resolvedCity,
        state: resolvedState,
        cep: formatCep(address.cep),
        coordinates:
          resolvedCoords ||
          (isValidCep(address.cep) ? estimateCoordinatesFromCep(address.cep, resolvedState) : undefined),
      };

      const selectedCatObjects = adminCategories.filter(c => selectedCategoryIds.includes(c.id));
      const derivedEquipmentTypes = Array.from(
        new Set([
          ...equipmentTypes,
          ...(selectedCatObjects.map(c => c.vehicleType).filter(Boolean) as VehicleCategory[]),
        ])
      );

      const res = await auth.registerWithPasswordRemote({
        name,
        companyName: regRole === 'fornecedor' ? (companyName || name) : undefined,
        phone: regPhone,
        password: regPassword.trim(),
        role: regRole,
        document: documentNumber,
        personType,
        avatarUrl: avatarPreview || undefined,
        address: ensuredAddress,
        supplierCategoryIds: regRole === 'fornecedor' ? selectedCategoryIds : undefined,
        categoriesSupplied:
          regRole === 'fornecedor'
            ? Array.from(new Set([...selectedCatObjects.map(c => c.name), ...selectedSubcategories]))
            : undefined,
        subcategoriesSupplied: regRole === 'fornecedor' ? selectedSubcategories : undefined,
        equipmentTypesSupplied: regRole === 'fornecedor' ? derivedEquipmentTypes : undefined,
        gatewayProvider: regRole === 'fornecedor' ? gatewayProvider : undefined,
        gatewayPixKey: regRole === 'fornecedor' ? gatewayPixKey.trim() || undefined : undefined,
        gatewayWalletId: regRole === 'fornecedor' ? gatewayWalletId.trim() || undefined : undefined,
        gatewayBankInfo:
          regRole === 'fornecedor' && (bankCode.trim() || bankAgency.trim() || bankAccount.trim())
            ? {
                bankCode: bankCode.trim() || undefined,
                agency: bankAgency.trim() || undefined,
                account: bankAccount.trim() || undefined,
                ownerName: companyName.trim() || name.trim(),
              }
            : undefined,
      });

      if (!res.success) {
        setIsPortalMismatchError(Boolean(res.portalMismatch));
        setError(res.message);
        return;
      }

      setSuccessMsg(res.message);
      setTimeout(() => {
        onLoginSuccess();
        onClose();
      }, 650);
    } finally {
      setIsSubmitting(false);
    }
  };

  const portalLabel =
    activePortalRole === 'cliente'
      ? 'Área do Cliente'
      : activePortalRole === 'fornecedor'
      ? 'Portal do Fornecedor'
      : activePortalRole === 'admin'
      ? 'Painel Administrativo Master'
      : 'Acesso Autenticado';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-5 bg-black/75 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-4 sm:p-7 relative max-h-[90dvh] overflow-y-auto overscroll-contain">
        <button
          onClick={onClose}
          className="absolute top-3.5 right-3.5 p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition z-10"
          aria-label="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Branding Title */}
        <div className="text-center pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-center gap-2.5 mb-1">
            {custom.logoUrl !== '' && (
              <img
                src={custom.logoUrl || '/assets/aistudio/M1_AUTO_LOGO_3c381c58.jpg'}
                alt={custom.appName}
                className="h-11 w-auto rounded-lg object-contain bg-slate-900 p-0.5 shadow-sm"
              />
            )}
            <div className="text-left">
              <span className="text-2xl font-black text-slate-900 dark:text-white block leading-none">{custom.appName}</span>
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{custom.appSlogan}</span>
            </div>
          </div>
          <p
            className="text-xs font-bold uppercase tracking-wider mt-1"
            style={{ color: custom.primaryBrandColor || '#2563eb' }}
          >
            {portalLabel} · Celular e Senha
          </p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 font-semibold">
            {custom.headerWebsite || 'www.m1br.com.br'} · {custom.appDomain || 'auto.m1br.com.br'} · WhatsApp: {custom.whatsappNumber || '11 96212-2694'}
          </p>
        </div>

        {/* Security Notice Banner */}
        <div className={`mt-4 p-3 rounded-2xl border text-xs flex items-start gap-2.5 ${
          isAdminPortal
            ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-900 text-purple-900 dark:text-purple-200'
            : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
        }`}>
          {isAdminPortal ? (
            <ShieldCheck className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
          ) : (
            <Lock className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          )}
          <div>
            <strong className="block font-bold">
              {isAdminPortal
                ? 'Acesso Administrativo Restrito (RBAC)'
                : 'Acesso Protegido por Celular e Senha'}
            </strong>
            <span className="text-[11px] opacity-85">
              {isAdminPortal
                ? 'Somente administradores credenciados podem autenticar neste painel. Não há cadastro público para Admin.'
                : activePortalRole === 'fornecedor'
                ? 'Novos fornecedores passam por aprovação e classificação prévia do Administrador antes da liberação do painel.'
                : 'Cada perfil acessa exclusivamente suas próprias funcionalidades e link independente.'}
            </span>
          </div>
        </div>

        {/* Tabs: Entrar vs Criar Cadastro (oculto para Admin) */}
        {!isAdminPortal && (
          <div className="flex items-center gap-2 mt-4 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
            <button
              type="button"
              onClick={() => { setTab('login'); setError(null); setIsPortalMismatchError(false); setSuccessMsg(null); }}
              className={`flex-1 py-2.5 text-xs font-black rounded-xl transition cursor-pointer ${
                tab === 'login'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Entrar com Celular e Senha
            </button>
            <button
              type="button"
              onClick={() => { setTab('register'); setError(null); setIsPortalMismatchError(false); setSuccessMsg(null); }}
              className={`flex-1 py-2.5 text-xs font-black rounded-xl transition cursor-pointer ${
                tab === 'register'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Criar Cadastro Novo
            </button>
          </div>
        )}

        {/* Alert Messages */}
        {error && (
          <div
            ref={errorBannerRef}
            className="mt-3 text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/60 p-3 rounded-xl border border-red-200 dark:border-red-900 space-y-1.5"
          >
            <div className="flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
            {isPortalMismatchError && (
              <p className="text-[11px] font-medium text-red-700/80 dark:text-red-300/80 pl-6">
                Este endereço é exclusivo para <strong>{portalLabel}</strong>. Utilize o link independente correspondente ao seu perfil.
              </p>
            )}
          </div>
        )}

        {successMsg && (
          <div className="mt-3 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 p-3 rounded-xl border border-emerald-200 dark:border-emerald-900 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* TAB 1: LOGIN COM CELULAR E SENHA */}
        {tab === 'login' ? (
          <form onSubmit={handleLoginSubmit} noValidate className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Celular (DDD + Número)
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3.5 sm:top-3" />
                <input
                  type="tel"
                  inputMode="tel"
                  placeholder="(00) 00000-0000"
                  value={phone}
                  onChange={e => setPhone(formatPhone(e.target.value))}
                  autoComplete="tel"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-base sm:text-sm text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-600 outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Senha de Acesso
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[11px] text-blue-600 dark:text-blue-400 font-bold flex items-center gap-1 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  <span>{showPassword ? 'Ocultar' : 'Mostrar'}</span>
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5 sm:top-3" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Digite sua senha"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-base sm:text-sm text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-blue-600 outline-none"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-3.5 rounded-2xl text-white font-black text-sm shadow-lg transition active:scale-98 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 ${
                isAdminPortal
                  ? 'bg-purple-600 hover:bg-purple-700 shadow-purple-500/20'
                  : activePortalRole === 'fornecedor'
                  ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20'
                  : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>VALIDANDO...</span>
                </>
              ) : (
                <>
                  <span>VALIDAR CREDENCIAIS E ENTRAR</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        ) : (
          /* TAB 2: CADASTRO COMPLETO (CLIENTE OU FORNECEDOR) */
          <form onSubmit={handleRegisterSubmit} noValidate className="mt-4 space-y-4">
            {/* Escolha do Perfil (ou bloqueado quando vindo de portal específico) */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                1. Tipo de Conta
              </label>
              {activePortalRole === 'cliente' || activePortalRole === 'fornecedor' ? (
                <div className={`p-3 rounded-2xl border text-xs font-bold flex items-center justify-between ${
                  regRole === 'cliente'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/50 text-blue-800 dark:text-blue-200'
                    : 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200'
                }`}>
                  <span className="flex items-center gap-2">
                    {regRole === 'cliente' ? <UserCheck className="w-4 h-4" /> : <Store className="w-4 h-4" />}
                    <span>{regRole === 'cliente' ? 'Cliente / Motorista' : 'Fornecedor / Loja de Autopeças'}</span>
                  </span>
                  <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-white/80 dark:bg-slate-900/60">
                    {regRole === 'cliente' ? 'Liberação Direta' : 'Aprovação Admin'}
                  </span>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => { setRegRole('cliente'); setPersonType('PF'); }}
                    className={`py-3 px-3 rounded-2xl border text-xs font-black flex items-center justify-center gap-2 transition cursor-pointer ${
                      regRole === 'cliente'
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500/30'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <UserCheck className="w-4 h-4" />
                    <span>Cliente (Liberado)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setRegRole('fornecedor'); setPersonType('PJ'); }}
                    className={`py-3 px-3 rounded-2xl border text-xs font-black flex items-center justify-center gap-2 transition cursor-pointer ${
                      regRole === 'fornecedor'
                        ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/30'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Store className="w-4 h-4" />
                    <span>Fornecedor (Homologação)</span>
                  </button>
                </div>
              )}

              {regRole === 'fornecedor' && (
                <div className="mt-2.5 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-[11px] flex items-start gap-2">
                  <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Aprovação Prévia Obrigatória:</strong> após o cadastro, o Administrador irá avaliar, classificar (1ª/2ª/3ª Opção e raio) e liberar seu painel de fornecedor.
                  </span>
                </div>
              )}

              {/* Categorias e Subcategorias Habilitadas durante o Cadastro do Fornecedor */}
              {regRole === 'fornecedor' && (
                <div className="mt-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase text-slate-700 dark:text-slate-300">
                      Categorias e Subcategorias Atendidas:
                    </span>
                    <span className="text-[10px] text-slate-400">Editável pelo Admin na aprovação</span>
                  </div>
                  <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                    {adminCategories.map(cat => {
                      const isCatSelected = selectedCategoryIds.includes(cat.id);
                      return (
                        <div key={cat.id} className="p-2 rounded-xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isCatSelected}
                              onChange={() => {
                                if (isCatSelected) {
                                  if (selectedCategoryIds.length > 1) {
                                    setSelectedCategoryIds(selectedCategoryIds.filter(id => id !== cat.id));
                                    if (cat.vehicleType) {
                                      setEquipmentTypes(equipmentTypes.filter(t => t !== cat.vehicleType));
                                    }
                                  }
                                } else {
                                  setSelectedCategoryIds([...selectedCategoryIds, cat.id]);
                                  if (cat.vehicleType && !equipmentTypes.includes(cat.vehicleType)) {
                                    setEquipmentTypes([...equipmentTypes, cat.vehicleType]);
                                  }
                                }
                              }}
                              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                            />
                            <span className="text-slate-900 dark:text-white text-xs font-black">{cat.name}</span>
                          </label>

                          {cat.subcategories.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2 pl-6">
                              {cat.subcategories.map(sub => {
                                const isSubSelected = selectedSubcategories.includes(sub.name);
                                return (
                                  <label
                                    key={sub.id}
                                    className={`flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-semibold cursor-pointer transition ${
                                      isSubSelected
                                        ? 'bg-emerald-100 dark:bg-emerald-950/60 border-emerald-400 text-emerald-800 dark:text-emerald-200'
                                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSubSelected}
                                      onChange={() => {
                                        if (isSubSelected) {
                                          setSelectedSubcategories(selectedSubcategories.filter(s => s !== sub.name));
                                        } else {
                                          setSelectedSubcategories([...selectedSubcategories, sub.name]);
                                          if (!isCatSelected) {
                                            setSelectedCategoryIds([...selectedCategoryIds, cat.id]);
                                            if (cat.vehicleType && !equipmentTypes.includes(cat.vehicleType)) {
                                              setEquipmentTypes([...equipmentTypes, cat.vehicleType]);
                                            }
                                          }
                                        }
                                      }}
                                      className="w-3 h-3 rounded text-emerald-600 cursor-pointer"
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
              )}
            </div>

            {/* Foto do Logo / Comércio / Rosto */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                2. Foto de Perfil (Logo, Fachada ou Rosto)
              </label>
              <div className="flex items-center gap-3 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                <div className="w-16 h-16 rounded-2xl overflow-hidden bg-white dark:bg-slate-700 border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center shrink-0">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <Camera className="w-6 h-6 text-slate-400" />
                  )}
                </div>
                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center gap-2">
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
                      className="px-3 py-1.5 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-xs font-bold hover:bg-slate-800 cursor-pointer transition flex items-center gap-1.5"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>{avatarPreview ? 'Trocar Foto' : 'Enviar Foto'}</span>
                    </button>
                    {avatarPreview && (
                      <button
                        type="button"
                        onClick={() => setAvatarPreview('')}
                        className="text-xs text-red-600 hover:underline font-bold cursor-pointer"
                      >
                        Remover
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500">
                    * Visível para outros usuários somente após o orçamento ser aceito.
                  </p>
                </div>
              </div>
            </div>

            {/* Dados Pessoais / Empresariais */}
            <div className="space-y-3">
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                3. Identificação
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Nome Completo {regRole === 'fornecedor' ? 'do Responsável' : ''}
                  </label>
                  <input
                    type="text"
                    placeholder="Nome completo"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-base sm:text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-600 outline-none"
                    required
                  />
                </div>

                {regRole === 'fornecedor' ? (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Nome da Loja / Comércio (Razão Social)
                    </label>
                    <input
                      type="text"
                      placeholder="Nome fantasia ou Razão Social"
                      value={companyName}
                      onChange={e => setCompanyName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-base sm:text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-600 outline-none"
                      required
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Celular (WhatsApp)
                    </label>
                    <input
                      type="tel"
                      inputMode="tel"
                      placeholder="(00) 00000-0000"
                      value={regPhone}
                      onChange={e => setRegPhone(formatPhone(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-base sm:text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-600 outline-none"
                      required
                    />
                  </div>
                )}
              </div>

              {regRole === 'fornecedor' && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Celular Comercial (WhatsApp para Chamados)
                  </label>
                  <input
                    type="tel"
                    inputMode="tel"
                    placeholder="(00) 00000-0000"
                    value={regPhone}
                    onChange={e => setRegPhone(formatPhone(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-base sm:text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-600 outline-none"
                    required
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Tipo de Documento
                  </label>
                  <select
                    value={personType}
                    onChange={e => setPersonType(e.target.value as PersonType)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-base sm:text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-600 outline-none"
                  >
                    <option value="PF">Pessoa Física (CPF)</option>
                    <option value="PJ">Pessoa Jurídica (CNPJ)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    {personType === 'PF' ? 'Número do CPF' : 'Número do CNPJ'}
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder={personType === 'PF' ? '000.000.000-00' : '00.000.000/0001-00'}
                    value={documentNumber}
                    onChange={e => setDocumentNumber(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-base sm:text-xs font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-600 outline-none"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Endereço Completo e Geolocalização Obrigatória via CEP */}
            <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    4. Localização por CEP {regRole === 'fornecedor' ? '(Obrigatório para Raio)' : '& Endereço'}
                  </label>
                </div>
                {regRole === 'fornecedor' && (
                  <button
                    type="button"
                    onClick={handleUseDeviceGps}
                    disabled={isLocatingGps}
                    className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-[10px] font-black flex items-center gap-1 hover:bg-emerald-100 transition cursor-pointer disabled:opacity-50"
                  >
                    <Navigation className="w-3 h-3" />
                    <span>{isLocatingGps ? 'Obtendo GPS...' : 'Refinar com GPS'}</span>
                  </button>
                )}
              </div>

              {regRole === 'fornecedor' && (
                <div className="p-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-[11px] text-emerald-900 dark:text-emerald-200 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <strong className="font-bold">Geolocalização do Estabelecimento:</strong>
                    {address.coordinates ? (
                      <span className="font-mono text-[10px] font-black px-2 py-0.5 rounded bg-emerald-600 text-white">
                        Lat {address.coordinates.lat.toFixed(4)} · Lng {address.coordinates.lng.toFixed(4)}
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300">
                        Informe o CEP para localizar
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] opacity-85">
                    {geoSourceLabel
                      ? `${geoSourceLabel} — define quais chamados chegam dentro do seu raio de atuação.`
                      : 'O CEP é obrigatório para calcular a distância entre sua loja e o CEP de entrega dos clientes.'}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-0.5">
                    CEP {regRole === 'fornecedor' ? '* (Obrigatório)' : '*'}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="00000-000"
                      maxLength={9}
                      value={address.cep}
                      onChange={e => handleCepChange(e.target.value)}
                      className={`w-full px-3 py-2 rounded-xl border bg-white dark:bg-slate-800 text-base sm:text-xs font-mono font-bold text-slate-900 dark:text-white focus:ring-2 outline-none ${
                        cepStatusError
                          ? 'border-red-500 focus:ring-red-500'
                          : isValidCep(address.cep)
                          ? 'border-emerald-500 focus:ring-emerald-500'
                          : 'border-slate-300 dark:border-slate-700 focus:ring-blue-600'
                      }`}
                      required
                    />
                    {isLoadingCep && (
                      <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin absolute right-2.5 top-2.5" />
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-0.5">
                    Cidade *
                  </label>
                  <input
                    type="text"
                    placeholder="Cidade"
                    value={address.city}
                    onChange={e => setAddress({ ...address, city: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-base sm:text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-600 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-0.5">
                    UF *
                  </label>
                  <input
                    type="text"
                    placeholder="SP"
                    maxLength={2}
                    value={address.state}
                    onChange={e => setAddress({ ...address, state: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-base sm:text-xs font-bold uppercase text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-600 outline-none"
                    required
                  />
                </div>
              </div>

              {cepStatusError && (
                <p className="text-[11px] font-bold text-red-600 dark:text-red-400">
                  {cepStatusError}
                </p>
              )}

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <input
                    type="text"
                    placeholder="Logradouro / Rua / Avenida"
                    value={address.street}
                    onChange={e => setAddress({ ...address, street: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-base sm:text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-600 outline-none"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    placeholder="Número"
                    value={address.number}
                    onChange={e => setAddress({ ...address, number: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-base sm:text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-600 outline-none"
                  />
                </div>
              </div>

              <div>
                <input
                  type="text"
                  placeholder="Bairro"
                  value={address.neighborhood}
                  onChange={e => setAddress({ ...address, neighborhood: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-base sm:text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-600 outline-none"
                />
              </div>
            </div>

            {/* Dados de Recebimento & Subconta Gateway (Split) para Fornecedor */}
            {regRole === 'fornecedor' && (
              <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-1.5">
                  <Wallet className="w-4 h-4 text-emerald-600" />
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    5. Conta de Recebimento & Split no Gateway
                  </label>
                </div>
                <p className="text-[11px] text-slate-500">
                  Informe sua chave PIX ou ID da carteira (Asaas / Mercado Pago) para receber automaticamente o saldo líquido das vendas via Split de Pagamento.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-0.5">
                      Gateway Preferencial
                    </label>
                    <select
                      value={gatewayProvider}
                      onChange={e => setGatewayProvider(e.target.value as PaymentGatewayProvider)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white outline-none"
                    >
                      <option value="asaas">Asaas (Subconta / Wallet ID)</option>
                      <option value="mercadopago">Mercado Pago (Collector / PIX)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-0.5">
                      Chave PIX / Conta de Recebimento *
                    </label>
                    <input
                      type="text"
                      placeholder="CNPJ, E-mail, Celular ou Chave Aleatória"
                      value={gatewayPixKey}
                      onChange={e => setGatewayPixKey(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-slate-900 dark:text-white outline-none"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-0.5">
                    Wallet ID / Collector ID (Opcional — gerado automaticamente se vazio)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: wallet_asaas_... ou ID da carteira existente"
                    value={gatewayWalletId}
                    onChange={e => setGatewayWalletId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-slate-900 dark:text-white outline-none"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="Cód. Banco (ex: 341)"
                    value={bankCode}
                    onChange={e => setBankCode(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Agência"
                    value={bankAgency}
                    onChange={e => setBankAgency(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Conta c/ Dígito"
                    value={bankAccount}
                    onChange={e => setBankAccount(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-none"
                  />
                </div>
              </div>
            )}

            {/* Criação da Senha */}
            <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  {regRole === 'fornecedor' ? '6.' : '5.'} Criar Senha de Acesso (Mínimo 4 Caracteres)
                </label>
                <button
                  type="button"
                  onClick={() => setShowRegPassword(!showRegPassword)}
                  className="text-[11px] text-blue-600 dark:text-blue-400 font-bold flex items-center gap-1 cursor-pointer"
                >
                  {showRegPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  <span>{showRegPassword ? 'Ocultar' : 'Mostrar'}</span>
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <input
                    type={showRegPassword ? 'text' : 'password'}
                    placeholder="Senha (mín 4 caracteres)"
                    value={regPassword}
                    onChange={e => setRegPassword(e.target.value)}
                    autoComplete="new-password"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-base sm:text-xs font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-600 outline-none"
                    required
                  />
                </div>
                <div>
                  <input
                    type={showRegPassword ? 'text' : 'password'}
                    placeholder="Confirmar senha"
                    value={regPasswordConfirm}
                    onChange={e => setRegPasswordConfirm(e.target.value)}
                    autoComplete="new-password"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-base sm:text-xs font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-600 outline-none"
                    required
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-3.5 rounded-2xl text-white font-black text-sm shadow-lg transition active:scale-98 flex items-center justify-center gap-2 cursor-pointer mt-2 disabled:opacity-60 ${
                regRole === 'fornecedor'
                  ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20'
                  : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>ENVIANDO CADASTRO...</span>
                </>
              ) : (
                <>
                  <span>
                    {regRole === 'fornecedor'
                      ? 'ENVIAR CADASTRO PARA APROVAÇÃO DO ADMIN'
                      : 'CRIAR CONTA DE CLIENTE E ACESSAR'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
