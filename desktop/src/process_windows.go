//go:build windows

package main

import (
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"

	"golang.org/x/sys/windows"
)

func hideConsole(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{
		HideWindow:    true,
		CreationFlags: windows.CREATE_NO_WINDOW,
	}
}

func configureProcGroup(cmd *exec.Cmd) {
	hideConsole(cmd)
	cmd.Stdout = io.Discard
	cmd.Stderr = io.Discard
}

func killProcessTree(cmd *exec.Cmd) {
	if cmd == nil || cmd.Process == nil {
		return
	}
	killPid(cmd.Process.Pid)
}

func killPid(pid int) {
	if pid <= 0 {
		return
	}
	kill := exec.Command("taskkill", "/F", "/T", "/PID", strconv.Itoa(pid))
	hideConsole(kill)
	_ = kill.Run()
}

func stopPortableHolders(root string) {
	root = filepath.Clean(strings.TrimSpace(root))
	if root == "" {
		return
	}
	ps := filepath.Join(os.Getenv("SystemRoot"), `System32`, `WindowsPowerShell`, `v1.0`, `powershell.exe`)
	if os.Getenv("SystemRoot") == "" {
		ps = `C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`
	}
	script := `
param($Root, $SelfPid)
$ErrorActionPreference = 'SilentlyContinue'
$want = $Root
try { $want = [IO.Path]::GetFullPath($Root) } catch {}
Get-CimInstance Win32_Process | Where-Object {
    $_.ProcessId -ne [int]$SelfPid -and (
        ($_.CommandLine -like ('*' + $want + '*launch.py*')) -or
        ($_.ExecutablePath -like ($want + '*'))
    )
} | ForEach-Object {
    try { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue } catch {}
}
Start-Sleep -Milliseconds 400
`
	cmd := exec.Command(ps, "-NoProfile", "-Command", script, "-Root", root, "-SelfPid", strconv.Itoa(os.Getpid()))
	hideConsole(cmd)
	_ = cmd.Run()
}

func killWindowsImageAt(exe string) {
	exe = strings.TrimSpace(exe)
	if exe == "" {
		return
	}
	ps := filepath.Join(os.Getenv("SystemRoot"), `System32`, `WindowsPowerShell`, `v1.0`, `powershell.exe`)
	if os.Getenv("SystemRoot") == "" {
		ps = `C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`
	}
	script := `
param($Path)
$want = ''
try { $want = [IO.Path]::GetFullPath($Path) } catch { $want = $Path }
Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue | ForEach-Object {
    if (-not $_.ExecutablePath) { return }
    try {
        if ([IO.Path]::GetFullPath($_.ExecutablePath) -eq $want) {
            Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
        }
    } catch {}
}
`
	cmd := exec.Command(ps, "-NoProfile", "-Command", script, "-Path", exe)
	hideConsole(cmd)
	_ = cmd.Run()
}
