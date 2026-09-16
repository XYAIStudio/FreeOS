package main

import (
	"fmt"
	"log"
	"os/exec"
	"runtime"
	"strings"
)

func (a *App) emitPickedFolder() {
	path, err := pickFolderNative()
	if err != nil {
		log.Printf("select folder: %v", err)
		path = ""
	}
	if a.window == nil {
		return
	}
	js := fmt.Sprintf(
		`window.dispatchEvent(new CustomEvent('freeos-folder-selected',{detail:%s}))`,
		jsonString(path),
	)
	a.window.ExecJS(js)
}

// SelectFolder opens a native OS folder picker (any drive on Windows).
func (a *App) SelectFolder() (string, error) {
	return pickFolderNative()
}

func pickFolderNative() (string, error) {
	switch runtime.GOOS {
	case "windows":
		return pickFolderWindows()
	case "darwin":
		return pickFolderDarwin()
	default:
		return pickFolderLinux()
	}
}

func pickFolderWindows() (string, error) {
	// FolderBrowserDialog with MyComputer so every drive letter is reachable.
	script := strings.Join(
		[]string{
			"Add-Type -AssemblyName System.Windows.Forms",
			"[void][System.Windows.Forms.Application]::EnableVisualStyles()",
			"$d = New-Object System.Windows.Forms.FolderBrowserDialog",
			"$d.Description = 'Select a work folder'",
			"$d.RootFolder = [System.Environment+SpecialFolder]::MyComputer",
			"$d.ShowNewFolderButton = $true",
			"if ($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { $d.SelectedPath }",
		},
		"; ",
	)
	cmd := exec.Command(
		"powershell.exe",
		"-NoProfile",
		"-STA",
		"-ExecutionPolicy", "Bypass",
		"-Command",
		script,
	)
	hideConsole(cmd)
	out, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("folder dialog: %w", err)
	}
	path := strings.TrimSpace(string(out))
	if path == "" {
		return "", nil
	}
	return path, nil
}

func pickFolderDarwin() (string, error) {
	cmd := exec.Command(
		"osascript",
		"-e",
		`POSIX path of (choose folder with prompt "Select a work folder")`,
	)
	out, err := cmd.Output()
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok && exitErr.ExitCode() == 1 {
			return "", nil
		}
		return "", fmt.Errorf("folder dialog: %w", err)
	}
	return strings.TrimSpace(string(out)), nil
}

func pickFolderLinux() (string, error) {
	for _, argv := range [][]string{
		{"zenity", "--file-selection", "--directory", "--title=Select a work folder"},
		{"kdialog", "--getexistingdirectory", ".", "Select a work folder"},
	} {
		if _, err := exec.LookPath(argv[0]); err != nil {
			continue
		}
		cmd := exec.Command(argv[0], argv[1:]...)
		out, err := cmd.Output()
		if err != nil {
			if exitErr, ok := err.(*exec.ExitError); ok && exitErr.ExitCode() == 1 {
				return "", nil
			}
			log.Printf("folder dialog %s: %v", argv[0], err)
			continue
		}
		return strings.TrimSpace(string(out)), nil
	}
	return "", fmt.Errorf("no folder dialog (install zenity or kdialog)")
}
