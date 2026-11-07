/**
 * Shapes shared by the demo UI and the real bitcoin-vision model.
 *
 * The raw scanner output types mirror wasm/src/lib.rs (serialised with camelCase).
 */

export interface Candidate {
  /** A word from the official 2048-word BIP-39 list. */
  word: string;
  /** 0–100 */
  confidence: number;
}

/** One word as the demo shows it, from the sample page or from the real model. */
export interface WordRead {
  /** Exactly what was read off the paper, e.g. "absert". */
  ocr: string;
  /** The word to show first. */
  selected: string;
  /** Best list matches, highest confidence first. */
  candidates: Candidate[];
  /** False when the model wants the person to confirm this word. */
  accepted: boolean;
  /** Object URL of the crop the model read (real scans only). */
  cropUrl?: string;
  /** Where the word is in the photo, clockwise from top left (real scans only). */
  quad?: Point[];
}

/* ---------- raw output of the WebAssembly scanners ---------- */

export type Point = [number, number];

export interface ScannedWord {
  quad: [Point, Point, Point, Point];
  ranked: { word: string; probability: number }[];
  accepted: boolean;
  selected: string | null;
  raw: string | null;
  stray: boolean;
  number: number | null;
  cropPng: Uint8Array;
}

export interface PageScan {
  layout: 'sheet' | 'page';
  width: number;
  height: number;
  words: ScannedWord[];
  columns: number[];
  rows: number[];
  numbered: number[];
  columnsPass: boolean;
  rowsPass: boolean;
  numberedPass: boolean;
  initialOrder: 'numbers' | 'rows' | 'columns';
  orderRequiresReview: boolean;
  orderBasis: string;
  numbering: 'none' | 'held' | 'inconsistent';
}

export interface ShareCell {
  symbol: string | null;
  probability: number | null;
  unread: boolean;
  top: { symbol: string; probability: number }[];
}

export interface ShareScan {
  /** Handle for recover(); valid while the page is open. */
  id: number;
  kind: 'seed' | 'share' | 'unknown';
  /** 1–3 for a share strip. */
  index: number | null;
  quad: [Point, Point, Point, Point];
  /** Twelve rows of six cells. */
  rows: ShareCell[][];
}

export type ScanPhase = 'loading' | 'reading';
