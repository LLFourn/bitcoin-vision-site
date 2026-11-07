import Link from 'next/link';
import { GITHUB, INTEGRATION_GUIDE, PENLOCK } from '@/lib/links';

const SPECS: [string, string][] = [
  ['Size', '24.7 MB'],
  ['Network', 'None'],
  ['Reads', 'BIP39 words · Penlock shares'],
  ['Scores', '2048 words · 29 symbols'],
  ['Library', 'Rust'],
  ['License', 'MIT or Apache-2.0'],
  ['Tested on', 'Passport Prime simulator'],
];

export function Hero() {
  return (
    <section id="top" className="hero">
      <div className="hero-copy">
        <p className="kicker">[ Open source · On-device vision model ]</p>
        <h1 className="h1">
          Reads handwritten seed backups.<br />
          <span style={{ color: 'var(--dim)' }}>Never leaves the device.</span>
        </h1>
        <p className="lead">
          bitcoin-vision is a small set of vision models and a Rust library. It turns a photo of a BIP39 recovery phrase
          or a Penlock share into words you can check, with a confidence score for every one.
        </p>
        <div className="hero-ctas">
          <a href="#demo" className="btn btn--ink">Try the demo</a>
          <Link href={INTEGRATION_GUIDE} className="btn btn--line">Integration guide →</Link>
        </div>
      </div>
      <dl className="specs card">
        {SPECS.map(([k, v]) => (
          <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
        ))}
      </dl>
    </section>
  );
}

const MODELS = [
  ['word-detector.onnx', 'BIP39', 'Finds each handwritten word on the page', 'A box per word'],
  ['text-recogniser.onnx', 'BIP39', 'Reads the letters in each word, with its dictionary', 'Raw text, e.g. “absert”'],
  ['word-reference.onnx', 'BIP39', 'Scores each crop against all 2048 seed words, then calibrates', 'Probabilities over 2048 words'],
  ['cell-reference.onnx', 'Penlock', 'Classifies each of the 72 cells on a share strip', 'Probabilities over 29 symbols'],
];

export function ModelCard() {
  return (
    <section id="model" className="sec" aria-labelledby="model-h">
      <p className="kicker">02 · Model card</p>
      <div className="sec-head">
        <h2 id="model-h" className="h2">Four small models. One job each.</h2>
        <p>No general-purpose AI, no cloud. Each model does one narrow step, and every step’s output is kept so you can show the user why a word was chosen.</p>
      </div>
      <div role="table" aria-label="Models" className="card mtable">
        <div role="row" className="mrow is-head">
          <span role="columnheader">Model file</span><span role="columnheader">Pipeline</span>
          <span role="columnheader">Job</span><span role="columnheader">Output</span>
        </div>
        {MODELS.map(([file, pipe, job, out]) => (
          <div role="row" className="mrow" key={file}>
            <span role="cell" className="m-file">{file}</span>
            <span role="cell"><span className="m-pipe">{pipe}</span></span>
            <span role="cell" className="m-job">{job}</span>
            <span role="cell">{out}</span>
          </div>
        ))}
      </div>
      <div className="stats">
        <div className="stat"><b>24.7 <small>MB</small></b><p>All models together, bundled with the crate</p></div>
        <div className="stat"><b>0</b><p>Network calls. No logs, no uploads</p></div>
        <div className="stat"><b>2048</b><p>BIP39 words scored for every handwritten word</p></div>
        <div className="stat"><b>29</b><p>Penlock symbols scored for every one of 72 cells</p></div>
      </div>
    </section>
  );
}

