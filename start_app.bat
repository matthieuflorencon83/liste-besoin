@echo off
echo ==============================================
echo       Lancement de Arts Alu Zen...
echo ==============================================
echo.
echo Fermeture de l'ancien serveur si existant...
powershell -Command "Get-CimInstance Win32_Process | Where-Object {$_.CommandLine -like '*python*server.py*'} | ForEach-Object { Invoke-CimMethod -InputObject $_ -MethodName Terminate }"
timeout /t 1 /nobreak >nul

echo.
echo Demarrage du serveur HTTP (port 8000)...
start "" "http://localhost:8000"
echo Le navigateur va s'ouvrir. Gardez cette fenetre ouverte.
python server.py
pause
