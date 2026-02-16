import fitz  # PyMuPDF

file_path = "C:\\Users\\utopi\\Desktop\\Logiciel Arts alu\\tarif-installux-fr.pdf"

try:
    doc = fitz.open(file_path)
    print(f"Opened PDF: {file_path}")
    print(f"Pages: {len(doc)}")

    # Extract text from first 10 pages to understand structure
    for i in range(min(10, len(doc))):
        print(f"\n--- Page {i+1} ---")
        print(doc[i].get_text()[:1000]) # Print first 1000 chars

    # Search for keywords like "Equilibre", "Expression", "Plus-value", "RAL"
    keywords = ["Equilibre", "Expression", "Plus-value", "RAL", "Laquage"]
    print("\n--- Keyword Search ---")
    for i in range(len(doc)):
        text = doc[i].get_text()
        for kw in keywords:
            if kw in text:
                print(f"Found '{kw}' on page {i+1}")
                # Print context around keyword
                idx = text.find(kw)
                start = max(0, idx - 100)
                end = min(len(text), idx + 200)
                print(f"Context: ...{text[start:end]}...")
                
except Exception as e:
    print(f"Error reading PDF: {e}")
