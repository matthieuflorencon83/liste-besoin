import json
import os
import glob
import mysql.connector

# ==========================================
# Configuration MySQL
# ==========================================
DB_CONFIG = {
    'host': '127.0.0.1',
    'port': 3307,
    'user': 'root',
    'password': 'rootpassword',
    'database': 'liste_besoin_db'
}

def connect_to_db():
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        return conn
    except mysql.connector.Error as err:
        print(f"Erreur de connexion MySQL: {err}")
        return None

def main():
    conn = connect_to_db()
    if not conn:
        return
    cursor = conn.cursor(buffered=True)

    json_files = glob.glob('data_*.json')
    if not json_files:
        print("Aucun fichier data_*.json trouvé.")
        return

    articles_inserted = 0
    prix_inserted = 0

    print("Début de l'importation...")

    for file_path in json_files:
        print(f"-> Traitement de {file_path}")
        with open(file_path, 'r', encoding='utf-8') as f:
            try:
                data = json.load(f)
            except json.JSONDecodeError:
                print(f"Erreur de lecture du JSON {file_path}")
                continue

        for item in data:
            reference = item.get('reference')
            if not reference:
                reference = item.get('designation')
                if not reference:
                    continue # Ignore si ni reference ni designation

            designation = item.get('designation') or "N/A"
            famille = item.get('famille')
            sous_famille = item.get('sous-famille')
            type_article = item.get('type')
            gamme = item.get('gamme')
            serie = item.get('serie')
            fabricant = item.get('fabricant')
            fournisseur = item.get('fournisseur')
            
            poids_kg = item.get('poids_kg') or item.get('poids__kg_unit_')
            surface_m2 = item.get('surface__m__m_')
            dimension = item.get('dimension')
            epaisseur = item.get('epaisseur')
            
            unite_vente = item.get('unit_vente')
            unite_qte = item.get('unite_qte')
            unite_condit = item.get('unit_condit')
            multiple_cde = item.get('multiple_cde') or 1.0
            tenu_en_stock = item.get('tenu_en_stock') or 'Non'
            
            image_url = item.get('image')
            mots_cles = item.get('cles')

            # 1. Insert Article
            try:
                sql_article = """
                    INSERT IGNORE INTO article (
                        reference, designation, famille, sous_famille, type_article,
                        gamme, serie, fabricant, fournisseur_defaut,
                        poids_kg, surface_m2, dimension, epaisseur,
                        unite_vente, unite_qte, unite_condit, multiple_cde,
                        tenu_en_stock, image_url, mots_cles
                    ) VALUES (
                        %s, %s, %s, %s, %s,
                        %s, %s, %s, %s,
                        %s, %s, %s, %s,
                        %s, %s, %s, %s,
                        %s, %s, %s
                    )
                """
                cursor.execute(sql_article, (
                    reference, designation, famille, sous_famille, type_article,
                    gamme, serie, fabricant, fournisseur,
                    poids_kg, surface_m2, dimension, epaisseur,
                    unite_vente, unite_qte, unite_condit, multiple_cde,
                    tenu_en_stock, image_url, mots_cles
                ))
                if cursor.rowcount > 0:
                    articles_inserted += 1

                cursor.execute("SELECT id FROM article WHERE reference = %s", (reference,))
                article_row = cursor.fetchone()
                if not article_row:
                    continue
                article_id = article_row[0]

                # 2. Gestion de la finition
                decor = item.get('decor')
                if not decor:
                    decor = 'Standard'
                
                cursor.execute("INSERT IGNORE INTO finition (nom, type_finition) VALUES (%s, %s)", (decor, 'Couleur/Decor'))
                cursor.execute("SELECT id FROM finition WHERE nom = %s", (decor,))
                finition_row = cursor.fetchone()
                finition_id = finition_row[0]

                # 3. Insert Prix
                prix_u_ht = item.get('prix_u_ht')
                ancien_prix = item.get('ancien_prix_u_ht')
                prix_public = item.get('prix_public') or item.get('px_public')
                px_remise = item.get('px_remise')
                conditionnement = item.get('conditionnement') or item.get('condit')

                sql_prix = """
                    INSERT IGNORE INTO prix (
                        article_id, finition_id, fournisseur_nom,
                        prix_u_ht, ancien_prix_u_ht, prix_public, px_remise,
                        conditionnement
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """
                cursor.execute(sql_prix, (
                    article_id, finition_id, fournisseur,
                    prix_u_ht, ancien_prix, prix_public, px_remise,
                    conditionnement
                ))
                if cursor.rowcount > 0:
                    prix_inserted += 1

            except Exception as e:
                print(f"Erreur sur l'article {reference}: {e}")

    conn.commit()
    cursor.close()
    conn.close()
    print(f"\nImportation terminee : {articles_inserted} articles crees, {prix_inserted} prix inseres.")
if __name__ == "__main__":
    main()
