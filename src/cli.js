#!/usr/bin/env node

const { Command } = require('commander');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process'); // Uncommented

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
  .option('--verbose', 'Enable verbose logging (progress as JSON lines)')
  .option('--output-dir <path>', 'Directory to output split PDF files (defaults to source file directory)')
  .option('--output-basename <name>', 'Base name for output files (defaults to source file name without extension)');

program.parse(process.argv);

const options = program.opts();

function validateOptions(options) {
  if (!fs.existsSync(options.file)) {
    console.error(`Error: File not found at ${options.file}`);
    process.exit(3); // Exit code 3 for I/O error (file not found)
  }

  if (!options.parts || options.parts <= 0) {
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

  // Set default output directory and basename if not provided
  if (!options.outputDir) {
    options.outputDir = path.dirname(path.resolve(options.file));
  }
  
  if (!options.outputBasename) {
    options.outputBasename = path.basename(options.file, path.extname(options.file));
  }
}

validateOptions(options);

console.log('Parsed options:', options);

// Determine the path to the Rust binary
// Assuming it's in a 'bin' directory at the root of the project
const rustBinaryPath = path.join(__dirname, '..', 'bin', 'rust_pdf_splitter'); 
// For development, you might point directly to target/release or target/debug
// const rustBinaryPath = path.join(__dirname, '..', 'rust_pdf_splitter', 'target', 'release', 'rust_pdf_splitter');

if (options.dryRun) {
  console.log('Executing dry run via Rust binary...');
  const rustArgs = [
    '--file-path', path.resolve(options.file),
    '--parts', options.parts.toString(),
    '--output-basename', options.outputBasename,
    '--output-dir', options.outputDir,
    '--dry-run',
  ];
  if (options.introParsed) {
    rustArgs.push('--intro-start', options.introParsed.start.toString());
    rustArgs.push('--intro-end', options.introParsed.end.toString());
  }
  if (options.verbose) {
    rustArgs.push('--verbose');
  }

  const dryRunProcess = spawn(rustBinaryPath, rustArgs);

  let dryRunOutput = '';
  dryRunProcess.stdout.on('data', (data) => {
    dryRunOutput += data.toString();
  });

  dryRunProcess.stderr.on('data', (data) => {
    console.error(`Dry Run Rust Error: ${data}`);
  });

  dryRunProcess.on('close', (code) => {
    if (code === 0) {
      try {
        // Assuming dry-run from Rust prints JSON to stdout
        const parsedOutput = JSON.parse(dryRunOutput);
        console.log(JSON.stringify(parsedOutput, null, 2));
      } catch (e) {
        console.error('Failed to parse dry run JSON output from Rust:', e);
        console.log('Raw output:', dryRunOutput);
      }
    } else {
      console.error(`Dry run Rust process exited with code ${code}`);
    }
    process.exit(code === null ? 1 : code);
  });

} else {
  console.log('Proceeding with PDF splitting via Rust binary...');
  const rustArgs = [
    '--file-path', path.resolve(options.file),
    '--parts', options.parts.toString(),
    '--output-basename', options.outputBasename,
    '--output-dir', options.outputDir,
  ];

  if (options.introParsed) {
    rustArgs.push('--intro-start', options.introParsed.start.toString());
    rustArgs.push('--intro-end', options.introParsed.end.toString());
  }
  if (options.verbose) {
    rustArgs.push('--verbose');
  }

  console.log(`Spawning Rust binary: ${rustBinaryPath} with args:`, rustArgs.join(' '));

  const rustProcess = spawn(rustBinaryPath, rustArgs);

  rustProcess.stdout.on('data', (data) => {
    // Assuming verbose output from Rust is JSON lines
    const lines = data.toString().split('\n').filter(line => line.trim() !== '');
    lines.forEach(line => {
      try {
        const event = JSON.parse(line);
        // You could handle different event types here, e.g. progress, partComplete
        if (options.verbose) {
            console.log('Rust Event:', event);
        } else if (event.event === 'Error') {
            console.error('Rust Error:', event.message);
        }
      } catch (e) {
        if (options.verbose) { // Print non-JSON lines if verbose
            console.log('Rust STDOUT:', line);
        }
      }
    });
  });

  rustProcess.stderr.on('data', (data) => {
    console.error(`Rust STDERR: ${data}`);
  });

  rustProcess.on('close', (code) => {
    console.log(`Rust process exited with code ${code}.`);
    // Translate Rust exit codes to CLI exit codes if necessary, or just pass through
    // See Section 5 of spec/project.md
    // For now, a simple pass-through if non-zero, or specific mapping if needed
    if (code !== 0) {
        // Potentially map code to spec codes 2, 3, 4, 5 here
        console.error(`PDF splitting failed. Rust process exited with code ${code}.`);
    }
    process.exit(code === null ? 1 : code); // Exit with Rust's code, or 1 if null
  });
} 