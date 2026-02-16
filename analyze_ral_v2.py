import pandas as pd

file_path = "C:\\Antigravity\\Matthieu\\Liste de besoin\\BDD Arts Alu 2026.xlsx"

try:
    df = pd.read_excel(file_path)
    
    print("\n--- Column: decor ---")
    if 'decor' in df.columns:
        print("Unique values in 'decor':")
        print(df['decor'].unique())
        print("\nSample rows with 'decor':")
        print(df[['rfrence', 'dsignation', 'decor', 'px_public']].head(20))
    else:
        print("'decor' column not found.")

    print("\n--- Column: gamme ---")
    if 'gamme' in df.columns:
        print(df['gamme'].unique())

except Exception as e:
    print(f"Error: {e}")
