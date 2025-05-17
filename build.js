#!/usr/bin/env node

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('Building Rust PDF splitter...');

// Determine platform-specific extension
const getBinaryExtension = () => {
  return os.platform() === 'win32' ? '.exe' : '';
};

// Create bin directory if it doesn't exist
const binDir = path.join(__dirname, 'bin');
if (!fs.existsSync(binDir)) {
  fs.mkdirSync(binDir);
}

// Build the Rust binary
const buildResult = spawnSync('cargo', ['build', '--release'], {
  cwd: path.join(__dirname, 'rust_pdf_splitter'),
  stdio: 'inherit'
});

if (buildResult.status !== 0) {
  console.error('Failed to build Rust binary');
  process.exit(1);
}

// Copy the binary to the bin directory
const binaryName = `rust_pdf_splitter${getBinaryExtension()}`;
const sourcePath = path.join(__dirname, 'rust_pdf_splitter', 'target', 'release', binaryName);
const destPath = path.join(__dirname, 'bin', 'rust_pdf_splitter');

fs.copyFileSync(sourcePath, destPath);
fs.chmodSync(destPath, 0o755); // Make executable

console.log(`Rust binary copied to ${destPath}`);
console.log('Build completed successfully'); 