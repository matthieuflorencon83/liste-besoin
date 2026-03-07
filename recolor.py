from PIL import Image
import os

def recolor_logo(input_path, output_path, target_hex):
    # Convert hex to RGB
    target_hex = target_hex.lstrip('#')
    tr, tg, tb = tuple(int(target_hex[i:i+2], 16) for i in (0, 2, 4))
    
    img = Image.open(input_path).convert("RGBA")
    data = img.getdata()
    
    new_data = []
    for r, g, b, a in data:
        if a == 0:
            new_data.append((r, g, b, a))
            continue
            
        # Detect greenish pastel pixels (green > red and green > blue)
        # Also ensure it's not simply white/grey (by checking saturation roughly)
        if g > r + 10 and g > b + 10:
            # It's a green pixel. We want to replace it with the target color #059669
            # But preserve the relative brightness/alpha to avoid aliasing
            brightness = (r + g + b) / (3.0 * 255.0)
            
            # Simple replacement, we tint it towards the target color, maintaining alpha
            # If the pixel is very pastel (light), we make it exactly the target color
            # but preserve anti-aliasing pixels (alpha).
            
            # Weighted average based on original darkness
            factor = min(1.0, max(0.4, brightness))
            new_r = int(tr * factor)
            new_g = int(tg * factor)
            new_b = int(tb * factor)
            
            new_data.append((new_r, new_g, new_b, a))
        else:
            # Not green, leave as is (grey text)
            # Maybe darken the dark text slightly to make it contrast well
            if r == g and g == b and r < 100:
                new_data.append((30, 41, 59, a)) # #1e293b
            else:
                new_data.append((r, g, b, a))
                
    img.putdata(new_data)
    img.save(output_path, "PNG")

if __name__ == "__main__":
    input_file = r"c:\Antigravity\Matthieu\Liste de besoin\images\logo_arts_alu.png"
    output_file = r"c:\Antigravity\Matthieu\Liste de besoin\images\logo_arts_alu_color.png"
    recolor_logo(input_file, output_file, "#059669")
    print(f"Generated {output_file}")
