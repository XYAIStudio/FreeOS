package main

import (
	"encoding/base64"
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

// folderPickerWindowsScript prints the selected path as UTF-8 base64.
// PowerShell's default stdout is the OEM/ACP code page (GBK on zh-CN
// Windows). Interpreting those bytes as UTF-8 garbles Chinese folder names
// the same way a KB mount path used to mojibake.
func folderPickerWindowsScript() string {
	return strings.Join(
		[]string{
			"Add-Type -AssemblyName System.Windows.Forms",
			"[void][System.Windows.Forms.Application]::EnableVisualStyles()",
			"$d = New-Object System.Windows.Forms.FolderBrowserDialog",
			"$d.Description = 'Select a work folder'",
			"$d.RootFolder = [System.Environment+SpecialFolder]::MyComputer",
			"$d.ShowNewFolderButton = $true",
			"if ($d.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) { exit 0 }",
			"$bytes = [System.Text.Encoding]::UTF8.GetBytes($d.SelectedPath)",
			"[Convert]::ToBase64String($bytes)",
		},
		"; ",
	)
}

func decodeFolderPickerOutput(raw []byte) (string, error) {
	token := strings.TrimSpace(string(raw))
	if token == "" {
		return "", nil
	}
	decoded, err := base64.StdEncoding.DecodeString(token)
	if err != nil {
		return "", fmt.Errorf("folder dialog encoding: %w", err)
	}
	return strings.TrimSpace(string(decoded)), nil
}

func pickFolderWindows() (string, error) {
	cmd := exec.Command(
		"powershell.exe",
		"-NoProfile",
		"-STA",
		"-ExecutionPolicy", "Bypass",
		"-Command",
		folderPickerWindowsScript(),
	)
	hideConsole(cmd)
	out, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("folder dialog: %w", err)
	}
	return decodeFolderPickerOutput(out)
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
