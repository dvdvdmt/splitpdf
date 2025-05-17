#!/usr/bin/env node

const { Command } = require('commander');
const path = require('path');
const fs = require('fs');
const { splitPdf } = require('./index');

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
  .option('--output-basename <n>', 'Base name for output files (defaults to source file name without extension)');

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
    const introRangeParts = options.intro.split(':');
    const introRange = [];
    for (const part of introRangeParts) {
      introRange.push(Number(part));
    }
    
    let hasInvalidNumber = false;
    for (const num of introRange) {
      if (isNaN(num)) {
        hasInvalidNumber = true;
        break;
      }
    }
    
    if (introRange.length !== 2 || hasInvalidNumber || introRange[0] < 1 || introRange[1] < introRange[0]) {
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

// Prepare options for the splitPdf function
const splitterOptions = {
  filePath: path.resolve(options.file),
  parts: options.parts,
  intro: options.introParsed,
  outputDir: options.outputDir,
  outputBasename: options.outputBasename,
  dryRun: !!options.dryRun,
  progressCallback: options.verbose ? (progress) => {
    console.log(JSON.stringify(progress));
  } : null
};

// Execute PDF splitting
async function run() {
  try {
    const result = await splitPdf(splitterOptions);
    
    if (options.dryRun) {
      // Format and print the calculated page ranges
      console.log(JSON.stringify({
        parts: result
      }, null, 2));
    } else if (options.verbose) {
      // Final summary in verbose mode
      console.log(JSON.stringify({
        event: 'complete',
        parts: result.length,
        outputFiles: result.map(part => part.outputPath)
      }));
    } else {
      // Simple completion message in non-verbose mode
      console.log(`Successfully split PDF into ${result.length} parts.`);
      console.log('Output files:');
      result.forEach(part => {
        console.log(`  ${part.outputPath}`);
      });
    }
    
    process.exit(0);
  } catch (error) {
    // Handle errors with specific exit codes
    console.error(`Error: ${error.message}`);
    
    // Use the error code if available, or determine code based on error message
    const exitCode = error.code || (() => {
      if (error.message.includes('I/O error')) return 3;
      if (error.message.includes('PDF error')) return 4;
      if (error.message.includes('encrypted')) return 5;
      return 1; // Default unknown error
    })();
    
    process.exit(exitCode);
  }
}

run(); 