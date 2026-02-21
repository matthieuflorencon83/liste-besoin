import fitz  # PyMuPDF
import sys

# Set encoding for output
sys.stdout.reconfigure(encoding='utf-8')

file_path = "C:\\Users\\utopi\\Desktop\\Logiciel Arts alu\\tarif-installux-fr.pdf"

try:
    doc = fitz.open(file_path)
    print(f"Opened PDF: {file_path}")
    print(f"Pages: {len(doc)}")

    # Extract text from first 20 pages
    full_text = ""
    for i in range(min(20, len(doc))):
        try:
            text = doc[i].get_text()
            full_text += text
        except Exception as e:
            print(f"Skipping page {i+1} due to error: {e}")

    # Search for keywords
    keywords = ["Equilibre", "Expression", "Plus-value", "RAL", "Laquage", "Anodisation", "Teinte"]
    print("\n--- Keyword Search Results ---")
    
    lines = full_text.split('\n')
    for i, line in enumerate(lines):
        line = line.strip()
        if any(kw.lower() in line.lower() for kw in keywords):
            # Print context (previous line + current + next)
            prev_line = lines[i-1].strip() if i > 0 else ""
            if len(line) > 5: # Filter out noise
                print(f"Match: {line}")

except Exception as e:
    print(f"Error reading PDF: {e}")
