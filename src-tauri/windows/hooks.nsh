; The NSIS installer's half of the `mallow` command on Windows (TASK-62): put
; $INSTDIR\bin, which holds mallow.cmd and nothing else, on the user's PATH.
; The install directory itself is not added, since uninstall.exe sits there.
;
; An update reruns the install, so adding is idempotent, and the uninstaller an
; update runs leaves the entry where it is.

!ifndef HWND_BROADCAST
  !define HWND_BROADCAST 0xffff
!endif
!ifndef WM_SETTINGCHANGE
  !define WM_SETTINGCHANGE 0x001A
!endif

!define MALLOW_POWERSHELL '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File'

!macro NSIS_HOOK_POSTINSTALL
  nsExec::ExecToLog '${MALLOW_POWERSHELL} "$INSTDIR\cli-path.ps1" -Dir "$INSTDIR\bin"'
  Pop $0
  ; Tells Explorer, and so every terminal opened from now on, that PATH changed.
  SendMessage ${HWND_BROADCAST} ${WM_SETTINGCHANGE} 0 "STR:Environment" /TIMEOUT=5000
!macroend

; The entry is removed after the uninstall, never before it: this hook runs
; ahead of the check for a running mallow, and cancelling that check aborts the
; uninstall, which would leave mallow installed without its command. By then
; the resources are deleted, so the script is kept aside in the uninstaller's
; own plugins folder, which lasts as long as the uninstaller runs.
!macro NSIS_HOOK_PREUNINSTALL
  InitPluginsDir
  CopyFiles /SILENT "$INSTDIR\cli-path.ps1" "$PLUGINSDIR\cli-path.ps1"
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  ${If} $UpdateMode <> 1
    nsExec::ExecToLog '${MALLOW_POWERSHELL} "$PLUGINSDIR\cli-path.ps1" -Dir "$INSTDIR\bin" -Remove'
    Pop $0
    SendMessage ${HWND_BROADCAST} ${WM_SETTINGCHANGE} 0 "STR:Environment" /TIMEOUT=5000
  ${EndIf}
!macroend
