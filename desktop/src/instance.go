package main

import (
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

func desktopLockPath() string {
	return filepath.Join(productHome(), "desktop.pid")
}

func readDesktopPid() int {
	data, err := os.ReadFile(desktopLockPath())
	if err != nil {
		return 0
	}
	pid, err := strconv.Atoi(strings.TrimSpace(string(data)))
	if err != nil || pid <= 0 {
		return 0
	}
	return pid
}

func writeDesktopPid() error {
	if err := os.MkdirAll(productHome(), 0o755); err != nil {
		return err
	}
	return os.WriteFile(desktopLockPath(), []byte(strconv.Itoa(os.Getpid())), 0o644)
}

func clearDesktopPid() {
	_ = os.Remove(desktopLockPath())
}

// claimDesktopInstance returns true when another live desktop process holds the lock.
func claimDesktopInstance() bool {
	pid := readDesktopPid()
	if pid > 0 && pid != os.Getpid() && pidAlive(pid) {
		return true
	}
	if err := writeDesktopPid(); err != nil {
		logStartupError("desktop lock", err)
	}
	return false
}
