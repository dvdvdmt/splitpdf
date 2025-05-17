# PDF Splitter Specification

## Goal & Scope

A command‑line utility for **fast, personal splitting of large PDF documents** into equal‑sized parts while optionally prepending a fixed intro‑page range to every part. The tool runs entirely on the local machine (no GUI) and produces files ready for downstream processors such as NotebookLM.


## Architecture Overview


* **Interface layer**: Pure JavaScript (Node ≥ 20 LTS) using **commander** for argument parsing.
* **Core processing**: JavaScript using [pdf-lib](https://pdf-lib.js.org/) for PDF manipulation.
* **Communication**: Single process architecture with direct library calls.

## Tech Stack

This project leverages the following technologies:

Node.js (≥ 20 LTS): The runtime environment for the CLI interface.
Documentation: https://nodejs.org/en/docs/

Node.js Test Runner (node:test): The built-in module for end-to-end testing of the CLI.
Documentation: https://nodejs.org/api/test.html

commander.js: A library for parsing command-line arguments in Node.js.
GitHub: https://github.com/tj/commander.js

pdf-lib: A pure JavaScript library for creating and modifying PDF documents.
GitHub: https://github.com/Hopding/pdf-lib

## 3 Functional Requirements

| ID  | Requirement                                                                                                                                                                                                                            |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F‑1 | **Input parameters**: `(a) --file <path>`, `(b) --parts <int>`, `(c) --intro <range>` where range is `start:end` inclusive, 1‑based.                                                                                                   |
| F‑2 | **Dry‑run mode** (`--dry-run`): prints calculated page ranges in JSON, writes no files.                                                                                                                                                |
| F‑3 | **Split algorithm**: Let `T = totalPages`, `I = introCount`. Compute `N = T − I`; `base = ⌊N/parts⌋`; `remainder = N mod parts`. Distribute the extra pages to the first `remainder` parts. Intro pages are prepended to every output. |
| F‑4 | **Output files**: saved alongside the source as `<basename>_part<index>.pdf` (1‑based).                                                                                                                                                |

|F‑5 | **Error handling**: conform to exit‑code contract in Section 5. All error messages must be clearly written to the console in human-readable form.|

## 4 Command‑Line Interface

```
quickpdfsplit \
  --file ./source.pdf \
  --parts 3 \
  --intro 1:10 \
  [--dry-run] [--verbose]
```

*Short flags*: `-f`, `-p`, `-i`.

### Verbosity & logging

* `--verbose` → progress as JSON lines (`{"event":"progress","page":42}` …).
* Default: minimal output (errors only).

## 5 Exit Codes

| Code | Meaning                                                   |
| ---- | --------------------------------------------------------- |
| 0    | Success                                                   |
| 2    | Invalid CLI arguments                                     |
| 3    | I/O error (file not found, permission denied)             |
| 4    | PDF parse/processing error                                |
| 5    | Unsupported PDF features (encrypted, incremental updates) |



## 6 Testing Strategy (End‑to‑End only)

* **Framework**: Node's built‑in [`node:test`](https://nodejs.org/api/test.html) module with `ChildProcess.spawn()` to invoke the CLI.
* **Fixtures**: Synthetic multi‑hundred‑page PDFs generated programmatically; stored in Git LFS to keep repository size reasonable.
* **Assertions**

  * Correct number and naming of output files.
  * Each output opens and has the expected intro sequence and total page count.
  * Negative scenarios (bad path, invalid range) yield correct exit codes.
* **CI**: GitHub Actions matrix across macOS, Windows, Linux executing the E2E suite.


