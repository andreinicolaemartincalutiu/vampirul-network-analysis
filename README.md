# Vampirul — Novel Analysis Pipeline: Setup Guide

## Overview

This pipeline extracts, validates, and analyzes dialogue from a Romanian novel (`.docx`), producing a character interaction network enriched with vocabulary profiles. It is built entirely inside a single Jupyter notebook (`algorithm.ipynb`) and a set of browser-based interfaces backed by local Flask servers.

**The pipeline has six sequential stages:**

1. **Dialogue Extraction** — parse the `.docx` and extract all dialogue lines into JSON
2. **Dialogue Validation** — browser UI to review, edit, delete, or add extracted dialogues
3. **Character Assignment** — browser UI to tag each dialogue with speaker, partner, and silent participants
4. **JSON Cleanup** — strip internal fields and produce a clean dialogue dataset
5. **Character Gender Assignment** — browser-based editor for gender metadata
6. **Network Generation** — build a character interaction graph with vocabulary analysis via Stanza

---

## Requirements

**Python 3.8+** is required. Install all dependencies with:

```bash
pip install -r requirements.txt
```

The `requirements.txt` covers: `python-docx`, `stanza`, `pandas`, `flask`, `flask-cors`, and `networkx`.

Then download the **Stanza Romanian language model** (one-time step):

```bash
python -c "import stanza; stanza.download('ro')"
```

---

## File Structure

Place the following files in the same directory before running:

```
project/
├── algorithm.ipynb                 # Main pipeline notebook
├── requirements.txt
├── validation_interface.html       # Served by Cell 2 Flask server (port 5000)
├── character_assignment.html       # Served by Cell 3 Flask server (port 5001)
├── character_gender_editor.html    # Opened directly in browser (no server needed)
├── character_network.html          # Final visualization (open directly in browser)
├── script.js                       # Required by character_network.html
├── style.css                       # Required by character_network.html
└── your_novel.docx                 # Your input file
```

---

## Running the Pipeline

Open `algorithm.ipynb` in Jupyter and run cells  **in order** . Each cell is labeled with its stage.

### Cell 1 — Extract Dialogues

Update the filename at the bottom of the cell:

```python
dialogues = extract_all_dialogues_smart('your_novel.docx')
```

**Outputs produced:**

* `dialogues_extracted.json` — raw extraction results
* `dialogues_validation_state.json` — validation session state

The extractor handles two Romanian dialogue conventions:

* Lines starting with an em-dash (`—`)
* Text enclosed in Romanian quotation marks (`„..."`)

Short attribution-only lines (e.g. `— zise el`) are automatically filtered out.

---

### Cell 2 — Dialogue Validation Server

Starts a Flask server on **port 5000** and generates `dialogue_id_char_work.json`.

Open **http://localhost:5000** in your browser. The interface lets you:

* **Valid** — accept the dialogue as extracted
* **Edit** — correct the text in place
* **Mark Del** — flag for deletion (kept in state, excluded from export)
* **Delete** — remove permanently from the JSON
* **Add Dialogue** — insert a new entry after the current one
* **Skip** — move to next without acting

Progress auto-saves to the server every 5 minutes. Use **Save Progress Now** for an immediate save + local backup download.

**Keyboard shortcuts:** `V` = Valid, `E` = Edit, `D` = Mark Delete, `S` = Skip, `← →` = Navigate

> Stop the server by restarting the Jupyter kernel before moving to Cell 3.

---

### Cell 3 — Character Assignment Server

Starts a Flask server on  **port 5001** .

Open **http://localhost:5001** in your browser. For each dialogue you assign:

* **Speaker** — who is speaking
* **Dialogue Partner** — who they are speaking to
* **Silent Participants** — characters present but not speaking

All three fields draw from a pre-configured character list (`DEFAULT_CHARACTERS` at the top of the cell). You can add new names on the fly using the custom input fields — they persist for the session.

Session state (last position, filter) is saved automatically so you can resume across browser refreshes.

**Keyboard shortcuts:** `Ctrl+S` = Save & Next, `Ctrl+→` = Next, `Ctrl+←` = Previous

> **Note:** `DEFAULT_CHARACTERS` is hardcoded for this specific novel. Replace it with your own character list before running.

> Stop the server by restarting the Jupyter kernel before moving to Cell 4.

---

### Cell 4 — Clean Final JSON

Reads `dialogue_id_char_work.json`, strips all internal validation fields, reindexes IDs from 1, and writes:

* **`dialogues_with_participants.json`** — the clean dataset used by all subsequent cells

Each entry contains only: `id`, `text`, `word_count`, `speaker_name`, `dialogue_partner`, `silent_participants`.

---

### Cell 5 — Extract Character Metadata

Reads `dialogues_with_participants.json`, collects all unique character names across all three participant fields, and writes:

* **`characters_metadata.json`** — one entry per character with `name`, `gender` (null), `dialogue_count`, `notes`

