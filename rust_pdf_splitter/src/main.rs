use std::env;
use std::path::Path;
use std::process;
use serde::{Serialize, Deserialize};
use serde_json;

// Import from the lib.rs module
use rust_pdf_splitter::*;

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
    
    // Parse intro range
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
    
    // Create split args - using the qualified name
    let args = SplitArgs {
        file_path: file_path.clone(),
        parts,
        intro_range,
        output_dir: options.get("output-dir").cloned(),
        output_basename: options.get("output-basename").cloned(),
        verbose: options.contains_key("verbose"),
        dry_run: options.contains_key("dry-run"),
    };
    
    // Process the PDF
    match process_pdf(&args) {
        Ok(result) => {
            if args.dry_run {
                println!("{}", serde_json::to_string_pretty(&result).unwrap());
            }
            process::exit(0);
        },
        Err(e) => {
            eprintln!("Error: {}", e);
            if e.contains("not found") {
                process::exit(3);
            } else {
                process::exit(4);
            }
        }
    }
} 