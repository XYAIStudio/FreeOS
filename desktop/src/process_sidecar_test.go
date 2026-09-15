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
