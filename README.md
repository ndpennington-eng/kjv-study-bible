# KJV Study Bible (offline iPhone web app)

A static, installable Progressive Web App (PWA) study Bible for iPhone (and any modern browser):

* **King James Version** text: 66 books, 1,189 chapters, 31,102 verses. Works **fully offline** after the first visit.
* **Historical introduction to every book**, written for this app: author, date, original audience, historical setting, empires and powers, genre, purpose, themes, short outline, how the book points to Christ, and **debated questions**, with the traditional view and the main critical view both given. The standpoint is confessional Lutheran, and the treatment aims to be fair and scholarly.
* **Martin Luther's prefaces**, reproduced verbatim from the public-domain 1932 English translation (Philadelphia Edition, vol. 6), with a full citation for each one. Where Luther wrote no preface to a book, the app shows a **clearly labeled excerpt** from his general Old or New Testament preface instead. A library screen holds all 46 prefaces in full.
* Fast **offline full-text search**: words in any order, "exact phrase", and prefix\*, filterable to OT or NT. Tap a result to open the verse.
* **Quick jump**: `jn 3:16`, `gen 1`, `1 cor 13:4`, `ps 23`, `jude 3`, `rom 8:28-30`.
* Book list (OT/NT) → chapter grid → reader, with previous/next chapter buttons and swipe.
* **Cross-references** from OpenBible.info (CC BY) on every verse.
* **Bookmarks, highlights (4 colours) and notes**, stored on the device (localStorage), with JSON **export/import**.
* **Font size** and **light / sepia / dark** themes, plus a verse-by-verse or paragraph layout.
* **KJV archaic-word glossary** (89 entries), a **biblical timeline**, and **empire profiles** (Egypt, Assyria, Babylon, Persia, Greece/Ptolemies/Seleucids, Rome).

Everything is plain HTML, CSS and JavaScript. There is no framework, build step, server code, account or tracking. All paths are relative, so the site works from a domain root or any sub-path (for example `https://user.github.io/kjv/`).

## Folder layout

```
app/                    <- THE STATIC SITE (this is what you deploy; same as the zip)
  index.html            app shell (apple-mobile-web-app meta tags, apple-touch-icon)
  manifest.webmanifest  display: standalone, icons
  sw.js                 service worker: precaches every file of the site (generated)
  css/app.css
  js/app.js             the app (router, reader, search UI, Luther, notes, settings…)
  js/books.js           book abbreviations + reference parser
  js/search-worker.js   full-text search in a Web Worker
  data/kjv.json         KJV text (4.3 MB; about 1.3 MB gzipped by most hosts)
  data/xref.json        OpenBible cross-references (0.9 MB)
  data/luther.json      Luther prefaces + per-book mapping (0.25 MB)
  data/study.json       introductions, glossary, timeline, empires (0.18 MB)
  icons/                PNG icons (180 apple-touch, 192, 512, maskable)
kjv-study-bible-site.zip  zip of app/ (the deployable site)
content/                source text for intros, glossary, timeline, empires, Luther
tools/                  build and test scripts
screenshots/            iPhone-size screenshots from the automated test
```

## Deploying (pick one; nothing has been deployed)

The site is fully static. Upload the **contents** of `app/` (or unzip `kjv-study-bible-site.zip`). HTTPS is required for offline mode and installation; all three hosts below give you HTTPS automatically.

**GitHub Pages**
1. Create a repository and put the contents of `app/` at the repository root (or in a `/docs` folder).
2. Repository → Settings → Pages → "Deploy from a branch" → choose the branch and `/ (root)` or `/docs`.
3. The site appears at `https://<user>.github.io/<repo>/`. The sub-path works because every path is relative.

**Cloudflare Pages**
1. Dashboard → Workers & Pages → Create → Pages → "Upload assets" (direct upload).
2. Drag in the unzipped site folder (or connect a Git repo with build command *none* and output directory `app`).

**Netlify**
1. Go to app.netlify.com → "Add new site" → "Deploy manually", then drag the unzipped folder onto the page.
2. Or use the CLI: `netlify deploy --dir=app --prod`.

**Updating later:** after changing anything in `app/`, run `python3 tools/build_sw.py`. It writes a new cache version into `sw.js`, so installed copies download the update. When an update is ready, users see a small toast; it takes effect the next time they open the app.

**Local preview:** `cd app && python3 -m http.server 8000`, then open `http://localhost:8000/`. Service workers also run on `localhost`.

## Installing on iPhone

1. Open the site's URL in **Safari**.
2. Wait a few seconds on the first visit while the app saves itself for offline use. The **More** tab shows "Ready for offline use".
3. Tap the **Share** button, then **Add to Home Screen**, then **Add**.
4. Launch it from the home-screen icon. It opens full-screen (standalone) and works in airplane mode.

Notes: iOS keeps an installed web app's storage separately from Safari's, so bookmarks and notes made in Safari do not carry over to the home-screen app. Use **Saved → Export JSON** to move or back up your data. iOS may clear the storage of web apps that go unused for many weeks, so export a backup now and then.

## Data sources and licenses

