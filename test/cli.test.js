const { describe, it, before, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const { promisify } = require('node:util');
const { PDFDocument } = require('pdf-lib');

const CLI_PATH = path.join(__dirname, '../src/cli.js');
const TEST_PDF_PATH = path.join(__dirname, 'fixtures/test.pdf');
const TEST_OUTPUT_DIR = path.join(__dirname, 'temp');

// Helper function to run the CLI
function runCLI(args) {
  return new Promise((resolve, reject) => {
    const process = spawn('node', [CLI_PATH, ...args]);
    
    let stdout = '';
    let stderr = '';
    
    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    process.on('close', (code) => {
      resolve({
        code,
        stdout,
        stderr
      });
    });
    
    process.on('error', reject);
  });
}

// Check if a file exists and has size > 0
async function fileExists(filePath) {
  try {
    const stats = await fs.promises.stat(filePath);
    return stats.isFile() && stats.size > 0;
  } catch (err) {
    return false;
  }
}

// Get page count of a PDF file
async function getPdfPageCount(filePath) {
  try {
    const fileData = await fs.promises.readFile(filePath);
    const pdfDoc = await PDFDocument.load(fileData);
    return pdfDoc.getPageCount();
  } catch (error) {
    throw new Error(`Error checking page count for ${path.basename(filePath)}: ${error.message}`);
  }
}

describe('PDF Splitter CLI', () => {
  before(async () => {
    // Create test output directory
    await fs.promises.mkdir(TEST_OUTPUT_DIR, { recursive: true });
    
    // Check if test PDF exists, if not warn the user
    if (!await fileExists(TEST_PDF_PATH)) {
      console.warn(`Test PDF not found at ${TEST_PDF_PATH}. Run 'npm run test:setup' to generate it.`);
    }
  });
  
  afterEach(async () => {
    // Clean up test output files
    try {
      const files = await fs.promises.readdir(TEST_OUTPUT_DIR);
      for (const file of files) {
        if (file.endsWith('.pdf')) {
          await fs.promises.unlink(path.join(TEST_OUTPUT_DIR, file));
        }
      }
    } catch (err) {
      console.error('Error cleaning up test files:', err);
    }
  });
  
  it('shows help text when run with --help', async () => {
    const { code, stdout } = await runCLI(['--help']);
    
    assert.strictEqual(code, 0);
    assert.ok(stdout.includes('quickpdfsplit'));
    assert.ok(stdout.includes('--file'));
    assert.ok(stdout.includes('--parts'));
  });
  
  it('returns error code 2 with invalid arguments', async () => {
    // For this test, we'll use an invalid format for the intro parameter
    const { code } = await runCLI([
      '--file', TEST_PDF_PATH, 
      '--parts', '2',
      '--intro', 'invalid-format'  // This should trigger a validation error
    ]);
    
    assert.strictEqual(code, 2, 'Exits with code 2 for invalid intro parameter format');
  });
  
  it('returns error code 3 when file not found', async () => {
    const { code } = await runCLI(['--file', 'nonexistent.pdf', '--parts', '2']);
    assert.strictEqual(code, 3);
  });
  
  // Actual PDF splitting test - requires the test PDF to be generated
  it('splits a PDF into the specified number of parts', async function() {
    // Skip if test PDF doesn't exist
    if (!await fileExists(TEST_PDF_PATH)) {
      this.skip('Test PDF not found. Run npm run test:setup first.');
      return;
    }
    
    const outputDir = TEST_OUTPUT_DIR;
    const outputBasename = 'test';
    
    const { code, stdout, stderr } = await runCLI([
      '--file', TEST_PDF_PATH,
      '--parts', '2',
      '--output-dir', outputDir,
      '--output-basename', outputBasename,
      '--verbose'
    ]);
    
    if (stderr) console.error('STDERR:', stderr);

    assert.strictEqual(code, 0, `CLI exits with code 0, but got ${code}. Stderr: ${stderr}`);
    
    // Check if output files exist with expected names
    const outputPath1 = path.join(outputDir, `${outputBasename}_part1.pdf`);
    const outputPath2 = path.join(outputDir, `${outputBasename}_part2.pdf`);
    
    assert.ok(await fileExists(outputPath1), `Output file ${outputPath1} exists`);
    assert.ok(await fileExists(outputPath2), `Output file ${outputPath2} exists`);
    
    // Verify page counts in output files
    const sourcePdfPageCount = await getPdfPageCount(TEST_PDF_PATH);
    const part1PageCount = await getPdfPageCount(outputPath1);
    const part2PageCount = await getPdfPageCount(outputPath2);
    
    // Assert that the sum of page counts in parts equals source page count
    assert.strictEqual(
      part1PageCount + part2PageCount, 
      sourcePdfPageCount, 
      `Sum of part page counts (${part1PageCount} + ${part2PageCount}) should equal source page count (${sourcePdfPageCount})`
    );
    
    // Assert that parts have roughly the same number of pages (diff <= 1)
    assert.ok(
      Math.abs(part1PageCount - part2PageCount) <= 1,
      `Part page counts should be roughly equal: ${part1PageCount} vs ${part2PageCount}`
    );
  });
  
  it('runs in dry-run mode without creating files', async function() {
    // Skip if test PDF doesn't exist
    if (!await fileExists(TEST_PDF_PATH)) {
      this.skip('Test PDF not found. Run npm run test:setup first.');
      return;
    }
    
    const outputDir = TEST_OUTPUT_DIR;
    const outputBasename = 'test_dry_run';
    const outputPath1 = path.join(outputDir, `${outputBasename}_part1.pdf`);
    const outputPath2 = path.join(outputDir, `${outputBasename}_part2.pdf`);
    
    // Make sure output files don't exist before the test
    if (await fileExists(outputPath1)) {
      await fs.promises.unlink(outputPath1);
    }
    if (await fileExists(outputPath2)) {
      await fs.promises.unlink(outputPath2);
    }
    
    const { code, stdout } = await runCLI([
      '--file', TEST_PDF_PATH,
      '--parts', '2',
      '--output-dir', outputDir,
      '--output-basename', outputBasename,
      '--dry-run'
    ]);
    
    assert.strictEqual(code, 0);
    
    // Check that the output has JSON somewhere in it
    assert.ok(stdout.includes('"parts":'), 'Dry run output includes parts array');
    assert.ok(stdout.includes('"index":'), 'Dry run output includes part indexes');
    
    // Files are not created in dry-run mode
    assert.strictEqual(await fileExists(outputPath1), false, 'Dry run does not create output files');
    assert.strictEqual(await fileExists(outputPath2), false, 'Dry run does not create output files');
  });
  
  it('splits a PDF with intro pages', async function() {
    // Skip if test PDF doesn't exist
    if (!await fileExists(TEST_PDF_PATH)) {
      this.skip('Test PDF not found. Run npm run test:setup first.');
      return;
    }
    
    const outputDir = TEST_OUTPUT_DIR;
    const outputBasename = 'test_with_intro';
    const introStart = 1;
    const introEnd = 5;
    const introPageCount = introEnd - introStart + 1;
    
    const { code, stdout, stderr } = await runCLI([
      '--file', TEST_PDF_PATH,
      '--parts', '3',
      '--intro', `${introStart}:${introEnd}`,
      '--output-dir', outputDir,
      '--output-basename', outputBasename,
      '--verbose'
    ]);
    
    if (stderr) console.error('STDERR:', stderr);
    
    assert.strictEqual(code, 0, `CLI exits with code 0, but got ${code}. Stderr: ${stderr}`);
    
    // Check if output files exist with expected names
    const outputPath1 = path.join(outputDir, `${outputBasename}_part1.pdf`);
    const outputPath2 = path.join(outputDir, `${outputBasename}_part2.pdf`);
    const outputPath3 = path.join(outputDir, `${outputBasename}_part3.pdf`);
    
    assert.ok(await fileExists(outputPath1), `Output file ${outputPath1} exists`);
    assert.ok(await fileExists(outputPath2), `Output file ${outputPath2} exists`);
    assert.ok(await fileExists(outputPath3), `Output file ${outputPath3} exists`);
    
    // Verify the output contains expected info about intro pages
    assert.ok(
      stdout.includes('intro') || 
      stdout.includes('withIntro') || 
      stdout.includes('--intro-start'),
      'Output mentions intro pages'
    );
    
    // Get page counts
    const sourcePdfPageCount = await getPdfPageCount(TEST_PDF_PATH);
    const part1PageCount = await getPdfPageCount(outputPath1);
    const part2PageCount = await getPdfPageCount(outputPath2);
    const part3PageCount = await getPdfPageCount(outputPath3);
    
    // Each part should have intro pages + content pages
    // Verify each part has the intro pages included
    assert.ok(
      part1PageCount > introPageCount,
      `Part 1 should include intro pages (${introPageCount}) plus content pages. Got ${part1PageCount} total pages.`
    );
    assert.ok(
      part2PageCount > introPageCount,
      `Part 2 should include intro pages (${introPageCount}) plus content pages. Got ${part2PageCount} total pages.`
    );
    assert.ok(
      part3PageCount > introPageCount,
      `Part 3 should include intro pages (${introPageCount}) plus content pages. Got ${part3PageCount} total pages.`
    );
    
    // Sum should equal source page count + (intro pages count * (parts - 1))
    // This is because intro pages are repeated in each part
    const expectedTotalPages = sourcePdfPageCount + (introPageCount * (3 - 1));
    assert.strictEqual(
      part1PageCount + part2PageCount + part3PageCount,
      expectedTotalPages,
      `Sum of part page counts should be source pages (${sourcePdfPageCount}) + intro pages (${introPageCount}) * (parts-1). ` +
      `Got ${part1PageCount} + ${part2PageCount} + ${part3PageCount} = ${part1PageCount + part2PageCount + part3PageCount}`
    );
    
    // Non-intro content should be roughly evenly distributed
    const part1ContentPages = part1PageCount - introPageCount;
    const part2ContentPages = part2PageCount - introPageCount;
    const part3ContentPages = part3PageCount - introPageCount;
    
    assert.ok(
      Math.max(part1ContentPages, part2ContentPages, part3ContentPages) - 
      Math.min(part1ContentPages, part2ContentPages, part3ContentPages) <= 1,
      `Content pages should be evenly distributed: ${part1ContentPages}, ${part2ContentPages}, ${part3ContentPages}`
    );
  });
}); 