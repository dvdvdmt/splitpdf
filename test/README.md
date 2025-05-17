# PDF Splitter Tests

This directory contains end-to-end tests for the PDF Splitter CLI using Node's built-in test runner.

## Test Components

1. **Test PDF Generation**: `generate-test-pdf.js` creates a 20-page test PDF using PDFKit.
2. **CLI Tests**: Tests in `cli.test.js` verify the Node.js CLI interface.

## Test Setup

Before running the tests, you need to:

1. Install dependencies:
   ```
   npm install
   ```

2. Generate test PDF fixtures:
   ```
   npm run test:setup
   ```

## Running Tests

Run the tests with:

```
npm test
```

Or to generate test PDF and run tests in one command:

```
npm run test:with-setup
```

## Test Cases

The tests cover:

1. **CLI Options**:
   - Help text display
   - Error handling for invalid arguments
   - Error handling for non-existent files

2. **PDF Splitting**:
   - Verify files are created with correct names
   - Verify proper page distribution
   - Verify correct page counts

3. **Dry Run Mode**:
   - Verify JSON output
   - Verify no files are created

## Test Output

Test output files are created in the `temp/` directory and are automatically cleaned up after tests complete.

## Adding New Tests

When adding new tests:

1. Add test cases to `cli.test.js`
2. If needed, update the test PDF generator in `generate-test-pdf.js` 