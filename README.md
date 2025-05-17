# PDF Splitter

A command-line utility for fast, personal splitting of large PDF documents into equal-sized parts while optionally prepending a fixed intro-page range to every part.

## Features

- Split PDFs into equal-sized parts
- Optionally prepend intro pages to each part
- Dry-run mode to preview splitting without creating files
- Detailed JSON output and verbose logging options

## Installation

```bash
# Clone the repository
git clone https://github.com/your-username/pdf-splitter.git
cd pdf-splitter

# Install dependencies
npm install

# Build the Rust binary
npm run build:rust
```

## Usage

```bash
splitpdf --file ./source.pdf --parts 3 [--intro 1:10] [--dry-run] [--verbose]
```

### Options

- `--file, -f <path>`: Path to the source PDF file (required)
- `--parts, -p <integer>`: Number of parts to split the PDF into (required)
- `--intro, -i <range>`: Intro page range, e.g., 1:10 (1-based, inclusive)
- `--dry-run`: Print calculated page ranges as JSON and exit without writing files
- `--verbose`: Enable verbose logging (progress as JSON lines)
- `--output-dir <path>`: Directory to output split PDF files (defaults to source file directory)
- `--output-basename <name>`: Base name for output files (defaults to source file name without extension)

### Examples

```bash
# Split a PDF into 3 equal parts
splitpdf --file ./document.pdf --parts 3

# Split a PDF into 2 parts, each with pages 1-5 as an intro
splitpdf --file ./document.pdf --parts 2 --intro 1:5

# Preview splitting without creating files
splitpdf --file ./document.pdf --parts 4 --dry-run

# Save output to a specific directory with a custom basename
splitpdf --file ./document.pdf --parts 2 --output-dir ./output --output-basename split_doc
```

## Development

### Testing

```bash
# Generate test fixtures and run tests
npm run test:with-setup

# Run tests only (assumes fixtures already exist)
npm test

# Generate test fixtures only
npm run test:setup
```

### Architecture

The project consists of:

1. **Node.js CLI Interface**: Handles argument parsing and validation
2. **Rust Core Processing**: Performs the actual PDF splitting

## Exit Codes

| Code | Meaning                                                   |
| ---- | --------------------------------------------------------- |
| 0    | Success                                                   |
| 2    | Invalid CLI arguments                                     |
| 3    | I/O error (file not found, permission denied)             |
| 4    | PDF parse/processing error                                |
| 5    | Unsupported PDF features (encrypted, incremental updates) | 