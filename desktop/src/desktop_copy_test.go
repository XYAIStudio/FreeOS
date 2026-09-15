package main

import (
	"strings"
	"testing"
)

func TestDesktopTextLooksUpLocaleWithEnglishDefault(t *testing.T) {
	if got := desktopText(LocaleZH, copyStatusReady); got != "FreeOS 已就绪" {
		t.Fatalf("zh: %s", got)
	}
	if got := desktopText(LocaleEN, copyStatusReady); got != "FreeOS is ready" {
		t.Fatalf("en: %s", got)
	}
	if got := desktopText(Locale(""), copyStatusReady); got != "FreeOS is ready" {
		t.Fatalf("unknown locale should fall back to English: %s", got)
	}
	if got := desktopText(LocaleZH, "missing.key"); got != "missing.key" {
		t.Fatalf("unknown key: %s", got)
	}
	if got := desktopText(LocaleEN, copyAlreadyRunning); !strings.Contains(got, "already running") {
		t.Fatalf("already running: %s", got)
	}
}

func TestDesktopTextFormatsArgs(t *testing.T) {
	got := desktopText(LocaleEN, copyStatusBackupDatabase, "0.9.32")
	if got != "Desktop update 0.9.32 found. Backing up the database…" {
		t.Fatalf("format: %s", got)
	}
}
