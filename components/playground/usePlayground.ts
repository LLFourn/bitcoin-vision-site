'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { SAMPLE_WORDS } from '@/lib/sample-data';
import { checksumPasses, pageToWords, recoverShares, scanShares, scanWords } from '@/lib/vision/client';
import { shareSample } from '@/lib/vision/share';
import type { ScanPhase, ShareScan, WordRead } from '@/lib/vision/types';

export type Mode = 'bip' | 'pen';
export type Status = 'idle' | 'running' | 'done' | 'error';
export type PenPick = 'right' | 'a1' | 'a2' | null;

/** The training-sample question for the current photo. Asked once per photo. */
export interface ShareAsk {
  status: 'ask' | 'sending' | 'sent' | 'declined' | 'error';
  /** The person ticked "these are practice words, not a real backup". */
  practice: boolean;
  id: string | null;
  error: string | null;
}
const ASK: ShareAsk = { status: 'ask', practice: false, id: null, error: null };

export interface PgState {
  mode: Mode;
  status: Status;
  /** 0–3 while the sample animates, 4 when done. */
  stage: number;
  /** What a real scan is doing. */
  phase: ScanPhase | null;
  /** Reading the sample page, or the person's own photo with the real model. */
  source: 'sample' | 'photo';
  photo: string | null;
  photoName: string;
  /** Pixel size the boxes are drawn against. */
  photoSize: { w: number; h: number } | null;
  words: WordRead[];
  /** The person's choice for a word, by index. */
  picks: Record<number, string>;
  open: number;
  tab: 'words' | 'json';
  mask: boolean;
  error: string | null;
  /** Whether the chosen words pass the BIP39 checksum (real reads). */
  checksum: boolean | null;
  /* the sample Penlock walkthrough */
  shares: number;
  penPick: PenPick;
  /* real Penlock reads */
  penReads: ShareScan[];
  recovered: string[] | null;
  /** Strips found in the current photo (a sample covers only this photo). */
  photoStrips: ShareScan[];
  share: ShareAsk;
}

const IDLE: Omit<PgState, 'mode'> = {
  status: 'idle', stage: 0, phase: null, source: 'sample', photo: null, photoName: '', photoSize: null,
  words: SAMPLE_WORDS, picks: {}, open: -1, tab: 'words', mask: false, error: null, checksum: null,
  shares: 0, penPick: null, penReads: [], recovered: null, photoStrips: [], share: ASK,
};

export const isFlagged = (s: PgState, i: number) => !s.words[i].accepted && !s.picks[i];
export const unsureCount = (s: PgState) => s.words.filter((_, i) => isFlagged(s, i)).length;
export const finalWords = (s: PgState) => s.words.map((w, i) => s.picks[i] || w.selected);
export const latestShare = (s: PgState) => s.penReads[s.penReads.length - 1];

const LOCATE_ERROR = 'I couldn’t find a Penlock strip. Fit the whole strip, with its black corner squares, flat and in focus.';

