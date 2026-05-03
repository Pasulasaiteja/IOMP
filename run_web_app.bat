@echo off
echo Starting ZenScreen Backend Server...
cd server
start /b cmd /c "npm start"
echo Server started!
echo Opening ZenScreen Web App in your default browser...
timeout /t 3 > nul
start http://localhost:3001/app.html
echo.
echo Press any key to stop the server and close this window...
pause > nul
taskkill /f /im node.exe
