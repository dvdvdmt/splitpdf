#!/usr/bin/env python3

import os
import sys
from PyPDF2 import PdfReader
from glob import glob

def check_pdf_page_count(pdf_path):
    try:
        reader = PdfReader(pdf_path)
        page_count = len(reader.pages)
        return {
            'file': os.path.basename(pdf_path),
            'page_count': page_count
        }
    except Exception as e:
        return {
            'file': os.path.basename(pdf_path),
            'error': str(e)
        }

def main():
    # Check the main test PDF
    source_pdfs = [
        os.path.join('test', 'fixtures', 'test.pdf')
    ]
    
    # Check the split output PDFs
    split_pdfs = glob(os.path.join('test', 'temp', '*.pdf'))
    
    all_pdfs = source_pdfs + split_pdfs
    results = []
    
    for pdf_path in all_pdfs:
        if not os.path.exists(pdf_path):
            print(f"File not found: {pdf_path}")
            continue
            
        print(f"Checking {pdf_path}...")
        result = check_pdf_page_count(pdf_path)
        results.append(result)
        print(f"  {result}")
    
    print("\nSummary:")
    for result in results:
        if 'error' in result:
            print(f"{result['file']}: ERROR - {result['error']}")
        else:
            print(f"{result['file']}: {result['page_count']} pages")

if __name__ == "__main__":
    main() 