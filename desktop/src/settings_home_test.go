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

func TestProductHomeIgnoresLegacyOctopDir(t *testing.T) {
	root := t.TempDir()
	t.Setenv("FREEOS_HOME", "")
	t.Setenv("OCTOP_HOME", "")
	t.Setenv("HOME", root)
	t.Setenv("USERPROFILE", root)
	if err := os.Mkdir(filepath.Join(root, ".octop"), 0o755); err != nil {
		t.Fatal(err)
	}
	want := filepath.Join(root, ".freeos")
	if got := productHome(); got != want {
		t.Fatalf("productHome() = %q, want %q", got, want)
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
	t.Setenv("FREEOS_OPENXYOS_HOME", filepath.Join(home, "missing-openxyos"))
	t.Setenv("LOCALAPPDATA", filepath.Join(home, "local"))
	env := hostLaunchEnv(filepath.Join(home, "portable"), 8088)
	if env["FREEOS_HOME"] != home || env["OCTOP_HOME"] != home {
		t.Fatalf("homes: %+v", env)
	}
	if env["FREEOS_ORG_ENABLE"] != "1" {
		t.Fatalf("org enable: %+v", env)
	}
	if _, ok := env["FREEOS_ORG_INTEGRATED"]; ok {
		t.Fatalf("zero-Node desktop must not claim integrated embed: %+v", env)
	}
	if _, ok := env["FREEOS_ORG_SIDECAR_URL"]; ok {
		t.Fatalf("sidecar url must stay unset by default: %+v", env)
	}
	if _, ok := env["OPENXYOS_BASE_URL"]; ok {
		t.Fatalf("OPENXYOS_BASE_URL must stay unset by default: %+v", env)
	}
	if env["OCTOP_DESKTOP"] != "1" || env["FREEOS_DESKTOP"] != "1" {
		t.Fatalf("desktop flags: %+v", env)
	}
	if env["PYTHONUTF8"] != "1" || env["PYTHONIOENCODING"] != "utf-8" {
		t.Fatalf("utf8 env: %+v", env)
	}
}

func TestOpenxyosWorkDirStaysInsideProductHome(t *testing.T) {
	home := t.TempDir()
	t.Setenv("FREEOS_HOME", home)
	t.Setenv("FREEOS_OPENXYOS_HOME", "")
	t.Setenv("LOCALAPPDATA", filepath.Join(t.TempDir(), "unrelated-local-app-data"))
	if got, want := openxyosUserWorkDir(), filepath.Join(home, "openxyos"); got != want {
		t.Fatalf("openxyosUserWorkDir() = %q, want %q", got, want)
	}
}

func TestHostLaunchEnvPassesIntegratedRuntimeWithoutLegacySidecar(t *testing.T) {
	home := t.TempDir()
	work := filepath.Join(home, "openxyos")
	t.Setenv("FREEOS_HOME", home)
	t.Setenv("FREEOS_OPENXYOS_HOME", work)
	t.Setenv("LOCALAPPDATA", filepath.Join(home, "local"))
	writeSidecarBundle(t, work)
	env := hostLaunchEnv(filepath.Join(home, "portable"), 8088)
	if env["FREEOS_OPENXYOS_HOME"] != work {
		t.Fatalf("integrated runtime path: %+v", env)
	}
	if env["FREEOS_ORG_INTEGRATED"] != "1" {
		t.Fatalf("bundled runtime must enable openXYOS embed: %+v", env)
	}
	if _, ok := env["OPENXYOS_BASE_URL"]; ok {
		t.Fatalf("Python must own the integrated Node port: %+v", env)
	}
}

func TestOrgRuntimeProvisionDefaultsOnAndCanBeDisabled(t *testing.T) {
	t.Setenv("FREEOS_ORG_ENABLE", "")
	if !orgRuntimeWanted() {
		t.Fatal("desktop product must provision organization runtime by default")
	}
	t.Setenv("FREEOS_ORG_ENABLE", "0")
	if orgRuntimeWanted() {
		t.Fatal("explicit disable must be honored")
	}
}

func TestWebviewAcceptanceArgsRequiresValidExplicitPort(t *testing.T) {
	t.Setenv("FREEOS_WEBVIEW_DEBUG_PORT", "")
	if got := webviewAcceptanceArgs(); got != nil {
		t.Fatalf("debugging must be off by default: %v", got)
	}
	t.Setenv("FREEOS_WEBVIEW_DEBUG_PORT", "9223")
	got := webviewAcceptanceArgs()
	if len(got) != 1 || got[0] != "--remote-debugging-port=9223" {
		t.Fatalf("unexpected args: %v", got)
	}
	t.Setenv("FREEOS_WEBVIEW_DEBUG_PORT", "80")
	if got := webviewAcceptanceArgs(); got != nil {
		t.Fatalf("privileged or invalid port must be rejected: %v", got)
	}
}

func TestHostLaunchEnvSidecarOptIn(t *testing.T) {
	home := t.TempDir()
	t.Setenv("FREEOS_HOME", home)
	t.Setenv("FREEOS_ORG_SIDECAR", "1")
	env := hostLaunchEnv(filepath.Join(home, "portable"), 8088)
	if env["FREEOS_ORG_SIDECAR_URL"] != "http://127.0.0.1:3780" {
		t.Fatalf("sidecar url: %+v", env)
	}
	if env["OPENXYOS_BASE_URL"] != "http://127.0.0.1:3780" {
		t.Fatalf("openxyos url: %+v", env)
	}
	if env["FREEOS_ORG_INTEGRATED"] != "1" {
		t.Fatalf("legacy sidecar opt-in must still embed: %+v", env)
	}
}

func TestWithDesktopQueryMarksSpa(t *testing.T) {
	if got := withDesktopQuery("http://127.0.0.1:8088/"); got != "http://127.0.0.1:8088/chat/main?desktop=1" {
		t.Fatalf("got %q", got)
	}
	if got := withDesktopQuery("http://127.0.0.1:8088"); got != "http://127.0.0.1:8088/chat/main?desktop=1" {
		t.Fatalf("origin: %q", got)
	}
	if got := withDesktopQuery("http://127.0.0.1:8088/?desktop=1"); got != "http://127.0.0.1:8088/?desktop=1" {
		t.Fatalf("idempotent: %q", got)
	}
	if got := withDesktopQuery("http://127.0.0.1:8088/setup"); got != "http://127.0.0.1:8088/setup?desktop=1" {
		t.Fatalf("existing path: %q", got)
	}
}

func TestSidecarReadyRequiresNodeAndServer(t *testing.T) {
	root := t.TempDir()
	t.Setenv("FREEOS_HOME", root)
	t.Setenv("FREEOS_OPENXYOS_HOME", filepath.Join(root, "missing"))
	t.Setenv("LOCALAPPDATA", filepath.Join(root, "local"))
	if sidecarReady(root) {
		t.Fatal("empty tree should not look ready")
	}
}
