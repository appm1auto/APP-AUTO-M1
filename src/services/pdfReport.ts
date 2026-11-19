/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  AuditLog,
  ManufacturerCatalog,
  OrderAndPayment,
  PartRequest,
} from '../types';

export interface MediaArchivePdfItem {
  id: string;
  type: 'solicitacao' | 'cotacao' | 'embalagem';
  mediaUrl: string;
  title: string;
  subtitle: string;
  date: string;
  referenceNumber: string;
  authorName: string;
}

function addReportHeader(doc: jsPDF, title: string, subtitle: string) {
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('AUTO SHOP — O shopping das autopeças online !', 14, 12);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`${title}  |  Emitido em ${new Date().toLocaleString('pt-BR')}`, 14, 20);
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(9);
  doc.text(subtitle, 14, 35);
}

export function exportArchivedRecordsPdfReport(
  orders: OrderAndPayment[],
  requests: PartRequest[]
) {
  const doc = new jsPDF({ orientation: 'landscape' });
  addReportHeader(
    doc,
    'Arquivo Morto Permanente AUTO SHOP (> 30 Dias)',
    `Total de Pedidos: ${orders.length} | Total de Chamados: ${requests.length}`
  );

  autoTable(doc, {
    startY: 40,
    head: [['Pedido', 'Peça / Veículo', 'Valor Total', 'Repasse Líquido', 'Status', 'PIN', 'Data', 'Arquivo']],
    body: orders.map((ord) => {
      const isArchived = new Date(ord.createdAt).getTime() < Date.now() - 30 * 24 * 3600 * 1000;
      return [
        ord.orderNumber,
        `${ord.partName} (${ord.vehicleSummary})`,
        `R$ ${ord.totalAmount.toFixed(2)}`,
        `R$ ${ord.supplierTransferAmount.toFixed(2)}`,
        ord.deliveryStatus,
        ord.pinDeliveryCode,
        new Date(ord.createdAt).toLocaleDateString('pt-BR'),
        isArchived ? 'Arquivo Morto (>30d)' : 'Ativo (<=30d)',
      ];
    }),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [124, 58, 237] },
  });

  if (requests.length > 0) {
    const finalY = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY || 50;
    autoTable(doc, {
      startY: finalY + 10,
      head: [['Chamado', 'Peça', 'Veículo', 'Cliente', 'Cidade/UF', 'Status', 'Data']],
      body: requests.map((req) => [
        req.requestNumber,
        req.partName,
        `${req.vehicleBrand} ${req.vehicleModel} (${req.vehicleYear})`,
        req.customerName,
        `${req.deliveryAddress.city}/${req.deliveryAddress.state}`,
        req.status,
        new Date(req.createdAt).toLocaleDateString('pt-BR'),
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [37, 99, 235] },
    });
  }

  doc.save(`compe-arquivo-morto-${Date.now()}.pdf`);
}

export function exportMediaArchivePdfReport(
  items: MediaArchivePdfItem[],
  titleSuffix?: string
) {
  const doc = new jsPDF({ orientation: 'portrait' });
  addReportHeader(
    doc,
    `Arquivo Central de Imagens e Pedidos${titleSuffix ? ` · ${titleSuffix}` : ''}`,
    `Total de registros com mídia: ${items.length}`
  );

  autoTable(doc, {
    startY: 40,
    head: [['Ref.', 'Tipo', 'Título / Peça', 'Detalhes', 'Autor', 'Data']],
    body: items.map((item) => [
      item.referenceNumber,
      item.type.toUpperCase(),
      item.title,
      item.subtitle,
      item.authorName,
      new Date(item.date).toLocaleDateString('pt-BR'),
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [37, 99, 235] },
  });

  if (items.length === 1 && items[0].mediaUrl?.startsWith('data:image/')) {
    try {
      const finalY = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY || 70;
      const format = items[0].mediaUrl.includes('image/png') ? 'PNG' : 'JPEG';
      doc.addImage(items[0].mediaUrl, format, 14, finalY + 8, 90, 68);
    } catch {
      // Ignore unsupported embedded data URI
    }
  }

  doc.save(`compe-arquivo-imagens-${Date.now()}.pdf`);
}

export function exportAuditLogsPdfReport(logs: AuditLog[]) {
  const doc = new jsPDF({ orientation: 'landscape' });
  addReportHeader(
    doc,
    'Registro Imutável de Auditoria e Conformidade LGPD',
    `Total de eventos auditados: ${logs.length}`
  );

  autoTable(doc, {
    startY: 40,
    head: [['Data / Hora', 'Telefone / Usuário', 'Perfil', 'Ação', 'Detalhes', 'IP']],
    body: logs.map((log) => [
      new Date(log.timestamp).toLocaleString('pt-BR'),
      log.userPhone,
      log.userRole.toUpperCase(),
      log.action,
      log.details,
      log.ipAddress,
    ]),
    styles: { fontSize: 7.5 },
    columnStyles: { 4: { cellWidth: 100 } },
    headStyles: { fillColor: [15, 23, 42] },
  });

  doc.save(`compe-auditoria-lgpd-${Date.now()}.pdf`);
}

export function exportBottlenecksPdfReport(requests: PartRequest[]) {
  const doc = new jsPDF({ orientation: 'landscape' });
  addReportHeader(
    doc,
    'Radar Automático de Gargalos (Chamados Sem Proposta)',
    `Solicitações críticas identificadas: ${requests.length}`
  );

  autoTable(doc, {
    startY: 40,
    head: [['Chamado', 'Peça Solicitada', 'Veículo', 'Categoria', 'Cliente', 'Cidade / Bairro', 'Raio (km)', 'Criado em']],
    body: requests.map((req) => [
      req.requestNumber,
      req.partName,
      `${req.vehicleBrand} ${req.vehicleModel} (${req.vehicleYear})`,
      `${req.categoryName || req.partCategory}${req.partSubcategory ? ` / ${req.partSubcategory}` : ''}`,
      req.customerName,
      `${req.deliveryAddress.neighborhood}, ${req.deliveryAddress.city}/${req.deliveryAddress.state}`,
      `${req.searchRadiusKm} km`,
      new Date(req.createdAt).toLocaleString('pt-BR'),
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [220, 38, 38] },
  });

  doc.save(`compe-radar-gargalos-${Date.now()}.pdf`);
}

export function exportCatalogsPdfReport(catalogs: ManufacturerCatalog[]) {
  const doc = new jsPDF({ orientation: 'landscape' });
  addReportHeader(
    doc,
    'Catálogos Oficiais de Fabricantes (PDF)',
    `Total de catálogos publicados: ${catalogs.length}`
  );

  autoTable(doc, {
    startY: 40,
    head: [['Fabricante', 'Título', 'Categoria', 'Modelos Compatíveis', 'Arquivo PDF', 'Tamanho', 'Downloads', 'Data']],
    body: catalogs.map((cat) => [
      cat.manufacturer || cat.name || '-',
      cat.title || cat.name || '-',
      cat.category || '-',
      cat.compatibleModels || '-',
      cat.pdfFileName || cat.fileName || '-',
      cat.fileSize || '-',
      String(cat.downloadsCount || 0),
      cat.uploadDate || new Date(cat.uploadedAt).toLocaleDateString('pt-BR'),
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [37, 99, 235] },
  });

  doc.save(`compe-catalogos-fabricantes-${Date.now()}.pdf`);
}
