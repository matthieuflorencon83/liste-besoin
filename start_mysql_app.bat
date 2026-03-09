@echo off
echo ==============================================
echo       Lancement de Arts Alu Zen (MySQL)...
echo ==============================================
echo.
echo Fermeture de l'ancien serveur MySQL si existant...
FOR /F "tokens=5" %%a IN ('netstat -a -n -o ^| findstr :8001') DO taskkill /PID %%a /F >nul 2>&1
timeout /t 1 /nobreak >nul

echo.
echo Demarrage du serveur MySQL (port 8001)...
start "" "http://localhost:8001/index_db.html"
echo Le navigateur va s'ouvrir sur la version MySQL. Gardez cette fenetre ouverte.
python server_mysql.py
pause
