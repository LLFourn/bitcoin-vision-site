// bitcoin-vision Web Worker: runs the WebAssembly scanners off the main thread.
// Everything stays in this browser tab; the only network requests fetch the
// model and the .wasm file from this same site (then they come from the cache).
//
// Messages in:  { id, type: 'scanWords' | 'scanShares', photo: ArrayBuffer }
//               { id, type: 'recover', a, b }          (share ids from scanShares)
//               { id, type: 'checksum', words: string[] }
// Messages out: { id, progress: 'loading' | 'reading' }
//               { id, result } | { id, error }

import init, { WordScanner, ShareScanner, checksumPasses, recoverShares } from './pkg/bitcoin_vision_wasm.js';

// Bump when the models or the .wasm change, so browsers drop the old copies.
const CACHE = 'bitcoin-vision-v1';
const here = (path) => new URL(path, import.meta.url).href;

async function cachedFetch(path) {
  const url = here(path);
  let cache = null;
  try {
    cache = await caches.open(CACHE);
    const hit = await cache.match(url);
    if (hit) return hit;
  } catch {
    // Cache Storage can be unavailable (private mode); fall through to the network.
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load ${path} (${res.status})`);
  if (cache) await cache.put(url, res.clone()).catch(() => {});
  return res;
}
const bytes = async (path) => new Uint8Array(await (await cachedFetch(path)).arrayBuffer());
const text = async (path) => (await cachedFetch(path)).text();

let booted = null;
let words = null;
let shares = null;
const readings = new Map();
let nextReading = 1;

function boot() {
  booted ??= cachedFetch('./pkg/bitcoin_vision_wasm_bg.wasm').then((res) => init({ module_or_path: res }));
  return booted;
}

async function wordScanner(progress) {
  if (words) return words;
  progress('loading');
  const [, detector, classifier, calibration, recogniser, dictionary] = await Promise.all([
    boot(),
    bytes('./models/word-detector.onnx'),
    bytes('./models/word-reference.onnx'),
    text('./models/word-reference.calibration'),
    bytes('./models/text-recogniser.onnx'),
    text('./models/text-recogniser.dict.txt'),
  ]);
  words = new WordScanner(detector, classifier, calibration, recogniser, dictionary);
  return words;
}

async function shareScanner(progress) {
  if (shares) return shares;
  progress('loading');
  const [, cells] = await Promise.all([boot(), bytes('./models/cell-reference.onnx')]);
  shares = new ShareScanner(cells);
  return shares;
}

self.onmessage = async ({ data }) => {
  const { id, type } = data;
  const progress = (phase) => self.postMessage({ id, progress: phase });
  try {
    let result;
    if (type === 'scanWords') {
      const scanner = await wordScanner(progress);
      progress('reading');
      result = scanner.scan(new Uint8Array(data.photo));
    } else if (type === 'scanShares') {
      const scanner = await shareScanner(progress);
      progress('reading');
      result = scanner.scan(new Uint8Array(data.photo)).map((reading) => {
        const rid = nextReading++;
        readings.set(rid, reading);
        return { id: rid, ...reading.review() };
      });
    } else if (type === 'recover') {
      const a = readings.get(data.a);
      const b = readings.get(data.b);
      if (!a || !b) throw new Error('Those shares are no longer loaded. Scan them again.');
      await boot();
      result = recoverShares(a, b);
    } else if (type === 'checksum') {
      await boot();
      result = checksumPasses(data.words);
    } else {
      throw new Error(`Unknown request ${type}`);
    }
    self.postMessage({ id, result });
  } catch (e) {
    self.postMessage({ id, error: String(e && e.message ? e.message : e) });
  }
};
