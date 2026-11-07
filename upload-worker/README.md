# Training-sample upload worker

Receives photos that visitors **chose** to share from the site's Playground, and stores them in a
private Cloudflare R2 bucket for training. Scanning never uses it; only the “Share this sample” button does.

Each sample is two objects under `samples/<yyyy-mm-dd>/<id>`:

- `<id>.jpg`: the photo, redrawn upright in the browser so EXIF (GPS location, device, time) is gone.
- `<id>.json`: the consent record and the labels. For BIP39: per word, what the recogniser read (`ocr`),
  the model’s word (`model`), the person’s explicit pick (`picked`), the best label (`label`), candidates
  and the word’s box in the uploaded photo’s pixels. For Penlock: each strip’s rows as read, with
  probabilities.

The worker refuses other origins, non-JPEGs, files over 15 MB and requests without the consent record,
rate-limits to 10 uploads a minute per visitor, and stores no IP address.

## Deploy (once)

```bash
cd upload-worker
npm install
npx wrangler login
npx wrangler r2 bucket create bitcoin-vision-samples
```

Edit `ALLOWED_ORIGINS` in `wrangler.toml` to your site’s origin, e.g.
`https://<user>.github.io` (no path), then:

```bash
npx wrangler deploy
```

It prints the worker URL, e.g. `https://bitcoin-vision-samples.<account>.workers.dev`.
In the site’s GitHub repo, add a variable under **Settings › Secrets and variables › Actions › Variables**:

```
SAMPLE_UPLOAD_URL = https://bitcoin-vision-samples.<account>.workers.dev/samples
```

and re-run the Pages deploy. Without that variable the site never shows the prompt.

## Working with samples

```bash
npx wrangler r2 object get bitcoin-vision-samples/samples/<date>/<id>.json --file sample.json
npx wrangler r2 object delete bitcoin-vision-samples/samples/<date>/<id>.jpg   # removal request
npx wrangler r2 object delete bitcoin-vision-samples/samples/<date>/<id>.json
```

People are shown their sample ID after sharing, so they can ask for removal.

## Local testing

```bash
npm run dev                     # http://127.0.0.1:8787, R2 simulated on disk in .wrangler/
# in the site: .env.local → NEXT_PUBLIC_SAMPLE_UPLOAD_URL=http://127.0.0.1:8787/samples
```
