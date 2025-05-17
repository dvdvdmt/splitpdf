use std::env;
use std::fs;
use std::path::Path;

fn main() {
    println!("cargo:rerun-if-changed=build.rs");
    
    // Create pdfium directory if it doesn't exist
    let out_dir = env::var("OUT_DIR").unwrap();
    let pdfium_dir = Path::new(&out_dir).join("pdfium");
    
    if !pdfium_dir.exists() {
        fs::create_dir_all(&pdfium_dir).expect("Failed to create pdfium directory");
    }
    
    // On macOS, we can use the system PDFium through PDFKit
    #[cfg(target_os = "macos")]
    {
        println!("cargo:rustc-link-lib=framework=PDFKit");
    }
    
    // For other platforms, we'd need to download and build PDFium
    // This is a simplified version - in production, you might want to use a pre-built version
    #[cfg(not(target_os = "macos"))]
    {
        // Link to PDFium - in production you would download/build it
        println!("cargo:rustc-link-search=native={}", pdfium_dir.display());
        println!("cargo:rustc-link-lib=dylib=pdfium");
    }
} 