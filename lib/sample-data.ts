import type { WordRead } from './vision/types';

/** Below this confidence the model stops and asks the user. */
export const ASK_THRESHOLD = 80;

const w = (ocr: string, ...c: [string, number][]): WordRead => ({
  ocr,
  selected: c[0][0],
  candidates: c.map(([word, confidence]) => ({ word, confidence })),
  accepted: c[0][1] >= ASK_THRESHOLD,
});

/** The practice page used by the demo. Words 6 and 10 are deliberately unclear. */
export const SAMPLE_WORDS: WordRead[] = [
  w('abandon', ['abandon', 97], ['ability', 2], ['absent', 1]),
  w('ability', ['ability', 95], ['agile', 3], ['able', 2]),
  w('able', ['able', 93], ['table', 5], ['cable', 2]),
  w('about', ['about', 96], ['above', 3], ['absorb', 1]),
  w('above', ['above', 94], ['about', 5], ['glove', 1]),
  w('absert', ['absent', 71], ['assert', 22], ['absurd', 4]),
  w('absorb', ['absorb', 95], ['absurd', 3], ['about', 2]),
  w('abstract', ['abstract', 98], ['attract', 1], ['abuse', 1]),
  w('absurd', ['absurd', 92], ['absorb', 6], ['absent', 2]),
  w('amuse', ['abuse', 58], ['amuse', 39], ['above', 2]),
  w('access', ['access', 96], ['across', 3], ['actress', 1]),
  w('accident', ['accident', 97], ['accuse', 2], ['account', 1]),
];

/** Word indexes the sample flags (6 and 10, zero-based). */
export const isAsked = (i: number) => i === 5 || i === 9;

export const GLYPHS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

/** Deterministic fake Penlock glyph for row r, column c of share s. */
export const glyph = (r: number, c: number, s: number) =>
  GLYPHS[(r * 7 + c * 11 + 3 + s * 5) % GLYPHS.length];

/** 9 preview rows of a Penlock share, formatted "ABC DEF". */
export const penPreview = (s: number) =>
  Array.from({ length: 9 }, (_, r) => {
    let t = '';
    for (let c = 0; c < 6; c++) t += glyph(r, c, s);
    return `${t.slice(0, 3)} ${t.slice(3)}`;
  });
