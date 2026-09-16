package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestLoadOrCreateSidecarSecretsPersists(t *testing.T) {
	home := t.TempDir()
	jwt, cookie, err := loadOrCreateSidecarSecrets(home)
	if err != nil {
		t.Fatal(err)
	}
	if jwt == "" || cookie == "" {
		t.Fatal("secrets should be generated")
	}
	jwt2, cookie2, err := loadOrCreateSidecarSecrets(home)
	if err != nil {
		t.Fatal(err)
	}
	if jwt != jwt2 || cookie != cookie2 {
		t.Fatal("secrets should persist across launches")
	}
	raw, err := os.ReadFile(sidecarSecretsPath(home))
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(raw), "JWT_SECRET=") {
		t.Fatalf("sidecar.env: %s", raw)
	}
}

func TestSidecarLaunchEnvPointsAtHomeDatabase(t *testing.T) {
	home := t.TempDir()
	env, err := sidecarLaunchEnv(home, 8088)
	if err != nil {
		t.Fatal(err)
	}
	want := filepath.Join(home, "org-os", "xiongyuan.db")
	if env["DATABASE_PATH"] != want {
		t.Fatalf("DATABASE_PATH=%q want %q", env["DATABASE_PATH"], want)
	}
	if !strings.Contains(env["CORS_ORIGIN"], "http://127.0.0.1:8088") {
		t.Fatalf("CORS_ORIGIN=%q", env["CORS_ORIGIN"])
	}
}

func TestSidecarReadyRequiresFrontendBuild(t *testing.T) {
	root := t.TempDir()
	if sidecarReady(root) {
		t.Fatal("empty tree should not be ready")
	}
	node := sidecarNodeExe(root)
	if err := os.MkdirAll(filepath.Dir(node), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(node, []byte("node"), 0o755); err != nil {
		t.Fatal(err)
	}
	app := sidecarAppDir(root)
	if err := os.MkdirAll(filepath.Join(app, "backend"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(app, "backend", "server.ts"), []byte(""), 0o644); err != nil {
		t.Fatal(err)
	}
	if sidecarReady(root) {
		t.Fatal("missing dist/index.html should not be ready")
	}
	if err := os.MkdirAll(filepath.Join(app, "dist"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(app, "dist", "index.html"), []byte("<html></html>"), 0o644); err != nil {
		t.Fatal(err)
	}
	if !sidecarReady(root) {
		t.Fatal("bundled node + server + frontend should be ready")
	}
}

func TestSidecarNodeArgsPrefersCompiledServer(t *testing.T) {
	app := t.TempDir()
	args := sidecarNodeArgs(app)
	if args[0] != "--import" {
		t.Fatalf("tsx fallback args=%v", args)
	}
	if err := os.MkdirAll(filepath.Join(app, "backend-dist"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(app, "backend-dist", "server.js"), []byte("ok"), 0o644); err != nil {
		t.Fatal(err)
	}
	args = sidecarNodeArgs(app)
	if len(args) != 1 || args[0] != "backend-dist/server.js" {
		t.Fatalf("compiled args=%v", args)
	}
}
