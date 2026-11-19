/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ManufacturerCatalog } from '../types';
import { apiUrl } from './apiBase';

const DB_NAME = 'compe_pdf_storage';
const DB_VERSION = 1;
const STORE_NAME = 'catalog_pdfs';

function openPdfDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB indisponível'));
      return;
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Erro ao abrir IndexedDB'));
  });
}

export async function savePdfBlob(catalogId: string, file: Blob): Promise<void> {
  try {
    const idb = await openPdfDatabase();
    const arrayBuffer = await file.arrayBuffer();
    await new Promise<void>((resolve, reject) => {
      const tx = idb.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const record = {
        buffer: arrayBuffer,
        type: file.type || 'application/pdf',
      };
      const req = store.put(record, catalogId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    idb.close();
  } catch (err) {
    console.warn('IndexedDB indisponível ao salvar PDF localmente:', err);
  }

  // Envia o PDF real também ao servidor compartilhado para download em celulares/tablets
  try {
    await fetch(apiUrl(`/api/catalogs/${encodeURIComponent(catalogId)}/pdf`), {
      method: 'POST',
      headers: {
        'Content-Type': file.type || 'application/pdf',
      },
      body: file,
    });
  } catch (err) {
    console.warn('Não foi possível sincronizar PDF com o servidor:', err);
  }
}

export async function getPdfBlob(catalogId: string): Promise<Blob | null> {
  try {
    const idb = await openPdfDatabase();
    const result = await new Promise<{ buffer: ArrayBuffer; type: string } | Blob | null>((resolve, reject) => {
      const tx = idb.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(catalogId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
    idb.close();

    if (result) {
      if (result instanceof Blob) return result;
      if (result.buffer) {
        return new Blob([result.buffer], { type: result.type || 'application/pdf' });
      }
    }
  } catch (err) {
    console.warn('IndexedDB indisponível ao ler PDF localmente:', err);
  }

  // Fallback cross-device: busca o PDF original no servidor compartilhado
  try {
    const res = await fetch(apiUrl(`/api/catalogs/${encodeURIComponent(catalogId)}/pdf`), {
      cache: 'no-store',
    });
    if (res.ok) {
      return await res.blob();
    }
  } catch (err) {
    console.warn('Erro ao buscar PDF no servidor:', err);
  }

  return null;
}

export async function deletePdfBlob(catalogId: string): Promise<void> {
  try {
    const idb = await openPdfDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = idb.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(catalogId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    idb.close();
  } catch (err) {
    console.warn('Erro ao excluir PDF do IndexedDB:', err);
  }

  try {
    await fetch(apiUrl(`/api/catalogs/${encodeURIComponent(catalogId)}/pdf`), {
      method: 'DELETE',
    });
  } catch {
    // ignore
  }
}

export async function downloadCatalogPdf(catalog: ManufacturerCatalog): Promise<boolean> {
  const filename =
    catalog.fileName ||
    catalog.pdfFileName ||
    `${(catalog.name || catalog.manufacturer || catalog.title || 'catalogo').toLowerCase().replace(/\s+/g, '-')}.pdf`;

  const storedBlob = await getPdfBlob(catalog.id);
  if (storedBlob) {
    const url = URL.createObjectURL(storedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2500);
    return true;
  }

  if (catalog.pdfUrl && catalog.pdfUrl !== '#' && (catalog.pdfUrl.startsWith('data:') || catalog.pdfUrl.startsWith('http') || catalog.pdfUrl.startsWith('/'))) {
    const a = document.createElement('a');
    a.href = catalog.pdfUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return true;
  }

  return false;
}
