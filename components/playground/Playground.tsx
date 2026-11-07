'use client';

import type { ReactNode } from 'react';
import { GLYPHS, glyph } from '@/lib/sample-data';
import { rowUnsure } from '@/lib/vision/client';
import { sharingEnabled } from '@/lib/vision/share';
import { removalRequest } from '@/lib/links';
import type { Point, WordRead } from '@/lib/vision/types';
import { isFlagged, latestShare, unsureCount, usePlayground, type PenPick, type PgActions, type PgState } from './usePlayground';

type P = { s: PgState; a: PgActions };

const VALID_LENGTHS = [12, 15, 18, 21, 24];

const Short = ({ long, short }: { long: string; short: string }) => (
  <><span className="seg-long">{long}</span><span className="seg-short">{short}</span></>
);

function FileButton({ a, className, children, label }: { a: PgActions; className: string; children: ReactNode; label: string }) {
  return (
    <label className={className}>
      <input
        type="file"
        accept="image/*"
        aria-label={label}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) a.scanPhoto(f); e.target.value = ''; }}
      />
      {children}
    </label>
  );
}

/** Which share the sample is on, or which the real strip says it is. */
function shareNo(s: PgState) {
  if (s.source === 'photo') return latestShare(s)?.index ?? 1;
  return Math.max(1, s.status === 'running' ? s.shares + 1 : s.shares);
}

/* ---------------------------------------------------------------- input */

const pts = (q: Point[]) => q.map(([x, y]) => `${x},${y}`).join(' ');

