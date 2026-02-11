import pandas as pd
base_file = r'C:/Antigravity/Matthieu/Liste de besoin/BDD Arts Alu 2026.xlsx'
supplier_file = r'C:/Users/utopi/Desktop/Logiciel Arts alu/Articles-fournisseur.xlsm'

df_base = pd.read_excel(base_file)
df_sup = pd.read_excel(supplier_file)

print(f"Base records: {len(df_base)}")
print(f"Supplier records: {len(df_sup)}")

# Let's check how many MEPLAT in base and sup
print(f"MEPLAT in base: {len(df_base[df_base.apply(lambda r: 'MEPLAT' in str(r), axis=1)])}")
print(f"MEPLAT in supplier: {len(df_sup[df_sup.apply(lambda r: 'MEPLAT' in str(r), axis=1)])}")

# Check Ref_Clean overlap
df_base['Ref_Clean'] = df_base.iloc[:, 1].astype(str).str.strip().str.lower() # Column 1 is usually Ref
df_sup['Ref_Clean'] = df_sup['Ref'].astype(str).str.strip().str.lower()

missing = df_sup[~df_sup['Ref_Clean'].isin(df_base['Ref_Clean'])]
print(f"Missing articles identified: {len(missing)}")
print("Sample missing articles:")
print(missing[['Ref', 'Dsignation']].head(10))
