import pandas as pd

file_path = "C:\\Antigravity\\Matthieu\\Liste de besoin\\BDD Arts Alu 2026.xlsx"

try:
    # Read the Excel file
    df = pd.read_excel(file_path, sheet_name=None)  # Read all sheets

    print(f"File found: {file_path}")
    print("Sheets found:", list(df.keys()))

    for sheet_name, data in df.items():
        print(f"\n--- Sheet: {sheet_name} ---")
        print("Columns:", list(data.columns))
        print("First 5 rows:")
        print(data.head())
        
        # Check for columns related to RAL, Finish, or Price Groups
        potential_cols = [c for c in data.columns if any(x in str(c).lower() for x in ['ral', 'finition', 'famille', 'prix', 'plus-value', 'couleur'])]
        if potential_cols:
            print(f"\nPotential relevant columns in {sheet_name}: {potential_cols}")
            print(data[potential_cols].drop_duplicates().head(20))

except Exception as e:
    print(f"Error analyzing file: {e}")
