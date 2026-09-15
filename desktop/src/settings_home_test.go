package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestProductHomePrefersFreeosHome(t *testing.T) {
	t.Setenv("FREEOS_HOME", filepath.Join(t.TempDir(), "free"))
	t.Setenv("OCTOP_HOME", filepath.Join(t.TempDir(), "oct"))
	if got := productHome(); got != os.Getenv("FREEOS_HOME") {
		t.Fatalf("productHome() = %q", got)
	}
}

func TestProductHomeHonorsOctopHome(t *testing.T) {
	t.Setenv("FREEOS_HOME", "")
	oct := filepath.Join(t.TempDir(), "oct")
	t.Setenv("OCTOP_HOME", oct)
	if got := productHome(); got != oct {
		t.Fatalf("productHome() = %q, want %q", got, oct)
	}
}

func TestHostLaunchEnvSetsFreeosHomeAndOrgEnable(t *testing.T) {
	home := t.TempDir()
	t.Setenv("FREEOS_HOME", home)
	env := hostLaunchEnv(filepath.Join(home, "portable"), 8088)
	if env["FREEOS_HOME"] != home || env["OCTOP_HOME"] != home {
		t.Fatalf("homes: %+v", env)
	}
	if env["FREEOS_ORG_ENABLE"] != "1" {
		t.Fatalf("org enable: %+v", env)
	}
	if env["FREEOS_ORG_SIDECAR_URL"] != "http://127.0.0.1:3780" {
		t.Fatalf("sidecar url: %+v", env)
	}
	if env["OCTOP_DESKTOP"] != "1" || env["FREEOS_DESKTOP"] != "1" {
		t.Fatalf("desktop flags: %+v", env)
	}
}

func TestWithDesktopQueryMarksSpa(t *testing.T) {
	if got := withDesktopQuery("http://127.0.0.1:8088/"); got != "http://127.0.0.1:8088/?desktop=1" {
		t.Fatalf("got %q", got)
	}
	if got := withDesktopQuery("http://127.0.0.1:8088/?desktop=1"); got != "http://127.0.0.1:8088/?desktop=1" {
		t.Fatalf("idempotent: %q", got)
	}
}

func TestSidecarReadyRequiresNodeAndServer(t *testing.T) {
	root := t.TempDir()
	if sidecarReady(root) {
		t.Fatal("empty tree should not look ready")
	}
}
