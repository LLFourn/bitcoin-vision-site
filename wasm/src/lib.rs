//! bitcoin-vision in the browser.
//!
//! A thin wasm-bindgen layer over the upstream scanners, shaped after the
//! Android example's adapter. It runs single-threaded (browser WebAssembly
//! without cross-origin isolation has no threads; the upstream reader falls
//! back to one worker on its own). Load it in a Web Worker so a scan does not
//! block the page.

use bitcoin_vision_words::review::ReviewNumbering;
use penlock::soft::combine;
use penlock::soft::search::{Bip39Checksum, Filter, Floor, Outcome, search, slots};
use penlock::{Distribution, Symbol, Word};
use penlock_scan::{Identity, ScannedShare};
use serde::Serialize;
use wasm_bindgen::prelude::*;

#[wasm_bindgen(start)]
pub fn start() {
    console_error_panic_hook::set_once();
}

fn err(e: impl std::fmt::Display) -> JsError {
    JsError::new(&e.to_string())
}

fn to_js<T: Serialize>(value: &T) -> Result<JsValue, JsError> {
    value
        .serialize(&serde_wasm_bindgen::Serializer::new().serialize_maps_as_objects(true))
        .map_err(err)
}

fn quad<T: Into<f64> + Copy>(q: &[(T, T); 4]) -> [[f64; 2]; 4] {
    q.map(|(x, y)| [x.into(), y.into()])
}

