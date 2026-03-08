import os
import json
import pandas as pd

base_dir = os.path.dirname(os.path.abspath(__file__))
json_path = os.path.join(base_dir, "data.json")
excel_path = os.path.join(base_dir, "BDD Arts Alu 2026 - Complétée.xlsx")

def cleanup():
    # 1. Clean JSON
    print("Cleaning JSON...")
    if os.path.exists(json_path):
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        original_count = len(data)
        data = [item for item in data if not str(item.get("reference", "")).startswith("TEST-")]
        
        if len(data) < original_count:
            with open(json_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            print(f"Removed {original_count - len(data)} items from JSON.")
        else:
            print("No test items found in JSON.")

    # 2. Clean Excel
    print("Cleaning Excel...")
    if os.path.exists(excel_path):
        try:
            df = pd.read_excel(excel_path, engine='openpyxl')
            original_len = len(df)
            # Remove rows where Référence starts with TEST-
            # Handle NaN values
            mask = df['Référence'].astype(str).str.startswith('TEST-', na=False)
            df = df[~mask]
            
            if len(df) < original_len:
                df.to_excel(excel_path, index=False, engine='openpyxl')
                print(f"Removed {original_len - len(df)} test rows from Excel.")
            else:
                print("No test items found in Excel.")
        except Exception as e:
            print(f"Error accessing Excel: {e}")

if __name__ == "__main__":
    cleanup()
