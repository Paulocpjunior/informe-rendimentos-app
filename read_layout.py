import pandas as pd
import json
import sys

file_path = "/Users/paulocesarpereirajunior/Desktop/INFORMES_2026/informe-rendimentos-app/CAIXA 1- Janeiro de 2026 0588.xlsx"
try:
    # Read first 15 rows to get a good structural overview
    df = pd.read_excel(file_path, header=None, nrows=15)
    print(df.to_json(orient="values"))
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
