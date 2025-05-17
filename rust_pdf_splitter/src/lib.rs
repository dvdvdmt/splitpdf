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
    let exe_dir = std::env::current_exe()
        .map_err(|e| format!("Failed to get executable path: {}", e))?
        .parent()
        .ok_or_else(|| "Unable to determine executable directory".to_string())?
        .to_path_buf();
    
    let pdfium_paths = [
        // Check relative to executable
        exe_dir.join("pdfium"),
        // Check relative to current directory
        PathBuf::from("./pdfium"),
        // Check in parent directory
        PathBuf::from("../pdfium"),
    ];
    
    // Try binding to PDFium at various possible locations
    let mut bindings = None;
    for path in &pdfium_paths {
        if path.exists() {
            let lib_path = Pdfium::pdfium_platform_library_name_at_path(path.to_string_lossy().as_ref());
            match Pdfium::bind_to_library(lib_path) {
                Ok(binding) => {
                    bindings = Some(binding);
                    break;
                }
                Err(_) => continue,
            }
        }
    }
    
    // Fall back to system library if no local library was found
    let bindings = match bindings {
        Some(binding) => binding,
        None => match Pdfium::bind_to_system_library() {
            Ok(binding) => binding,
            Err(e) => return Err(format!("Failed to bind to PDFium library: {}", e)),
        },
    };
    
    let pdfium = Pdfium::new(bindings);
    
    let document = match pdfium.load_pdf_from_file(file_path, None) {
        Ok(doc) => doc,
        Err(e) => return Err(format!("Failed to load PDF: {}", e)),
    };
    
    Ok(document.pages().len() as usize)
}

pub fn process_pdf(args: &SplitArgs) -> Result<SplitResult, String> {
    // Check if file exists
    if !Path::new(&args.file_path).exists() {
        return Err(format!("File not found at {}", args.file_path));
    }
    
    // Resolve PDFium library path - first check for library in the executable directory
    let exe_dir = std::env::current_exe()
        .map_err(|e| format!("Failed to get executable path: {}", e))?
        .parent()
        .ok_or_else(|| "Unable to determine executable directory".to_string())?
        .to_path_buf();
    
    let pdfium_paths = [
        // Check relative to executable
        exe_dir.join("pdfium"),
        // Check relative to current directory
        PathBuf::from("./pdfium"),
        // Check in parent directory
        PathBuf::from("../pdfium"),
    ];
    
    // Try binding to PDFium at various possible locations
    let mut bindings = None;
    for path in &pdfium_paths {
        if path.exists() {
            let lib_path = Pdfium::pdfium_platform_library_name_at_path(path.to_string_lossy().as_ref());
            match Pdfium::bind_to_library(lib_path) {
                Ok(binding) => {
                    bindings = Some(binding);
                    break;
                }
                Err(_) => continue,
            }
        }
    }
    
    // Fall back to system library if no local library was found
    let bindings = match bindings {
        Some(binding) => binding,
        None => match Pdfium::bind_to_system_library() {
            Ok(binding) => binding,
            Err(e) => return Err(format!("Failed to bind to PDFium library: {}", e)),
        },
    };
    
    let pdfium = Pdfium::new(bindings);
    
    // Load the source document
    let source_document = match pdfium.load_pdf_from_file(&args.file_path, None) {
        Ok(doc) => doc,
        Err(e) => return Err(format!("Failed to load source PDF: {}", e)),
    };
    
    // Get total pages
    let total_pages = source_document.pages().len() as usize;
    if total_pages == 0 {
        return Err("Source PDF has no pages".to_string());
    }
    
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
        let mut output_doc = pdfium.create_new_pdf().map_err(|e| e.to_string())?;
        
        // For each part, we'll copy pages one by one
        let mut pages_processed = 0;
        
        // Add intro pages if required
        if range.with_intro {
            for i in range.intro_start_page.unwrap()..=range.intro_end_page.unwrap() {
                // Convert to 0-based index
                let source_page_index = i - 1;
                
                // Verify the source page exists (without storing the result)
                source_document.pages().get(source_page_index as u16)
                    .map_err(|e| format!("Failed to get intro page {}: {}", i, e))?;
                
                // Get the current page count before copying
                let current_page_count = output_doc.pages().len();
                
                // Copy the page to the output document
                match output_doc.pages_mut().copy_page_from_document(
                    &source_document,
                    source_page_index as u16,
                    current_page_count
                ) {
                    Ok(_) => (),
                    Err(e) => return Err(format!("Failed to copy intro page {}: {}", i, e)),
                };
                
                // Verify the page was copied correctly
                if output_doc.pages().len() != (pages_processed + 1) as u16 {
                    return Err(format!("Failed to verify page copy for intro page {}", i));
                }
                
                pages_processed += 1;
                
                if args.verbose {
                    println!(
                        "{}",
                        serde_json::to_string(&Event::Progress {
                            page: pages_processed,
                            total: if range.with_intro {
                                (range.end_page - range.start_page + 1) + 
                                (range.intro_end_page.unwrap() - range.intro_start_page.unwrap() + 1)
                            } else {
                                range.end_page - range.start_page + 1
                            },
                        }).unwrap()
                    );
                }
            }
        }
        
        // Add content pages
        for i in range.start_page..=range.end_page {
            // Convert to 0-based index
            let source_page_index = i - 1;
            
            // Verify the source page exists (without storing the result)
            source_document.pages().get(source_page_index as u16)
                .map_err(|e| format!("Failed to get content page {}: {}", i, e))?;
            
            // Get the current page count before copying
            let current_page_count = output_doc.pages().len();
            
            // Copy the page to the output document
            match output_doc.pages_mut().copy_page_from_document(
                &source_document,
                source_page_index as u16,
                current_page_count
            ) {
                Ok(_) => (),
                Err(e) => return Err(format!("Failed to copy content page {}: {}", i, e)),
            };
            
            // Verify the page was copied correctly
            if output_doc.pages().len() != (pages_processed + 1) as u16 {
                return Err(format!("Failed to verify page copy for content page {}", i));
            }
            
            pages_processed += 1;
            
            if args.verbose {
                println!(
                    "{}",
                    serde_json::to_string(&Event::Progress {
                        page: pages_processed,
                        total: if range.with_intro {
                            (range.end_page - range.start_page + 1) + 
                            (range.intro_end_page.unwrap() - range.intro_start_page.unwrap() + 1)
                        } else {
                            range.end_page - range.start_page + 1
                        },
                    }).unwrap()
                );
            }
        }
        
        // Create the output file path
        let output_filename = format!("{}_part{}.pdf", output_basename, range.part_index);
        let output_path = PathBuf::from(output_dir).join(output_filename);
        let output_path_str = output_path.to_string_lossy().to_string();
        
        // Save the document
        output_doc.save_to_file(&output_path_str)
            .map_err(|e| format!("Failed to save output file: {}", e))?;
        
        // Verify the output file exists and has a non-zero size
        let metadata = std::fs::metadata(&output_path)
            .map_err(|e| format!("Failed to verify output file {}: {}", output_path_str, e))?;
        
        if metadata.len() == 0 {
            return Err(format!("Output file {} has zero size", output_path_str));
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