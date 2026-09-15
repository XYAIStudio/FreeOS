package main

import (
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"testing"
)

func TestDesktopLogPathLivesUnderProductHome(t *testing.T) {
	home := t.TempDir()
	t.Setenv("FREEOS_HOME", home)
	t.Setenv("OCTOP_HOME", "")
	if got := desktopLogPath(); got != filepath.Join(home, "logs", "desktop.log") {
		t.Fatalf("desktopLogPath() = %q", got)
	}
	if got := processLogPath("host"); got != filepath.Join(home, "logs", "host.log") {
		t.Fatalf("processLogPath() = %q", got)
	}
}

func TestInitDesktopLogWritesFile(t *testing.T) {
	home := t.TempDir()
	t.Setenv("FREEOS_HOME", home)
	t.Setenv("OCTOP_HOME", "")
	initDesktopLog()
	data, err := os.ReadFile(desktopLogPath())
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(data), "desktop log") {
		t.Fatalf("log: %s", data)
	}
}

func TestFormatFatalStartupMentionsLogPath(t *testing.T) {
	home := t.TempDir()
	t.Setenv("FREEOS_HOME", home)
	t.Setenv("OCTOP_HOME", "")
	msg := formatFatalStartup(LocaleEN, os.ErrNotExist)
	if !strings.Contains(msg, desktopLogPath()) {
		t.Fatalf("fatal text missing log path: %s", msg)
	}
}

func TestPidAliveCurrentProcess(t *testing.T) {
	if !pidAlive(os.Getpid()) {
		t.Fatal("current pid should be alive")
	}
	if pidAlive(1 << 30) {
		t.Fatal("bogus pid should not look alive")
	}
}

func TestClaimDesktopInstanceDetectsLiveLock(t *testing.T) {
	home := t.TempDir()
	t.Setenv("FREEOS_HOME", home)
	t.Setenv("OCTOP_HOME", "")
	if claimDesktopInstance() {
		t.Fatal("first claim should succeed")
	}
	parent := os.Getppid()
	if parent <= 0 || !pidAlive(parent) {
		t.Skip("no live parent pid to pretend is another instance")
	}
	if err := os.WriteFile(desktopLockPath(), []byte(strconv.Itoa(parent)), 0o644); err != nil {
		t.Fatal(err)
	}
	blocked := claimDesktopInstance()
	if runtime.GOOS == "windows" {
		if blocked {
			t.Fatal("live pid that is not FreeOS.exe must not block Windows launch")
		}
	} else if !blocked {
		t.Fatal("lock held by another live pid should be detected")
	}
	clearDesktopPid()
	if claimDesktopInstance() {
		t.Fatal("claim after clear should succeed")
	}
}
