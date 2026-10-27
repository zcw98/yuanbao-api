@echo off
cd /d "%~dp0"
set "HTTP_PROXY="
set "HTTPS_PROXY="
set "NO_PROXY=localhost,127.0.0.1"
node server.js
