import pandas as pd
import os

try:
    df = pd.read_excel('BDD Arts Alu 2026 - Complétée.xlsx')
    print("COLUMNS:", df.columns.tolist())
    print("FIRST ROW:", df.iloc[0].to_dict())
except Exception as e:
    print(e)
