#!/usr/bin/env node

const { Command } = require('commander');
const path = require('path');
const fs = require('fs');
// const { spawn } = require('child_process'); // Will be used later

const program = new Command();

program
  .name('quickpdfsplit')
  .description('Splits a PDF into multiple parts, optionally prepending an intro range.')
  .version('0.1.0');

program
  .requiredOption('-f, --file <path>', 'Path to the source PDF file')
  .requiredOption('-p, --parts <integer>', 'Number of parts to split the PDF into', parseInt)
  .option('-i, --intro <range>', 'Intro page range, e.g., 1:10 (1-based, inclusive)')
  .option('--dry-run', 'Print calculated page ranges as JSON and exit without writing files')
  .option('--verbose', 'Enable verbose logging (progress as JSON lines)');

program.parse(process.argv);

const options = program.opts();

function validateOptions(options) {
  if (!fs.existsSync(options.file)) {
    console.error(`Error: File not found at ${options.file}`);
    process.exit(3); // Exit code 3 for I/O error (file not found)
  }

  if (options.parts <= 0) {
    console.error('Error: Number of parts must be a positive integer.');
    process.exit(2); // Exit code 2 for invalid CLI arguments
  }

  if (options.intro) {
    const introRange = options.intro.split(':').map(Number);
    if (introRange.length !== 2 || introRange.some(isNaN) || introRange[0] < 1 || introRange[1] < introRange[0]) {
      console.error('Error: Invalid intro range. Must be in format start:end, e.g., 1:10, with start >= 1 and end >= start.');
      process.exit(2); // Exit code 2 for invalid CLI arguments
    }
    options.introParsed = { start: introRange[0], end: introRange[1] };
  } else {
    options.introParsed = null;
  }
}

validateOptions(options);

console.log('Parsed options:', options);

if (options.dryRun) {
  console.log('Executing dry run...');
  // TODO: Implement dry run logic (Phase 2)
  // This will involve calling the Rust binary or a JS function to get page count and calculate ranges.
  // For now, just print a message.
  const dryRunOutput = {
    message: "Dry run calculations will appear here.",
    sourceFile: options.file,
    parts: options.parts,
    intro: options.introParsed
  };
  console.log(JSON.stringify(dryRunOutput, null, 2));
  process.exit(0);
}

// TODO: Implement actual PDF splitting logic (Phase 1 & 2)
// This will involve spawning the Rust binary.
console.log('Proceeding with PDF splitting (to be implemented)...');

// Placeholder for calling Rust binary
// const rustArgs = [
//   JSON.stringify({
//     filePath: path.resolve(options.file),
//     parts: options.parts,
//     introRange: options.introParsed,
//     outputBasename: path.basename(options.file, path.extname(options.file)),
//     verbose: !!options.verbose,
//   })
// ];

// console.log('Calling Rust binary with:', rustArgs);
// const rustProcess = spawn('path_to_rust_binary', rustArgs);

// rustProcess.stdout.on('data', (data) => {
//   if (options.verbose) {
//     console.log(data.toString()); // Assuming JSON lines from Rust
//   }
// });

// rustProcess.stderr.on('data', (data) => {
//   console.error(`Rust Error: ${data}`);
// });

// rustProcess.on('close', (code) => {
//   console.log(`Rust process exited with code ${code}`);
//   // Handle exit codes as per spec (Section 5)
//   process.exit(code === 0 ? 0 : code); // Simplistic mapping for now
// });


// For now, a success placeholder
process.exit(0); 