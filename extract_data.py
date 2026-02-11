import pandas as pd
import json
import os
import re
from datetime import datetime
import os

def handler(obj):
    if isinstance(obj, (datetime, pd.Timestamp)):
        return obj.isoformat()
    return None

def clean_column_name(col):
    col = str(col)
    replacements = {
        '\ufffd': 'e',
        'é': 'e',
        'è': 'e',
        'ê': 'e',
        'à': 'a',
        'ç': 'c',
        'î': 'i',
        'ï': 'i',
        'ô': 'o',
        'û': 'u',
        ' ': '_',
        '(': '',
        ')': '',
        '/': '_',
        '°': 'deg'
    }
    for old, new in replacements.items():
        col = col.replace(old, new)
    return col.lower()

import os
import pandas as pd
import json
import re
import shutil

def get_image_map(base_dirs, local_copy_dir):
    image_map = {}
    if not os.path.exists(local_copy_dir):
        os.makedirs(local_copy_dir)
        
    for base_dir in base_dirs:
        if not os.path.exists(base_dir):
            continue
        is_external = "Desktop" in base_dir or "Logiciel Arts alu" in base_dir
        
        for root, dirs, files in os.walk(base_dir):
            for file in files:
                if file.lower().endswith(('.png', '.jpg', '.jpeg')):
                    name = os.path.splitext(file)[0]
                    clean_name = name.replace("INS ", "").strip()
                    base_ref = re.split(r'[\s\-_\/]', clean_name)[0].lower()
                    
                    if is_external:
                        # Copy to local img_arcellor to be browser-accessible
                        dest_path = os.path.join(local_copy_dir, file)
                        if not os.path.exists(dest_path):
                            shutil.copy2(os.path.join(root, file), dest_path)
                        rel_path = "img_arcellor/" + file
                    else:
                        # Case for Installux which is already inside the web folder
                        try:
                            rel_path = os.path.relpath(os.path.join(root, file), r'c:\Antigravity\Matthieu\Liste de besoin')
                        except:
                            rel_path = os.path.join(root, file)
                    
                    if base_ref not in image_map:
                        image_map[base_ref] = rel_path.replace('\\', '/')
    return image_map

def find_best_image(ref, img_map):
    if not ref: return None
    ref_str = str(ref).lower().strip()
    
    # 1. Direct match
    if ref_str in img_map: return img_map[ref_str]
    
    # 2. Try cleaning ref (ignore /X and special chars at end)
    # Example: 7760/4th -> 7760
    clean_ref = re.sub(r'[\/\.].*', '', ref_str)
    if clean_ref in img_map: return img_map[clean_ref]
    
    # 3. Try alphanumeric only part from beginning
    # Example: 7760th -> 7760
    base = re.match(r'^([a-z0-9]+)', ref_str)
    if base:
        base_val = base.group(1)
        if base_val in img_map: return img_map[base_val]
    
    # 4. Normalisation complète (on garde juste les lettres et chiffres)
    # 7760/4th -> 77604th
    norm_ref = re.sub(r'[^a-z0-9]', '', ref_str)
    if norm_ref in img_map: return img_map[norm_ref]
    
    # 5. Recherche par préfixe (si ref assez longue)
    # 7760/4th -> clean_ref = 7760. Cherche si une clé commence par 7760 (ex: 7760th)
    if len(clean_ref) >= 4:
        # Trier les clés pour avoir les plus courtes en premier pour éviter les faux positifs? 
        # Ou chercher le match le plus proche.
        for k in img_map:
            if k.startswith(clean_ref):
                return img_map[k]
            
    # 6. Try even broader: first digit sequence if > 3 digits
    digits = re.search(r'(\d{4,})', ref_str)
    if digits:
        digit_val = digits.group(1)
        if digit_val in img_map: return img_map[digit_val]

    return None

# Config
BASE_DIR = r'c:\Antigravity\Matthieu\Liste de besoin'
EXCEL_FILE = 'BDD Arts Alu 2026 - Complétée.xlsx'
IMAGE_DIRS = [
    os.path.join(BASE_DIR, 'Installux'),
    r'C:\Users\utopi\Desktop\Logiciel Arts alu\img arcelor'
]
LOCAL_COPY_DIR = os.path.join(BASE_DIR, 'img_arcellor')
OUTPUT_PATH = os.path.join(BASE_DIR, 'data.js')

excel_path = os.path.join(BASE_DIR, EXCEL_FILE)
image_dirs = IMAGE_DIRS
local_copy_dir = LOCAL_COPY_DIR
output_path = OUTPUT_PATH

img_map = get_image_map(image_dirs, local_copy_dir)

try:
    df = pd.read_excel(excel_path)
    df.columns = [clean_column_name(c) for c in df.columns]
    
    # Fill NaN with None for valid JSON (null)
    df = df.replace({float('nan'): None})
    df = df.where(pd.notnull(df), None)
    
    # Robust NaN handling for all types
    print("DataFrame columns:", df.columns.tolist())
    data = df.to_dict(orient='records')
    cleaned_data = []
    for row in data:
        cleaned_row = {k: (v if pd.notnull(v) else None) for k, v in row.items()}
        # ADD IMAGE MAPPING
        cleaned_row['image'] = find_best_image(cleaned_row.get('reference'), img_map)
        cleaned_data.append(cleaned_row)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write("window.ART_DATA = ")
        json.dump(cleaned_data, f, default=handler, ensure_ascii=False, indent=2)
        f.write(";")
    
    print(f"Success: {len(cleaned_data)} records exported to {output_path} with image mapping.")
except Exception as e:
    import traceback
    print(f"Error: {str(e)}")
    traceback.print_exc()
