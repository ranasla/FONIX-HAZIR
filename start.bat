@echo off
echo ========================================
echo    FONIX - Proje Baslatiliyor...
echo ========================================
echo.

:: Backend'i yeni terminalde baslat
start "FONIX Backend" cmd /k "cd /d %~dp0 && python app.py"

:: Frontend'i yeni terminalde baslat
start "FONIX Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo Backend: http://localhost:5000
echo Frontend: http://localhost:3000
echo.
echo Iki terminal acildi. Tarayicinizi acin!
pause
