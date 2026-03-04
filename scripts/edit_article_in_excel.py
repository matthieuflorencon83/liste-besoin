import pandas as pd
import sys
import json
import os

def edit_in_excel(json_path):
    try:
        # 1. Load Data
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        excel_path = os.path.join(base_dir, "BDD Arts Alu 2026 - Complétée.xlsx")
        
        # Fallback to the other file if needed
        if not os.path.exists(excel_path):
            excel_path = os.path.join(base_dir, "BDD Arts Alu 2026.xlsx")

        print(f"Opening Excel for edit: {excel_path}")
        
        if not os.path.exists(excel_path):
            print(f"Error: Excel file {excel_path} not found.")
            sys.exit(1)

        # 2. Read existing
        df = pd.read_excel(excel_path, engine='openpyxl')

        # 3. Find the row
        old_ref = str(data.get('old_reference', '')).strip()
        old_four = str(data.get('old_fournisseur', '')).strip()

        # Convert columns to string for comparison and find matching index
        mask = (df['REFERENCE'].astype(str).str.strip() == old_ref) & \
               (df['FOURNISSEUR'].astype(str).str.strip() == old_four)
        
        indices = df.index[mask].tolist()

        if not indices:
            print(f"Article not found in Excel: {old_ref} ({old_four})")
        else:
            # Update the first matching row
            idx = indices[0]
            print(f"Found article at index {idx}. Updating...")
            
            # 4. Update fields if provided
            if data.get('reference'): df.at[idx, 'REFERENCE'] = data.get('reference')
            if data.get('designation'): df.at[idx, 'DESIGNATION'] = data.get('designation')
            if data.get('fournisseur'): df.at[idx, 'FOURNISSEUR'] = data.get('fournisseur')
            if data.get('famille'): df.at[idx, 'FAMILLE'] = data.get('famille')
            if data.get('type'): df.at[idx, 'TYPE'] = data.get('type')
            if data.get('finition'): df.at[idx, 'DECOR'] = data.get('finition')
            
            if data.get('prix') is not None and data.get('prix') != '':
                df.at[idx, 'PRIX_PUBLIC'] = float(data.get('prix'))
                
            if 'dimensions' in data: df.at[idx, 'DIMENSION'] = data.get('dimensions')
            if 'epaisseur' in data: df.at[idx, 'EPAISSEUR'] = data.get('epaisseur')

            # 5. Save
            df.to_excel(excel_path, index=False, engine='openpyxl')
            print("Excel updated successfully.")

        # Cleanup Temp File
        if os.path.exists(json_path):
            os.remove(json_path)

    except Exception as e:
        print(f"Error editing Excel: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python edit_article_in_excel.py <json_path>")
        sys.exit(1)
    
    json_path = sys.argv[1]
    edit_in_excel(json_path)