Then open **`character_gender_editor.html` directly in your browser** (no server needed — it reads `characters_metadata.json` via a local fetch). Assign gender (`M` / `F` / `C` for collective) to each character. Characters are sorted by dialogue count descending.

**Saving:** click  **Save All** . If a PHP backend is not available (it won't be unless you configure one), the file downloads automatically. Replace `characters_metadata.json` in your project folder with the downloaded file before running Cell 6.

---

### Cell 6 — Generate Character Network

This is a multi-step cell sequence (all under the `## GENERATE CHARACTER NETWORK` heading). Run them in order:

**Config cell** — sets file paths and vocabulary thresholds:

```python
DIALOGUES_FILE    = "dialogues_with_participants.json"
METADATA_FILE     = "characters_metadata.json"
OUTPUT_FILE       = "network_data.json"
```

**Subsequent cells (run in order):**

1. Load dialogues and metadata
2. Build the NetworkX graph (direct interactions + co-presence)
3. Calculate centrality metrics and detect communities (greedy modularity)
4. Analyze per-character connection profiles
5. Run the **Stanza NLP pipeline** — tokenizes, POS-tags, and lemmatizes all dialogue text; this is the slowest step
6. Build vocabulary profiles (TTR, MTLD, top words, per-relationship breakdowns)
7. **Enrich and export** → writes `network_data.json`

**Output:** `network_data.json` — a self-contained file with nodes, edges, centrality scores, community assignments, gender data, and vocabulary profiles.

---

## Viewing the Network

Open **`character_network.html`** directly in your browser (no server needed). It loads `network_data.json` from the same folder.

The visualization requires `script.js` and `style.css` to be in the same directory.

**Features:**

* Force-directed graph with D3.js
* Filter by minimum dialogues or edge weight
* Toggle between direct dialogue and co-presence edges
* **Community View** — collapse individual nodes into community clusters
* **Merge Vampire** — combine multiple character aliases into a single merged node (configured via `meta_identity` fields in `characters_metadata.json`)
* Click any node to open a side drawer with: overview stats, connection table with vocabulary overlap scores, per-character vocabulary profile (MTLD, TTR, POS distribution, top words, per-relationship word shifts), community cohesion analysis
* Export to SVG or PNG

> **Note:** `character_network.html` fetches `network_data_with_vocabulary_final.json` by default (see `script.js` line 1). If your output file is named differently, update that path.

---

## Intermediate Files Reference

| File                                  | Created by    | Used by                    |
| ------------------------------------- | ------------- | -------------------------- |
| `dialogues_extracted.json`          | Cell 1        | —                         |
| `dialogues_validation_state.json`   | Cell 1        | Cell 2 server              |
| `dialogue_id_char_work.json`        | Cell 2 server | Cell 3 server              |
| `character_assignment_session.json` | Cell 3 server | Cell 3 server              |
| `dialogues_with_participants.json`  | Cell 4        | Cells 5 & 6                |
| `characters_metadata.json`          | Cell 5        | Cell 6                     |
| `network_data.json`                 | Cell 6        | `character_network.html` |

---

## Adapting to a Different Novel

1. **Replace the input file** — update the filename in Cell 1
2. **Update `DEFAULT_CHARACTERS`** in Cell 3 with your character list
3. **Review `attribution_verbs`** in Cell 1 — currently set to Romanian dialogue attribution verbs; update for your language
4. **Review `RO_STOPWORDS`** in the network config cell — replace with appropriate stopwords for your language
5. **Change the Stanza language model** in the vocabulary cell if your novel is not in Romanian:
   ```python
   nlp = stanza.Pipeline("en", ...)  # or any supported language code
   ```
6. **Update `DIALOGUES_FILE` / `METADATA_FILE` / `OUTPUT_FILE`** in the network config cell if you rename files

---

## Troubleshooting

**Flask server won't start on port 5000/5001** — another process is using the port. Either kill it or change `port=5000` in the cell.

**Browser shows "Error loading data"** — make sure the Flask server cell is still running (kernel not restarted) before opening the browser interface.

**`character_network.html` shows "Error loading data"** — confirm `network_data.json` (or whichever filename is set in `script.js`) is in the same folder as the HTML file.

**Stanza download fails** — try downloading manually:

```python
import stanza
stanza.download('ro', verbose=True)
```

**`characters_metadata.json` not updating in the gender editor** — the browser fetches the file at load time. If you edited it externally, refresh the page.

---

## Credits

This pipeline was developed by **Anca-Simina Martin** and **Andrei-Nicolae Martin-Căluțiu** at the *Lucian Blaga University of Sibiu*, Romania.

---

## License

This project is licensed under the  **GNU General Public License v3.0 (GPL-3.0)** .

You are free to use, study, modify, and distribute this software. Any modified or derivative version must also be released under GPL-3.0 and make its source code available. This license does not permit incorporating this code into proprietary closed-source software.

See the [LICENSE](https://claude.ai/chat/LICENSE) file for the full license text, or visit https://www.gnu.org/licenses/gpl-3.0.html.
