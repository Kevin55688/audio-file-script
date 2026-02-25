@echo off
chcp 65001 >nul
start "Audio Subtitle Player" powershell -ExecutionPolicy Bypass -File "%~dp0scripts\start_all.ps1"
