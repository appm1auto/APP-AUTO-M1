/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  BarChart3,
  Calendar,
  CheckCircle,
  Clock,
  DollarSign,
  Download,
  Filter,
  Layers,
  Package,
  Search,
  Store,
  TrendingUp,
  UserCheck,
} from 'lucide-react';
import { OrderAndPayment, PartRequest, User } from '../../types';
import { db } from '../../services/db';

interface EnrichedOrderRow {
  order: OrderAndPayment;
  request?: PartRequest;
  supplier?: User;
  customer?: User;
  categoryLabel: string;
  subcategoryLabel: string;
  createdDateKey: string; // YYYY-MM-DD
}

interface SupplierRankingRow {
  supplierId: string;
  supplierName: string;
  supplierCity: string;
  ordersCount: number;
  grossTotal: number;
  platformTotal: number;
  netTotal: number;
  confirmedCount: number;
  topCategories: string[];
  orders: EnrichedOrderRow[];
}

const formatBRL = (value: number) =>
  `R$ ${(Number.isFinite(value) ? value : 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export const FinancialReportTab: React.FC = () => {
  const [, setTick] = useState(0);
  const [supplierFilter, setSupplierFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [subcategoryFilter, setSubcategoryFilter] = useState<string>('all');
  const [productQuery, setProductQuery] = useState<string>('');
  const [rankBy, setRankBy] = useState<'gross' | 'count' | 'net'>('gross');
  const [focusedSupplierId, setFocusedSupplierId] = useState<string | null>(null);
  const [exportSuccessMsg, setExportSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    const unsub = db.subscribe(() => setTick(t => t + 1));
    return () => {
      unsub();
    };
  }, []);

  const allUsers = db.getUsers();
  const suppliers = useMemo(() => allUsers.filter(u => u.role === 'fornecedor'), [allUsers]);
  const allOrders = db.getOrders(true);
  const allRequests = db.getRequests(true);
  const categories = db.getCategories();

  const requestMap = useMemo(() => {
    const map = new Map<string, PartRequest>();
    allRequests.forEach(r => map.set(r.id, r));
    return map;
  }, [allRequests]);

  const userMap = useMemo(() => {
    const map = new Map<string, User>();
    allUsers.forEach(u => map.set(u.id, u));
    return map;
  }, [allUsers]);

  const enrichedRows: EnrichedOrderRow[] = useMemo(() => {
    return allOrders.map(order => {
      const request = requestMap.get(order.requestId);
      const supplier = userMap.get(order.supplierId);
      const customer = userMap.get(order.customerId);
      const categoryLabel =
        request?.categoryName || request?.partCategory || 'Peças Automotivas';
      const subcategoryLabel =
        request?.partSubcategory || request?.partCategory || 'Geral';
      const createdDateKey = order.createdAt ? order.createdAt.slice(0, 10) : '';
      return {
        order,
        request,
        supplier,
        customer,
        categoryLabel,
        subcategoryLabel,
        createdDateKey,
      };
    });
  }, [allOrders, requestMap, userMap]);

  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    categories.forEach(c => set.add(c.name));
    enrichedRows.forEach(r => set.add(r.categoryLabel));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [categories, enrichedRows]);

  const availableSubcategories = useMemo(() => {
    const set = new Set<string>();
    categories.forEach(c => {
      if (categoryFilter === 'all' || c.name === categoryFilter) {
        c.subcategories.forEach(sub => set.add(sub.name));
      }
    });
    enrichedRows.forEach(r => {
      if (categoryFilter === 'all' || r.categoryLabel === categoryFilter) {
        set.add(r.subcategoryLabel);
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [categories, enrichedRows, categoryFilter]);

  const filteredRows = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    return enrichedRows
      .filter(row => {
        if (supplierFilter !== 'all' && row.order.supplierId !== supplierFilter) return false;
        if (startDate && row.createdDateKey && row.createdDateKey < startDate) return false;
        if (endDate && row.createdDateKey && row.createdDateKey > endDate) return false;
        if (categoryFilter !== 'all' && row.categoryLabel !== categoryFilter) return false;
        if (subcategoryFilter !== 'all' && row.subcategoryLabel !== subcategoryFilter) return false;
        if (q) {
          const hay = [
            row.order.partName,
            row.order.orderNumber,
            row.order.vehicleSummary,
            row.categoryLabel,
            row.subcategoryLabel,
            row.supplier?.companyName || row.supplier?.name || '',
          ]
            .join(' ')
            .toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort(
        (a, b) =>
          new Date(b.order.createdAt).getTime() - new Date(a.order.createdAt).getTime()
      );
  }, [
    enrichedRows,
    supplierFilter,
    startDate,
    endDate,
    categoryFilter,
    subcategoryFilter,
    productQuery,
  ]);

  const totals = useMemo(() => {
    let gross = 0;
    let platform = 0;
    let supplierNet = 0;
    let shipping = 0;
    filteredRows.forEach(({ order }) => {
      gross += order.totalAmount || 0;
      platform += order.platformCommissionAmount || 0;
      supplierNet += order.supplierTransferAmount || 0;
      shipping += order.shippingPrice || 0;
    });
    const avgTicket = filteredRows.length > 0 ? gross / filteredRows.length : 0;
    return { gross, platform, supplierNet, shipping, avgTicket, count: filteredRows.length };
  }, [filteredRows]);

  // Classificação numérica dos fornecedores (1º, 2º, 3º...)
  const supplierRanking: SupplierRankingRow[] = useMemo(() => {
    const grouped = new Map<string, SupplierRankingRow>();
    filteredRows.forEach(row => {
      const supId = row.order.supplierId;
      const existing = grouped.get(supId);
      const supName =
        row.supplier?.companyName || row.supplier?.name || `Fornecedor ${supId.slice(0, 6)}`;
      const supCity = row.supplier?.address?.city
        ? `${row.supplier.address.city}/${row.supplier.address.state || ''}`
        : 'Brasil';
      if (!existing) {
        grouped.set(supId, {
          supplierId: supId,
          supplierName: supName,
          supplierCity: supCity,
          ordersCount: 1,
          grossTotal: row.order.totalAmount || 0,
          platformTotal: row.order.platformCommissionAmount || 0,
          netTotal: row.order.supplierTransferAmount || 0,
          confirmedCount: row.order.supplierReceiptConfirmed ? 1 : 0,
          topCategories: [row.subcategoryLabel],
          orders: [row],
        });
      } else {
        existing.ordersCount += 1;
        existing.grossTotal += row.order.totalAmount || 0;
        existing.platformTotal += row.order.platformCommissionAmount || 0;
        existing.netTotal += row.order.supplierTransferAmount || 0;
        if (row.order.supplierReceiptConfirmed) existing.confirmedCount += 1;
        if (!existing.topCategories.includes(row.subcategoryLabel)) {
          existing.topCategories.push(row.subcategoryLabel);
        }
        existing.orders.push(row);
      }
    });

    const list = Array.from(grouped.values());
    list.sort((a, b) => {
      if (rankBy === 'count') return b.ordersCount - a.ordersCount || b.grossTotal - a.grossTotal;
      if (rankBy === 'net') return b.netTotal - a.netTotal || b.ordersCount - a.ordersCount;
      return b.grossTotal - a.grossTotal || b.ordersCount - a.ordersCount;
    });
    return list;
  }, [filteredRows, rankBy]);

  // Agrupamento por Produto / Categoria / Subcategoria
  const categoryBreakdown = useMemo(() => {
    const map = new Map<
      string,
      { key: string; category: string; subcategory: string; count: number; gross: number; platform: number; net: number }
    >();
    filteredRows.forEach(row => {
      const key = `${row.categoryLabel}::${row.subcategoryLabel}`;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          key,
          category: row.categoryLabel,
          subcategory: row.subcategoryLabel,
          count: 1,
          gross: row.order.totalAmount || 0,
          platform: row.order.platformCommissionAmount || 0,
          net: row.order.supplierTransferAmount || 0,
        });
      } else {
        existing.count += 1;
        existing.gross += row.order.totalAmount || 0;
        existing.platform += row.order.platformCommissionAmount || 0;
        existing.net += row.order.supplierTransferAmount || 0;
      }
    });
    return Array.from(map.values()).sort((a, b) => b.gross - a.gross);
  }, [filteredRows]);

  const focusedSupplier = useMemo(() => {
    if (!focusedSupplierId) return null;
    return supplierRanking.find(s => s.supplierId === focusedSupplierId) || null;
  }, [focusedSupplierId, supplierRanking]);

  const applyPeriodPreset = (days: number | 'today' | 'all') => {
    const now = new Date();
    const toIso = (d: Date) => d.toISOString().slice(0, 10);
    if (days === 'all') {
      setStartDate('');
      setEndDate('');
      return;
    }
    if (days === 'today') {
      const today = toIso(now);
      setStartDate(today);
      setEndDate(today);
      return;
    }
    const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    setStartDate(toIso(from));
    setEndDate(toIso(now));
  };

  const handleExportCsv = () => {
    const header = [
      'Data',
      'Pedido',
      'Fornecedor',
      'Cliente',
      'Produto',
      'Categoria',
      'Subcategoria',
      'Valor Bruto (R$)',
      'Comissao Plataforma (%)',
      'Repasse Plataforma (R$)',
      'Liquido Fornecedor (R$)',
      'Confirmado em Conta',
      'Status Entrega',
    ].join(';');

    const lines = filteredRows.map(({ order, supplier, customer, categoryLabel, subcategoryLabel }) =>
      [
        new Date(order.createdAt).toLocaleString('pt-BR'),
        order.orderNumber,
        (supplier?.companyName || supplier?.name || order.supplierId).replace(/;/g, ','),
        (customer?.name || order.customerId).replace(/;/g, ','),
        order.partName.replace(/;/g, ','),
        categoryLabel.replace(/;/g, ','),
        subcategoryLabel.replace(/;/g, ','),
        (order.totalAmount || 0).toFixed(2).replace('.', ','),
        `${order.platformCommissionRate || 0}%`,
        (order.platformCommissionAmount || 0).toFixed(2).replace('.', ','),
        (order.supplierTransferAmount || 0).toFixed(2).replace('.', ','),
        order.supplierReceiptConfirmed ? 'SIM' : 'AGUARDANDO',
        order.deliveryStatus,
      ].join(';')
    );

    const csv = '\uFEFF' + [header, ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `autoshop-relatorio-financeiro-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExportSuccessMsg(`Planilha CSV gerada com ${filteredRows.length} venda(s).`);
    setTimeout(() => setExportSuccessMsg(null), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho do Relatório Financeiro */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-purple-950 to-slate-900 text-white border border-purple-800/50 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-3 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 shrink-0">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-black">
              Relatório Financeiro, Repasses e Classificação de Fornecedores
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Controle completo de vendas, repasses à plataforma, histórico individual, período, produtos, categorias, subcategorias e ranking numérico.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-2 shadow-md transition cursor-pointer shrink-0 self-start sm:self-auto"
        >
          <Download className="w-4 h-4" />
          <span>Exportar Planilha (CSV)</span>
        </button>
      </div>

      {exportSuccessMsg && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 text-xs font-bold text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{exportSuccessMsg}</span>
        </div>
      )}

      {/* Barra de Filtros Completos */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
            <Filter className="w-4 h-4 text-purple-600" />
            <span>Filtros por Fornecedor, Data, Período e Categoria</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => applyPeriodPreset('all')}
              className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-purple-100 text-[11px] font-bold cursor-pointer"
            >
              Todo Período
            </button>
            <button
              type="button"
              onClick={() => applyPeriodPreset('today')}
              className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-purple-100 text-[11px] font-bold cursor-pointer"
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={() => applyPeriodPreset(7)}
              className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-purple-100 text-[11px] font-bold cursor-pointer"
            >
              Últimos 7 dias
            </button>
            <button
              type="button"
              onClick={() => applyPeriodPreset(30)}
              className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-purple-100 text-[11px] font-bold cursor-pointer"
            >
              Últimos 30 dias
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          <div>
            <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
              Fornecedor (Individual ou Todos)
            </label>
            <select
              value={supplierFilter}
              onChange={e => setSupplierFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold"
            >
              <option value="all">Todos os Fornecedores ({suppliers.length})</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>
                  {s.companyName || s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
              Data Inicial
            </label>
            <div className="relative">
              <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full pl-8 pr-2.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
              Data Final
            </label>
            <div className="relative">
              <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full pl-8 pr-2.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
              Categoria
            </label>
            <select
              value={categoryFilter}
              onChange={e => {
                setCategoryFilter(e.target.value);
                setSubcategoryFilter('all');
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold"
            >
              <option value="all">Todas as Categorias</option>
              {availableCategories.map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
              Subcategoria
            </label>
            <select
              value={subcategoryFilter}
              onChange={e => setSubcategoryFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold"
            >
              <option value="all">Todas as Subcategorias</option>
              {availableSubcategories.map(sub => (
                <option key={sub} value={sub}>
                  {sub}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={productQuery}
            onChange={e => setProductQuery(e.target.value)}
            placeholder="Filtrar por produto/peça, número do pedido, veículo ou loja..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-purple-600"
          />
        </div>
      </div>

      {/* KPIs Consolidados */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[11px] font-bold uppercase text-slate-500 block">
            Volume Bruto das Vendas
          </span>
          <strong className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono tabular-nums mt-1 block">
            {formatBRL(totals.gross)}
          </strong>
          <span className="text-[11px] text-slate-500 mt-1 block">
            Frete incluído: {formatBRL(totals.shipping)}
          </span>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border-2 border-purple-300 dark:border-purple-800 shadow-sm">
          <span className="text-[11px] font-bold uppercase text-purple-700 dark:text-purple-300 block">
            Repasses à Plataforma AUTO SHOP
          </span>
          <strong className="text-xl sm:text-2xl font-black text-purple-600 dark:text-purple-400 font-mono tabular-nums mt-1 block">
            {formatBRL(totals.platform)}
          </strong>
          <span className="text-[11px] text-slate-500 mt-1 block">
            {totals.gross > 0
              ? `${((totals.platform / totals.gross) * 100).toFixed(1)}% de margem média`
              : 'Sem vendas no filtro'}
          </span>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border-2 border-emerald-300 dark:border-emerald-800 shadow-sm">
          <span className="text-[11px] font-bold uppercase text-emerald-700 dark:text-emerald-300 block">
            Ganhos Líquidos dos Fornecedores
          </span>
          <strong className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono tabular-nums mt-1 block">
            {formatBRL(totals.supplierNet)}
          </strong>
          <span className="text-[11px] text-slate-500 mt-1 block">
            Repasses após taxa da plataforma
          </span>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[11px] font-bold uppercase text-slate-500 block">
            Pedidos & Ticket Médio
          </span>
          <strong className="text-xl sm:text-2xl font-black text-blue-600 dark:text-blue-400 font-mono tabular-nums mt-1 block">
            {totals.count} venda{totals.count === 1 ? '' : 's'}
          </strong>
          <span className="text-[11px] text-slate-500 mt-1 block">
            Ticket médio: <strong className="font-mono">{formatBRL(totals.avgTicket)}</strong>
          </span>
        </div>
      </div>

      {/* CLASSIFICAÇÃO NUMÉRICA DOS FORNECEDORES (1º, 2º, 3º...) */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-500" />
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
                Classificação Numérica & Histórico de Ganhos por Fornecedor
              </h3>
              <p className="text-[11px] text-slate-500">
                Posição numérica (1º, 2º, 3º...) e detalhamento individual de comercialização de cada parceiro.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 font-semibold">Classificar por:</span>
            <select
              value={rankBy}
              onChange={e => setRankBy(e.target.value as 'gross' | 'count' | 'net')}
              className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold cursor-pointer"
            >
              <option value="gross">Maior Faturamento Bruto</option>
              <option value="net">Maior Ganho Líquido</option>
              <option value="count">Maior Qtd. de Vendas</option>
            </select>
          </div>
        </div>

        {supplierRanking.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            Nenhuma comercialização encontrada com os filtros selecionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-2.5 px-3">Posição</th>
                  <th className="py-2.5 px-3">Fornecedor / Loja</th>
                  <th className="py-2.5 px-3 text-center">Vendas</th>
                  <th className="py-2.5 px-3">Bruto Vendido</th>
                  <th className="py-2.5 px-3">Repasse Plataforma</th>
                  <th className="py-2.5 px-3">Líquido Fornecedor</th>
                  <th className="py-2.5 px-3">Subcategorias</th>
                  <th className="py-2.5 px-3 text-right">Individual</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {supplierRanking.map((row, idx) => {
                  const rank = idx + 1;
                  const sharePct = totals.gross > 0 ? (row.grossTotal / totals.gross) * 100 : 0;
                  const isFocused = focusedSupplierId === row.supplierId;
                  return (
                    <tr
                      key={row.supplierId}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                        isFocused ? 'bg-purple-50/70 dark:bg-purple-950/30' : ''
                      }`}
                    >
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center justify-center w-8 h-8 rounded-xl font-mono font-black text-xs ${
                            rank === 1
                              ? 'bg-amber-400 text-slate-950 shadow-sm'
                              : rank === 2
                              ? 'bg-slate-300 text-slate-900'
                              : rank === 3
                              ? 'bg-amber-700 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {rank}º
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <strong className="text-slate-900 dark:text-white block">
                          {row.supplierName}
                        </strong>
                        <span className="text-[11px] text-slate-500">
                          {row.supplierCity} · {sharePct.toFixed(1)}% do volume
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-black">
                        {row.ordersCount}
                        <span className="block text-[10px] font-normal text-emerald-600">
                          {row.confirmedCount} conf.
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                        {formatBRL(row.grossTotal)}
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-purple-600 dark:text-purple-400 tabular-nums">
                        {formatBRL(row.platformTotal)}
                      </td>
                      <td className="py-3 px-3 font-mono font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {formatBRL(row.netTotal)}
                      </td>
                      <td className="py-3 px-3 max-w-[200px]">
                        <div className="flex flex-wrap gap-1">
                          {row.topCategories.slice(0, 3).map(cat => (
                            <span
                              key={cat}
                              className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold"
                            >
                              {cat}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            setFocusedSupplierId(isFocused ? null : row.supplierId)
                          }
                          className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-[11px] cursor-pointer"
                        >
                          {isFocused ? 'Ocultar' : 'Ver Histórico'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Painel Expandido: Histórico Individual do Fornecedor Selecionado */}
        {focusedSupplier && (
          <div className="p-4 rounded-2xl bg-purple-50/70 dark:bg-purple-950/30 border-2 border-purple-300 dark:border-purple-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-purple-200 dark:border-purple-800">
              <div className="flex items-center gap-2">
                <Store className="w-4 h-4 text-purple-600" />
                <h4 className="text-sm font-black text-slate-900 dark:text-white">
                  Histórico Individual de Ganhos & Comercialização: {focusedSupplier.supplierName}
                </h4>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono font-black">
                <span>Bruto: {formatBRL(focusedSupplier.grossTotal)}</span>
                <span className="text-purple-700 dark:text-purple-300">
                  Plataforma: {formatBRL(focusedSupplier.platformTotal)}
                </span>
                <span className="text-emerald-700 dark:text-emerald-400">
                  Líquido: {formatBRL(focusedSupplier.netTotal)}
                </span>
              </div>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {focusedSupplier.orders.map(({ order, customer, categoryLabel, subcategoryLabel }) => (
                <div
                  key={order.id}
                  className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-black text-blue-600 dark:text-blue-400">
                        {order.orderNumber}
                      </span>
                      <span className="text-slate-400">·</span>
                      <span className="text-slate-500">
                        {new Date(order.createdAt).toLocaleString('pt-BR')}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-bold">
                        {categoryLabel} / {subcategoryLabel}
                      </span>
                    </div>
                    <strong className="text-slate-900 dark:text-white block mt-0.5">
                      {order.partName} — <span className="font-normal text-slate-500">{order.vehicleSummary}</span>
                    </strong>
                    <span className="text-[11px] text-slate-500">
                      Cliente: {customer?.name || 'Cliente'} · Pagamento: {order.paymentMethod.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-left sm:text-right font-mono space-y-0.5 shrink-0">
                    <div className="text-slate-900 dark:text-white font-bold">
                      Bruto: {formatBRL(order.totalAmount)}
                    </div>
                    <div className="text-[11px] text-purple-600 dark:text-purple-400 font-bold">
                      Taxa Plataforma ({order.platformCommissionRate}%): -{formatBRL(order.platformCommissionAmount)}
                    </div>
                    <div className="text-emerald-600 dark:text-emerald-400 font-black">
                      Líquido Fornecedor: {formatBRL(order.supplierTransferAmount)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Resumo por Produto / Categoria / Subcategoria */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <Layers className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
              Faturamento por Categoria & Subcategoria
            </h3>
          </div>
          {categoryBreakdown.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">Sem dados no período.</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {categoryBreakdown.map(cat => (
                <div
                  key={cat.key}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <strong className="text-slate-900 dark:text-white block">
                      {cat.subcategory}
                    </strong>
                    <span className="text-[11px] text-slate-500">
                      {cat.category} · {cat.count} pedido{cat.count === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div className="text-right font-mono tabular-nums">
                    <strong className="text-slate-900 dark:text-white block">
                      {formatBRL(cat.gross)}
                    </strong>
                    <span className="text-[11px] text-purple-600 dark:text-purple-400 font-bold">
                      Plataforma: {formatBRL(cat.platform)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <Package className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
              Histórico Detalhado de Vendas & Repasses ({filteredRows.length})
            </h3>
          </div>
          {filteredRows.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">Nenhuma venda registrada neste filtro.</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {filteredRows.map(({ order, supplier, categoryLabel, subcategoryLabel }) => (
                <div
                  key={order.id}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono font-black text-blue-600 dark:text-blue-400">
                        {order.orderNumber}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {new Date(order.createdAt).toLocaleDateString('pt-BR')}
                      </span>
                      {order.supplierReceiptConfirmed ? (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                          Confirmado
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300 text-[10px] font-bold inline-flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" /> Aguardando Fornecedor
                        </span>
                      )}
                    </div>
                    <strong className="text-slate-900 dark:text-white block truncate">
                      {order.partName}
                    </strong>
                    <span className="text-[11px] text-slate-500 block">
                      {supplier?.companyName || supplier?.name} · {categoryLabel} / {subcategoryLabel}
                    </span>
                  </div>

                  <div className="text-left sm:text-right font-mono tabular-nums shrink-0">
                    <div className="font-black text-slate-900 dark:text-white">
                      {formatBRL(order.totalAmount)}
                    </div>
                    <div className="text-[10px] text-purple-600 dark:text-purple-400 font-bold">
                      AUTO SHOP: {formatBRL(order.platformCommissionAmount)}
                    </div>
                    <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-black">
                      Fornecedor: {formatBRL(order.supplierTransferAmount)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