export function usePlayground() {
  const [s, setS] = useState<PgState>({ mode: 'bip', ...IDLE });
  const iv = useRef<ReturnType<typeof setInterval> | null>(null);
  /** Bumped on every new run or reset, so a late result from an old scan is dropped. */
  const token = useRef(0);
  /** The person's original file, kept in memory only, for an opt-in share. */
  const photoFile = useRef<File | null>(null);

  const patch = useCallback((p: Partial<PgState>) => setS((prev) => ({ ...prev, ...p })), []);
  const stop = useCallback(() => {
    if (iv.current) clearInterval(iv.current);
    iv.current = null;
  }, []);
  useEffect(() => stop, [stop]);

  /** Free the photo and crop images of a real read. */
  const release = (st: PgState) => {
    if (st.photo) URL.revokeObjectURL(st.photo);
    if (st.words !== SAMPLE_WORDS) st.words.forEach((w) => w.cropUrl && URL.revokeObjectURL(w.cropUrl));
  };

  const reset = (extra: Partial<PgState> = {}) => {
    token.current++;
    photoFile.current = null;
    stop();
    release(s);
    setS((p) => ({ ...p, ...IDLE, ...extra }));
  };

  /** The design's scripted run over the sample page or share. */
  const runSample = () => {
    if (s.status === 'running') return;
    const fromPhoto = s.source === 'photo';
    if (fromPhoto) { release(s); photoFile.current = null; }
    token.current++;
    stop();
    const pen = s.mode === 'pen';
    const keepPen = pen && !fromPhoto;
    setS((p) => ({
      ...p,
      ...(fromPhoto ? IDLE : {}),
      status: 'running', stage: 0, open: -1, error: null,
      picks: {}, shares: keepPen ? p.shares : 0, penPick: keepPen && p.shares >= 1 ? p.penPick : null,
    }));
    let stage = 0;
    iv.current = setInterval(() => {
      if (stage >= 3) {
        stop();
        setS((p) => ({ ...p, status: 'done', stage: 4, shares: pen ? Math.min(p.shares + 1, 2) : 0, open: pen ? (p.penPick ? -1 : 6) : 5 }));
      } else {
        stage += 1;
        patch({ stage });
      }
    }, 480);
  };

  /** The real model on the person's own photo. */
  const scanPhoto = async (file: File) => {
    stop();
    const mine = ++token.current;
    const current = () => token.current === mine;
    const pen = s.mode === 'pen';
    const keep = pen && s.source === 'photo' ? s.penReads : [];
    photoFile.current = file;
    if (s.photo) URL.revokeObjectURL(s.photo);
    if (!pen && s.words !== SAMPLE_WORDS) s.words.forEach((w) => w.cropUrl && URL.revokeObjectURL(w.cropUrl));
    patch({
      source: 'photo', photo: URL.createObjectURL(file), photoName: file.name || 'your-photo', photoSize: null,
      status: 'running', stage: 1, phase: 'reading', error: null, open: -1, picks: {}, checksum: null, tab: 'words',
      words: SAMPLE_WORDS, penReads: keep, recovered: null, shares: 0, penPick: null, photoStrips: [], share: ASK,
    });
    const onPhase = (phase: ScanPhase) => { if (current()) patch({ phase, stage: phase === 'loading' ? 0 : 1 }); };

    try {
      if (!pen) {
        const page = await scanWords(file, onPhase);
        if (!current()) return;
        const words = pageToWords(page);
        if (!words.length) throw new Error('I couldn’t find handwritten words. Try a closer, well-lit photo with the whole page in view.');
        patch({ words, photoSize: { w: page.width, h: page.height }, status: 'done', stage: 4, phase: null, open: words.findIndex((w) => !w.accepted) });
        return;
      }

      const found = await scanShares(file, onPhase);
      if (!current()) return;
      const strips = found.filter((f) => f.kind === 'share' && f.index);
      if (!strips.length) {
        throw new Error(found.length ? 'That’s the seed strip. Show me a share strip (1, 2 or 3).' : LOCATE_ERROR);
      }
      const byIndex = new Map(keep.map((r) => [r.index, r]));
      strips.forEach((r) => byIndex.set(r.index, r));
      const penReads = [...byIndex.values()];
      patch({ penReads, photoStrips: strips, status: 'done', stage: 4, phase: null });
      if (penReads.length >= 2) {
        const [a, b] = penReads.slice(-2);
        try {
          const recovered = await recoverShares(a.id, b.id);
          if (current()) patch({ recovered });
        } catch (e) {
          if (current()) patch({ error: (e as Error).message });
        }
      }
    } catch (e) {
      if (!current()) return;
      let error = (e as Error).message;
      if (pen && error.startsWith('scan:')) error = LOCATE_ERROR;
      patch({ status: keep.length ? 'done' : 'error', phase: null, error });
    }
  };

  // Real BIP39 reads: check the phrase once every word is settled.
  const live = s.source === 'photo';
  useEffect(() => {
    if (!live || s.mode !== 'bip' || s.status !== 'done') return;
    if (unsureCount(s) > 0) { patch({ checksum: null }); return; }
    let alive = true;
    checksumPasses(finalWords(s)).then((ok) => { if (alive) patch({ checksum: ok }); }).catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, s.mode, s.status, s.words, s.picks, patch]);

  /** Upload the current photo and its labels, only after the person said yes. */
  const sendSample = async () => {
    const file = photoFile.current;
    if (!file || !s.share.practice || s.share.status === 'sending' || s.share.status === 'sent') return;
    if (s.mode === 'bip' && unsureCount(s) > 0) return;
    const mine = token.current;
    patch({ share: { ...s.share, status: 'sending', error: null } });
    try {
      const id = await shareSample(
        file,
        s.mode === 'bip'
          ? { pipeline: 'bip39', scannedSize: s.photoSize ?? { w: 1, h: 1 }, words: s.words, picks: s.picks, checksumValid: s.checksum }
          : { pipeline: 'penlock', scannedSize: s.photoSize, strips: s.photoStrips, rebuiltWithAnotherShare: !!s.recovered },
      );
      if (token.current === mine) setS((p) => ({ ...p, share: { ...p.share, status: 'sent', id } }));
    } catch (e) {
      if (token.current === mine) setS((p) => ({ ...p, share: { ...p.share, status: 'error', error: (e as Error).message } }));
    }
  };

  const actions = {
    setMode: (mode: Mode) => { if (mode !== s.mode) reset({ mode }); },
    run: runSample,
    scanPhoto,
    forget: () => reset(),
    toggleRow: (i: number) => patch({ open: s.open === i ? -1 : i }),
    pickWord: (i: number, word: string) => setS((p) => ({ ...p, picks: { ...p.picks, [i]: word }, open: -1 })),
    pickPen: (v: PenPick) => patch({ penPick: v, open: -1 }),
    setTab: (tab: PgState['tab']) => patch({ tab }),
    toggleMask: () => setS((p) => ({ ...p, mask: !p.mask })),
    setPractice: (practice: boolean) => setS((p) => ({ ...p, share: { ...p.share, practice } })),
    declineSample: () => setS((p) => ({ ...p, share: { ...p.share, status: 'declined' } })),
    sendSample,
    photoLoaded: (w: number, h: number) => setS((p) => (p.photoSize ? p : { ...p, photoSize: { w, h } })),
  };

  return { s, actions };
}

export type PgActions = ReturnType<typeof usePlayground>['actions'];
