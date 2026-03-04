import pandas as pd
import sys
import json
import os
import openpyxl

def add_to_excel(json_path):
    try:
        # 1. Load Data
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        excel_path = os.path.join(base_dir, "BDD Arts Alu 2026 - Complétée.xlsx")

        print(f"Opening Excel: {excel_path}")
        
        # 2. Check if file exists, if not create basic structure (unlikely but safe)
        if not os.path.exists(excel_path):
            df = pd.DataFrame(columns=['REFERENCE', 'DESIGNATION', 'FOURNISSEUR', 'FAMILLE', 'SOUS-FAMILLE', 'TYPE', 'DECOR', 'CONDITIONNEMENT', 'UNIT_CONDIT', 'PRIX_PUBLIC', 'POIDS_KG', 'DIMENSION', 'EPAISSEUR'])
        else:
            # Read existing
            df = pd.read_excel(excel_path, engine='openpyxl')

        # 3. Create new row
        new_row = {
            'REFERENCE': data.get('reference', ''),
            'DESIGNATION': data.get('designation', ''),
            'FOURNISSEUR': data.get('fournisseur', ''),
            'FAMILLE': data.get('famille', ''),
            'SOUS-FAMILLE': data.get('sous_famille', ''),
            'TYPE': data.get('type', ''),
            'DECOR': data.get('ral', ''), # We map RAL form field to DECOR column
            'CONDITIONNEMENT': data.get('longueur', ''),
            'UNIT_CONDIT': data.get('unite', ''),
            'PRIX_PUBLIC': float(data.get('prix') or 0),
            'POIDS_KG': float(data.get('poids') or 0),
            'DIMENSION': data.get('dimension', ''),
            'EPAISSEUR': data.get('epaisseur', '')
        }

        # 4. Append
        df = pd.concat([df, pd.DataFrame([new_row])], ignore_index=True)

        # 5. Save
        df.to_excel(excel_path, index=False, engine='openpyxl')
        print("Excel updated successfully.")

        # Cleanup
        if os.path.exists(json_path):
            os.remove(json_path)

    except Exception as e:
        print(f"Error updating Excel: {e}")
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python add_to_excel.py <json_path>")
        sys.exit(1)
    
    add_to_excel(sys.argv[1])