/* ---------------------------------------------------------------- BIP39 */

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Ranked {
    word: &'static str,
    probability: f32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct WordOut {
    /// Corners in photo pixels, clockwise from top left.
    quad: [[f64; 2]; 4],
    /// The model's most probable list words, most probable first.
    ranked: Vec<Ranked>,
    /// Whether the calibration accepts the pick; otherwise ask the person.
    accepted: bool,
    /// The word to show first.
    selected: Option<&'static str>,
    /// The text recogniser's literal read of the crop.
    raw: Option<String>,
    /// Not a word: left out of every reading order.
    stray: bool,
    /// The item number written beside it, when the page is numbered.
    number: Option<u32>,
    /// The exact crop the models read, as PNG.
    #[serde(with = "serde_bytes")]
    crop_png: Vec<u8>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct PageOut {
    /// "sheet" (a recovery phrase worksheet) or "page" (anything else).
    layout: &'static str,
    width: u32,
    height: u32,
    words: Vec<WordOut>,
    /// Indices into `words` in each reading order, strays included.
    columns: Vec<u32>,
    rows: Vec<u32>,
    numbered: Vec<u32>,
    /// Whether each order's picks pass the BIP39 checksum.
    columns_pass: bool,
    rows_pass: bool,
    numbered_pass: bool,
    /// Which order the scanner suggests: "numbers", "rows" or "columns".
    initial_order: &'static str,
    order_requires_review: bool,
    order_basis: &'static str,
    /// Whether the written item numbers made a consistent run.
    numbering: &'static str,
}

/// The handwritten BIP39 word reader. Build once, scan many photos.
#[wasm_bindgen]
pub struct WordScanner {
    inner: bitcoin_vision_words::Scanner,
}

#[wasm_bindgen]
impl WordScanner {
    /// Builds the scanner from the five files in `words/models/`.
    #[wasm_bindgen(constructor)]
    pub fn new(
        detector: &[u8],
        classifier: &[u8],
        calibration: &str,
        recogniser: &[u8],
        dictionary: &str,
    ) -> Result<WordScanner, JsError> {
        let inner = bitcoin_vision_words::Scanner::new(bitcoin_vision_words::ModelBytes {
            detector,
            classifier,
            calibration,
            recogniser,
            dictionary,
        })
        .map_err(err)?;
        Ok(WordScanner { inner })
    }

    /// Reads every word in one photo (JPEG, PNG or WebP bytes; EXIF honoured).
    pub fn scan(&self, photo: &[u8]) -> Result<JsValue, JsError> {
        let result = self
            .inner
            .scan(photo, bitcoin_vision_words::ScanOptions::default())
            .map_err(err)?;
        let page = result.review().map_err(err)?;
        let out = PageOut {
            layout: match page.found {
                bitcoin_vision_words::Found::Sheet => "sheet",
                bitcoin_vision_words::Found::Page => "page",
            },
            width: page.width,
            height: page.height,
            words: page
                .words
                .iter()
                .map(|w| WordOut {
                    quad: quad(&w.quad),
                    ranked: w
                        .ranked
                        .iter()
                        .map(|&(word, probability)| Ranked { word, probability })
                        .collect(),
                    accepted: w.accepted,
                    selected: w.selected,
                    raw: w.raw.clone(),
                    stray: w.stray,
                    number: w.number,
                    crop_png: w.crop_png.clone(),
                })
                .collect(),
            columns: page.columns,
            rows: page.rows,
            numbered: page.numbered,
            columns_pass: page.columns_pass,
            rows_pass: page.rows_pass,
            numbered_pass: page.numbered_pass,
            initial_order: page.initial_order,
            order_requires_review: page.order_requires_review,
            order_basis: page.order_basis,
            numbering: match page.numbering {
                ReviewNumbering::None => "none",
                ReviewNumbering::Held { .. } => "held",
                ReviewNumbering::Inconsistent { .. } => "inconsistent",
            },
        };
        to_js(&out)
    }
}

/// Whether the words pass the BIP39 checksum. Well formed, not confirmed:
/// a wrong twelve-word phrase passes about one time in sixteen.
#[wasm_bindgen(js_name = checksumPasses)]
pub fn checksum_passes(words: Vec<String>) -> bool {
    words
        .iter()
        .map(|w| Word::from_bip39(w))
        .collect::<Option<Vec<_>>>()
        .is_some_and(|w| Bip39Checksum.passes(&w))
}

/// BIP39 list words starting with `prefix`, for a correction field.
#[wasm_bindgen(js_name = listWords)]
pub fn list_words(prefix: &str) -> Vec<String> {
    let prefix = prefix.trim().to_lowercase();
    Word::all()
        .map(|w| w.as_str())
        .filter(|w| w.starts_with(&prefix))
        .map(str::to_owned)
        .collect()
}

/* -------------------------------------------------------------- Penlock */

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Alt {
    symbol: char,
    probability: f32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CellOut {
    /// Best symbol, absent when the cell could not be read.
    symbol: Option<char>,
    probability: Option<f32>,
    unread: bool,
    /// The three most probable symbols.
    top: Vec<Alt>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ShareOut {
    /// "seed", "share" or "unknown".
    kind: &'static str,
    /// 1–3 for a share strip.
    index: Option<u8>,
    /// Strip corners in photo pixels.
    quad: [[f64; 2]; 4],
    /// Twelve rows of six cells.
    rows: Vec<Vec<CellOut>>,
}

fn cell(d: &Distribution, unread: bool) -> CellOut {
    let mut all: Vec<(Symbol, f32)> = Symbol::all().map(|s| (s, d.p(s))).collect();
    all.sort_by(|a, b| b.1.total_cmp(&a.1));
    let best = d.argmax();
    CellOut {
        symbol: (!unread).then(|| best.to_char()),
        probability: (!unread).then(|| d.p(best)),
        unread,
        top: all
            .into_iter()
            .take(3)
            .map(|(s, p)| Alt { symbol: s.to_char(), probability: p })
            .collect(),
    }
}

/// The Penlock strip reader. Build once, scan many photos.
#[wasm_bindgen]
pub struct ShareScanner {
    inner: penlock_scan::Scanner,
}

/// One strip found in a photo, its soft readings kept for recovery.
#[wasm_bindgen]
pub struct ShareReading {
    share: ScannedShare,
}

#[wasm_bindgen]
impl ShareScanner {
    /// Builds the scanner from `penlock-scan/models/cell-reference.onnx`.
    #[wasm_bindgen(constructor)]
    pub fn new(cells: &[u8]) -> Result<ShareScanner, JsError> {
        let inner = penlock_scan::Scanner::new(penlock_scan::ModelBytes { cells }).map_err(err)?;
        Ok(ShareScanner { inner })
    }

    /// Reads every strip in one photo.
    pub fn scan(&self, photo: &[u8]) -> Result<Vec<ShareReading>, JsError> {
        let read = self
            .inner
            .scan_all(photo, penlock_scan::ScanOptions::default())
            .map_err(err)?;
        Ok(read.shares.into_iter().map(|share| ShareReading { share }).collect())
    }
}

#[wasm_bindgen]
impl ShareReading {
    /// What was read, for review: identity and every cell's best symbols.
    pub fn review(&self) -> Result<JsValue, JsError> {
        let s = &self.share;
        let (kind, index) = match s.identity {
            Identity::Seed => ("seed", None),
            Identity::Share(i) => ("share", Some(i.number())),
            Identity::Unknown => ("unknown", None),
        };
        let rows = s
            .cells
            .iter()
            .enumerate()
            .map(|(r, row)| {
                row.iter()
                    .enumerate()
                    .map(|(c, d)| cell(d, s.unread.contains(&(r, c))))
                    .collect()
            })
            .collect();
        to_js(&ShareOut { kind, index, quad: quad(&s.quad()), rows })
    }
}

/// Recovers the 12 words from two different share strips: the most probable
/// phrase that passes the BIP39 checksum (a filter, not proof).
#[wasm_bindgen(js_name = recoverShares)]
pub fn recover_shares(a: &ShareReading, b: &ShareReading) -> Result<Vec<String>, JsError> {
    let index = |s: &ShareReading| {
        s.share
            .identity
            .share()
            .ok_or_else(|| JsError::new("recovery needs two share strips"))
    };
    let (ia, ib) = (index(a)?, index(b)?);
    if a.share.cells.len() != 12 || b.share.cells.len() != 12 {
        return Err(JsError::new("both shares must contain twelve rows"));
    }
    let combined = a
        .share
        .cells
        .iter()
        .zip(&b.share.cells)
        .map(|(x, y)| combine(x, ia, y, ib).map_err(err))
        .collect::<Result<Vec<_>, _>>()?;
    let ranked = slots(&combined, &[], Floor::DEFAULT);
    match search(&ranked, &[&Bip39Checksum], None, 0) {
        Outcome::Unconfirmed { words, .. } => Ok(words.iter().map(|w| w.to_string()).collect()),
        _ => Err(JsError::new("no candidate phrase passed the BIP39 checksum")),
    }
}