const PIPES: { tag: string; title: string; steps: [string, string][] }[] = [
  {
    tag: 'PIPELINE A · BIP39',
    title: 'Recovery phrase',
    steps: [
      ['Find.', 'Straighten the page and box every word.'],
      ['Read.', 'Read each word letter by letter.'],
      ['Match.', 'Score the crop against all 2048 seed words.'],
      ['Check.', 'Test the phrase checksum.'],
      ['You confirm.', 'Pick any unsure word, then Reveal or Forget.'],
    ],
  },
  {
    tag: 'PIPELINE B · PENLOCK',
    title: 'Penlock share',
    steps: [
      ['Find.', 'Locate the strip and cut out its 72 cells.'],
      ['Read.', 'Score each cell against 29 symbols.'],
      ['Check.', 'Run each row’s built-in error check.'],
      ['Combine.', 'Any 2 of 3 shares rebuild the 12 words.'],
      ['You confirm.', 'Fix any smudged symbol, then Reveal or Forget.'],
    ],
  },
];

export function HowItReads() {
  return (
    <section className="sec" aria-labelledby="how-h">
      <p className="kicker">03 · How it reads</p>
      <h2 id="how-h" className="h2" style={{ marginBottom: 28 }}>Two pipelines. Both end with you.</h2>
      <div className="two">
        {PIPES.map((p) => (
          <article key={p.tag} className="card pipe">
            <p className="pipe-tag">{p.tag}</p>
            <h3>{p.title}</h3>
            <ol className="steps">
              {p.steps.map(([t, d], i) => (
                <li key={t}>
                  <span className="n">0{i + 1}</span>
                  <span><b>{t}</b> <span className="muted">{d}</span></span>
                </li>
              ))}
            </ol>
          </article>
        ))}
      </div>
    </section>
  );
}

export function Hardware() {
  return (
    <section id="hardware" className="sec hw" aria-labelledby="hw-h">
      <div className="hw-copy">
        <p className="kicker">05 · In a hardware wallet</p>
        <h2 id="hw-h" className="h2">Tested on the Passport Prime simulator.</h2>
        <p className="lead">
          A Penlock app for Passport Prime, built at a hackathon, uses bitcoin-vision to read shares. So far it has run on
          the Passport Prime simulator, not yet on a real device. Small models and zero network access are what make it a fit.
        </p>
        <div className="facts">
          <div><p>STORAGE</p><p>About 24.7 MB of models</p></div>
          <div><p>NETWORK</p><p>None, ever</p></div>
          <div><p>UPDATES</p><p>Signed, through firmware</p></div>
          <div><p>UX</p><p>Review, reveal, forget</p></div>
        </div>
      </div>
      <div className="hw-art" aria-hidden="true">
        <div className="device">
          <div className="device-screen">
            <p className="mono">PENLOCK · SHARE 1</p>
            <div className="device-read">KQ7 RMX</div>
            <p>✓ 12 of 12 rows read</p>
            <p className="mono">SIMULATOR · OFFLINE</p>
          </div>
          <div className="device-keys"><span /><span /></div>
        </div>
      </div>
    </section>
  );
}

export function Limits() {
  return (
    <section className="sec" aria-labelledby="lim-h">
      <p className="kicker">06 · Limits</p>
      <h2 id="lim-h" className="h2" style={{ marginBottom: 28 }}>An honest prototype.</h2>
      <div className="two">
        <div className="card limit">
          <p className="kicker" style={{ letterSpacing: 0, marginBottom: 12 }}>WHAT IT CAN’T DO YET</p>
          <ul>
            <li>English seed words only</li>
            <li>Faint writing, low contrast and odd layouts cause misreads</li>
            <li>About 1 in 16 wrong 12-word phrases still pass the checksum</li>
            <li>Not published to crates.io yet</li>
          </ul>
        </div>
        <div className="card limit">
          <p className="kicker" style={{ letterSpacing: 0, marginBottom: 12 }}>WHAT INTEGRATORS MUST DO</p>
          <ul>
            <li>Ask the user to confirm every unsure word</li>
            <li>Keep photos, crops and results in memory only</li>
            <li>Hide words until Reveal; wipe them on Forget</li>
            <li>Tell Penlock users to store shares apart</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className="footer">
      <b>bitcoin-vision</b>
      <span>MIT or Apache-2.0</span>
      <a href={GITHUB}>GitHub ↗</a>
      <a href={PENLOCK}>Penlock ↗</a>
      <Link href={INTEGRATION_GUIDE}>Integration guide</Link>
    </footer>
  );
}
