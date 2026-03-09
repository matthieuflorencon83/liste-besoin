Set oWS = WScript.CreateObject("WScript.Shell")
sLinkFile = oWS.SpecialFolders("Desktop") & "\liste besoin arts alu myql.lnk"
Set oLink = oWS.CreateShortcut(sLinkFile)

' Path to batch file
currentDir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
oLink.TargetPath = currentDir & "\start_mysql_app.bat"
oLink.WorkingDirectory = currentDir
oLink.WindowStyle = 1 ' Normal window
oLink.Description = "Lancer Arts Alu Zen (Outil MySQL)"
oLink.IconLocation = currentDir & "\icon.ico"
oLink.Save

WScript.Echo "Raccourci cree sur le bureau !"
