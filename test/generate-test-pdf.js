#!/usr/bin/env node

// This script generates a simple test PDF file for testing the PDF splitter
// Note: We're using PDFKit for simplicity. In a real project, you'd 
// use a more comprehensive PDF generator or pre-made test files.

const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const OUTPUT_PATH = path.join(__dirname, 'fixtures/test.pdf');

// Create a document with 50 pages
function createTestPDF() {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    const writeStream = fs.createWriteStream(OUTPUT_PATH);
    
    doc.pipe(writeStream);
    
    // Create 50 pages
    for (let i = 1; i <= 50; i++) {
      doc.fontSize(40).text(`Page ${i}`, 100, 100);
      
      // Add some content to make the page visually distinct
      doc.fontSize(12).text(`This is test page ${i} for PDF splitter testing`, 100, 200);
      
      // Draw a rectangle with page number
      doc.rect(100, 250, 400, 100)
         .lineWidth(3)
         .stroke();
      doc.fontSize(24).text(`PDF SPLITTER TEST`, 150, 290);
      
      if (i < 50) {
        doc.addPage();
      }
    }
    
    doc.end();
    
    writeStream.on('finish', () => {
      console.log(`Created test PDF with 50 pages at ${OUTPUT_PATH}`);
      resolve();
    });
    
    writeStream.on('error', reject);
  });
}

// Ensure fixtures directory exists
fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });

// Generate the test PDF
createTestPDF().catch(err => {
  console.error('Error generating test PDF:', err);
  process.exit(1);
}); 