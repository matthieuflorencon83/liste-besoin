import http.server
import socketserver
import json
import os
import shutil
import subprocess
import sys
import email.parser
import email.policy

PORT = 8000

# Define directories
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
IMAGE_DIR = os.path.join(BASE_DIR, "images")
EXCEL_path = os.path.join(BASE_DIR, "BDD Arts Alu 2026.xlsx")

class MyHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

    def do_POST(self):
        if self.path == '/api/add-article':
            self.handle_add_article()
        elif self.path == '/api/edit-article-db':
            self.handle_edit_article()
        else:
            self.send_error(404, "Endpoint not found")

    def parse_multipart(self):
        content_type = self.headers.get('content-type')
        if not content_type or 'multipart/form-data' not in content_type:
            return {}, {}

        content_length = int(self.headers.get('content-length', 0))
        body = self.rfile.read(content_length)
        
        # Create a complete message bytes including headers and body to parse
        # We need to construct a fake header block for the email parser
        headers_block = f"Content-Type: {content_type}\r\n\r\n".encode('utf-8')
        msg_data = headers_block + body
        
        msg = email.parser.BytesParser(policy=email.policy.default).parsebytes(msg_data)
        
        form_data = {}
        files = {}

        if msg.is_multipart():
            for part in msg.iter_parts():
                name = part.get_param('name', header='content-disposition')
                filename = part.get_param('filename', header='content-disposition')
                payload = part.get_payload(decode=True) # Returns bytes

                if filename:
                    files[name] = {'filename': filename, 'content': payload}
                elif name:
                    # Text field
                    charset = part.get_content_charset('utf-8')
                    form_data[name] = payload.decode(charset)
        
        return form_data, files

    def handle_add_article(self):
        try:
            form_data, files = self.parse_multipart()

            # Extract fields
            ref = form_data.get('reference')
            des = form_data.get('designation')
            four = form_data.get('fournisseur')
            fam = form_data.get('famille')
            sous_famille = form_data.get('sous_famille')
            type_art = form_data.get('type')
            ral = form_data.get('finition') # Match HTML input name
            longueur = form_data.get('longueur')
            unite = form_data.get('unite')
            prix = form_data.get('prix')
            poids = form_data.get('poids')
            dimension = form_data.get('dimensions') # Nouveau
            epaisseur = form_data.get('epaisseur') # Nouveau

            if not ref or not four:
                self.send_response(400)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'error', 'message': 'Référence et Fournisseur requis'}).encode('utf-8'))
                return

            print(f"Adding Article: {ref} - {des}")

            # Handle Image Upload
            image_name = ""
            if 'image' in files:
                file_info = files['image']
                original_filename = file_info['filename']
                file_content = file_info['content']
                
                if original_filename:
                    # Extension check
                    _, ext = os.path.splitext(original_filename)
                    # Create a safe filename: REF_FOURNISSEUR.ext
                    # Sanitize
                    safe_ref = "".join([c for c in ref if c.isalnum() or c in ('-','_')]).upper()
                    safe_four = "".join([c for c in four if c.isalnum() or c in ('-','_')]).upper()
                    
                    new_filename = f"INS {safe_ref}.jpg" # Standardizing to jpg/png? Using original ext is safer for now but logic expects jpg often.
                    if ext.lower() in ['.png', '.jpeg', '.jpg', '.webp']:
                         new_filename = f"INS {safe_ref}{ext.lower()}"
                    
                    save_path = os.path.join(IMAGE_DIR, new_filename)
                    
                    # Ensure directory exists
                    os.makedirs(os.path.dirname(save_path), exist_ok=True)

                    with open(save_path, 'wb') as f:
                        f.write(file_content)
                    
                    image_name = new_filename
                    print(f"Image saved to {save_path}")

            # Create Data Dict
            new_article = {
                "reference": ref,
                "designation": des,
                "fournisseur": four,
                "famille": fam,
                "sous_famille": sous_famille,
                "type": type_art,
                "ral": ral,
                "longueur": longueur,
                "unite": unite,
                "prix": prix,
                "poids": poids,
                "dimension": dimension,
                "epaisseur": epaisseur,
                "image_name": image_name
            }

            # Save json temp file
            import uuid
            temp_id = str(uuid.uuid4())
            temp_json = os.path.join(BASE_DIR, f"temp_new_article_{temp_id}.json")
            with open(temp_json, "w", encoding='utf-8') as f:
                json.dump(new_article, f, indent=4)

            # Call Python Script to Add to Excel in background thread
            import threading
            def process_article(t_json):
                try:
                    print("Calling add_article_to_excel.py...")
                    subprocess.run([sys.executable, os.path.join(BASE_DIR, "scripts", "add_article_to_excel.py"), t_json], check=True)
                except Exception as ex:
                    print(f"Error in add_article_to_excel background task: {ex}")
                finally:
                    # Remove temp file
                    if os.path.exists(t_json):
                        os.remove(t_json)
                    try:
                        # Regenerate data.js
                        print("Regenerating data.js...")
                        subprocess.run([sys.executable, os.path.join(BASE_DIR, "extract_data.py")], check=True)
                    except Exception as ex:
                        print(f"Error regenerating data: {ex}")

            threading.Thread(target=process_article, args=(temp_json,)).start()

            self.send_response(202)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'success', 'message': 'Article ajouté en file d\'attente. La base sera mise à jour dans quelques secondes.'}).encode('utf-8'))

        except Exception as e:
            print(f"Error: {e}")
            import traceback
            traceback.print_exc()
            self.send_response(500)
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'error', 'message': str(e)}).encode('utf-8'))

    def handle_edit_article(self):
        try:
            form_data, files = self.parse_multipart()

            old_ref = form_data.get('old_reference')
            old_four = form_data.get('old_fournisseur')

            if not old_ref or not old_four:
                self.send_response(400)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'error', 'message': 'Ancienne Référence et Fournisseur requis'}).encode('utf-8'))
                return

            print(f"Editing Article: {old_ref} (Fournisseur: {old_four})")

            # Collect form data exactly like add_article
            edit_data = {
                'old_reference': old_ref,
                'old_fournisseur': old_four,
                'reference': form_data.get('reference', ''),
                'designation': form_data.get('designation', ''),
                'fournisseur': form_data.get('fournisseur', ''),
                'famille': form_data.get('famille', ''),
                'type': form_data.get('type', ''),
                'finition': form_data.get('finition', ''),
                'prix': form_data.get('prix', ''),
                'dimensions': form_data.get('dimensions', ''),
                'epaisseur': form_data.get('epaisseur', '')
            }

            import uuid
            temp_id = str(uuid.uuid4())
            temp_json = os.path.join(BASE_DIR, f"temp_edit_article_{temp_id}.json")
            with open(temp_json, "w", encoding='utf-8') as f:
                json.dump(edit_data, f, indent=4)

            # Background process to update Excel and regenerate data
            import threading
            def process_edit(t_json):
                try:
                    print(f"Calling edit_article_in_excel.py for {old_ref}...")
                    subprocess.run([sys.executable, os.path.join(BASE_DIR, "scripts", "edit_article_in_excel.py"), t_json], check=True)
                except Exception as ex:
                    print(f"Error in edit_article_in_excel background task: {ex}")
                finally:
                    if os.path.exists(t_json):
                        os.remove(t_json)
                    try:
                        print("Regenerating data.js...")
                        subprocess.run([sys.executable, os.path.join(BASE_DIR, "extract_data.py")], check=True)
                    except Exception as ex:
                        print(f"Error regenerating data after edit: {ex}")

            threading.Thread(target=process_edit, args=(temp_json,)).start()

            self.send_response(202)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'success', 'message': 'Modification de l\'article en cours...'}).encode('utf-8'))

        except Exception as e:
            print(f"Error during edit: {e}")
            import traceback
            traceback.print_exc()
            self.send_response(500)
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'error', 'message': str(e)}).encode('utf-8'))

# Ensure scripts dir
if not os.path.exists(os.path.join(BASE_DIR, "scripts")):
    os.makedirs(os.path.join(BASE_DIR, "scripts"))

socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("", PORT), MyHandler) as httpd:
    print(f"Serveur Python actif sur le port {PORT}")
    print("Vous pouvez utiliser l'application.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nArrêt du serveur.")
