// bitcoin-vision · interactive demo (vanilla JS port of the Synth/Air design)
(function () {
  'use strict';

  // [shown word, what the AI read, candidates [word, %]]
  const WORDS = [
    ['abandon', 'abandon', [['abandon', 97], ['ability', 2], ['absent', 1]]],
    ['ability', 'ability', [['ability', 95], ['agile', 3], ['able', 2]]],
    ['able', 'able', [['able', 93], ['table', 5], ['cable', 2]]],
    ['about', 'about', [['about', 96], ['above', 3], ['absorb', 1]]],
    ['above', 'above', [['above', 94], ['about', 5], ['glove', 1]]],
    ['absent', 'absert', [['absent', 71], ['assert', 22], ['absurd', 4]]],
    ['absorb', 'absorb', [['absorb', 95], ['absurd', 3], ['about', 2]]],
    ['abstract', 'abstract', [['abstract', 98], ['attract', 1], ['abuse', 1]]],
    ['absurd', 'absurd', [['absurd', 92], ['absorb', 6], ['absent', 2]]],
    ['abuse', 'amuse', [['abuse', 58], ['amuse', 39], ['above', 2]]],
    ['access', 'access', [['access', 96], ['across', 3], ['actress', 1]]],
    ['accident', 'accident', [['accident', 97], ['accuse', 2], ['account', 1]]]
  ];
  const GLYPHS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const ORDER = ['camera', 'scanning', 'review', 'result'];
  const STEP_COLORS = ['var(--a1)', 'var(--a2)', 'var(--a3)', 'var(--a4)'];
  const BAR_COLORS = ['var(--a2)', 'var(--a4)', 'var(--a1)'];

  const S = {
    mode: 'bip', step: 'camera', stage: 0, picks: {}, penPick: null, open: -1, shares: 0,
    reveal: false, copied: false, rsel: -1, playing: false,
    upImg: null, shareImg: null, shareName: '', ok: false, sent: false
  };
  let iv = null;
  let timers = [];

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const g = (r, c, s) => GLYPHS[(r * 7 + c * 11 + 3 + (s === undefined ? S.shares : s) * 5) % GLYPHS.length];

  function set(patch) { Object.assign(S, patch); render(); }
  function stopAll() {
    if (iv) { clearInterval(iv); iv = null; }
    timers.forEach(clearTimeout);
    timers = [];
  }
  function at(ms, fn) { timers.push(setTimeout(fn, ms)); }

  function scan() {
    if (iv) clearInterval(iv);
    set({ step: 'scanning', stage: 0, open: -1 });
    iv = setInterval(() => {
      if (S.stage >= 3) {
        clearInterval(iv); iv = null;
        set({ step: 'review', stage: 4, shares: S.mode === 'pen' ? Math.min(S.shares + 1, 2) : 0, picks: {}, penPick: null });
      } else set({ stage: S.stage + 1 });
    }, 520);
  }

  function goTo(s) {
    stopAll();
    const pen = S.mode === 'pen';
    if (s === 'camera') set({ step: 'camera', stage: 0, open: -1, rsel: -1, playing: false });
    else if (s === 'scanning') { S.playing = false; scan(); }
    else if (s === 'review') set({ step: 'review', stage: 4, picks: {}, penPick: null, open: -1, shares: pen ? Math.max(S.shares, 1) : 0, playing: false });
    else set({ step: 'result', picks: { 5: 'absent', 9: 'abuse' }, penPick: 'right', shares: pen ? 2 : 0, open: -1, rsel: -1, reveal: false, copied: false, playing: false });
  }

  function play() {
    stopAll();
    const pen = S.mode === 'pen';
    set({ step: 'camera', stage: 0, picks: {}, penPick: null, open: -1, shares: 0, reveal: false, copied: false, rsel: -1, playing: true });
    at(900, scan);
    if (!pen) {
      at(3300, () => set({ open: 5 }));
      at(4400, () => set({ picks: { 5: 'absent' }, open: -1 }));
      at(5000, () => set({ open: 9 }));
      at(6100, () => set({ picks: { 5: 'absent', 9: 'abuse' }, open: -1 }));
      at(6900, () => set({ step: 'result', rsel: -1 }));
      at(7900, () => set({ reveal: true, playing: false }));
    } else {
      at(3300, () => set({ open: 6 }));
      at(4400, () => set({ penPick: 'right', open: -1 }));
      at(5200, () => set({ step: 'camera', stage: 0 }));
      at(6000, scan);
      at(8600, () => set({ step: 'result', rsel: -1 }));
      at(9600, () => set({ reveal: true, playing: false }));
    }
  }

  function setMode(m) {
    stopAll();
    set({ mode: m, step: 'camera', stage: 0, picks: {}, penPick: null, open: -1, shares: 0, reveal: false, copied: false, rsel: -1, playing: false });
  }

  function next() {
    stopAll();
    const bip = S.mode === 'bip';
    if (bip || S.shares >= 2) {
      set({
        step: 'result', rsel: -1, reveal: false, copied: false, playing: false,
        picks: bip ? Object.assign({ 5: S.picks[5] || 'absent', 9: S.picks[9] || 'abuse' }, S.picks) : S.picks,
        penPick: S.penPick || 'right'
      });
    } else set({ step: 'camera', stage: 0, open: -1, playing: false });
  }

  // ---------- pen helpers ----------
  function penAlts() {
    const top = g(6, 2);
    const i = GLYPHS.indexOf(top);
    return { top, alt1: GLYPHS[(i + 5) % GLYPHS.length], alt2: GLYPHS[(i + 11) % GLYPHS.length] };
  }

  function bar(word, pct, color) {
    return `<div class="bar-row"><div class="bar-head"><span>${esc(word)}</span><span class="muted">${pct}</span></div><div class="bar-track"><div style="width:${parseInt(pct, 10)}%;background:${color}"></div></div></div>`;
  }

  // ---------- render: left rail ----------
  function renderRail() {
    const bip = S.mode === 'bip';
    $('seg-bip').setAttribute('aria-pressed', String(bip));
    $('seg-pen').setAttribute('aria-pressed', String(!bip));
    const cur = ORDER.indexOf(S.step);
    const rd = bip
      ? [['Point', 'Fit the page in the frame'], ['Read', 'Find, read, match'], ['Check', 'It asks when unsure'], ['Done', 'Words hidden until revealed']]
      : [['Point', 'Show one Penlock share'], ['Read', '72 symbols, row by row'], ['Check', 'Fix any smudge, add share 2'], ['Done', 'Backup rebuilt']];
    $('demo-rail').innerHTML = rd.map((d, i) => `
      <li><button type="button" class="rail-btn" data-act="goto" data-v="${ORDER[i]}" aria-current="${i === cur ? 'step' : 'false'}" style="--c:${STEP_COLORS[i]}">
        <span class="rail-num">${i + 1}</span>
        <span class="rail-text"><b>${d[0]}</b><small>${d[1]}</small></span>
      </button></li>`).join('');
    $('play-label').textContent = S.playing ? 'Playing…' : 'Play the demo';
  }

  // ---------- render: phone screen ----------
  function renderCamera() {
    const bip = S.mode === 'bip';
    const scanning = S.step === 'scanning';
    const scanned = scanning && S.stage >= 1;
    let page;
    if (bip) {
      page = '<div class="mini-grid">' + WORDS.map((w, i) => {
        const cls = scanned ? ((i === 5 || i === 9) && S.stage >= 3 ? ' is-warn' : ' is-on') : '';
        return `<span class="mini-word${cls}">${w[1]}</span>`;
      }).join('') + '</div>';
    } else {
      let rows = '';
      for (let r = 0; r < 12; r++) {
        let cells = '';
        for (let c = 0; c < 6; c++) {
          const cls = scanned ? (r === 6 && c === 2 && S.stage >= 3 ? ' is-on is-warn' : ' is-on') : '';
          cells += `<span class="pen-cell${cls}">${g(r, c)}</span>`;
        }
        rows += `<div class="pen-row">${cells}</div>`;
      }
      page = `<div class="pen-grid">${rows}</div>`;
    }
    const scanLine = scanning ? `<div class="scanline" style="top:${Math.round((S.stage + 0.5) / 4 * 100)}%"></div>` : '';
    const upload = S.upImg && S.step === 'camera' ? `<img class="vf-upload" src="${S.upImg}" alt="Your practice photo">` : '';
    const title = bip ? 'Scan recovery words' : 'Scan Penlock share ' + (S.shares + 1);

    let bottom = '';
    if (S.step === 'camera') {
      bottom = `
        <div class="cam-controls">
          <label class="gallery"><input type="file" accept="image/*" data-change="upload" aria-label="Use your own photo of practice words">
            <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 16l5-5 4 4 3-3 6 6"/></svg>
          </label>
          <button type="button" class="shutter" data-act="scan" aria-label="Take photo"><span></span></button>
          <span class="tap-hint">Tap to<br>scan</span>
        </div>`;
    } else {
      const names = bip ? ['Find', 'Read', 'Match', 'Check'] : ['Find share', 'Read symbols', 'Match', 'Check rows'];
      const stages = names.map((n, i) => {
        const cls = i < S.stage ? ' is-done' : i === S.stage ? ' is-now' : '';
        const mark = i < S.stage ? '✓  ' : i === S.stage ? '•  ' : '   ';
        return `<p class="stage${cls}">${mark}${n}</p>`;
      }).join('');
      bottom = `
        <div class="sheet" aria-live="polite">
          <h3>Reading…</h3>
          <div class="progress"><div style="width:${Math.round((S.stage + 1) / 4 * 100)}%"></div></div>
          ${stages}
        </div>`;
    }

    return `
      <div class="cam">
        <p class="cam-title">${title}</p>
        <div class="vf">
          ${upload}
          <div class="mini-page">${page}${scanLine}</div>
          <div class="corners" aria-hidden="true"><span></span><span></span><span></span><span></span></div>
        </div>
        ${bottom}
      </div>`;
  }

  function optBtn(word, pct, pressed, act, v, i, hand) {
    return `<button type="button" class="opt" data-act="${act}" data-v="${esc(v)}" data-i="${i}" aria-pressed="${pressed}"><span class="opt-word${hand ? ' hand' : ''}">${esc(word)}</span><small>${pct}</small></button>`;
  }

  function reviewCounts() {
    let unsure = 0;
    WORDS.forEach((w, i) => { if (w[2][0][1] < 80 && !S.picks[i]) unsure++; });
    return { unsure, penUnsure: S.penPick ? 0 : 1 };
  }

  function renderReview() {
    const bip = S.mode === 'bip';
    const { unsure, penUnsure } = reviewCounts();
    const n = bip ? unsure : penUnsure;
    const title = n ? n + ' to check' : 'All good';
    let list = '';

    if (bip) {
      list = WORDS.map((w, i) => {
        const pick = S.picks[i];
        const flagged = w[2][0][1] < 80 && !pick;
        const open = S.open === i;
        const p = w[2][0][1];
        const lvl = pick ? 3 : p >= 90 ? 3 : p >= 70 ? 2 : 1;
        const col = pick || lvl === 3 ? 'var(--a2)' : lvl === 2 ? 'var(--a3)' : 'var(--a1)';
        const dots = [1, 2, 3].map((k) => `<i style="${k <= lvl ? 'background:' + col : ''}"></i>`).join('');
        const tag = flagged ? '<span class="tag-check">Check</span>' : pick ? '<span class="tag-ok">✓</span>' : '';
        const body = open ? `<div class="rrow-body"><div class="ocr">${w[1]}</div>${w[2].map((c) => optBtn(c[0], c[1] + '%', pick === c[0], 'pick', c[0], i, false)).join('')}</div>` : '';
        const cls = flagged ? ' is-flag' : open ? ' is-open' : '';
        return `<div class="rrow${cls}">
          <button type="button" class="rrow-btn" data-act="toggle" data-i="${i}" aria-expanded="${open}" aria-label="Word ${i + 1}${flagged ? ', check this' : ''}">
            <span class="rrow-n">${i + 1}</span><span class="rrow-word">${pick || w[2][0][0]}</span>
            <span class="dots" aria-hidden="true">${dots}</span>${tag}
          </button>${body}</div>`;
      }).join('');
    } else {
      const { top, alt1, alt2 } = penAlts();
      for (let r = 0; r < 12; r++) {
        const bad = r === 6 && !S.penPick;
        const open = S.open === 6 && r === 6;
        let gl = '';
        for (let c = 0; c < 6; c++) gl += r === 6 && c === 2 ? (S.penPick ? top : '?') : g(r, c);
        const tag = bad ? '<span class="tag-check">Check</span>' : '<span class="tag-ok">✓</span>';
        const body = open ? `<div class="rrow-body">${[[top, '62%', 'right'], [alt1, '31%', 'a1'], [alt2, '7%', 'a2']].map((o) => optBtn(o[0], o[1], S.penPick === o[2], 'penpick', o[2], r, true)).join('')}</div>` : '';
        list += `<div class="rrow${bad ? ' is-flag' : ''}">
          <button type="button" class="rrow-btn" data-act="toggle" data-i="${r}" style="min-height:40px" aria-expanded="${open}" aria-label="Row ${r + 1}${bad ? ', check this' : ''}">
            <span class="rrow-n">${r + 1}</span><span class="rrow-glyphs">${gl}</span>${tag}
          </button>${body}</div>`;
      }
    }

    const nextLabel = bip ? 'Show my words' : (S.shares >= 2 ? 'Rebuild backup' : 'Scan share 2');
    return `
      <div class="review">
        <p class="review-title" style="color:${n ? 'var(--a3)' : 'var(--a2)'}">${title}</p>
        <div class="review-list">${list}</div>
        <div class="screen-foot"><button type="button" class="screen-btn" data-act="next">${nextLabel}</button></div>
      </div>`;
  }

  function renderResult() {
    const bip = S.mode === 'bip';
    const words = WORDS.map((w, i) => {
      const shown = S.reveal ? (S.picks[i] || w[2][0][0]) : '••••••';
      const asked = bip && (i === 5 || i === 9);
      return `<li><button type="button" class="res-btn" data-act="rsel" data-i="${i}" aria-label="Word ${i + 1}, how the AI read it">
        <span class="rrow-n">${i + 1}</span><b>${shown}</b><span class="res-dot${asked ? ' is-asked' : ''}" aria-hidden="true"></span>
      </button></li>`;
    }).join('');

    let ev = '';
    if (S.rsel >= 0) {
      const rw = WORDS[S.rsel];
      const line = bip ? ((S.rsel === 5 || S.rsel === 9) ? 'I wasn’t sure, so you confirmed it.' : 'A clear match with the word list.') : 'Rebuilt from 2 Penlock shares.';
      const bars = bip ? rw[2].map((c, k) => bar(S.reveal || k > 0 ? c[0] : 'hidden', c[1] + '%', BAR_COLORS[k])).join('') : '';
      ev = `
        <div class="ev">
          <button type="button" class="ev-scrim" data-act="closeEv" aria-label="Close"></button>
          <div class="ev-sheet" role="dialog" aria-label="How the AI read this word">
            <span class="ev-grab" aria-hidden="true"></span>
            <p style="margin:0;font-size:13px;color:var(--muted)">How I read word ${S.rsel + 1}</p>
            <div class="ocr">${rw[1]}</div>
            ${bars}
            <p style="margin:4px 0 0;font-size:13px;color:var(--muted)">${line}</p>
            <button type="button" class="screen-btn" data-act="closeEv" style="margin-top:10px;min-height:44px;border-radius:12px">Got it</button>
          </div>
        </div>`;
    }

    return `
      <div class="review">
        <div class="result-head"><span>${bip ? 'Your words' : 'Your backup'}</span><span class="badge">✓ Checked</span></div>
        <div class="pair">
          <button type="button" class="btn-outline-warn" data-act="reveal" aria-pressed="${S.reveal}">${S.reveal ? 'Hide' : 'Reveal'}</button>
          <button type="button" class="btn-fill-ok" data-act="copy">${S.copied ? 'Copied' : 'Copy'}</button>
        </div>
        <ol class="res-list">${words}</ol>
        <div class="res-foot">
          <button type="button" class="btn-save">Save</button>
          <button type="button" class="btn-forget" data-act="forget">Forget</button>
        </div>
        ${ev}
      </div>`;
  }

  // ---------- render: thoughts ----------
  function renderThoughts() {
    const bip = S.mode === 'bip';
    const pen = !bip;
    const T = (text, tone, bars) => `<div class="thought${tone ? ' is-' + tone : ''}"><p>${text}</p>${(bars || []).join('')}</div>`;
    const bars2 = (w) => w[2].slice(0, 2).map((c, k) => bar(c[0], c[1] + '%', k === 0 ? 'var(--a3)' : 'var(--a4)'));
    let out = [];

    if (S.step === 'camera' && S.upImg) {
      out = [T('Nice photo! This preview still reads our sample page.'), T('Want to help me learn? Send it in below.', 'ok')];
    } else if (S.step === 'camera') {
      out = [
        T(pen && S.shares === 1 ? 'Share 1 read. Show me any second share and I can rebuild the backup.' : 'Ready. Show me the ' + (bip ? 'page with your 12 words.' : 'Penlock share.')),
        T('Everything happens on this device. Nothing is uploaded.', 'ok')
      ];
    } else if (S.step === 'scanning') {
      const lines = bip
        ? ['Found the page and straightened it.', 'I can see 12 handwritten words.', 'Reading the letters in each word…', 'Comparing each word with the 2048 official seed words…']
        : ['Found the share and straightened it.', '12 rows × 6 symbols. Reading each one…', 'Matching each symbol…', 'Testing each row’s built-in error check…'];
      out = lines.slice(0, Math.min(S.stage + 1, 4)).map((s) => T(s));
    } else if (S.step === 'review') {
      if (bip) {
        const { unsure } = reviewCounts();
        out = [T((12 - unsure) + ' of 12 words match the list clearly.', 'ok')];
        if (!S.picks[5]) out.push(T('Word 6 reads “absert”, which isn’t a seed word. Closest:', 'warn', bars2(WORDS[5])));
        if (!S.picks[9]) out.push(T('Word 10 could be “abuse” or “amuse”. Both are real, so I need you.', 'warn', bars2(WORDS[9])));
        if (!unsure) out.push(T('Thanks! With your answers, all 12 pass the check.', 'ok'));
      } else {
        const { top, alt1 } = penAlts();
        out = [T('11 of 12 rows pass their own error check.', 'ok')];
        out.push(S.penPick
          ? T(S.shares >= 2 ? 'Two shares read. That’s enough to rebuild.' : 'Row 7 fixed. Now I need any second share.', 'ok')
          : T('Row 7 has a smudged symbol and fails its check. Which is it?', 'warn', [bar(top, '62%', 'var(--a3)'), bar(alt1, '31%', 'var(--a4)')]));
      }
    } else {
      out = [
        T(bip ? 'Done. Your 12 words pass the built-in check.' : 'Done. Rebuilt your 12 words from 2 of 3 shares.', 'ok'),
        T('A passing check is a good sign, not proof: about 1 in 16 wrong answers slip through. Compare with your paper.', 'warn'),
        T('Tap any word to see exactly how I read it.')
      ];
    }
    $('demo-thoughts').innerHTML = out.join('');
  }

  // ---------- render: share card ----------
  function renderShare() {
    if (S.sent) {
      $('share-card').innerHTML = `
        <div class="sent">
          <span class="sent-ring"><svg aria-hidden="true" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--a2)" stroke-width="2.4"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>
          <h3>Thank you!</h3>
          <p>Your handwriting helps it read better.</p>
          <button type="button" class="again" data-act="again">Send another</button>
        </div>`;
      return;
    }
    const media = S.shareImg
      ? `<img src="${S.shareImg}" alt="Your practice photo">`
      : '<svg aria-hidden="true" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--a1)" stroke-width="1.8"><path d="M12 16V4M7 9l5-5 5 5M4 20h16"/></svg>';
    $('share-card').innerHTML = `
      <label class="drop" id="drop">
        <input type="file" accept="image/*" data-change="share" aria-label="Choose a photo of your practice words">
        ${media}
        <b>${S.shareImg ? esc(S.shareName) : 'Your practice page'}</b>
        <small>Drop a photo or click to choose</small>
      </label>
      <button type="button" class="check" data-act="ok" role="checkbox" aria-checked="${S.ok}">
        <span class="check-box">${S.ok ? '✓' : ''}</span>
        <span>These are practice words, <strong>not a real backup</strong>.</span>
      </button>
      <button type="button" class="send-btn${S.shareImg && S.ok ? ' is-ready' : ''}" data-act="send">Send sample</button>`;
  }

  function render() {
    renderRail();
    const screen = S.step === 'review' ? renderReview() : S.step === 'result' ? renderResult() : renderCamera();
    $('demo-screen').innerHTML = screen;
    renderThoughts();
    renderShare();
  }

  // ---------- static art ----------
  function renderStatic() {
    $('hero-page').innerHTML = WORDS.map((w, i) => `<span class="hero-word${i === 5 || i === 9 ? ' is-warn' : ''}">${w[1]}</span>`).join('');
    const prev = (s) => {
      let out = '';
      for (let r = 0; r < 9; r++) {
        let t = '';
        for (let c = 0; c < 6; c++) t += g(r, c, s);
        out += `<p class="share-row">${t.slice(0, 3)} ${t.slice(3)}</p>`;
      }
      return out;
    };
    $('pen-a').innerHTML = prev(0);
    $('pen-b').innerHTML = prev(1);
    $('pen-c').innerHTML = prev(2);
  }

  // ---------- events ----------
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act;
    const v = el.dataset.v;
    const i = el.dataset.i !== undefined ? parseInt(el.dataset.i, 10) : -1;
    switch (act) {
      case 'mode': setMode(v); break;
      case 'goto': goTo(v); break;
      case 'play': play(); break;
      case 'scan': stopAll(); S.playing = false; scan(); break;
      case 'toggle':
        if (S.mode === 'bip') { if (WORDS[i][2][0][1] < 80) set({ open: S.open === i ? -1 : i }); }
        else if (i === 6) set({ open: S.open === 6 ? -1 : 6 });
        break;
      case 'pick': set({ picks: Object.assign({}, S.picks, { [i]: v }), open: -1 }); break;
      case 'penpick': set({ penPick: v, open: -1 }); break;
      case 'next': next(); break;
      case 'reveal': set({ reveal: !S.reveal }); break;
      case 'copy': set({ copied: true }); break;
      case 'forget': goTo('camera'); break;
      case 'rsel': set({ rsel: i }); break;
      case 'closeEv': set({ rsel: -1 }); break;
      case 'ok': set({ ok: !S.ok }); break;
      case 'send': if (S.shareImg && S.ok) set({ sent: true }); break;
      case 'again': set({ sent: false, shareImg: null, shareName: '', ok: false }); break;
    }
  });

  function useFile(kind, f) {
    if (!f || !f.type.startsWith('image/')) return;
    if (kind === 'upload') { stopAll(); set({ upImg: URL.createObjectURL(f), step: 'camera', playing: false }); }
    else set({ shareImg: URL.createObjectURL(f), shareName: f.name });
  }

  document.addEventListener('change', (e) => {
    const kind = e.target.dataset && e.target.dataset.change;
    if (kind) useFile(kind, e.target.files && e.target.files[0]);
  });

  // drag & drop onto the share box
  document.addEventListener('dragover', (e) => {
    const d = e.target.closest && e.target.closest('#drop');
    if (d) { e.preventDefault(); d.classList.add('is-over'); }
  });
  document.addEventListener('dragleave', (e) => {
    const d = e.target.closest && e.target.closest('#drop');
    if (d) d.classList.remove('is-over');
  });
  document.addEventListener('drop', (e) => {
    const d = e.target.closest && e.target.closest('#drop');
    if (!d) return;
    e.preventDefault();
    useFile('share', e.dataTransfer.files && e.dataTransfer.files[0]);
  });

  renderStatic();
  render();
})();
