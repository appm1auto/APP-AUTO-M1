/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Wallet,
  Split,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  Search,
  Code2,
  X,
  Building2,
  ArrowUpRight,
  ShieldCheck,
  Banknote,
  RotateCcw,
  KeyRound,
  Save
} from 'lucide-react';
import { db } from '../../services/db';
import { apiUrl } from '../../services/apiBase';
import type { GatewayConfigStatus } from '../../services/paymentGateway';
import type {
  User,
  SplitTransaction,
  SplitPaymentStatus,
  PaymentGatewayProvider,
} from '../../types';

interface SplitManagementTabProps {
  currentUser: User;
}

interface SubaccountDraft {
  provider: PaymentGatewayProvider;
  pixKey: string;
  walletId: string;
  bankCode: string;
  agency: string;
  account: string;
}

const SPLIT_STATUS_META: Record<
  SplitPaymentStatus,
  { label: string; badgeClass: string }
> = {
  pendente: {
    label: 'Pendente',
    badgeClass: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700',
  },
  processando: {
    label: 'Processando Split',
    badgeClass: 'bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300 border-blue-300 dark:border-blue-800',
  },
  dividido_pago: {
    label: 'Dividido & Pago',
    badgeClass: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/70 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800',
  },
  repassado: {
    label: 'Repassado à Carteira',
    badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
  },
  erro: {
    label: 'Erro no Split',
    badgeClass: 'bg-red-100 text-red-800 dark:bg-red-950/70 dark:text-red-300 border-red-300 dark:border-red-800',
  },
  estornado: {
    label: 'Estornado',
    badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border-amber-300 dark:border-amber-800',
  },
};

