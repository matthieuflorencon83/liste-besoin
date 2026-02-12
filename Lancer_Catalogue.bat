@echo off
:: Vérification de Chrome
where chrome >nul 2>&1
if %errorlevel% equ 0 (
    start chrome --app="file:///c:/Antigravity/Matthieu/Liste de besoin/index.html" --start-maximized
) else (
    echo Chrome non trouve dans le PATH, tentative avec le chemin par defaut...
    if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
        start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --app="file:///c:/Antigravity/Matthieu/Liste de besoin/index.html" --start-maximized
    ) else if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
        start "" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" --app="file:///c:/Antigravity/Matthieu/Liste de besoin/index.html" --start-maximized
    ) else (
        echo Chrome introuvable. Ouverture avec le navigateur par defaut...
        start "" "c:\Antigravity\Matthieu\Liste de besoin\index.html"
    )
)
exit
