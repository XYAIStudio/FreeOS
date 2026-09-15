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
