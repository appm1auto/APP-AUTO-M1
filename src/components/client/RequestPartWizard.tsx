/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Car,
  Bike,
  Truck,
  Tractor,
  Cog,
  HelpCircle,
  BookOpen,
  Hash,
  FileText,
  Camera,
  MapPin,
  Lock,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  X,
  Upload,
  AlertCircle,
  Plus,
  Trash2
} from 'lucide-react';
import {
  VehicleCategory,
  PartIdentificationType,
  DeliveryAddress,
  Vehicle
} from '../../types';
import { db } from '../../services/db';
import { lookupAddressAndGeoByCep, getCurrentDeviceCoordinates } from '../../services/geolocation';

interface ExtraPart {
  id: string;
  partName: string;
  partCategory: string;
  oemCode: string;
  characteristics: string;
  position: string;
  mediaUrls: string[];
}

interface RequestPartWizardProps {
  customerId: string;
  onSuccess: (requestId: string) => void;
  onCancel: () => void;
}

export const RequestPartWizard: React.FC<RequestPartWizardProps> = ({
  customerId,
  onSuccess,
  onCancel,
}) => {
  const custom = db.getCustomizationSettings();
  const cf = custom.clientFields || {};
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  const adminCategories = db.getCategories();
  const initialCategory = adminCategories[0];

  // Step 1: Category & Vehicle Type
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(initialCategory?.id || '');
  const [selectedCategoryName, setSelectedCategoryName] = useState<string>(initialCategory?.name || 'Veículos / Carros');
  const [vehicleType, setVehicleType] = useState<VehicleCategory>(initialCategory?.vehicleType || 'carro');

  // Step 2: Vehicle Data
  const [vehicleBrand, setVehicleBrand] = useState('Volkswagen');
  const [vehicleModel, setVehicleModel] = useState('Gol');
  const [vehicleYear, setVehicleYear] = useState<number>(2021);
  const [vehicleVersion, setVehicleVersion] = useState('1.6 MSI Flex');
  const [vehicleEngine, setVehicleEngine] = useState('1.6 16V');
  const [vehiclePlate, setVehiclePlate] = useState('BRA2E19');
  const [vehicleChassi, setVehicleChassi] = useState('9BWCA45U7MP019284');

  const clientVehicles = db.getVehicles(customerId);

  // Step 3: Part Identification (peça principal)
  const [partIdentificationType, setPartIdentificationType] = useState<PartIdentificationType>('catalog');
  const [partCategory, setPartCategory] = useState(initialCategory?.subcategories[0]?.name || 'Freios');
  const [partName, setPartName] = useState('Par de Discos de Freio Dianteiro Ventilado 256mm');
  const [oemCode, setOemCode] = useState('5Z0615301B');
  const [partCharacteristics, setPartCharacteristics] = useState('Nova Original / 1ª Linha');
  const [partPosition, setPartPosition] = useState('Dianteiro / Ambos os lados');
  const [description, setDescription] = useState('');
  const [mainPhotos, setMainPhotos] = useState<string[]>([]);
  const [uploadingPhotoTarget, setUploadingPhotoTarget] = useState<string | null>(null);
  const [photoUploadError, setPhotoUploadError] = useState<string | null>(null);

  // Lista de peças extras no mesmo pedido
  const [extraParts, setExtraParts] = useState<ExtraPart[]>([]);

  // Step 4: Delivery Location — CEP começa VAZIO e é OBRIGATÓRIO
  const [address, setAddress] = useState<DeliveryAddress>({
    cep: '',
    city: '',
    neighborhood: '',
    street: '',
    number: '',
    complement: '',
    state: '',
    coordinates: undefined,
  });

  const [isLoadingCep, setIsLoadingCep] = useState(false);
  const [isLocatingGps, setIsLocatingGps] = useState(false);
  const [gpsConfirmed, setGpsConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);

  // Valida se o CEP está completo e válido (8 dígitos)
  const isCepValid = (cep: string) => {
    const clean = cep.replace(/\D/g, '');
    return clean.length === 8;
  };

  // Formata o CEP automaticamente: 00000-000
  const formatCep = (value: string) => {
    const clean = value.replace(/\D/g, '').slice(0, 8);
    if (clean.length <= 5) return clean;
    return `${clean.slice(0, 5)}-${clean.slice(5)}`;
  };

  const handleConfirmGps = React.useCallback(async () => {
    setIsLocatingGps(true);
    try {
      const coords = await getCurrentDeviceCoordinates();
      setIsLocatingGps(false);
      setGpsConfirmed(true);
      setAddress(prev => ({ ...prev, coordinates: coords }));
      db.updateUserGpsCoordinates(customerId, coords);
    } catch {
      setIsLocatingGps(false);
    }
  }, [customerId]);

  React.useEffect(() => {
    if (step === 4 && !gpsConfirmed) {
      handleConfirmGps();
    }
  }, [step, gpsConfirmed, handleConfirmGps]);

  const getCategoryIcon = (type?: VehicleCategory) => {
    switch (type) {
      case 'carro':
        return <Car className="w-6 h-6" />;
      case 'moto':
        return <Bike className="w-6 h-6" />;
      case 'caminhao':
        return <Truck className="w-6 h-6" />;
      case 'agricola':
        return <Tractor className="w-6 h-6" />;
      case 'industrial':
        return <Cog className="w-6 h-6" />;
      default:
        return <HelpCircle className="w-6 h-6" />;
    }
  };

  const selectedCategoryObj =
    adminCategories.find(c => c.id === selectedCategoryId) ||
    adminCategories.find(c => c.vehicleType === vehicleType) ||
    adminCategories[0];

  const adminSubcategories = selectedCategoryObj?.subcategories.map(s => s.name) || [];
  const catalog = db.getCatalog();
  const catalogCategories = Array.from(
    new Set([
      ...adminSubcategories,
      ...(adminSubcategories.length === 0 ? catalog.map(c => c.category) : []),
    ])
  );

  const handleSelectAdminCategory = (catId: string) => {
    const cat = adminCategories.find(c => c.id === catId);
    if (!cat) return;
    setSelectedCategoryId(cat.id);
    setSelectedCategoryName(cat.name);
    setVehicleType(cat.vehicleType || 'outros');
    if (cat.subcategories.length > 0) {
      setPartCategory(cat.subcategories[0].name);
    }
  };

  const handleSelectSavedVehicle = (v: Vehicle) => {
    setVehicleType(v.type);
    const matchingCat = adminCategories.find(c => c.vehicleType === v.type);
    if (matchingCat) {
      setSelectedCategoryId(matchingCat.id);
      setSelectedCategoryName(matchingCat.name);
      if (matchingCat.subcategories.length > 0) {
        setPartCategory(matchingCat.subcategories[0].name);
      }
    }
    setVehicleBrand(v.brand);
    setVehicleModel(v.model);
    setVehicleYear(v.year);
    setVehicleVersion(v.version || '');
    setVehicleEngine(v.engine || '');
    setVehiclePlate(v.plate || '');
    setVehicleChassi(v.chassi || '');
  };

  // Busca CEP em tempo real
  const handleCepLookup = async (rawValue: string) => {
    const formatted = formatCep(rawValue);
    const clean = formatted.replace(/\D/g, '');

    setAddress(prev => ({ ...prev, cep: formatted }));
    setCepError(null);

    // Limpa os campos de endereço enquanto digita (se o CEP ainda não estiver completo)
    if (clean.length < 8) {
      setAddress(prev => ({
        ...prev,
        cep: formatted,
        city: '',
        neighborhood: '',
        street: '',
        state: '',
        coordinates: gpsConfirmed ? prev.coordinates : undefined,
      }));
      if (clean.length > 0) {
        setCepError('Digite o CEP completo (8 dígitos).');
      } else {
        setCepError('CEP é obrigatório para localizar fornecedores no raio e definir o local de entrega.');
      }
      return;
    }

    // CEP completo → busca endereço + geolocalização em tempo real
    if (clean.length === 8) {
      setIsLoadingCep(true);
      setAddress(prev => ({
        ...prev,
        coordinates: gpsConfirmed ? prev.coordinates : undefined,
      }));
      try {
        const geoRes = await lookupAddressAndGeoByCep(formatted);
        if (geoRes.success) {
          setAddress(prev => ({
            ...prev,
            cep: geoRes.cep,
            city: geoRes.city || '',
            neighborhood: geoRes.neighborhood || '',
            street: geoRes.street || '',
            state: geoRes.state || '',
            coordinates: gpsConfirmed && prev.coordinates ? prev.coordinates : geoRes.coordinates,
          }));
          setCepError(null);
        } else {
          setAddress(prev => ({
            ...prev,
            cep: formatted,
            city: '',
            neighborhood: '',
            street: '',
            state: '',
            coordinates: gpsConfirmed ? prev.coordinates : undefined,
          }));
          setCepError(geoRes.error || 'CEP não encontrado. Verifique e tente novamente.');
        }
      } catch {
        setCepError('Erro ao consultar CEP. Tente novamente.');
      } finally {
        setIsLoadingCep(false);
      }
    }
  };

  // Helper de upload rápido de múltiplas fotos com compressão
  const processSelectedImages = async (files: FileList | null, target: 'main' | string) => {
    if (!files || files.length === 0) return;
    setPhotoUploadError(null);
    setUploadingPhotoTarget(target);
    try {
      const currentCount =
        target === 'main'
          ? mainPhotos.length
          : (extraParts.find(p => p.id === target)?.mediaUrls.length || 0);
      const maxAllowed = target === 'main' ? 5 : 3;
      const availableSlots = Math.max(0, maxAllowed - currentCount);
      if (availableSlots <= 0) {
        setPhotoUploadError(
          target === 'main'
            ? 'Limite máximo de 5 fotos atingido na peça principal.'
            : 'Limite máximo de 3 fotos atingido para esta peça adicional.'
        );
        return;
      }

      const selectedFiles = Array.from(files).slice(0, availableSlots);
      const uploadedUrls: string[] = [];

      for (const file of selectedFiles) {
        const res = await db.compressAndUploadImageFile(file, 1280, 0.82);
        if (res.ok && res.url) {
          uploadedUrls.push(res.url);
        } else {
          // Fallback em Data URL caso upload falhe momentaneamente
          const dataUrl = await new Promise<string | null>(resolve => {
            const reader = new FileReader();
            reader.onload = ev => resolve(typeof ev.target?.result === 'string' ? ev.target.result : null);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(file);
          });
          if (dataUrl) uploadedUrls.push(dataUrl);
        }
      }

      if (uploadedUrls.length > 0) {
        if (target === 'main') {
          setMainPhotos(prev => [...prev, ...uploadedUrls].slice(0, 5));
        } else {
          setExtraParts(prev =>
            prev.map(p =>
              p.id === target
                ? { ...p, mediaUrls: [...(p.mediaUrls || []), ...uploadedUrls].slice(0, 3) }
                : p
            )
          );
        }
      }
      if (files.length > availableSlots) {
        setPhotoUploadError(`Apenas ${availableSlots} foto(s) adicionada(s) para respeitar o limite de ${maxAllowed}.`);
      }
    } finally {
      setUploadingPhotoTarget(null);
    }
  };

  // Adiciona peça extra
  const handleAddExtraPart = () => {
    const newPart: ExtraPart = {
      id: `extra-${Date.now()}`,
      partName: '',
      partCategory: partCategory,
      oemCode: '',
      characteristics: 'Nova Original / 1ª Linha',
      position: 'Dianteiro / Ambos os lados',
      mediaUrls: [],
    };
    setExtraParts(prev => [...prev, newPart]);
  };

  // Remove peça extra
  const handleRemoveExtraPart = (id: string) => {
    setExtraParts(prev => prev.filter(p => p.id !== id));
  };

  // Atualiza campo de peça extra
  const handleUpdateExtraPart = (id: string, field: keyof ExtraPart, value: string) => {
    setExtraParts(prev =>
      prev.map(p => (p.id === id ? { ...p, [field]: value } : p))
    );
  };

  const handleSubmitRequest = async () => {
    // ===== VALIDAÇÃO OBRIGATÓRIA DO CEP =====
    if (!isCepValid(address.cep)) {
      setCepError('CEP é obrigatório. Informe um CEP válido para que os fornecedores possam atender pelo raio e para definir o local de entrega.');
      return;
    }

    if (!address.city || !address.neighborhood) {
      setCepError('Complete o endereço. Use o CEP para preencher automaticamente cidade e bairro.');
      return;
    }

    setSubmitting(true);

    let resolvedCoordinates = address.coordinates;
    if (!resolvedCoordinates) {
      try {
        const geoRes = await lookupAddressAndGeoByCep(address.cep);
        resolvedCoordinates = geoRes.coordinates;
      } catch {
        // db.createPartRequest também resolve coordenadas regionais pelo CEP
      }
    }

    const effectiveCategoryName = selectedCategoryObj?.name || selectedCategoryName;

    // Monta descrição com todas as peças
    const partsList = [
      `1. ${partName} | Categoria: ${effectiveCategoryName} (${partCategory}) | OEM: ${oemCode || 'N/A'} | ${partCharacteristics} | ${partPosition}`,
      ...extraParts.map((p, idx) =>
        `${idx + 2}. ${p.partName || 'Peça sem nome'} | Categoria: ${effectiveCategoryName} (${p.partCategory}) | OEM: ${p.oemCode || 'N/A'} | ${p.characteristics} | ${p.position}`
      ),
    ].join('\n');

    const fullDescription = [
      `Categoria: ${effectiveCategoryName} · Subcategoria: ${partCategory}`,
      `=== PEÇAS SOLICITADAS NESTE PEDIDO (${1 + extraParts.length}) ===`,
      partsList,
      description ? `\nObservações do cliente: ${description}` : '',
    ].filter(Boolean).join('\n');

    try {
      const primaryMedia = mainPhotos[0] || undefined;
      const newReq = await db.createPartRequestRemote(customerId, {
        vehicleType,
        vehicleBrand,
        vehicleModel,
        vehicleYear,
        vehicleEngine,
        vehiclePlate,
        vehicleChassi,
        partIdentificationType,
        partName: extraParts.length > 0
          ? `${partName} + ${extraParts.length} peça(s) adicional(is)`
          : partName || 'Peça Automotiva Solicitada',
        partCategory,
        categoryId: selectedCategoryObj?.id || selectedCategoryId || undefined,
        categoryName: effectiveCategoryName,
        partSubcategory: partCategory,
        oemCode: oemCode || undefined,
        description: fullDescription || undefined,
        mediaUrl: primaryMedia,
        mediaUrls: mainPhotos,
        mediaType: mainPhotos.length > 0 ? 'photo' : undefined,
        extraParts: extraParts.map(ep => ({
          id: ep.id,
          partName: ep.partName || 'Peça adicional',
          partCategory: ep.partCategory,
          oemCode: ep.oemCode || undefined,
          characteristics: ep.characteristics,
          position: ep.position,
          mediaUrls: (ep.mediaUrls || []).slice(0, 3),
        })),
        clientGpsVerified: gpsConfirmed,
        deliveryAddress: {
          ...address,
          coordinates: resolvedCoordinates || undefined,
        },
      });

      onSuccess(newReq.id);
    } finally {
      setSubmitting(false);
    }
  };

  // Só permite enviar se CEP + cidade + bairro estiverem preenchidos
  const canSubmit = isCepValid(address.cep) && !!address.city && !!address.neighborhood;

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden transition-all">
      {/* Wizard Header */}
      <div className="bg-slate-900 text-white p-5 sm:p-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-blue-400">
              SOLICITAR COTAÇÃO DE PEÇA · AUTO SHOP
            </span>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs text-slate-400">Etapa {step} de 4</span>
          </div>
          <h2 className="text-lg sm:text-xl font-black mt-1">
            {step === 1 && '1. Selecione o Tipo de Veículo'}
            {step === 2 && '2. Dados do Veículo'}
            {step === 3 && '3. Identificação da Peça'}
            {step === 4 && '4. Local de Entrega e Confirmação'}
          </h2>
        </div>
        <button
          onClick={onCancel}
          className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Progress Bar */}
      <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800">
        <div
          className="h-full bg-blue-600 transition-all duration-300"
          style={{ width: `${(step / 4) * 100}%` }}
        />
      </div>

      {/* Wizard Body */}
      <div className="p-5 sm:p-7">
        {/* STEP 1 */}
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
              Escolha a categoria do veículo para direcionarmos aos fornecedores especializados:
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {adminCategories.map(cat => {
                const isSelected = selectedCategoryObj?.id === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleSelectAdminCategory(cat.id)}
                    className={`p-4 rounded-xl border text-left flex flex-col items-center justify-center gap-2 transition active:scale-95 cursor-pointer ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 ring-2 ring-blue-600/20'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300 bg-slate-50/50 dark:bg-slate-800/40'
                    }`}
                  >
                    <div className={`p-3 rounded-full ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                      {getCategoryIcon(cat.vehicleType)}
                    </div>
                    <span className="text-xs font-bold text-center">{cat.name}</span>
                    {cat.subcategories.length > 0 && (
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 text-center line-clamp-1">
                        {cat.subcategories.slice(0, 3).map(s => s.name).join(', ')}
                        {cat.subcategories.length > 3 ? '...' : ''}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {clientVehicles.length > 0 && (
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-2">
                  Ou selecione da sua garagem cadastrada:
                </span>
                <div className="flex flex-wrap gap-2">
                  {clientVehicles.map(v => (
                    <button
                      key={v.id}
                      onClick={() => {
                        handleSelectSavedVehicle(v);
                        setStep(2);
                      }}
                      className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:border-blue-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold transition"
                    >
                      {v.brand} {v.model} ({v.year})
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
              Informe os dados técnicos para garantir 100% de compatibilidade da peça:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(cf.vehicleBrand?.visible ?? true) && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {cf.vehicleBrand?.label || 'Marca *'}
                  </label>
                  <input
                    type="text"
                    value={vehicleBrand}
                    placeholder={cf.vehicleBrand?.placeholder || ''}
                    onChange={e => setVehicleBrand(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-600"
                    required
                  />
                </div>
              )}
              {(cf.vehicleModel?.visible ?? true) && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {cf.vehicleModel?.label || 'Modelo *'}
                  </label>
                  <input
                    type="text"
                    value={vehicleModel}
                    placeholder={cf.vehicleModel?.placeholder || ''}
                    onChange={e => setVehicleModel(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-600"
                    required
                  />
                </div>
              )}
              {(cf.vehicleYear?.visible ?? true) && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {cf.vehicleYear?.label || 'Ano *'}
                  </label>
                  <input
                    type="number"
                    value={vehicleYear}
                    placeholder={cf.vehicleYear?.placeholder || ''}
                    onChange={e => setVehicleYear(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-600"
                    required
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(cf.vehicleEngine?.visible ?? true) && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {cf.vehicleEngine?.label || 'Versão e Motorização'}
                  </label>
                  <input
                    type="text"
                    value={vehicleEngine}
                    placeholder={cf.vehicleEngine?.placeholder || ''}
                    onChange={e => setVehicleEngine(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              )}
              {(cf.vehiclePlate?.visible ?? true) && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {cf.vehiclePlate?.label || 'Placa (Opcional)'}
                  </label>
                  <input
                    type="text"
                    value={vehiclePlate}
                    placeholder={cf.vehiclePlate?.placeholder || ''}
                    onChange={e => setVehiclePlate(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 text-sm font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-600 uppercase"
                  />
                </div>
              )}
            </div>

            {(cf.vehicleChassi?.visible ?? true) && (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {cf.vehicleChassi?.label || 'Número do Chassi (Recomendado)'}
                </label>
                <input
                  type="text"
                  value={vehicleChassi}
                  placeholder={cf.vehicleChassi?.placeholder || ''}
                  onChange={e => setVehicleChassi(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 text-sm font-mono tracking-wider rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-600 uppercase"
                />
              </div>
            )}
          </div>
        )}

        {/* STEP 3 - COM BOTÃO + ADICIONAR MAIS PEÇAS */}
        {step === 3 && (
          <div className="space-y-4">
            <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
              Identifique a peça principal e, se necessário, adicione mais peças no mesmo pedido:
            </p>

            {/* Métodos de identificação */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                { type: 'catalog' as PartIdentificationType, icon: <BookOpen className="w-5 h-5" />, title: '1. Catálogo', desc: 'Pesquisar na lista' },
                { type: 'oem' as PartIdentificationType, icon: <Hash className="w-5 h-5" />, title: '2. Código OEM', desc: 'Código gravado' },
                { type: 'description' as PartIdentificationType, icon: <FileText className="w-5 h-5" />, title: '3. Descrição', desc: 'Escreva livremente' },
                { type: 'media' as PartIdentificationType, icon: <Camera className="w-5 h-5" />, title: '4. Foto/Vídeo', desc: 'Tirar foto da peça' },
              ].map(item => (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => setPartIdentificationType(item.type)}
                  className={`p-3.5 rounded-xl border-2 text-left flex flex-col gap-2 transition cursor-pointer ${
                    partIdentificationType === item.type
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500/30 shadow-sm font-bold'
                      : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 bg-slate-50/50 dark:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    {item.icon}
                    {partIdentificationType === item.type && <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />}
                  </div>
                  <span className="text-xs font-black">{item.title}</span>
                  <span className="text-[10px] text-slate-500 font-normal">{item.desc}</span>
                </button>
              ))}
            </div>

            {/* Peça Principal */}
            <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
                <span className="text-xs font-black uppercase text-blue-600 dark:text-blue-400 tracking-wider">
                  Peça Principal
                </span>
              </div>

              {(cf.partName?.visible ?? true) && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {cf.partName?.label || 'Nome da Peça *'}
                  </label>
                  <input
                    type="text"
                    value={partName}
                    placeholder={cf.partName?.placeholder || ''}
                    onChange={e => setPartName(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-600 font-semibold"
                    required
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(cf.oemCode?.visible ?? true) && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {cf.oemCode?.label || 'Código OEM'}
                    </label>
                    <input
                      type="text"
                      value={oemCode}
                      placeholder={cf.oemCode?.placeholder || ''}
                      onChange={e => setOemCode(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                )}
                {(cf.partCategory?.visible ?? true) && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {cf.partCategory?.label || `Subcategoria (${selectedCategoryObj?.name || 'Geral'}) *`}
                    </label>
                    <select
                      value={partCategory}
                      onChange={e => setPartCategory(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-600"
                    >
                      {catalogCategories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                      <option value="Outros / Não sei informar">Outros / Não sei informar</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(cf.partCharacteristics?.visible ?? true) && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {cf.partCharacteristics?.label || 'Características'}
                    </label>
                    <select
                      value={partCharacteristics}
                      onChange={e => setPartCharacteristics(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-600"
                    >
                      <option value="Nova Original / 1ª Linha">Nova Original / 1ª Linha</option>
                      <option value="Seminova / Usada com Garantia">Seminova / Usada com Garantia</option>
                      <option value="Recondicionada Certificada">Recondicionada Certificada</option>
                      <option value="Qualquer condição com garantia">Qualquer condição (Menor Preço)</option>
                    </select>
                  </div>
                )}
                {(cf.partPosition?.visible ?? true) && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {cf.partPosition?.label || 'Posição no Veículo'}
                    </label>
                    <select
                      value={partPosition}
                      onChange={e => setPartPosition(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-600"
                    >
                      <option value="Dianteiro / Ambos os lados">Dianteiro (Par)</option>
                      <option value="Dianteiro Lado Direito (Passageiro)">Dianteiro Direito</option>
                      <option value="Dianteiro Lado Esquerdo (Motorista)">Dianteiro Esquerdo</option>
                      <option value="Traseiro / Ambos os lados">Traseiro (Par)</option>
                      <option value="Traseiro Lado Direito (Passageiro)">Traseiro Direito</option>
                      <option value="Traseiro Lado Esquerdo (Motorista)">Traseiro Esquerdo</option>
                      <option value="Central / Motor / Câmbio / Geral">Central / Motor / Geral</option>
                    </select>
                  </div>
                )}
              </div>

              {(cf.description?.visible ?? true) && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {cf.description?.label || 'Observações'}
                  </label>
                  <textarea
                    rows={2}
                    value={description}
                    placeholder={cf.description?.placeholder || ''}
                    onChange={e => setDescription(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              )}

              {/* Upload de até 5 fotos da peça principal */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-700 space-y-2.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-blue-600" />
                    <span>Fotos da Peça Principal (até 5 fotos)</span>
                  </label>
                  <span className={`text-[11px] font-black px-2 py-0.5 rounded-md ${
                    mainPhotos.length >= 5
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                  }`}>
                    {mainPhotos.length} / 5 fotos
                  </span>
                </div>

                {photoUploadError && (
                  <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                    {photoUploadError}
                  </p>
                )}

                {mainPhotos.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {mainPhotos.map((url, idx) => (
                      <div key={`${url.slice(0, 24)}-${idx}`} className="relative aspect-square rounded-xl overflow-hidden border-2 border-slate-300 dark:border-slate-700 bg-slate-950 group">
                        <img src={url} alt={`Peça principal ${idx + 1}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/75 text-white text-[9px] font-bold">
                          #{idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => setMainPhotos(prev => prev.filter((_, i) => i !== idx))}
                          className="absolute top-1 right-1 p-1 rounded-full bg-red-600 text-white hover:bg-red-700 shadow cursor-pointer"
                          title="Remover foto"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {mainPhotos.length < 5 && (
                  <div className="flex flex-wrap gap-2">
                    <label className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer">
                      <Camera className="w-3.5 h-3.5" />
                      <span>{uploadingPhotoTarget === 'main' ? 'Enviando...' : 'Tirar Foto'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        disabled={uploadingPhotoTarget === 'main'}
                        onChange={e => {
                          void processSelectedImages(e.target.files, 'main');
                          e.target.value = '';
                        }}
                      />
                    </label>
                    <label className="px-3.5 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{uploadingPhotoTarget === 'main' ? 'Enviando...' : `Anexar até ${5 - mainPhotos.length} foto(s)`}</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        disabled={uploadingPhotoTarget === 'main'}
                        onChange={e => {
                          void processSelectedImages(e.target.files, 'main');
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                )}
              </div>
            </div>

            {/* LISTA DE PEÇAS EXTRAS */}
            {extraParts.map((part, index) => (
              <div key={part.id} className="p-4 rounded-2xl border-2 border-dashed border-orange-300 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase text-orange-600 dark:text-orange-400">
                    Peça Extra #{index + 2}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveExtraPart(part.id)}
                    className="p-1.5 rounded-lg text-red-600 hover:bg-red-100 dark:hover:bg-red-950 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Nome da Peça *</label>
                  <input
                    type="text"
                    value={part.partName}
                    onChange={e => handleUpdateExtraPart(part.id, 'partName', e.target.value)}
                    placeholder="Ex: Pastilha de Freio Dianteira"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Código OEM</label>
                    <input
                      type="text"
                      value={part.oemCode}
                      onChange={e => handleUpdateExtraPart(part.id, 'oemCode', e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Subcategoria ({selectedCategoryObj?.name || 'Geral'})
                    </label>
                    <select
                      value={part.partCategory}
                      onChange={e => handleUpdateExtraPart(part.id, 'partCategory', e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                    >
                      {catalogCategories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                      <option value="Outros / Não sei informar">Outros / Não sei informar</option>
                    </select>
                  </div>
                </div>

                {/* Upload de até 3 fotos por peça extra */}
                <div className="pt-2 border-t border-orange-200 dark:border-orange-900/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Camera className="w-3.5 h-3.5 text-orange-600" />
                      <span>Fotos desta peça (até 3 fotos)</span>
                    </label>
                    <span className="text-[11px] font-black px-2 py-0.5 rounded-md bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300">
                      {(part.mediaUrls || []).length} / 3 fotos
                    </span>
                  </div>

                  {(part.mediaUrls || []).length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {(part.mediaUrls || []).map((url, photoIdx) => (
                        <div key={`${part.id}-${photoIdx}`} className="relative aspect-square rounded-xl overflow-hidden border border-orange-300 dark:border-orange-800 bg-slate-950">
                          <img src={url} alt={`${part.partName || 'Peça extra'} ${photoIdx + 1}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          <button
                            type="button"
                            onClick={() =>
                              setExtraParts(prev =>
                                prev.map(p =>
                                  p.id === part.id
                                    ? { ...p, mediaUrls: (p.mediaUrls || []).filter((_, i) => i !== photoIdx) }
                                    : p
                                )
                              )
                            }
                            className="absolute top-1 right-1 p-1 rounded-full bg-red-600 text-white hover:bg-red-700 shadow cursor-pointer"
                            title="Remover foto"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {(part.mediaUrls || []).length < 3 && (
                    <div className="flex flex-wrap gap-2">
                      <label className="px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer">
                        <Camera className="w-3.5 h-3.5" />
                        <span>{uploadingPhotoTarget === part.id ? 'Enviando...' : 'Tirar Foto'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          disabled={uploadingPhotoTarget === part.id}
                          onChange={e => {
                            void processSelectedImages(e.target.files, part.id);
                            e.target.value = '';
                          }}
                        />
                      </label>
                      <label className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-orange-300 dark:border-orange-800 text-orange-700 dark:text-orange-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer">
                        <Upload className="w-3.5 h-3.5" />
                        <span>{uploadingPhotoTarget === part.id ? 'Enviando...' : `Anexar até ${3 - (part.mediaUrls || []).length} foto(s)`}</span>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          disabled={uploadingPhotoTarget === part.id}
                          onChange={e => {
                            void processSelectedImages(e.target.files, part.id);
                            e.target.value = '';
                          }}
                        />
                      </label>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* BOTÃO + ADICIONAR MAIS PEÇAS */}
            <button
              type="button"
              onClick={handleAddExtraPart}
              className="w-full py-3.5 rounded-2xl border-2 border-dashed border-blue-400 dark:border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 font-black text-sm flex items-center justify-center gap-2 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition active:scale-98"
            >
              <Plus className="w-5 h-5" />
              <span>+ Adicionar mais peças neste pedido</span>
            </button>

            {extraParts.length > 0 && (
              <p className="text-[11px] text-slate-500 text-center">
                Total de peças neste pedido: <strong>{1 + extraParts.length}</strong>. O fornecedor verá a lista completa e poderá cotar cada uma.
              </p>
            )}
          </div>
        )}

        {/* STEP 4 */}
        {step === 4 && (
          <div className="space-y-4">
            {/* Aviso de privacidade */}
            <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 flex items-start gap-3">
              <Lock className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div className="text-xs">
                <strong className="text-blue-900 dark:text-blue-200 block font-bold mb-0.5">
                  Regra Crítica de Privacidade da AUTO SHOP:
                </strong>
                <p className="text-blue-800 dark:text-blue-300">
                  Antes do pagamento, o fornecedor visualiza <strong>apenas a distância real em km</strong> calculada entre o CEP/GPS da loja e o seu local de entrega. CEP, rua, número e seus dados pessoais permanecem ocultos até a confirmação do pagamento.
                </p>
              </div>
            </div>

            {/* Aviso de CEP obrigatório */}
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs">
                <strong className="text-amber-900 dark:text-amber-200 block font-bold mb-0.5">
                  CEP obrigatório
                </strong>
                <p className="text-amber-800 dark:text-amber-300">
                  O CEP e o GPS ativo do app garantem precisão real em km para o cálculo do frete e para definir o local exato de entrega após o pagamento.
                </p>
              </div>
            </div>

            {/* GPS */}
            <div className="p-3.5 rounded-2xl border border-blue-200 dark:border-blue-900 bg-blue-50/70 dark:bg-blue-950/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-xl text-white flex items-center justify-center shrink-0 ${gpsConfirmed ? 'bg-emerald-600' : 'bg-blue-600'}`}>
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-black text-slate-900 dark:text-white block">
                    Geolocalização (GPS Ativo no App)
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {gpsConfirmed && address.coordinates
                      ? `✓ GPS verificado (Lat: ${address.coordinates.lat.toFixed(4)}, Lng: ${address.coordinates.lng.toFixed(4)})`
                      : address.coordinates
                      ? `Localização via CEP (Lat: ${address.coordinates.lat.toFixed(4)}, Lng: ${address.coordinates.lng.toFixed(4)})`
                      : 'Ative o GPS ou informe seu CEP para precisão real em km'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleConfirmGps}
                disabled={isLocatingGps}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>{isLocatingGps ? 'Obtendo GPS...' : gpsConfirmed ? 'Atualizar GPS' : 'Confirmar por GPS'}</span>
              </button>
            </div>

            {/* Campos de endereço */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  CEP * <span className="text-red-500">(obrigatório)</span>
                </label>
                <input
                  type="text"
                  value={address.cep}
                  onChange={e => handleCepLookup(e.target.value)}
                  placeholder="00000-000"
                  maxLength={9}
                  className={`w-full px-3 py-2 text-sm font-mono rounded-xl border bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-600 ${
                    cepError
                      ? 'border-red-500 focus:ring-red-500'
                      : isCepValid(address.cep)
                      ? 'border-green-500 focus:ring-green-500'
                      : 'border-slate-300 dark:border-slate-700'
                  }`}
                  required
                />
                {isLoadingCep && (
                  <p className="text-[11px] text-blue-600 mt-1">Buscando endereço em tempo real...</p>
                )}
                {cepError && (
                  <p className="text-[11px] text-red-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {cepError}
                  </p>
                )}
                {!cepError && isCepValid(address.cep) && address.street && (
                  <p className="text-[11px] text-green-600 mt-1">
                    ✓ Endereço encontrado
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Cidade *</label>
                <input
                  type="text"
                  value={address.city}
                  onChange={e => setAddress(prev => ({ ...prev, city: e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-600"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Bairro *</label>
                <input
                  type="text"
                  value={address.neighborhood}
                  onChange={e => setAddress(prev => ({ ...prev, neighborhood: e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-600"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Rua (Privado até o pagamento)
                </label>
                <input
                  type="text"
                  value={address.street}
                  onChange={e => setAddress(prev => ({ ...prev, street: e.target.value }))}
                  placeholder="Preenchido automaticamente pelo CEP"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Número</label>
                <input
                  type="text"
                  value={address.number}
                  onChange={e => setAddress(prev => ({ ...prev, number: e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Complemento</label>
              <input
                type="text"
                value={address.complement || ''}
                onChange={e => setAddress(prev => ({ ...prev, complement: e.target.value }))}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>
        )}

        {/* Controles do Wizard */}
        <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep(prev => (prev - 1) as any)}
              className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 flex items-center gap-1.5 transition"
            >
              <ArrowLeft className="w-4 h-4" /> Voltar
            </button>
          ) : (
            <div />
          )}

          {step < 4 ? (
            <button
              type="button"
              onClick={() => setStep(prev => (prev + 1) as any)}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md flex items-center gap-2 transition active:scale-95"
            >
              <span>Avançar</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={submitting || isLoadingCep || !canSubmit}
              onClick={handleSubmitRequest}
              className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-black shadow-lg shadow-blue-600/30 flex items-center gap-2 transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle className="w-4 h-4" />
              <span>
                {submitting
                  ? 'Disparando Cotação...'
                  : isLoadingCep
                  ? 'Localizando CEP...'
                  : !canSubmit
                  ? 'Informe o CEP para continuar'
                  : 'DISPARAR COTAÇÃO'}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};