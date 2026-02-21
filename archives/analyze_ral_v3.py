import pandas as pd
import sys

# Set encoding for output to avoid charmap errors
sys.stdout.reconfigure(encoding='utf-8')

file_path = "C:\\Antigravity\\Matthieu\\Liste de besoin\\BDD Arts Alu 2026.xlsx"

try:
    df = pd.read_excel(file_path)
    
    # Normalize column names (lowercase, remove accents/special chars if needed)
    df.columns = [c.lower() for c in df.columns]
    print("Columns found:", list(df.columns))

    # Find relevant columns using fuzzy matching concept
    col_ref = next((c for c in df.columns if 'ref' in c), None)
    col_des = next((c for c in df.columns if 'des' in c or 'dés' in c), None)
    col_dec = next((c for c in df.columns if 'dec' in c or 'déc' in c), None)
    col_px = next((c for c in df.columns if 'px' in c or 'prix' in c), None)

    print(f"\nMapped columns: Ref={col_ref}, Des={col_des}, Dec={col_dec}, Px={col_px}")

    if col_dec:
        print("\n--- Column: decor ---")
        print("Unique values in 'decor':")
        # Get unique values and sort them, handling mixed types
        uniques = sorted([str(x) for x in df[col_dec].unique() if pd.notna(x)])
        print(uniques)
        
        print("\nSample rows with 'decor':")
        cols_to_show = [c for c in [col_ref, col_des, col_dec, col_px] if c]
        print(df[cols_to_show].head(20))
    else:
        print("'decor' column not found.")

except Exception as e:
    print(f"Error: {e}")
