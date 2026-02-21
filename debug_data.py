import json
import re
import os

try:
    with open('data.js', 'r', encoding='utf-8') as f:
        content = f.read().strip()
        if content.startswith('window.ART_DATA ='):
            content = content.replace('window.ART_DATA =', '', 1).rstrip(';')
        
        data = json.loads(content)
        
        print(f"Total items: {len(data)}")
        
        suspects_color = []
        suspects_length = []
        
        # Regex for common RAL or lengths in text
        # RAL: 4 digits (9010, 7016) often preceded by space
        # Length: 4 digits (6000, 6500) or decimal (6.5)
        
        for item in data:
            des = item.get('designation', '') or ''
            ref = item.get('reference', '')
            
            # Check for RAL-like patterns in designation
            # Avoid matching Ref if it's numeric and part of des
            
            # RAL detection (4 digits, start with 1, 7, 8, 9 usually)
            ral_match = re.search(r'\b(9010|9016|7016|1247|3004|3005|5003|6005|6009|1015)\b', des)
            if ral_match:
                suspects_color.append(f"{des} (Ref: {ref}) -> Found {ral_match.group(0)}")
                
            # Length detection (4 digits > 3000, or like 6.5m)
            len_match = re.search(r'\b(\d{4}|[3-7]\.\d)\b', des)
            if len_match:
                # filter out if it matches reference
                if str(ref) not in des:
                    suspects_length.append(f"{des} (Ref: {ref}) -> Found {len_match.group(0)}")

        print("\n--- SUSPECT COLORS IN DESIGNATION ---")
        for s in suspects_color[:20]: print(s)
        if len(suspects_color) > 20: print(f"... and {len(suspects_color)-20} more.")
        
        print("\n--- SUSPECT LENGTHS IN DESIGNATION ---")
        for s in suspects_length[:20]: print(s)
        if len(suspects_length) > 20: print(f"... and {len(suspects_length)-20} more.")

except Exception as e:
    print(f"Error: {e}")
