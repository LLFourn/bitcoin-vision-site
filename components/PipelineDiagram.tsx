const LANES: { tag: string; steps: [string, string][] }[] = [
  {
    tag: 'BIP39 recovery phrase',
    steps: [
      ['Photo', 'JPEG, PNG, WebP'],
      ['Find', 'box each word'],
      ['Read', 'letter by letter'],
      ['Match', 'vs 2048 words'],
      ['Check', 'BIP39 checksum'],
      ['You review', 'pick, reveal, forget'],
    ],
  },
  {
    tag: 'Penlock share',
    steps: [
      ['Photo', 'one cut strip'],
      ['Find', 'cut 72 cells'],
      ['Classify', 'vs 29 symbols'],
      ['Check', 'each row'],
      ['Combine', 'any 2 of 3'],
      ['You review', 'fix, reveal, forget'],
    ],
  },
];

/** The guide's architecture figure: both pipelines end with the person reviewing. */
export default function PipelineDiagram() {
  return (
    <figure className="pipes-fig" aria-label="bitcoin-vision pipelines: BIP39 and Penlock">
      {LANES.map((lane) => (
        <div key={lane.tag} className="lane">
          <p className="lane-tag">{lane.tag}</p>
          <ol>
            {lane.steps.map(([t, d], i) => (
              <li key={t} className={i === lane.steps.length - 1 ? 'is-you' : undefined}>
                <b>{t}</b>
                <span>{d}</span>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </figure>
  );
}
