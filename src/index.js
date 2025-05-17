// This file is the main entry point for the module (if imported).
// For the CLI, see src/cli.js.

const path = require('path');
const fs = require('fs/promises');
const { PDFDocument } = require('pdf-lib');

/**
 * Splits a PDF into multiple parts, optionally prepending an intro range
 * 
 * @param {Object} options Configuration options
 * @param {string} options.filePath Path to the source PDF
 * @param {number} options.parts Number of parts to split into
 * @param {Object|null} options.intro Intro page range (1-based, inclusive)
 * @param {number} options.intro.start Start page of intro (1-based)
 * @param {number} options.intro.end End page of intro (1-based)
 * @param {string} options.outputDir Directory for output files
 * @param {string} options.outputBasename Base filename for output parts
 * @param {boolean} options.dryRun If true, only returns calculated page ranges without writing files
 * @param {Function} options.progressCallback Optional callback for progress updates
 * @returns {Promise<Array<Object>>} Array of parts with page ranges and output paths
 */
async function splitPdf(options) {
  try {
    // Load the source PDF
    const sourceBytes = await fs.readFile(options.filePath);
    const sourcePdf = await PDFDocument.load(sourceBytes);
    
    // Get total page count
    const totalPages = sourcePdf.getPageCount();
    
    // Calculate intro pages
    const introCount = options.intro 
      ? (options.intro.end - options.intro.start + 1) 
      : 0;
    
    // Setup intro pages array for copying later
    let introPages = [];
    if (introCount > 0) {
      // Validate intro range
      if (options.intro.start < 1 || options.intro.end > totalPages) {
        throw new Error(`Invalid intro range: ${options.intro.start}:${options.intro.end}. Valid range is 1:${totalPages}`);
      }
      
      // Convert from 1-based to 0-based indexing
      introPages = Array.from(
        { length: introCount },
        (_, i) => i + options.intro.start - 1
      );
    }
    
    // Calculate main content division
    const remainingPages = totalPages - introCount;
    const parts = options.parts;
    
    // Error if we can't create the requested number of parts
    if (remainingPages < parts) {
      throw new Error(`Cannot split ${remainingPages} remaining pages into ${parts} parts`);
    }
    
    // Calculate base pages per part and remainder
    const basePerPart = Math.floor(remainingPages / parts);
    const remainder = remainingPages % parts;
    
    // Calculate page ranges for each part
    const partInfos = [];
    
    // Track current page (0-based)
    let currentNonIntroPage = introCount;
    
    for (let i = 0; i < parts; i++) {
      // Calculate pages for this part (add an extra page for the first 'remainder' parts)
      const partPageCount = basePerPart + (i < remainder ? 1 : 0);
      
      // Define page range for this part
      const partPages = Array.from(
        { length: partPageCount },
        (_, j) => currentNonIntroPage + j
      );
      
      // Update current page tracker
      currentNonIntroPage += partPageCount;
      
      // Calculate output filename
      const outputFile = `${options.outputBasename}_part${i + 1}.pdf`;
      const outputPath = path.join(options.outputDir, outputFile);
      
      // Save part info
      partInfos.push({
        index: i + 1,
        pages: {
          // Convert to 1-based for output/reporting
          intro: introPages.map(p => p + 1),
          content: partPages.map(p => p + 1)
        },
        outputPath
      });
    }
    
    // For dry-run, just return the part info without creating files
    if (options.dryRun) {
      return partInfos;
    }
    
    // Process each part and create output PDFs
    for (let i = 0; i < partInfos.length; i++) {
      const partInfo = partInfos[i];
      
      // Create new PDF for this part
      const partPdf = await PDFDocument.create();
      
      // Copy intro pages
      if (introPages.length > 0) {
        const copiedIntroPages = await partPdf.copyPages(
          sourcePdf, 
          introPages
        );
        
        // Add copied intro pages
        for (const page of copiedIntroPages) {
          partPdf.addPage(page);
        }
      }
      
      // Convert 1-based content pages back to 0-based for copying
      const contentPages = partInfo.pages.content.map(p => p - 1);
      
      // Copy content pages for this part
      const copiedContentPages = await partPdf.copyPages(
        sourcePdf, 
        contentPages
      );
      
      // Add copied content pages
      for (const page of copiedContentPages) {
        partPdf.addPage(page);
      }
      
      // Save the part to a file
      const partBytes = await partPdf.save();
      await fs.writeFile(partInfo.outputPath, partBytes);
      
      // Report progress
      if (options.progressCallback) {
        options.progressCallback({
          event: 'partComplete',
          part: i + 1,
          totalParts: parts,
          outputPath: partInfo.outputPath
        });
      }
    }
    
    return partInfos;
  } catch (error) {
    // Add contextual information to the error
    if (error.message.includes('file does not exist')) {
      const enhancedError = new Error(`I/O error: ${error.message}`);
      enhancedError.code = 3; // I/O error
      throw enhancedError;
    } else if (error.message.includes('invalid') || error.message.includes('encrypted')) {
      const enhancedError = new Error(`PDF error: ${error.message}`);
      enhancedError.code = error.message.includes('encrypted') ? 5 : 4; // 5 for encrypted, 4 for other PDF errors
      throw enhancedError;
    }
    
    // For other errors, just pass them through
    throw error;
  }
}

module.exports = {
  splitPdf
}; 