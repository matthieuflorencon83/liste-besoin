import fitz  # PyMuPDF
import re
import sys

pdf_path = r"C:\Users\utopi\Desktop\Logiciel Arts alu\tarif-installux-fr.pdf"

try:
    # Force utf-8 for console output on Windows
    sys.stdout.reconfigure(encoding='utf-8')
    
    doc = fitz.open(pdf_path)

    print(f"Opened URL: {pdf_path}")
    print(f"Pages: {len(doc)}")
    
    pages_to_scan = [30]
    
    for i in pages_to_scan:
        page = doc[i] # 0-indexed, so 30 is actually page 31
        text = page.get_text("text") # Try raw text first
        print(f"\n--- Page {i+1} ---")
        print(text)
        
    keyword_check = ["Arcelor", "ArcelorMittal", "Arval"]
    for i, page in enumerate(doc):
        t = page.get_text()
        if any(k.lower() in t.lower() for k in keyword_check):
            print(f"Found {keyword_check} on page {i+1}")


            

        
except Exception as e:
    print(f"Error: {e}")
