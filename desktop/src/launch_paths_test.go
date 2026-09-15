package main

import (
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

func TestProductHomeIsAlwaysAbsolute(t *testing.T) {
	t.Setenv("FREEOS_HOME", "")
	t.Setenv("OCTOP_HOME", "")
	got := productHome()
	if !filepath.IsAbs(got) {
		t.Fatalf("productHome() = %q, want an absolute path", got)
	}
}

func TestWebviewUserDataPathWindowsLayout(t *testing.T) {
	if runtime.GOOS != "windows" {
		if got := webviewUserDataPath(); got != "" {
			t.Fatalf("non-windows webview path = %q", got)
		}
		return
	}
	t.Setenv("LOCALAPPDATA", filepath.Join(t.TempDir(), "local"))
	got := webviewUserDataPath()
	if filepath.Base(filepath.Dir(got)) != "FreeOS" || filepath.Base(got) != "WebView2" {
		t.Fatalf("webviewUserDataPath() = %q", got)
	}
	if !filepath.IsAbs(got) {
		t.Fatalf("webview path must be absolute: %q", got)
	}
}

func TestPrepareWebviewUserDataLinuxIsEmpty(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("windows uses a real user-data path")
	}
	if got := prepareWebviewUserData(); got != "" {
		t.Fatalf("prepareWebviewUserData() = %q", got)
	}
}

func TestPrepareWebviewUserDataWindowsSetsEnv(t *testing.T) {
	if runtime.GOOS != "windows" {
		t.Skip("WEBVIEW2_USER_DATA_FOLDER is a Windows runtime concern")
	}
	local := filepath.Join(t.TempDir(), "local")
	t.Setenv("LOCALAPPDATA", local)
	got := prepareWebviewUserData()
	want := filepath.Join(local, "FreeOS", "WebView2")
	if got != want {
		t.Fatalf("prepareWebviewUserData() = %q, want %q", got, want)
	}
	if os.Getenv("WEBVIEW2_USER_DATA_FOLDER") != want {
		t.Fatalf("WEBVIEW2_USER_DATA_FOLDER = %q", os.Getenv("WEBVIEW2_USER_DATA_FOLDER"))
	}
}

func TestEnsureProductHomeWritableCreatesDir(t *testing.T) {
	root := t.TempDir()
	home := filepath.Join(root, "nested-home")
	t.Setenv("FREEOS_HOME", home)
	t.Setenv("OCTOP_HOME", "")
	if err := ensureProductHomeWritable(); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(home); err != nil {
		t.Fatal(err)
	}
}
