import re
with open('src/state.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Lines 334 to 368 are dangling code from a bad string replacement.
# Let's cleanly remove them.
# The dangling code starts right after: if (v === 'needs') window.renderNeeds(); };
pattern = re.compile(r"(if\s*\(v\s*===\s*'needs'\)\s*window\.renderNeeds\(\);\s*\};\s*)(?:row\.classList.*?)(?=window\.updateNeedV\s*=)", re.DOTALL)

def repl(match):
    return match.group(1)

new_content = pattern.sub(repl, content)

with open('src/state.js', 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Orphan code removed from state.js")
