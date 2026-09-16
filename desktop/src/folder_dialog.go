package main

import (
	"encoding/base64"
	"fmt"
	"log"
	"os/exec"
	"runtime"
	"strings"
	"unicode/utf16"
	"unicode/utf8"
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
// Windows). Interpreting those bytes as UTF-8 garbles Chinese folder names.
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

func decodeFolderPickerOutput(out []byte) (string, error) {
	raw := strings.TrimSpace(normalizePickerBytes(out))
	if raw == "" {
		return "", nil
	}
	if i := strings.LastIndex(raw, "\n"); i >= 0 {
		if last := strings.TrimSpace(raw[i+1:]); last != "" {
			raw = last
		}
	}
	if decoded, err := base64.StdEncoding.DecodeString(raw); err == nil && len(decoded) > 0 && utf8.Valid(decoded) {
		return string(decoded), nil
	}
	return repairUTF8Mojibake(raw), nil
}

func normalizePickerBytes(out []byte) string {
	if len(out) >= 2 && out[0] == 0xFF && out[1] == 0xFE {
		return utf16LEToString(out[2:])
	}
	if looksLikeUTF16LE(out) {
		return utf16LEToString(out)
	}
	return string(out)
}

func looksLikeUTF16LE(b []byte) bool {
	if len(b) < 4 || len(b)%2 != 0 {
		return false
	}
	zeros := 0
	pairs := 0
	for i := 1; i < len(b); i += 2 {
		pairs++
		if b[i] == 0 {
			zeros++
		}
	}
	return pairs > 0 && zeros*2 >= pairs
}

func utf16LEToString(b []byte) string {
	if len(b)%2 == 1 {
		b = b[:len(b)-1]
	}
	u := make([]uint16, 0, len(b)/2)
	for i := 0; i+1 < len(b); i += 2 {
		u = append(u, uint16(b[i])|uint16(b[i+1])<<8)
	}
	return string(utf16.Decode(u))
}

func repairUTF8Mojibake(text string) string {
	raw := make([]byte, 0, len(text))
	for _, r := range text {
		if mapped, ok := cp1252Byte(r); ok {
			raw = append(raw, mapped)
			continue
		}
		return text
	}
	if !utf8.Valid(raw) {
		return text
	}
	repaired := string(raw)
	if repaired != text {
		return repaired
	}
	return text
}

func cp1252Byte(r rune) (byte, bool) {
	if r <= 0xFF {
		return byte(r), true
	}
	switch r {
	case 0x20AC:
		return 0x80, true
	case 0x201A:
		return 0x82, true
	case 0x0192:
		return 0x83, true
	case 0x201E:
		return 0x84, true
	case 0x2026:
		return 0x85, true
	case 0x2020:
		return 0x86, true
	case 0x2021:
		return 0x87, true
	case 0x02C6:
		return 0x88, true
	case 0x2030:
		return 0x89, true
	case 0x0160:
		return 0x8A, true
	case 0x2039:
		return 0x8B, true
	case 0x0152:
		return 0x8C, true
	case 0x017D:
		return 0x8E, true
	case 0x2018:
		return 0x91, true
	case 0x2019:
		return 0x92, true
	case 0x201C:
		return 0x93, true
	case 0x201D:
		return 0x94, true
	case 0x2022:
		return 0x95, true
	case 0x2013:
		return 0x96, true
	case 0x2014:
		return 0x97, true
	case 0x02DC:
		return 0x98, true
	case 0x2122:
		return 0x99, true
	case 0x0161:
		return 0x9A, true
	case 0x203A:
		return 0x9B, true
	case 0x0153:
		return 0x9C, true
	case 0x017E:
		return 0x9E, true
	case 0x0178:
		return 0x9F, true
	default:
		return 0, false
	}
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
