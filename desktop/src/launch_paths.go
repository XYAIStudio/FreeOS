package main

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"runtime"
	"strings"
)

func pinWorkingDirectory() {
	exe, err := os.Executable()
	if err != nil {
		return
	}
	dir := filepath.Dir(exe)
	if resolved, err := filepath.EvalSymlinks(dir); err == nil {
		dir = resolved
	}
	if err := os.Chdir(dir); err != nil {
		log.Printf("chdir %s: %v", dir, err)
	}
}

func userProfileDir() string {
	if home, err := os.UserHomeDir(); err == nil && strings.TrimSpace(home) != "" {
		return home
	}
	if v := strings.TrimSpace(os.Getenv("USERPROFILE")); v != "" {
		return v
	}
	drive, path := os.Getenv("HOMEDRIVE"), os.Getenv("HOMEPATH")
	if drive != "" && path != "" {
		return drive + path
	}
	return ""
}

func webviewUserDataPath() string {
	if runtime.GOOS != "windows" {
		return ""
	}
	base := strings.TrimSpace(os.Getenv("LOCALAPPDATA"))
	if base == "" {
		if prof := userProfileDir(); prof != "" {
			base = filepath.Join(prof, "AppData", "Local")
		} else {
			return filepath.Join(productHome(), "WebView2")
		}
	}
	return filepath.Join(base, "FreeOS", "WebView2")
}

func ensureProductHomeWritable() error {
	home := productHome()
	if err := os.MkdirAll(home, 0o755); err != nil {
		return err
	}
	probe := filepath.Join(home, ".write-probe")
	if err := os.WriteFile(probe, []byte("ok"), 0o644); err == nil {
		_ = os.Remove(probe)
		return nil
	} else {
		firstErr := err
		repairProductHomeAccess(home)
		if err := os.WriteFile(probe, []byte("ok"), 0o644); err != nil {
			return fmt.Errorf("cannot write to %s: %w", home, firstErr)
		}
		_ = os.Remove(probe)
		return nil
	}
}
