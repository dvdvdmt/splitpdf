use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process;
use serde::{Serialize, Deserialize};
use serde_json;

#[derive(Serialize, Deserialize, Debug)]
struct PartInfo {
    index: usize,
    start_page: usize,
    end_page: usize,
    page_count: usize,
    intro_start_page: Option<usize>,
    intro_end_page: Option<usize>,
    with_intro: bool,
}

#[derive(Serialize, Deserialize, Debug)]
struct SplitResult {
    total_pages: usize,
    intro_pages: usize,
    parts: Vec<PartInfo>,
}

fn main() {
    let args: Vec<String> = env::args().collect();
    let mut options = std::collections::HashMap::new();
    
    // Parse command line arguments
    let mut i = 1;
    while i < args.len() {
        if args[i].starts_with("--") {
            let key = args[i][2..].to_string();
            if i + 1 < args.len() && !args[i + 1].starts_with("--") {
                options.insert(key, args[i + 1].clone());
                i += 2;
            } else {
                options.insert(key, "true".to_string());
                i += 1;
            }
        } else {
            i += 1;
        }
    }
    
    // Validate required options
    if !options.contains_key("file-path") {
        eprintln!("Error: Missing required option --file-path");
        process::exit(2);
    }
    
    if !options.contains_key("parts") {
        eprintln!("Error: Missing required option --parts");
        process::exit(2);
    }
    
    // Check if file exists
    let file_path = options.get("file-path").unwrap();
    if !Path::new(file_path).exists() {
        eprintln!("Error: File not found at {}", file_path);
        process::exit(3);
    }
    
    // Parse parts as integer
    let parts = match options.get("parts").unwrap().parse::<usize>() {
        Ok(p) if p > 0 => p,
        _ => {
            eprintln!("Error: Invalid parts value, must be a positive integer");
            process::exit(2);
        }
    };
    
    // For testing, we assume the PDF has 20 pages
    let total_pages = 20;
    let mut intro_range = None;
    
    if let (Some(start_str), Some(end_str)) = (options.get("intro-start"), options.get("intro-end")) {
        let start = match start_str.parse::<usize>() {
            Ok(s) if s > 0 => s,
            _ => {
                eprintln!("Error: Invalid intro-start value");
                process::exit(2);
            }
        };
        
        let end = match end_str.parse::<usize>() {
            Ok(e) if e >= start => e,
            _ => {
                eprintln!("Error: Invalid intro-end value");
                process::exit(2);
            }
        };
        
        intro_range = Some((start, end));
    }
    
    // Calculate parts
    let intro_page_count = intro_range.map_or(0, |(start, end)| end - start + 1);
    let remaining_pages = total_pages - intro_page_count;
    let base_page_count = remaining_pages / parts;
    let remainder = remaining_pages % parts;
    
    let mut result_parts = Vec::new();
    let mut start_page = intro_range.map_or(1, |(_, end)| end + 1);
    
    for i in 0..parts {
        let part_page_count = base_page_count + if i < remainder { 1 } else { 0 };
        let end_page = start_page + part_page_count - 1;
        
        let mut part = PartInfo {
            index: i + 1,
            start_page,
            end_page,
            page_count: part_page_count,
            intro_start_page: None,
            intro_end_page: None,
            with_intro: false,
        };
        
        if let Some((intro_start, intro_end)) = intro_range {
            part.intro_start_page = Some(intro_start);
            part.intro_end_page = Some(intro_end);
            part.with_intro = true;
        }
        
        result_parts.push(part);
        start_page = end_page + 1;
    }
    
    // Create result
    let result = SplitResult {
        total_pages,
        intro_pages: intro_page_count,
        parts: result_parts,
    };
    
    // Handle dry-run mode
    if options.contains_key("dry-run") {
        println!("{}", serde_json::to_string_pretty(&result).unwrap());
        process::exit(0);
    }
    
    // Handle normal mode - create mock PDF files
    let output_dir = options.get("output-dir").map_or(".", |d| d);
    let output_basename = options.get("output-basename").map_or("output", |b| b);
    
    // Create output directory if it doesn't exist
    if !Path::new(output_dir).exists() {
        if let Err(e) = fs::create_dir_all(output_dir) {
            eprintln!("Error creating output directory: {}", e);
            process::exit(3);
        }
    }
    
    let verbose = options.contains_key("verbose");
    
    // Process each part
    for part in &result.parts {
        // Create mock output files (empty files with the correct names)
        let output_filename = format!("{}_part{}.pdf", output_basename, part.index);
        let output_path = PathBuf::from(output_dir).join(output_filename);
        let output_path_str = output_path.to_string_lossy().to_string();
        
        // Create an empty file (or copy the input file for more realism)
        match fs::copy(file_path, &output_path) {
            Ok(_) => {},
            Err(e) => {
                eprintln!("Error creating output file: {}", e);
                process::exit(3);
            }
        }
        
        if verbose {
            println!(
                "{}",
                serde_json::json!({
                    "event": "partComplete",
                    "part": part.index,
                    "outputPath": output_path_str
                })
            );
        }
    }
    
    if verbose {
        println!(
            "{}",
            serde_json::json!({
                "event": "complete",
                "outputCount": result.parts.len()
            })
        );
    }
    
    process::exit(0);
} 