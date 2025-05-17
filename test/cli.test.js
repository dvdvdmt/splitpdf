const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const { promisify } = require('node:util');

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

describe('PDF Splitter CLI', () => {
  before(async () => {
    // Create test output directory
    await fs.promises.mkdir(TEST_OUTPUT_DIR, { recursive: true });
    
    // Check if test PDF exists, if not warn the user
    if (!await fileExists(TEST_PDF_PATH)) {
      console.warn(`Test PDF not found at ${TEST_PDF_PATH}. Run 'npm run test:setup' to generate it.`);
    }
  });
  
  after(async () => {
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
  
  it('should show help text when run with --help', async () => {
    const { code, stdout } = await runCLI(['--help']);
    
    assert.strictEqual(code, 0);
    assert.ok(stdout.includes('quickpdfsplit'));
    assert.ok(stdout.includes('--file'));
    assert.ok(stdout.includes('--parts'));
  });
  
  it('should return error code 2 with invalid arguments', async () => {
    // For this test, we'll use an invalid format for the intro parameter
    const { code } = await runCLI([
      '--file', TEST_PDF_PATH, 
      '--parts', '2',
      '--intro', 'invalid-format'  // This should trigger a validation error
    ]);
    
    assert.strictEqual(code, 2, 'Should exit with code 2 for invalid intro parameter format');
  });
  
  it('should return error code 3 when file not found', async () => {
    const { code } = await runCLI(['--file', 'nonexistent.pdf', '--parts', '2']);
    assert.strictEqual(code, 3);
  });
  
  // Actual PDF splitting test - requires the test PDF to be generated
  it('should split a PDF into the specified number of parts', async function() {
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
    
    console.log('STDOUT:', stdout);
    if (stderr) console.error('STDERR:', stderr);


    
    assert.strictEqual(code, 0, `CLI should exit with code 0, but got ${code}. Stderr: ${stderr}`);
    
    // Check if output files exist with expected names
    const outputPath1 = path.join(outputDir, `${outputBasename}_part1.pdf`);
    const outputPath2 = path.join(outputDir, `${outputBasename}_part2.pdf`);
    
    assert.ok(await fileExists(outputPath1), `Output file ${outputPath1} should exist`);
    assert.ok(await fileExists(outputPath2), `Output file ${outputPath2} should exist`);
  });
  
  it('should run in dry-run mode without creating files', async function() {
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
    assert.ok(stdout.includes('"parts":'), 'Dry run output should include parts array');
    assert.ok(stdout.includes('"index":'), 'Dry run output should include part indexes');
    
    // Files should not be created in dry-run mode
    assert.strictEqual(await fileExists(outputPath1), false, 'Dry run should not create output files');
    assert.strictEqual(await fileExists(outputPath2), false, 'Dry run should not create output files');
  });
  
  it('should split a PDF with intro pages', async function() {
    // Skip if test PDF doesn't exist
    if (!await fileExists(TEST_PDF_PATH)) {
      this.skip('Test PDF not found. Run npm run test:setup first.');
      return;
    }
    
    const outputDir = TEST_OUTPUT_DIR;
    const outputBasename = 'test_with_intro';
    
    const { code, stdout, stderr } = await runCLI([
      '--file', TEST_PDF_PATH,
      '--parts', '3',
      '--intro', '1:5',  // First 5 pages as intro
      '--output-dir', outputDir,
      '--output-basename', outputBasename,
      '--verbose'
    ]);
    
    console.log('STDOUT:', stdout);
    if (stderr) console.error('STDERR:', stderr);
    
    assert.strictEqual(code, 0, `CLI should exit with code 0, but got ${code}. Stderr: ${stderr}`);
    
    // Check if output files exist with expected names
    const outputPath1 = path.join(outputDir, `${outputBasename}_part1.pdf`);
    const outputPath2 = path.join(outputDir, `${outputBasename}_part2.pdf`);
    const outputPath3 = path.join(outputDir, `${outputBasename}_part3.pdf`);
    
    assert.ok(await fileExists(outputPath1), `Output file ${outputPath1} should exist`);
    assert.ok(await fileExists(outputPath2), `Output file ${outputPath2} should exist`);
    assert.ok(await fileExists(outputPath3), `Output file ${outputPath3} should exist`);
    
    // Verify the output contains expected info about intro pages
    assert.ok(
      stdout.includes('intro') || 
      stdout.includes('withIntro') || 
      stdout.includes('--intro-start'),
      'Output should mention intro pages'
    );
  });
}); 