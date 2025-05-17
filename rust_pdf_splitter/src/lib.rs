use pdfium_render::prelude::*;
use serde::{Serialize, Deserialize};
use std::path::{Path, PathBuf};

#[derive(Serialize, Deserialize, Debug)]
pub struct SplitArgs {
    pub file_path: String,
    pub parts: usize,
    pub intro_range: Option<(usize, usize)>,
    pub output_dir: Option<String>,
    pub output_basename: Option<String>,
    pub verbose: bool,
    pub dry_run: bool,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct PageRange {
    pub part_index: usize,
    pub start_page: usize,
    pub end_page: usize,
    pub intro_start_page: Option<usize>,
    pub intro_end_page: Option<usize>,
    pub with_intro: bool,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SplitResult {
    pub total_pages_in_source: usize,
    pub intro_pages_count: usize,
    pub body_pages_count: usize,
    pub parts_to_create: usize,
    pub ranges: Vec<PageRange>,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Event {
    Progress { page: usize, total: usize },
    PartComplete { index: usize, path: String },
    Complete { output_count: usize },
}

pub fn calculate_ranges(total_pages: usize, parts: usize, intro_range: Option<(usize, usize)>) -> SplitResult {
    let intro_pages_count = intro_range.map_or(0, |(start, end)| end - start + 1);
    let body_pages_count = total_pages - intro_pages_count;
    let base_page_count = body_pages_count / parts;
    let remainder = body_pages_count % parts;
    
    let mut ranges = Vec::with_capacity(parts);
    let mut start_page = intro_range.map_or(1, |(_, end)| end + 1);
    
    for i in 0..parts {
        let part_page_count = base_page_count + if i < remainder { 1 } else { 0 };
        let end_page = start_page + part_page_count - 1;
        
        let range = PageRange {
            part_index: i + 1,
            start_page,
            end_page,
            intro_start_page: intro_range.map(|(s, _)| s),
            intro_end_page: intro_range.map(|(_, e)| e),
            with_intro: intro_range.is_some(),
        };
        
        ranges.push(range);
        start_page = end_page + 1;
    }
    
    SplitResult {
        total_pages_in_source: total_pages,
        intro_pages_count,
        body_pages_count,
        parts_to_create: parts,
        ranges,
    }
}

pub fn get_pdf_page_count(file_path: &str) -> Result<usize, String> {
    // Initialize PDFium
    let bindings = match Pdfium::bind_to_library(Pdfium::pdfium_platform_library_name_at_path("./pdfium/"))
        .or_else(|_| Pdfium::bind_to_system_library()) {
            Ok(binding) => binding,
            Err(e) => return Err(e.to_string()),
        };
    
    let pdfium = Pdfium::new(bindings);
    
    let document = match pdfium.load_pdf_from_file(file_path, None) {
        Ok(doc) => doc,
        Err(e) => return Err(e.to_string()),
    };
    
    Ok(document.pages().len() as usize)
}

pub fn process_pdf(args: &SplitArgs) -> Result<SplitResult, String> {
    // Check if file exists
    if !Path::new(&args.file_path).exists() {
        return Err(format!("File not found at {}", args.file_path));
    }
    
    // Initialize PDFium
    let bindings = match Pdfium::bind_to_library(Pdfium::pdfium_platform_library_name_at_path("./pdfium/"))
        .or_else(|_| Pdfium::bind_to_system_library()) {
            Ok(binding) => binding,
            Err(e) => return Err(e.to_string()),
        };
    
    let pdfium = Pdfium::new(bindings);
    
    // Load the document
    let document = match pdfium.load_pdf_from_file(&args.file_path, None) {
        Ok(doc) => doc,
        Err(e) => return Err(e.to_string()),
    };
    
    // Get total pages
    let total_pages = document.pages().len() as usize;
    
    // Validate intro range if provided
    if let Some((start, end)) = args.intro_range {
        if start < 1 || start > total_pages {
            return Err(format!("Invalid intro start page: {}", start));
        }
        if end < start || end > total_pages {
            return Err(format!("Invalid intro end page: {}", end));
        }
    }
    
    // Calculate page ranges
    let result = calculate_ranges(total_pages, args.parts, args.intro_range);
    
    // If dry run, just return the result
    if args.dry_run {
        return Ok(result);
    }
    
    // Set up output directory and basename
    let output_dir = args.output_dir.as_deref().unwrap_or(".");
    let output_basename = args.output_basename.as_deref().unwrap_or("output");
    
    // Create output directory if it doesn't exist
    if !Path::new(output_dir).exists() {
        std::fs::create_dir_all(output_dir).map_err(|e| e.to_string())?;
    }
    
    // Process each part
    for range in &result.ranges {
        // Create a new document for this part
        let mut output_document = match pdfium.create_new_pdf() {
            Ok(doc) => doc,
            Err(e) => return Err(e.to_string()),
        };
        
        // Add intro pages if required
        if range.with_intro {
            let intro_start = range.intro_start_page.unwrap() - 1; // Convert to 0-based
            let intro_end = range.intro_end_page.unwrap() - 1;
            
            for page_index in intro_start..=intro_end {
                let source_page = match document.pages().get(page_index as PdfPageIndex) {
                    Ok(page) => page,
                    Err(e) => return Err(e.to_string()),
                };
                
                // Get the dimensions of the source page
                let width = source_page.width();
                let height = source_page.height();
                
                // Create a new page in the output document with the same dimensions
                if let Err(e) = output_document.pages_mut().create_page_at_end(PdfPagePaperSize::Custom(width, height)) {
                    return Err(format!("Failed to create page: {}", e));
                }
                
                if args.verbose {
                    println!(
                        "{}",
                        serde_json::to_string(&Event::Progress {
                            page: page_index + 1,
                            total: total_pages,
                        }).unwrap()
                    );
                }
            }
        }
        
        // Add content pages
        let content_start = range.start_page - 1; // Convert to 0-based
        let content_end = range.end_page - 1;
        
        for page_index in content_start..=content_end {
            let source_page = match document.pages().get(page_index as PdfPageIndex) {
                Ok(page) => page,
                Err(e) => return Err(e.to_string()),
            };
            
            // Get the dimensions of the source page
            let width = source_page.width();
            let height = source_page.height();
            
            // Create a new page in the output document with the same dimensions
            if let Err(e) = output_document.pages_mut().create_page_at_end(PdfPagePaperSize::Custom(width, height)) {
                return Err(format!("Failed to create page: {}", e));
            }
            
            if args.verbose {
                println!(
                    "{}",
                    serde_json::to_string(&Event::Progress {
                        page: page_index + 1,
                        total: total_pages,
                    }).unwrap()
                );
            }
        }
        
        // Save the output
        let output_filename = format!("{}_part{}.pdf", output_basename, range.part_index);
        let output_path = PathBuf::from(output_dir).join(output_filename);
        let output_path_str = output_path.to_string_lossy().to_string();
        
        // Save the document
        match output_document.save_to_file(&output_path) {
            Ok(_) => {},
            Err(e) => return Err(format!("Failed to save PDF: {}", e)),
        }
        
        if args.verbose {
            println!(
                "{}",
                serde_json::to_string(&Event::PartComplete {
                    index: range.part_index,
                    path: output_path_str,
                }).unwrap()
            );
        }
    }
    
    if args.verbose {
        println!(
            "{}",
            serde_json::to_string(&Event::Complete {
                output_count: result.ranges.len(),
            }).unwrap()
        );
    }
    
    Ok(result)
}

// FFI function for calling from other languages
#[no_mangle]
pub extern "C" fn split_pdf(args_json: *const std::os::raw::c_char) -> i32 {
    // Convert the C string to a Rust string
    let args_str = unsafe {
        if args_json.is_null() {
            return 2; // Invalid arguments
        }
        match std::ffi::CStr::from_ptr(args_json).to_str() {
            Ok(s) => s,
            Err(_) => return 2, // Invalid arguments
        }
    };
    
    // Parse the JSON
    let args: SplitArgs = match serde_json::from_str(args_str) {
        Ok(a) => a,
        Err(_) => return 2, // Invalid arguments
    };
    
    // Process the PDF
    match process_pdf(&args) {
        Ok(_) => 0, // Success
        Err(e) => {
            eprintln!("Error: {}", e);
            if e.contains("not found") {
                3 // I/O error
            } else {
                4 // PDF processing error
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_ranges() {
        // Test with 20 pages, 4 parts, no intro
        let result = calculate_ranges(20, 4, None);
        assert_eq!(result.total_pages_in_source, 20);
        assert_eq!(result.intro_pages_count, 0);
        assert_eq!(result.body_pages_count, 20);
        assert_eq!(result.parts_to_create, 4);
        assert_eq!(result.ranges.len(), 4);
        
        // Each part should have 5 pages
        for i in 0..4 {
            assert_eq!(result.ranges[i].part_index, i + 1);
            assert_eq!(result.ranges[i].end_page - result.ranges[i].start_page + 1, 5);
            assert_eq!(result.ranges[i].with_intro, false);
        }
        
        // Test with 19 pages, 4 parts, no intro (uneven distribution)
        let result = calculate_ranges(19, 4, None);
        assert_eq!(result.total_pages_in_source, 19);
        assert_eq!(result.body_pages_count, 19);
        
        // First 3 parts should have 5 pages, last one 4 pages
        for i in 0..3 {
            assert_eq!(result.ranges[i].end_page - result.ranges[i].start_page + 1, 5);
        }
        assert_eq!(result.ranges[3].end_page - result.ranges[3].start_page + 1, 4);
        
        // Test with intro pages
        let result = calculate_ranges(20, 4, Some((1, 4)));
        assert_eq!(result.intro_pages_count, 4);
        assert_eq!(result.body_pages_count, 16);
        
        // Each part should have 4 body pages + intro
        for i in 0..4 {
            assert_eq!(result.ranges[i].end_page - result.ranges[i].start_page + 1, 4);
            assert_eq!(result.ranges[i].with_intro, true);
            assert_eq!(result.ranges[i].intro_start_page, Some(1));
            assert_eq!(result.ranges[i].intro_end_page, Some(4));
        }
    }
} 