@echo off
echo ==============================================
echo       Lancement de Arts Alu Zen...
echo ==============================================
echo.
echo Fermeture de l'ancien serveur si existant...
FOR /F "tokens=5" %%a IN ('netstat -a -n -o ^| findstr :8000') DO taskkill /PID %%a /F >nul 2>&1
timeout /t 1 /nobreak >nul

echo.
echo Demarrage du serveur HTTP (port 8000)...
start "" "http://localhost:8000"
echo Le navigateur va s'ouvrir. Gardez cette fenetre ouverte.
python server.py
pause