| Content | Source | License / status |
|---|---|---|
| Bible text | King James Version, 1769 Oxford standard text, from eBible.org ([eng-kjv](https://ebible.org/Scriptures/details.php?id=eng-kjv), CrossWire/eBible edition) | Public domain in the United States. In the UK the KJV is under perpetual Crown letters patent. Words in italics in the KJV are shown in *italics*; ¶ is the KJV paragraph mark. |
| Cross-references | [OpenBible.info cross-references](https://www.openbible.info/labs/cross-references/) | **CC BY** (Creative Commons Attribution). Attribution is shown on the About screen and under each verse's cross-reference list. Filtered to references with 5 or more votes, at most 12 per verse (94,546 references on 19,892 verses). |
| Luther's prefaces | *Works of Martin Luther, with Introductions and Notes*, vol. VI (Philadelphia: A. J. Holman Company and The Castle Press, 1932), "Prefaces to the Books of the Bible," translated by **Charles M. Jacobs**, pp. 363–489 | Believed public domain in the US (see below). |
| Introductions, glossary, timeline, empire profiles | Written for this app | Yours to use as you wish. |

### Why the 1932 Luther translation is public domain (US)

* Volume 6 was published in the United States in 1932. Its copyright page reads "Copyright, 1932, by A. J. Holman Company".
* US works published from 1927 through 1963 with a notice had to be **renewed in their 28th year** (here, 1959–1960) or they fell into the public domain.
* I searched the US Copyright Office renewal records for 1958 through 1962, using the NYPL transcription of the *Catalog of Copyright Entries* renewals (github.com/NYPL/cce-renewals). I searched for Luther, Jacobs, Strodach, Holman, United Lutheran and Castle Press. I found a renewal for **vol. 5** (1931): R238530, 26 June 1959, by the Board of Publication of the United Lutheran Church in America. I found **no renewal for vol. 6**. Vol. 6 is therefore believed to be in the US public domain.
* Caveat: this is a good-faith search of a transcribed index, not a formal Copyright Office search. The Stanford Copyright Renewal Database could not be checked from the build machine. Outside the US, different rules may apply.

### How the Luther text was made verbatim

* The starting point was "Everyone's Luther" (Wolf Mueller), a modern re-typesetting of the PE vol. 6 prefaces. A comparison showed it is **not verbatim**. It modernizes Scripture references ("chapter vii" → "Romans 7:14"), Americanizes spellings (fulfil → fulfill, Saviour → Savior), moves brackets, and contains OCR slips (e.g. "Eraser" for "Emser").
* Every page of the 1932 volume (archive.org scan `in.ernet.dli.2015.180138`, printed pp. 365–490) was re-OCR'd at 300 dpi with Tesseract. The text was then rebuilt word-by-word against that OCR (`tools/luther_build.py`). The 1932 roman-numeral references and spellings were restored, margin side-notes and footnote numbers were dropped, and 1932 paragraph breaks were restored from the page layout (`tools/luther_parasplit.py`). Every disagreement was resolved from the page images; the reviewed decisions are in `content/luther_fixes.json` and `content/luther_refmanual.json`.
* Result: at least 99.0% of words in every preface match the OCR. The remaining differences were checked and are OCR noise (`tools/luther_verify_final.py`). Punctuation was also checked against the OCR (`tools/luther_punct_check.py`).
* Original misprints are kept as printed (e.g. "It would be will, also, to know…" in the Isaiah preface).
* The bracketed passages in the NT and James/Jude prefaces are the 1932 editor's markings of text found only in the 1522 edition. The editor's notes are quoted next to them.

### Which books get which Luther text

* **Full preface** (44 books): Job; Psalms; Proverbs (Proverbs preface + preface to the Books of Solomon); Ecclesiastes (Preacher + Books of Solomon); Song of Solomon (preface to the three Books of Solomon, whose last paragraph treats the Song); Isaiah; Jeremiah; Ezekiel (both prefaces); Daniel (PE prints only part of this preface, "From the Preface…", and all of that portion is shown); all twelve Minor Prophets; Acts; Romans; 1 and 2 Corinthians; Galatians through Philemon; Hebrews; James and Jude (joint preface); 1 and 2 Peter; 1, 2 and 3 John (joint preface); Revelation (both the later preface and the 1522 preface).
* **Labeled excerpt, because Luther wrote no separate preface** (22 books):
  * Genesis, Exodus, Leviticus, Numbers, Deuteronomy: each gets the paragraph on that book from the *Introduction to the Old Testament*.
  * Joshua through Esther (12 books): the passage on "the other books, the prophets and the histories" from the same Introduction.
  * Lamentations: the opening paragraph of the *Preface to the Prophets*.
  * Matthew, Mark, Luke: the *Preface to the New Testament* passage on the Gospel told "at length" by the four Evangelists.
  * John: the *Preface to the New Testament* passage on John's Gospel as "the one, tender, true chief Gospel".

## Rebuilding the data

```
bash tools/build_all.sh                  # KJV + cross-refs + study content + sw.js + zip
REBUILD_LUTHER=1 bash tools/build_all.sh # also re-derive the Luther text from the 1932 scan (needs tesseract, poppler)
```

* `tools/build_data.py` downloads nothing itself. `build_all.sh` fetches `eng-kjv_vpl.zip` from eBible.org and `cross-references.zip` from OpenBible, and `build_data.py` turns them into `kjv.json` (it checks 66 books / 1,189 chapters / 31,102 verses) and `xref.json`.
* `tools/build_content.py` reads `content/*.txt` and `content/luther_1932.json` and checks that all 66 books have every required introduction field. It writes `study.json` and `luther.json`.
* `tools/build_sw.py` regenerates the precache list and cache version. Run it after every change.
* `tools/test_app.py [chromium|webkit] [url]` runs the end-to-end test (Playwright, iPhone-size 390×844 at 3× scale with a mobile Safari UA), including offline reload.

To edit an introduction, change `content/intros_*.txt` (one `## Book` header, then `key: value` lines; debated items are separated by ` || `, outline items by ` | `). Then run `python3 tools/build_content.py && python3 tools/build_sw.py`.
