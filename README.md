# Undead Networks

> Distant reading of undead literature: interactive character networks, vocabulary profiles, narrative events and translation comparisons for vampire, strigoi and revenant fiction.

**Founded by** Anca-Simina Martin & Andrei-Nicolae Martin-Calutiu · Sibiu, Romania
**Live site:** [https://horrordigitalhumanities.org](https://horrordigitalhumanities.org)

---

## What this repository is

This is the web platform of *Undead Networks*: an Express app, deployed on Vercel, that serves

* the public pages: **home** (the archive), **about**, **whitepaper** and **privacy & terms**;
* one **interactive visualizer** per analysis (D3.js), each reading its own JSON data file.

The data files are produced by the project's Python pipeline (dialogue extraction, researcher validation and annotation, network and vocabulary analysis, narrative events). Any change to an analysis is made in the pipeline and re-exported, never by editing the JSON by hand, so that it is documented in the visualizer.

---

## The archive

| Route                                           | Work                                                                  | Author                      | Analyses                                                |
| ----------------------------------------------- | --------------------------------------------------------------------- | --------------------------- | ------------------------------------------------------- |
| `/vampire-nation-character-network`           | *Vampire Nation*                                                    | Thomas M. Sipos             | network, vocabulary, **predation**, chapter range |
| `/vampirul-character-network`                 | *Vampirul*                                                          | Al. Bilciurescu & G.M. Amza | network, vocabulary, vampire identity merge             |
| `/miss-christina-character-network`           | *Miss Christina*                                                    | Mircea Eliade               | network, vocabulary                                     |
| `/the-pixie-of-the-marshes-character-network` | *The Pixie of the Marshes*                                          | Cezar Petrescu              | network, vocabulary                                     |
| `/the-canal-character-network`                | *The Canal*                                                         | Everil Worrell              | network, vocabulary, vampire identity merge             |
| `/the-silver-countess-character-network`      | *The Silver Countess*                                               | Seabury Quinn               | network, vocabulary                                     |
| `/the-mysterious-stranger-character-network`  | *The Mysterious Stranger* (published translation of *Der Fremde*) | Karl von Wachsmann          | network, vocabulary                                     |
| `/the-stranger-character-network`             | *The Stranger* (unpublished translation of *Der Fremde*)          | Karl von Wachsmann          | network, vocabulary                                     |
| `/the-stranger-translation-differences`       | *Der Fremde*: the two translations compared                         | Karl von Wachsmann          | alignment, sentiment                                    |

---

## Project structure

```
.
├── api/
│   ├── index.js        # Express app: routes
│   └── protect.js      # Anti-scraping layer, robots.txt and TDM policy
├── public/
│   ├── home.html, about.html, whitepaper.html, privacy.html   # public pages
│   ├── site.css        # styles of the public pages (light theme)
│   ├── site.js         # privacy notice, visitor statistics, back-to-top, menu (all pages)
│   ├── <work>-character-network.html   # one visualizer page per work
│   ├── <work>-network-data.json        # its data (exported by the pipeline)
│   ├── script.js, style.css            # shared visualizer code and styles
│   ├── the-stranger-translation-differences.html / .json
│   ├── vendor/         # d3 v7.9.0 and html2canvas 1.4.1, self-hosted
│   ├── fonts/          # Inter (variable, SIL OFL), self-hosted
│   └── favicon.png
├── server.js           # local entry point
├── vercel.json         # every request goes through api/index.js
└── package.json
```

---

## Running locally

Requires Node.js 18 or newer.

```bash
npm install
npm start            # http://localhost:3000
```

Browsers work normally. Command-line clients (curl, wget, Python requests…) receive **403** because of the anti-scraping layer; to test with curl, send a browser user agent, e.g. `curl -A "Mozilla/5.0" http://localhost:3000/home`.

---

## Adding a new analysis

1. Export the work from the pipeline: you get `network_data.json`.
2. Copy it to `public/<slug>-network-data.json`.
3. Create `public/<slug>-character-network.html` by copying an existing page (it already contains the mobile controls, the link back to the archive and `site.js`) and change the title. The visualizer derives the data file from the URL slug.
4. Add an entry to the `analyses` array at the end of `public/home.html` (title, author, tags, slug). The counters on the home page update themselves.

No route is needed: `api/index.js` serves any `/<slug>-character-network` automatically, and data files are served to the site's own pages.

Features specific to a work appear only when its data supports them: the vampire identity merge (`identity` data or `window.NETWORK_CONFIG`), chapters (chapter range), predation (`predation_edges`).

---

## Anti-scraping and rights

`api/protect.js` runs before anything is served:

* refuses known AI crawlers, SEO crawlers, scraping libraries and headless browsers (**403**);
* sends `tdm-reservation: 1`, a TDMRep policy (`/.well-known/tdmrep.json`) and `X-Robots-Tag: noai, noimageai` on every response, reserving text and data mining rights under Art. 4(3) of Directive (EU) 2019/790;
* lets search engines index only `/home`, `/about`, `/whitepaper` and `/privacy` (`robots.txt`); the visualizers are `noindex`;
* serves the `*.json` data only to the site's own pages (a direct link or a script gets **403**).

A determined scraper can still imitate a browser. For a second layer, enable the managed **Bot Protection** and **AI Bots** rules in the Vercel dashboard (Firewall).

---

## Visitor statistics and privacy

The site sets no cookies. Visits are counted with **Vercel Web Analytics** (cookieless), loaded by `site.js` on every page except on localhost. Enable it in the Vercel dashboard: *Project → Analytics → Enable*. The first-visit notice is informative only; its dismissal is kept in the browser's local storage. Details: `/privacy`.

All scripts and fonts are self-hosted (`public/vendor/`, `public/fonts/`); no third-party requests are made.

---

## Deployment

Push to the repository connected to Vercel, or run `vercel --prod`. No environment variables are required. Keep the `.vercel/` folder out of archives you share (it is already in `.gitignore`).

---

## License

The code is released under the [GNU General Public License v3.0](LICENSE). The content of the site (analyses, visualisations, data) is not covered by the GPL; see the terms of use at `/privacy#use`.

---

## Contact

[andreinicolae@tuta.io](mailto:andreinicolae@tuta.io)
