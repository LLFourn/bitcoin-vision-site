'use client';

import type { PageScan, ScanPhase, ShareCell, ShareScan, WordRead } from './types';

/**
 * Talks to public/vision/worker.js, where the WebAssembly model runs.
 * One worker per page; models load on the first scan and stay loaded.
 */

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

type Pending = {
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
  onProgress?: (p: ScanPhase) => void;
};

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, Pending>();

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(`${BASE}/vision/worker.js`, { type: 'module' });
  worker.onmessage = ({ data }) => {
    const p = pending.get(data.id);
    if (!p) return;
    if (data.progress) return p.onProgress?.(data.progress);
    pending.delete(data.id);
    if (data.error) p.reject(new Error(data.error));
    else p.resolve(data.result);
  };
  worker.onerror = (e) => {
    const error = new Error(e.message || 'The reader could not start in this browser.');
    pending.forEach((p) => p.reject(error));
    pending.clear();
    worker?.terminate();
    worker = null;
  };
  return worker;
}

function call<T>(msg: Record<string, unknown>, onProgress?: (p: ScanPhase) => void, transfer: Transferable[] = []): Promise<T> {
  const id = ++seq;
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject, onProgress });
    getWorker().postMessage({ id, ...msg }, transfer);
  });
}

const NATIVE = ['image/jpeg', 'image/png', 'image/webp'];
/** The scanner's own limits (bitcoin-vision-core decode_image). */
const MAX_BYTES = 60 * 1024 * 1024;
const MAX_PIXELS = 40_000_000;
/** What an oversized photo is scaled to: 36 MP, inside the limit. */
const TARGET_PIXELS = 36_000_000;

/**
 * Bytes the scanner can decode. A JPEG/PNG/WebP within the scanner's limits
 * goes through untouched (the scanner applies EXIF rotation itself). Anything
 * else (e.g. HEIC) or anything over the limits (e.g. a 48 MP phone photo) is
 * redrawn by the browser into an upright JPEG that fits.
 */
async function toScannable(file: Blob): Promise<ArrayBuffer> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    if (NATIVE.includes(file.type) && file.size < MAX_BYTES) return file.arrayBuffer();
    throw new Error('This browser can’t open that photo format. Try a JPEG or PNG.');
  }
  const pixels = bitmap.width * bitmap.height;
  if (NATIVE.includes(file.type) && file.size < MAX_BYTES && pixels <= MAX_PIXELS) {
    bitmap.close();
    return file.arrayBuffer();
  }
  const scale = Math.min(1, Math.sqrt(TARGET_PIXELS / pixels));
  const canvas = new OffscreenCanvas(Math.round(bitmap.width * scale), Math.round(bitmap.height * scale));
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.95 });
  return blob.arrayBuffer();
}

export async function scanWords(photo: Blob, onProgress?: (p: ScanPhase) => void): Promise<PageScan> {
  const buf = await toScannable(photo);
  return call<PageScan>({ type: 'scanWords', photo: buf }, onProgress, [buf]);
}

export async function scanShares(photo: Blob, onProgress?: (p: ScanPhase) => void): Promise<ShareScan[]> {
  const buf = await toScannable(photo);
  return call<ShareScan[]>({ type: 'scanShares', photo: buf }, onProgress, [buf]);
}

export const recoverShares = (a: number, b: number) => call<string[]>({ type: 'recover', a, b });

export const checksumPasses = (words: string[]) => call<boolean>({ type: 'checksum', words });

/* ---------- adapting scanner output to what the demo shows ---------- */

/** Words in the scanner's suggested reading order, strays left out. */
export function pageToWords(page: PageScan): WordRead[] {
  const order = page.initialOrder === 'numbers' ? page.numbered : page.initialOrder === 'rows' ? page.rows : page.columns;
  return order
    .map((i) => page.words[i])
    .filter((w) => w && !w.stray)
    .map((w) => {
      const candidates = w.ranked.slice(0, 3).map((r) => ({ word: r.word, confidence: Math.round(r.probability * 100) }));
      const selected = w.selected ?? candidates[0]?.word ?? '';
      if (selected && !candidates.some((c) => c.word === selected)) {
        const p = w.ranked.find((r) => r.word === selected)?.probability ?? 0;
        candidates.push({ word: selected, confidence: Math.round(p * 100) });
      }
      return {
        ocr: w.raw ?? '',
        selected,
        candidates,
        accepted: w.accepted,
        quad: w.quad,
        cropUrl: URL.createObjectURL(new Blob([w.cropPng as BlobPart], { type: 'image/png' })),
      };
    });
}

/** A Penlock row is worth a second look when any cell is unread or below 90 %. */
export const rowUnsure = (row: ShareCell[]) => row.some((c) => c.unread || (c.probability ?? 0) < 0.9);