const formatBRL = (value: number): string =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const SplitManagementTab: React.FC<SplitManagementTabProps> = ({ currentUser }) => {
  const [gatewayConfig, setGatewayConfig] = useState<GatewayConfigStatus | null>(null);
  const [loadingRemote, setLoadingRemote] = useState(false);
  const [subView, setSubView] = useState<'historico' | 'subcontas'>('historico');
  const [statusFilter, setStatusFilter] = useState<'todos' | SplitPaymentStatus>('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [feedbackBanner, setFeedbackBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [updatingSplitId, setUpdatingSplitId] = useState<string | null>(null);
  const [savingSupplierId, setSavingSupplierId] = useState<string | null>(null);
  const [inspectingSplit, setInspectingSplit] = useState<SplitTransaction | null>(null);
  const [subaccountDrafts, setSubaccountDrafts] = useState<Record<string, SubaccountDraft>>({});
  const [, setTick] = useState(0);

  const loadGatewayStatusAndSync = useCallback(async () => {
    setLoadingRemote(true);
    try {
      const [cfgRes] = await Promise.all([
        fetch(apiUrl('/api/payments/gateway-config'), { cache: 'no-store' }),
        db.syncFromServer(true),
      ]);
      if (cfgRes.ok) {
        const json = (await cfgRes.json()) as { ok?: boolean; config?: GatewayConfigStatus };
        if (json.ok && json.config) {
          setGatewayConfig(json.config);
        }
      }
    } catch {
      // Fallback silencioso mantendo dados em cache local
    } finally {
      setLoadingRemote(false);
    }
  }, []);

  useEffect(() => {
    void loadGatewayStatusAndSync();
    const unsub = db.subscribe(() => setTick(t => t + 1));
    return () => {
      unsub();
    };
  }, [loadGatewayStatusAndSync]);

  const splits = db.getSplitTransactions();
  const suppliers = db.getUsers().filter(u => u.role === 'fornecedor');

  const getDraft = (sup: User): SubaccountDraft => {
    const existing = subaccountDrafts[sup.id];
    if (existing) return existing;
    return {
      provider: sup.gatewayProvider || gatewayConfig?.activeProvider || 'asaas',
      pixKey: sup.gatewayPixKey || sup.bankAccountOrPix || '',
      walletId: sup.gatewayWalletId || '',
      bankCode: sup.gatewayBankInfo?.bankCode || '',
      agency: sup.gatewayBankInfo?.agency || '',
      account: sup.gatewayBankInfo?.account || '',
    };
  };

  const updateDraft = (sup: User, patch: Partial<SubaccountDraft>) => {
    const base = getDraft(sup);
    setSubaccountDrafts(prev => ({
      ...prev,
      [sup.id]: { ...base, ...patch },
    }));
  };

  const handleProvisionSubaccount = async (sup: User) => {
    const draft = getDraft(sup);
    if (!draft.pixKey.trim() && !draft.walletId.trim()) {
      setFeedbackBanner({
        type: 'error',
        text: `Informe a chave PIX/recebimento ou o Wallet ID de "${sup.companyName || sup.name}" antes de vincular a subconta.`,
      });
      return;
    }

    setSavingSupplierId(sup.id);
    setFeedbackBanner(null);
    try {
      const result = await db.registerSupplierSubaccountRemote(sup.id, {
        provider: draft.provider,
        pixKey: draft.pixKey.trim() || undefined,
        walletId: draft.walletId.trim() || undefined,
        bankInfo:
          draft.bankCode.trim() || draft.agency.trim() || draft.account.trim()
            ? {
                bankCode: draft.bankCode.trim() || undefined,
                agency: draft.agency.trim() || undefined,
                account: draft.account.trim() || undefined,
              }
            : undefined,
        actorId: currentUser.id,
      });

      if (!result.ok) {
        setFeedbackBanner({ type: 'error', text: result.message });
      } else {
        setFeedbackBanner({
          type: 'success',
          text: `${sup.companyName || sup.name}: ${result.message} (Wallet: ${result.user?.gatewayWalletId || 'vinculada'})`,
        });
        setSubaccountDrafts(prev => {
          const next = { ...prev };
          delete next[sup.id];
          return next;
        });
      }
    } catch {
      setFeedbackBanner({
        type: 'error',
        text: 'Erro de conexão ao registrar subconta no servidor.',
      });
    } finally {
      setSavingSupplierId(null);
    }
  };

  const handleUpdateSplitStatus = async (split: SplitTransaction, nextStatus: SplitPaymentStatus) => {
    setUpdatingSplitId(split.id);
    setFeedbackBanner(null);
    try {
      const res = await db.updateSplitStatusRemote(
        split.id,
        nextStatus,
        currentUser.id,
        `Status atualizado para "${nextStatus}" no painel Administrativo AUTO SHOP.`
      );
      if (!res.ok) {
        setFeedbackBanner({
          type: 'error',
          text: res.message || 'Falha ao atualizar status do split.',
        });
      } else {
        setFeedbackBanner({
          type: 'success',
          text: `Pedido ${split.orderNumber}: status do split alterado para "${SPLIT_STATUS_META[nextStatus].label}".`,
        });
      }
    } catch {
      setFeedbackBanner({
        type: 'error',
        text: 'Erro de comunicação ao atualizar status do split.',
      });
    } finally {
      setUpdatingSplitId(null);
    }
  };

  // Métricas consolidadas de Split
  const activeSplits = splits.filter(s => s.status !== 'estornado');
  const totalGrossProcessed = activeSplits.reduce((acc, s) => acc + s.grossAmount, 0);
  const totalPlatformRetained = activeSplits.reduce((acc, s) => acc + s.platformAmount, 0);
  const totalSupplierTransferred = activeSplits
    .filter(s => s.status === 'repassado' || s.status === 'dividido_pago')
    .reduce((acc, s) => acc + s.supplierNetAmount, 0);
  const totalProcessingSplits = splits.filter(
    s => s.status === 'pendente' || s.status === 'processando'
  );

  const filteredSplits = splits.filter(s => {
    if (statusFilter !== 'todos' && s.status !== statusFilter) return false;
    if (searchTerm.trim() !== '') {
      const q = searchTerm.toLowerCase();
      return (
        s.orderNumber.toLowerCase().includes(q) ||
        s.supplierName.toLowerCase().includes(q) ||
        s.supplierWalletId.toLowerCase().includes(q) ||
        s.gatewayChargeId.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const filteredSuppliers = suppliers.filter(s => {
    if (searchTerm.trim() === '') return true;
    const q = searchTerm.toLowerCase();
    return (
      (s.companyName || s.name).toLowerCase().includes(q) ||
      s.document.toLowerCase().includes(q) ||
      (s.gatewayWalletId || '').toLowerCase().includes(q) ||
      (s.gatewayPixKey || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Banner de Status do Gateway & Instruções de Produção */}
      <div className="p-5 rounded-3xl bg-slate-900 text-white border border-purple-500/40 shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-purple-600/25 border border-purple-500/40 flex items-center justify-center text-purple-300 shrink-0">
              <Split className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-black text-white">
                  Split Automático & Gestão de Subcontas (AUTO SHOP)
                </h2>
                <span
                  className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
                    gatewayConfig?.mode === 'production'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  }`}
                >
                  {gatewayConfig?.mode === 'production'
                    ? 'PRODUÇÃO ATIVA'
                    : 'MODO SANDBOX INTEGRADO'}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Divisão automática no checkout: a comissão da AUTO SHOP permanece na conta mestre e o valor líquido é roteado diretamente para a carteira (<code className="text-purple-300 font-mono">walletId</code>) do fornecedor vendedor.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void loadGatewayStatusAndSync()}
            disabled={loadingRemote}
            className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-2 transition cursor-pointer self-start lg:self-auto disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${loadingRemote ? 'animate-spin' : ''}`} />
            <span>{loadingRemote ? 'Atualizando...' : 'Sincronizar Gateway'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs pt-2 border-t border-slate-800">
          <div className="p-3 rounded-xl bg-slate-800/70 border border-slate-700/80">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">
              Gateway Padrão Ativo
            </span>
            <strong className="text-sm font-black text-white uppercase mt-0.5 block">
              {gatewayConfig?.activeProvider === 'mercadopago' ? 'Mercado Pago Marketplace' : 'Asaas Split Nativo v3'}
            </strong>
          </div>

          <div className="p-3 rounded-xl bg-slate-800/70 border border-slate-700/80">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">
              Carteira Mestre (AUTO SHOP)
            </span>
            <strong className="text-xs font-mono font-bold text-purple-300 mt-0.5 block truncate">
              {gatewayConfig?.platformWalletId || 'wal_autoshop_master_001'}
            </strong>
          </div>

          <div className="p-3 rounded-xl bg-slate-800/70 border border-slate-700/80">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">
              Credenciais Asaas / MP
            </span>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  gatewayConfig?.hasAsaasCredentials
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-slate-700 text-slate-300'
                }`}
              >
                Asaas: {gatewayConfig?.hasAsaasCredentials ? 'Chave OK' : 'Sandbox'}
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  gatewayConfig?.hasMercadoPagoCredentials
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-slate-700 text-slate-300'
                }`}
              >
                MP: {gatewayConfig?.hasMercadoPagoCredentials ? 'Token OK' : 'Sandbox'}
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-800/70 border border-slate-700/80">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">
              Webhook de Confirmação
            </span>
            <strong className="text-xs font-mono text-slate-200 mt-0.5 block truncate">
              /api/payments/webhook/{gatewayConfig?.activeProvider || 'asaas'}
            </strong>
            <span className="text-[10px] text-slate-400">
              {gatewayConfig?.webhookConfigured ? 'Token secreto ativo' : 'Defina PAYMENT_WEBHOOK_TOKEN no .env'}
            </span>
          </div>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedbackBanner && (
        <div
          className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-xs font-bold ${
            feedbackBanner.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : 'bg-red-50 dark:bg-red-950/50 border-red-300 dark:border-red-800 text-red-800 dark:text-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackBanner.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{feedbackBanner.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
            className="p-1 rounded-lg hover:bg-black/5 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPIs Financeiros do Split */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 block">
            Volume Bruto Processado (Split)
          </span>
          <strong className="text-2xl font-black text-slate-900 dark:text-white mt-1 block tabular-nums">
            {formatBRL(totalGrossProcessed)}
          </strong>
          <span className="text-[10px] text-slate-400 mt-1 block">
            {activeSplits.length} cobrança(s) dividida(s)
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 block">
            Comissão Retida AUTO SHOP
          </span>
          <strong className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1 block tabular-nums">
            {formatBRL(totalPlatformRetained)}
          </strong>
          <span className="text-[10px] text-purple-600 font-bold mt-1 block">
            Direto na carteira mestre
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 block">
            Saldo Repassado a Parceiros
          </span>
          <strong className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 block tabular-nums">
            {formatBRL(totalSupplierTransferred)}
          </strong>
          <span className="text-[10px] text-emerald-600 font-bold mt-1 block">
            Líquido creditado nas carteiras
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 block">
            Splits Pendentes / Em Processamento
          </span>
          <strong className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1 block tabular-nums">
            {totalProcessingSplits.length}
          </strong>
          <span className="text-[10px] text-slate-400 mt-1 block">
            {suppliers.filter(s => s.gatewayAccountStatus === 'ativa').length}/{suppliers.length} lojas com carteira ativa
          </span>
        </div>
      </div>

      {/* Sub-navegação e Filtro */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSubView('historico')}
            className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition cursor-pointer ${
              subView === 'historico'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            <Banknote className="w-4 h-4" />
            <span>Histórico de Pagamentos Divididos ({splits.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setSubView('subcontas')}
            className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition cursor-pointer ${
              subView === 'subcontas'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            <Wallet className="w-4 h-4" />
            <span>Subcontas & Carteiras dos Fornecedores ({suppliers.length})</span>
          </button>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1 md:max-w-md">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder={
                subView === 'historico'
                  ? 'Buscar por pedido, loja, walletId ou chargeId...'
                  : 'Buscar loja, CNPJ, PIX ou walletId...'
              }
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-600"
            />
          </div>

          {subView === 'historico' && (
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as 'todos' | SplitPaymentStatus)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none"
            >
              <option value="todos">Todos os Status</option>
              <option value="dividido_pago">Dividido & Pago</option>
              <option value="repassado">Repassado à Carteira</option>
              <option value="processando">Processando Split</option>
              <option value="pendente">Pendente</option>
              <option value="erro">Com Erro</option>
              <option value="estornado">Estornado</option>
            </select>
          )}
        </div>
      </div>

      {/* VIEW 1: HISTÓRICO DE PAGAMENTOS DIVIDIDOS */}
      {subView === 'historico' && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          {filteredSplits.length === 0 ? (
            <div className="p-10 text-center text-slate-400 space-y-2">
              <Split className="w-10 h-10 mx-auto opacity-30" />
              <p className="text-sm font-bold">
                Nenhuma transação de split encontrada para os filtros selecionados.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                <thead className="bg-slate-100 dark:bg-slate-800 text-[10px] uppercase font-black tracking-wider text-slate-500">
                  <tr>
                    <th className="py-3 px-4">Pedido / Data</th>
                    <th className="py-3 px-4">Fornecedor & Wallet ID</th>
                    <th className="py-3 px-4">Gateway / Cobrança</th>
                    <th className="py-3 px-4">Valor Bruto</th>
                    <th className="py-3 px-4">Comissão AUTO SHOP</th>
                    <th className="py-3 px-4">Repasse Líquido</th>
                    <th className="py-3 px-4">Status do Split</th>
                    <th className="py-3 px-4 text-right">Ações & Payload</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {filteredSplits.map(split => {
                    const meta = SPLIT_STATUS_META[split.status] || SPLIT_STATUS_META.pendente;
                    const isBusy = updatingSplitId === split.id;
                    return (
                      <tr
                        key={split.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition"
                      >
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <strong className="font-mono font-black text-blue-600 dark:text-blue-400 block">
                            {split.orderNumber}
                          </strong>
                          <span className="text-[10px] text-slate-400 block">
                            {new Date(split.createdAt).toLocaleString('pt-BR')}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <strong className="text-slate-900 dark:text-white block">
                            {split.supplierName}
                          </strong>
                          <span className="text-[10px] font-mono text-purple-600 dark:text-purple-300 block">
                            Wallet: {split.supplierWalletId}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="inline-block text-[10px] font-black uppercase px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                            {split.gatewayProvider} · {split.paymentMethod.toUpperCase()}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 block mt-1 truncate max-w-[165px]">
                            {split.gatewayChargeId}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                          {formatBRL(split.grossAmount)}
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <strong className="font-mono font-black text-purple-600 dark:text-purple-400 block">
                            {formatBRL(split.platformAmount)}
                          </strong>
                          <span className="text-[10px] text-slate-400">
                            ({split.platformFeePercent}%)
                          </span>
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <strong className="font-mono font-black text-emerald-600 dark:text-emerald-400 block">
                            {formatBRL(split.supplierNetAmount)}
                          </strong>
                          {split.transferredAt && (
                            <span className="text-[10px] text-emerald-600 block">
                              Em {new Date(split.transferredAt).toLocaleDateString('pt-BR')}
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[10px] font-black uppercase ${meta.badgeClass}`}
                          >
                            {split.status === 'repassado' && <CheckCircle2 className="w-3 h-3" />}
                            {(split.status === 'pendente' || split.status === 'processando') && (
                              <Clock className="w-3 h-3" />
                            )}
                            {meta.label}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            {split.status !== 'repassado' && split.status !== 'estornado' && (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => void handleUpdateSplitStatus(split, 'repassado')}
                                className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                title="Confirmar liquidação e repasse para carteira do parceiro"
                              >
                                <ArrowUpRight className="w-3 h-3" />
                                <span>Confirmar Repasse</span>
                              </button>
                            )}

                            {split.status !== 'dividido_pago' && split.status !== 'estornado' && (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => void handleUpdateSplitStatus(split, 'dividido_pago')}
                                className="px-2 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 font-bold text-[11px] cursor-pointer disabled:opacity-50"
                              >
                                Marcar Pago
                              </button>
                            )}

                            {split.status !== 'estornado' && (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => void handleUpdateSplitStatus(split, 'estornado')}
                                className="px-2 py-1.5 rounded-lg bg-red-50 dark:bg-red-950/60 hover:bg-red-100 text-red-600 font-bold text-[11px] flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                title="Estornar cobrança e split"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>Estornar</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => setInspectingSplit(split)}
                              className="px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                              title="Ver payload JSON enviado ao gateway"
                            >
                              <Code2 className="w-3.5 h-3.5" />
                              <span>JSON</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: GESTÃO DE SUBCONTAS E CARTEIRAS DOS FORNECEDORES */}
      {subView === 'subcontas' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredSuppliers.map(sup => {
            const draft = getDraft(sup);
            const isSaving = savingSupplierId === sup.id;
            const accStatus = sup.gatewayAccountStatus || 'nao_configurada';
            return (
              <div
                key={sup.id}
                className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4"
              >
                <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 flex items-center justify-center shrink-0">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <strong className="text-sm font-black text-slate-900 dark:text-white block">
                        {sup.companyName || sup.name}
                      </strong>
                      <span className="text-[11px] font-mono text-slate-500">
                        Doc: {sup.document} · Tel: {sup.phone}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border ${
                      accStatus === 'ativa'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                        : accStatus === 'em_analise'
                        ? 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300'
                        : 'bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {accStatus === 'ativa'
                      ? 'Carteira Ativa'
                      : accStatus === 'em_analise'
                      ? 'Em Análise'
                      : accStatus === 'rejeitada'
                      ? 'Rejeitada'
                      : 'Não Configurada'}
                  </span>
                </div>

                {sup.gatewaySubaccountId && (
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-[11px] font-mono flex flex-wrap items-center justify-between gap-2">
                    <span className="text-slate-500">
                      Subconta ID: <strong className="text-slate-800 dark:text-slate-200">{sup.gatewaySubaccountId}</strong>
                    </span>
                    <span className="text-purple-600 dark:text-purple-300">
                      Comissão AUTO SHOP: <strong>{sup.commissionRateOverride ?? db.getCommissionSettings().generalCommissionPercent}%</strong>
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      Gateway de Pagamento
                    </label>
                    <select
                      value={draft.provider}
                      onChange={e =>
                        updateDraft(sup, { provider: e.target.value as PaymentGatewayProvider })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold outline-none"
                    >
                      <option value="asaas">Asaas (Split via Wallet ID)</option>
                      <option value="mercadopago">Mercado Pago (Collector ID)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      Chave PIX / Conta de Recebimento
                    </label>
                    <input
                      type="text"
                      value={draft.pixKey}
                      onChange={e => updateDraft(sup, { pixKey: e.target.value })}
                      placeholder="CNPJ, e-mail, celular ou chave aleatória"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-purple-700 dark:text-purple-300 mb-1 flex items-center gap-1">
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Wallet ID / Collector ID no Gateway (Opcional para geração automática)</span>
                  </label>
                  <input
                    type="text"
                    value={draft.walletId}
                    onChange={e => updateDraft(sup, { walletId: e.target.value })}
                    placeholder="Deixe em branco para provisionar no Asaas/MP automaticamente ou cole o walletId"
                    className="w-full px-3 py-2 rounded-xl border border-purple-300 dark:border-purple-800 bg-purple-50/40 dark:bg-slate-800 text-xs font-mono font-bold outline-none"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <input
                    type="text"
                    value={draft.bankCode}
                    onChange={e => updateDraft(sup, { bankCode: e.target.value })}
                    placeholder="Cód. Banco (ex: 341)"
                    className="px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[11px] font-mono outline-none"
                  />
                  <input
                    type="text"
                    value={draft.agency}
                    onChange={e => updateDraft(sup, { agency: e.target.value })}
                    placeholder="Agência"
                    className="px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[11px] font-mono outline-none"
                  />
                  <input
                    type="text"
                    value={draft.account}
                    onChange={e => updateDraft(sup, { account: e.target.value })}
                    placeholder="Conta c/ dígito"
                    className="px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[11px] font-mono outline-none"
                  />
                </div>

                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => void handleProvisionSubaccount(sup)}
                  className="w-full py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-black text-xs shadow-sm flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>
                    {isSaving
                      ? 'Provisionando Subconta...'
                      : sup.gatewayWalletId
                      ? 'Atualizar / Revalidar Subconta & Wallet'
                      : 'Criar / Vincular Subconta no Gateway'}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Inspeção do Payload Split JSON */}
      {inspectingSplit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-5 sm:p-6 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-purple-600" />
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Detalhamento do Split · Pedido {inspectingSplit.orderNumber}
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    Gateway: {inspectingSplit.gatewayProvider.toUpperCase()} · Charge ID: {inspectingSplit.gatewayChargeId}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectingSplit(null)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block">Total Cobrado</span>
                <strong className="font-mono text-sm font-black text-slate-900 dark:text-white">
                  {formatBRL(inspectingSplit.grossAmount)}
                </strong>
              </div>
              <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/50">
                <span className="text-[10px] text-purple-700 dark:text-purple-300 uppercase block">
                  Retido AUTO SHOP ({inspectingSplit.platformFeePercent}%)
                </span>
                <strong className="font-mono text-sm font-black text-purple-700 dark:text-purple-300">
                  {formatBRL(inspectingSplit.platformAmount)}
                </strong>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50">
                <span className="text-[10px] text-emerald-700 dark:text-emerald-300 uppercase block">
                  Repasse Parceiro
                </span>
                <strong className="font-mono text-sm font-black text-emerald-700 dark:text-emerald-300">
                  {formatBRL(inspectingSplit.supplierNetAmount)}
                </strong>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto rounded-2xl bg-slate-950 text-emerald-300 p-4 font-mono text-[11px] border border-slate-800">
              <pre className="whitespace-pre-wrap break-all">
                {JSON.stringify(
                  {
                    splitId: inspectingSplit.id,
                    gatewayProvider: inspectingSplit.gatewayProvider,
                    gatewayChargeId: inspectingSplit.gatewayChargeId,
                    platformWalletId: inspectingSplit.platformWalletId,
                    supplierWalletId: inspectingSplit.supplierWalletId,
                    supplierSubaccountId: inspectingSplit.supplierSubaccountId,
                    status: inspectingSplit.status,
                    notes: inspectingSplit.notes,
                    payloadEnviadoAoGateway: inspectingSplit.splitPayload || {},
                  },
                  null,
                  2
                )}
              </pre>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setInspectingSplit(null)}
                className="px-5 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-black cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
