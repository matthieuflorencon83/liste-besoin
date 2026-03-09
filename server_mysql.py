import http.server
import socketserver
import json
import os
import mysql.connector
import decimal
from datetime import datetime

PORT = 8001
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

DB_CONFIG = {
    'host': '127.0.0.1',
    'port': 3307,
    'user': 'root',
    'password': 'rootpassword',
    'database': 'liste_besoin_db'
}

class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, decimal.Decimal):
            return float(obj)
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super(DecimalEncoder, self).default(obj)

class MySqlHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def do_GET(self):
        if self.path == '/api/articles':
            self.handle_get_articles()
        else:
            # Default to serving static files
            # If requesting index.html, we can rewrite to index_db.html if needed,
            # but usually the user will navigate to http://localhost:8001/index_db.html
            super().do_GET()

    def handle_get_articles(self):
        try:
            conn = mysql.connector.connect(**DB_CONFIG)
            cursor = conn.cursor(dictionary=True, buffered=True)

            query = """
                SELECT 
                    a.reference, a.designation, a.famille, a.sous_famille, a.type_article as type,
                    a.gamme, a.serie, a.fabricant, a.fournisseur_defaut as fournisseur,
                    a.poids_kg as poids__kg_unit_, a.surface_m2 as surface__m__m_, a.dimension, a.epaisseur,
                    a.unite_vente as unit_vente, a.unite_qte, a.unite_condit as unit_condit, 
                    a.multiple_cde, a.tenu_en_stock, a.image_url as image, a.mots_cles as cles,
                    f.nom as decor, 
                    p.prix_u_ht, p.ancien_prix_u_ht, p.prix_public as px_public, p.px_remise,
                    p.conditionnement as condit, p.conditionnement as conditionnement
                FROM article a
                LEFT JOIN prix p ON a.id = p.article_id
                LEFT JOIN finition f ON p.finition_id = f.id
            """
            cursor.execute(query)
            rows = cursor.fetchall()
            
            # Formatter les données pour le frontend
            cleaned_rows = []
            for row in rows:
                cleaned_rows.append({k: (v if v is not None else "") for k, v in row.items()})

            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps(cleaned_rows, cls=DecimalEncoder, ensure_ascii=False).encode('utf-8'))
            
            cursor.close()
            conn.close()
        except Exception as e:
            print(f"Error: {e}")
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))

class ThreadedHTTPServer(socketserver.ThreadingTCPServer):
    daemon_threads = True
    allow_reuse_address = True

if __name__ == "__main__":
    with ThreadedHTTPServer(("", PORT), MySqlHandler) as httpd:
        print(f"Serveur Python MySQL multithread actif sur le port {PORT}")
        print("Vous pouvez utiliser l'application via http://localhost:8001/index_db.html")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nArrêt du serveur MySQL.")
