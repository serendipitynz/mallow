@echo off
rem The `mallow` command on Windows (TASK-62). The installer puts this folder,
rem which holds nothing else, on PATH; mallow.exe sits one level up.
setlocal
set "MALLOW_EXE=%~dp0..\mallow.exe"
rem --help and --version are run in place so this script waits and their text
rem lands before the prompt returns; everything else is started detached, so the
rem command returns at once whether or not mallow is running.
if /i "%~1"=="--help" goto inline
if /i "%~1"=="-h" goto inline
if /i "%~1"=="--version" goto inline
if /i "%~1"=="-V" goto inline
start "" "%MALLOW_EXE%" %*
exit /b 0
:inline
"%MALLOW_EXE%" %*
exit /b %ERRORLEVEL%
