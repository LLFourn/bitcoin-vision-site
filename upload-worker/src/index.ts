/**
 * Training-sample intake for bitcoin-vision.
 *
 * POST /samples, multipart/form-data:
 *   photo  image/jpeg, EXIF already stripped by the browser (≤ 15 MB)
 *   meta   JSON: the consent record and the labels (what the model read and
 *          what the person confirmed)
 *
 * Stores samples/<yyyy-mm-dd>/<id>.jpg and .json in the private SAMPLES bucket
 * and answers 201 { id }. Keeps no IP address or other request data.
 */

export interface Env {
  SAMPLES: R2Bucket;
  LIMITER?: RateLimit;
  ALLOWED_ORIGINS: string;
}

const MAX_PHOTO = 15 * 1024 * 1024;
const MAX_META = 64 * 1024;
const MAX_BODY = MAX_PHOTO + MAX_META + 16 * 1024;

type Cors = Record<string, string>;

const reply = (body: unknown, status: number, cors: Cors) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...cors } });

function corsFor(origin: string, env: Env): Cors | null {
  const allowed = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean);
  if (!allowed.includes(origin)) return null;
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
    vary: 'origin',
  };
}

/** The consent record the site must send; anything else is refused. */
function validMeta(meta: unknown): meta is { pipeline: 'bip39' | 'penlock' } {
  if (!meta || typeof meta !== 'object') return false;
  const m = meta as Record<string, unknown>;
  const consent = m.consent as Record<string, unknown> | undefined;
  return (
    m.version === 1 &&
    (m.pipeline === 'bip39' || m.pipeline === 'penlock') &&
    !!consent && consent.training === true && consent.practiceOnly === true
  );
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const cors = corsFor(req.headers.get('origin') ?? '', env);
    const { pathname } = new URL(req.url);
    if (pathname !== '/samples') return reply({ error: 'Not found' }, 404, cors ?? {});
    if (!cors) return reply({ error: 'Origin not allowed' }, 403, {});
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (req.method !== 'POST') return reply({ error: 'Use POST' }, 405, cors);

    // Rate-limit per visitor. The address is used as a key here and never stored.
    if (env.LIMITER) {
      const { success } = await env.LIMITER.limit({ key: req.headers.get('cf-connecting-ip') ?? 'unknown' });
      if (!success) return reply({ error: 'Too many uploads. Try again in a minute.' }, 429, cors);
    }

    const length = Number(req.headers.get('content-length') ?? 0);
    if (!length || length > MAX_BODY) return reply({ error: 'The photo is too large.' }, 413, cors);

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return reply({ error: 'Expected multipart form data.' }, 400, cors);
    }
    const photo = form.get('photo');
    const metaText = form.get('meta');
    if (!(photo instanceof File) || photo.type !== 'image/jpeg' || photo.size === 0 || photo.size > MAX_PHOTO) {
      return reply({ error: 'Expected a JPEG photo under 15 MB.' }, 400, cors);
    }
    if (typeof metaText !== 'string' || metaText.length > MAX_META) {
      return reply({ error: 'Missing or oversized labels.' }, 400, cors);
    }
    let meta: unknown;
    try {
      meta = JSON.parse(metaText);
    } catch {
      return reply({ error: 'Labels are not valid JSON.' }, 400, cors);
    }
    if (!validMeta(meta)) return reply({ error: 'Missing consent.' }, 400, cors);

    const bytes = await photo.arrayBuffer();
    const head = new Uint8Array(bytes, 0, 3);
    if (head[0] !== 0xff || head[1] !== 0xd8 || head[2] !== 0xff) {
      return reply({ error: 'That file is not a JPEG.' }, 400, cors);
    }

    const id = crypto.randomUUID();
    const receivedAt = new Date().toISOString();
    const key = `samples/${receivedAt.slice(0, 10)}/${id}`;
    await env.SAMPLES.put(`${key}.jpg`, bytes, { httpMetadata: { contentType: 'image/jpeg' } });
    await env.SAMPLES.put(`${key}.json`, JSON.stringify({ id, receivedAt, ...meta }, null, 2), {
      httpMetadata: { contentType: 'application/json' },
    });
    return reply({ id }, 201, cors);
  },
} satisfies ExportedHandler<Env>;
