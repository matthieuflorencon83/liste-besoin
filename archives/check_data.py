import json
import os

# Load data.js
with open('data.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Strip "window.ART_DATA =" and trailing semicolon
json_str = content.replace('window.ART_DATA = ', '').strip().rstrip(';')

try:
    data = json.loads(json_str)
    
    targets = ['7626', '7626/4', '7628', '7628/4', '7637', '7637TH']
    
    found_items = [item for item in data if str(item.get('reference')) in targets]
    
    print(f"Found {len(found_items)} items matching targets: {targets}")
    for item in found_items:
        print(f"Ref: {item.get('reference')}")
        print(f"Des: {item.get('designation')}")
        print(f"Decor: {item.get('decor')}")
        print(f"Px Public: {item.get('px_public')}")
        print("-" * 20)
        
except json.JSONDecodeError as e:
    print(f"JSON Error: {e}")
    # Print a snippet around the error if possible