function Viewer({ s, a }: P) {
  const running = s.status === 'running';
  const done = s.status === 'done';

  if (s.source === 'photo' && s.photo) {
    const strip = s.mode === 'pen' ? latestShare(s) : undefined;
    return (
      <div className="viewer">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="viewer-photo"
          src={s.photo}
          alt="Your practice photo"
          onLoad={(e) => a.photoLoaded(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)}
        />
        {done && s.photoSize && (
          <svg className="viewer-boxes" viewBox={`0 0 ${s.photoSize.w} ${s.photoSize.h}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            {s.mode === 'bip' && s.words.map((w, i) => w.quad && (
              <polygon
                key={i}
                points={pts(w.quad)}
                fill="none"
                stroke={isFlagged(s, i) ? '#E5A84B' : '#5BC891'}
                strokeWidth="2.5"
                strokeDasharray={isFlagged(s, i) ? '6 4' : undefined}
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {strip && (
              <polygon points={pts([0, 1, 3, 2].map((k) => strip.quad[k]))} fill="none" stroke="#5BC891" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
            )}
          </svg>
        )}
        {running && <div className="scanline is-sweep" />}
      </div>
    );
  }

  const seen = running ? s.stage >= 1 : done;
  const flagSeen = running ? s.stage >= 3 : done;
  const share = shareNo(s);
  return (
    <div className="viewer" aria-hidden="true">
      <div className="paper">
        {s.mode === 'bip' ? (
          <div className="paper-grid">
            {s.words.map((w, i) => (
              <span key={i} className={`pw${seen ? (!w.accepted && flagSeen ? ' is-warn' : ' is-on') : ''}`}>{w.ocr}</span>
            ))}
          </div>
        ) : (
          <>
            <p className="strip-label">PENLOCK · SHARE {share}</p>
            <div className="strip">
              {Array.from({ length: 12 }, (_, r) => (
                <div key={r} className="strip-row">
                  {Array.from({ length: 6 }, (_, c) => (
                    <span key={c} className={`strip-cell${seen ? (r === 6 && c === 2 && flagSeen && !s.penPick ? ' is-warn' : ' is-on') : ''}`}>
                      {glyph(r, c, share)}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </>
        )}
        {running && <div className="scanline" style={{ top: `${Math.round(((s.stage + 0.5) / 4) * 100)}%` }} />}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- output */

const Conf = ({ pct, warn }: { pct: number; warn?: boolean }) => (
  <span role="cell" className="c-conf">
    <span className="track"><span className={warn ? 'is-warn' : undefined} style={{ width: `${pct}%` }} /></span>
    <span className="pct">{pct}%</span>
  </span>
);

function WordTable({ s, a }: P) {
  const live = s.source === 'photo';
  const mask = (t: string) => (s.mask ? '•'.repeat(Math.min(8, t.length)) : t);

  const why = (w: WordRead, i: number) => {
    if (live) return w.accepted ? 'Top candidates from all 2048 words. Pick another if it misread you:' : `It read “${w.ocr || '?'}” and isn’t sure. The closest seed words:`;
    if (w.accepted) return 'Top three candidates from all 2048 words:';
    return i === 5 ? '“absert” is not a seed word. These are the closest:' : 'Both “abuse” and “amuse” are real seed words. Which did you write?';
  };

  return (
    <div role="table" aria-label="Words read" className="wt">
      <div role="row" className="wt-head">
        <span role="columnheader">#</span>
        <span role="columnheader"><Short long="Handwriting" short="Written" /></span>
        <span role="columnheader">Read as</span>
        <span role="columnheader" className="h-conf">Confidence</span>
        <span role="columnheader" style={{ textAlign: 'right' }}>Status</span>
      </div>
      {s.words.map((w, i) => {
        const pick = s.picks[i];
        const flagged = isFlagged(s, i);
        const open = s.open === i;
        const shown = pick || w.selected;
        const pct = w.candidates.find((c) => c.word === shown)?.confidence ?? w.candidates[0]?.confidence ?? 0;
        const canPick = live || !w.accepted;
        return (
          <div role="row" key={i} className={`wt-item${flagged ? ' is-flag' : ''}`}>
            <button
              type="button"
              className="wt-btn"
              onClick={() => a.toggleRow(i)}
              aria-expanded={open}
              aria-label={`Word ${i + 1}${flagged ? ', needs your pick' : ', show how it was read'}`}
            >
              <span role="cell" className="c-n">{i + 1}</span>
              <span role="cell" className="c-hand">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {w.cropUrl ? <img src={w.cropUrl} alt={`Handwriting read as “${w.ocr}”`} /> : w.ocr}
              </span>
              <span role="cell" className="c-word">{flagged ? '—' : mask(shown)}</span>
              <Conf pct={pct} warn={flagged} />
              <span role="cell" className="c-status">
                {flagged
                  ? <span className="chip chip--warn"><Short long="Pick one" short="Pick" /></span>
                  : pick
                    ? <span className="chip chip--fixed"><Short long="You picked" short="Picked" /></span>
                    : <span className="chip">Sure</span>}
              </span>
            </button>
            {open && (
              <div className="wt-detail">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {w.cropUrl && <img className="crop-big" src={w.cropUrl} alt={`The crop the model read as “${w.ocr}”`} />}
                <p>{why(w, i)}</p>
                <div className="opts">
                  {w.candidates.map((c) => (
                    <button
                      key={c.word}
                      type="button"
                      className="opt"
                      aria-pressed={pick === c.word}
                      onClick={() => canPick && a.pickWord(i, c.word)}
                    >
                      <b>{mask(c.word)}</b><small>{c.confidence}%</small>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** The design's sample share: one smudged symbol on row 7 to fix. */
function SamplePenTable({ s, a }: P) {
  const share = shareNo(s);
  const g = (r: number, c: number) => glyph(r, c, share);
  const top = g(6, 2);
  const i = GLYPHS.indexOf(top);
  const opts: [string, string, PenPick][] = [[top, '62%', 'right'], [GLYPHS[(i + 5) % GLYPHS.length], '31%', 'a1'], [GLYPHS[(i + 11) % GLYPHS.length], '7%', 'a2']];
  return (
    <div role="table" aria-label="Penlock rows read" className="wt is-pen">
      <div role="row" className="wt-head">
        <span role="columnheader">Row</span><span role="columnheader">Symbols</span>
        <span role="columnheader" className="h-conf">Lowest cell confidence</span>
        <span role="columnheader" style={{ textAlign: 'right' }}>Check</span>
      </div>
      {Array.from({ length: 12 }, (_, r) => {
        const bad = r === 6 && !s.penPick;
        const open = s.open === 6 && r === 6;
        const p = r === 6 ? (s.penPick ? 100 : 62) : 90 + ((r * 7) % 9);
        let gl = '';
        for (let c = 0; c < 6; c++) gl += r === 6 && c === 2 ? (s.penPick ? top : '?') : g(r, c);
        return (
          <div role="row" key={r} className={`wt-item${bad ? ' is-flag' : ''}`}>
            <button
              type="button"
              className="wt-btn"
              onClick={() => r === 6 && a.toggleRow(6)}
              aria-expanded={open}
              aria-label={`Row ${r + 1}${bad ? ', needs your pick' : ''}`}
            >
              <span role="cell" className="c-n">{r + 1}</span>
              <span role="cell" className="c-glyphs">{s.mask ? '••••••' : gl}</span>
              <Conf pct={p} warn={bad} />
              <span role="cell" className="c-status">
                {bad ? <span className="chip chip--warn">Fails</span> : r === 6 ? <span className="chip chip--fixed">Fixed</span> : <span className="chip">Pass</span>}
              </span>
            </button>
            {open && (
              <div className="wt-detail">
                <p>Symbol 3 is smudged and the row fails its check. Which is it?</p>
                <div className="opts">
                  {opts.map(([sym, pct, v]) => (
                    <button key={v} type="button" className="opt" aria-pressed={s.penPick === v} onClick={() => a.pickPen(v)}>
                      <b className="mono">{sym}</b><small>{pct}</small>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** A real strip: each row as read, and the rebuilt words once two shares are in. */
function LivePenTable({ s }: { s: PgState }) {
  const share = latestShare(s);
  if (!share) return null;
  return (
    <>
      <div role="table" aria-label={`Penlock share ${share.index} rows read`} className="wt is-pen">
        <div role="row" className="wt-head">
          <span role="columnheader">Row</span><span role="columnheader">Symbols</span>
          <span role="columnheader" className="h-conf">Lowest cell confidence</span>
          <span role="columnheader" style={{ textAlign: 'right' }}>Read</span>
        </div>
        {share.rows.map((row, r) => {
          const unsure = rowUnsure(row);
          const low = Math.round(Math.min(...row.map((c) => (c.unread ? 0 : c.probability ?? 0))) * 100);
          return (
            <div role="row" key={r} className={`wt-item${unsure ? ' is-flag' : ''}`}>
              <div className="wt-btn">
                <span role="cell" className="c-n">{r + 1}</span>
                <span role="cell" className="c-glyphs">{s.mask ? '••••••' : row.map((c) => (c.unread ? '?' : c.symbol)).join('')}</span>
                <Conf pct={low} warn={unsure} />
                <span role="cell" className="c-status">
                  {unsure ? <span className="chip chip--warn">Unsure</span> : <span className="chip">Clear</span>}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      {s.recovered && (
        <div className="rebuilt">
          <p>Rebuilt from shares {s.penReads.slice(-2).map((r) => r.index).join(' + ')}</p>
          <ol>
            {s.recovered.map((w, i) => <li key={i}><span>{i + 1}</span>{s.mask ? '••••••' : w}</li>)}
          </ol>
        </div>
      )}
    </>
  );
}

function json(s: PgState): string {
  const live = s.source === 'photo';
  const mask = (t: string) => (s.mask ? '•'.repeat(Math.min(8, t.length)) : t);
  const p2 = (n: number) => (n / 100).toFixed(2);

  if (s.mode === 'bip') {
    const lines = s.words.map((w, i) => {
      const flagged = isFlagged(s, i);
      const word = flagged ? null : s.picks[i] || w.selected;
      const top = w.candidates[0]?.confidence ?? 0;
      const cands = '[' + w.candidates.map((c) => `["${mask(c.word)}", ${p2(c.confidence)}]`).join(', ') + ']';
      const extra = live
        ? `, "accepted": ${w.accepted}, "candidates": ${cands}`
        : !w.accepted ? `, "candidates": ${cands}, "review": ${flagged}` : '';
      return `    { "index": ${i + 1}, "ocr": ${JSON.stringify(w.ocr)}, "word": ${word ? `"${mask(word)}"` : 'null'}, "p": ${p2(top)}${extra} }`;
    });
    const valid = live ? String(s.checksum) : String(unsureCount(s) === 0);
    return `{\n  "pipeline": "bip39",\n  "checksum_valid": ${valid},\n  "words": [\n${lines.join(',\n')}\n  ]\n}`;
  }

  if (live) {
    const share = latestShare(s);
    if (!share) return '{}';
    const rows = share.rows.map((row, r) => {
      const symbols = s.mask ? '••••••' : row.map((c) => (c.unread ? '?' : c.symbol)).join('');
      const low = Math.min(...row.map((c) => (c.unread ? 0 : c.probability ?? 0)));
      return `    { "row": ${r + 1}, "symbols": "${symbols}", "lowest_p": ${low.toFixed(2)} }`;
    });
    const rec = s.recovered ? `,\n  "recovered": [${s.recovered.map((w) => `"${mask(w)}"`).join(', ')}]` : '';
    return `{\n  "pipeline": "penlock",\n  "share": ${share.index},\n  "rows": [\n${rows.join(',\n')}\n  ]${rec}\n}`;
  }

  const share = shareNo(s);
  const top = glyph(6, 2, share);
  const rows = Array.from({ length: 12 }, (_, r) => {
    let gl = '';
    for (let c = 0; c < 6; c++) gl += r === 6 && c === 2 ? (s.penPick ? top : '?') : glyph(r, c, share);
    const fails = r === 6 && !s.penPick;
    return `    { "row": ${r + 1}, "symbols": "${s.mask ? '••••••' : gl}", "check": "${fails ? 'fail' : 'pass'}" }`;
  });
  return `{\n  "pipeline": "penlock",\n  "share": ${share},\n  "rows": [\n${rows.join(',\n')}\n  ]\n}`;
}

function Verdict({ s, a }: P) {
  const live = s.source === 'photo';
  let text = '';
  let note = '';
  let ok = true;
  let extra: ReactNode = null;

  if (s.mode === 'bip') {
    const unsure = unsureCount(s);
    if (unsure) {
      ok = false;
      text = `${unsure} word${unsure > 1 ? 's' : ''} to confirm`;
      note = 'Open the flagged rows and pick what you wrote.';
    } else if (!live || s.checksum) {
      text = '✓ Checksum passes';
      note = 'A good sign, not proof. Compare with your paper.';
    } else if (s.checksum === null) {
      text = 'Checking…';
    } else {
      ok = false;
      text = '✗ Checksum fails';
      note = 'At least one word is wrong or out of order. Open each word and compare it with your paper.';
    }
    if (live && !VALID_LENGTHS.includes(s.words.length)) {
      note = `Found ${s.words.length} words; a phrase has 12, 15, 18, 21 or 24. ${note}`;
    }
  } else if (live) {
    const share = latestShare(s);
    if (s.error) {
      ok = false;
      text = s.recovered ? 'Couldn’t rebuild' : 'Couldn’t read that photo';
      note = s.error;
    } else if (s.recovered) {
      text = '✓ Rebuilt from 2 of 3 shares';
      note = `Compare these ${s.recovered.length} words with the phrase you split.`;
    } else if (s.penReads.length === 1) {
      text = `✓ Share ${share?.index} read`;
      note = 'Any second share rebuilds the backup.';
    } else {
      text = 'Rebuilding…';
    }
    if (!s.recovered) {
      extra = <FileButton a={a} className="small-btn small-btn--ink file-btn" label="Photo of another Penlock share">Read another share</FileButton>;
    }
  } else if (!s.penPick) {
    ok = false;
    text = 'Row 7 to confirm';
    note = 'Pick the smudged symbol to pass the row check.';
  } else if (s.shares >= 2) {
    text = '✓ Rebuilt from 2 of 3 shares';
    note = 'Your 12 words are ready to reveal on the device.';
  } else {
    text = '✓ Share 1 passes';
    note = 'Any second share rebuilds the backup.';
    extra = <button type="button" className="small-btn small-btn--ink" onClick={a.run}>Read share 2</button>;
  }

  return (
    <div className="verdict-bar">
      <span className={`verdict${ok ? '' : ' is-warn'}`}>{text}</span>
      <span className="verdict-note">{note}</span>
      {extra}
      <button type="button" className="small-btn" aria-pressed={s.mask} onClick={a.toggleMask}>{s.mask ? 'Show words' : 'Hide words'}</button>
      <button type="button" className="small-btn" onClick={a.forget}>Forget</button>
    </div>
  );
}

/** Asked once per photo after a real scan: may we keep this to train the model? */
function ShareConsent({ s, a }: P) {
  const bip = s.mode === 'bip';
  const { share } = s;
  if (share.status === 'sent') {
    return (
      <div className="consent" role="status">
        <p className="consent-done">✓ Thank you. This sample was shared for training.</p>
        <p className="consent-fine">
          Sample ID <code>{share.id}</code>. Changed your mind?{' '}
          <a href={removalRequest(share.id ?? '')} target="_blank" rel="noreferrer">Ask us to remove it</a>. Forget
          clears this page; it doesn’t delete a shared sample.
        </p>
      </div>
    );
  }
  const unsure = bip ? unsureCount(s) : 0;
  const sending = share.status === 'sending';
  const canSend = share.practice && !unsure && !sending;
  return (
    <div className="consent" role="region" aria-labelledby="consent-h">
      <h3 id="consent-h">Help train the model?</h3>
      <p className="consent-copy">
        Share this photo {bip ? 'and the words you confirmed' : 'and the symbols it read'} so future versions read
        handwriting like yours. It’s sent once, only if you say yes, to private storage for the bitcoin-vision team.
        Location and camera details are removed from the photo first.
      </p>
      <label className="consent-check">
        <input type="checkbox" checked={share.practice} disabled={sending} onChange={(e) => a.setPractice(e.target.checked)} />
        <span>These are practice words, <strong>not a real backup</strong>.</span>
      </label>
      {unsure > 0 && (
        <p className="consent-fine">Confirm the {unsure} flagged word{unsure > 1 ? 's' : ''} above first, so the labels are right.</p>
      )}
      {share.error && <p className="consent-error" role="alert">{share.error}</p>}
      <div className="consent-actions">
        <button type="button" className="small-btn small-btn--ink" disabled={!canSend} onClick={a.sendSample}>
          {sending ? 'Sharing…' : share.status === 'error' ? 'Try again' : 'Share this sample'}
        </button>
        <button type="button" className="small-btn" disabled={sending} onClick={a.declineSample}>No thanks</button>
      </div>
    </div>
  );
}

function Output({ s, a }: P) {
  const bip = s.mode === 'bip';
  const live = s.source === 'photo';

  if (s.status === 'idle') {
    return (
      <div className="out-empty">
        <strong>Nothing read yet.</strong>
        <p>Press Run to find, read, match and check the {bip ? '12 words' : 'share’s 72 symbols'}.</p>
        <p>Or use your own practice photo: the real models run in this tab.</p>
      </div>
    );
  }
  if (s.status === 'error') {
    return (
      <div className="out-empty is-error" role="alert">
        <strong>Couldn’t read that photo.</strong>
        <p style={{ maxWidth: 420 }}>{s.error}</p>
      </div>
    );
  }
  if (s.status === 'running') {
    const text = live
      ? s.phase === 'loading'
        ? 'Loading the models into this tab (about 30 MB, only once)…'
        : bip ? 'Finding and reading each word…' : 'Finding the strip and reading its 72 cells…'
      : (bip ? ['Finding the page…', 'Reading each word…', 'Matching 2048 seed words…', 'Checking the checksum…'] : ['Finding the strip…', 'Reading 72 cells…', 'Matching 29 symbols…', 'Running row checks…'])[Math.min(s.stage, 3)];
    return (
      <div className="out-running">
        <p style={{ fontSize: 17, fontWeight: 500 }}>{text}</p>
        <div className={`progress${live ? ' is-indeterminate' : ''}`}>
          <div style={live ? undefined : { width: `${Math.round(((s.stage + 1) / 4) * 100)}%` }} />
        </div>
        <p className="mono" style={{ fontSize: 12, color: 'var(--dim)' }}>on-device · no network</p>
      </div>
    );
  }
  if (s.tab === 'json') {
    return (
      <>
        <pre className="json">{json(s)}</pre>
        <p className="json-note">
          {live ? 'From this scan, trimmed: boxes and crops left out.' : <>Illustrative shape. Run <code>cargo doc</code> for the exact types.</>}
        </p>
      </>
    );
  }
  if (bip) return <WordTable s={s} a={a} />;
  return live ? <LivePenTable s={s} /> : <SamplePenTable s={s} a={a} />;
}

/* ---------------------------------------------------------------- the section */

export default function Playground() {
  const { s, actions: a } = usePlayground();
  const bip = s.mode === 'bip';
  const live = s.source === 'photo';
  const running = s.status === 'running';
  const done = s.status === 'done';

  const names = bip ? ['Find', 'Read', 'Match', 'Check'] : ['Find strip', 'Read cells', 'Match', 'Row checks'];
  const runLabel = running ? 'Running…' : live ? 'Run sample ▸' : done ? (!bip && s.shares === 1 ? 'Read share 2' : 'Run again') : 'Run ▸';
  const inputName = live ? s.photoName : bip ? 'sample-recovery-page.jpg' : `sample-penlock-share-${shareNo(s)}.jpg`;

  return (
    <section id="demo" className="sec" aria-labelledby="demo-h">
      <p className="kicker">01 · Playground</p>
      <div className="sec-head">
        <h2 id="demo-h" className="h2">Run it on a practice backup.</h2>
        <p>
          Press Run to replay the pipeline on a sample page, step by step. Or use your own practice photo: the real
          models run right here in your browser, and the photo stays on your device unless you choose to share it.
        </p>
      </div>

      <div className="pg">
        <div className="pg-bar">
          <div role="group" aria-label="Backup type" className="seg">
            <button type="button" aria-pressed={bip} onClick={() => a.setMode('bip')}><Short long="Recovery words" short="Words" /></button>
            <button type="button" aria-pressed={!bip} onClick={() => a.setMode('pen')}><Short long="Penlock share" short="Penlock" /></button>
          </div>
          <ol aria-label="Pipeline stages" className="pills">
            {names.map((n, i) => {
              const isDone = done || (running && i < s.stage);
              const isNow = running && i === s.stage;
              return <li key={n} className={`pill${isDone ? ' is-done' : isNow ? ' is-now' : ''}`}>{(isDone ? '✓ ' : '') + n}</li>;
            })}
          </ol>
          <button type="button" className="run" onClick={a.run} disabled={running}>{runLabel}</button>
        </div>

        <div className="pg-body">
          <div className="pg-input">
            <p className="pg-input-name">INPUT · {inputName}</p>
            <Viewer s={s} a={a} />
            <FileButton a={a} className="upload" label="Use your own practice photo">Use your own practice photo</FileButton>
            <p className="fine">Practice words only. Never photograph a real backup on a connected device.</p>
          </div>

          <div className="pg-out">
            <div role="tablist" aria-label="Output view" className="tabs">
              <button type="button" role="tab" className="tab" aria-selected={s.tab === 'words'} onClick={() => a.setTab('words')}>{bip ? 'Words' : 'Rows'}</button>
              <button type="button" role="tab" className="tab" aria-selected={s.tab === 'json'} onClick={() => a.setTab('json')}>JSON</button>
            </div>
            <div className="out" aria-live="polite">
              <Output s={s} a={a} />
            </div>
            {done && <Verdict s={s} a={a} />}
            {done && live && sharingEnabled && s.share.status !== 'declined' && <ShareConsent s={s} a={a} />}
          </div>
        </div>
      </div>
    </section>
  );
}
