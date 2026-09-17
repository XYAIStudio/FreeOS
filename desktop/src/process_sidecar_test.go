package main

import (
	"archive/zip"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestLoadOrCreateSidecarSecretsPersists(t *testing.T) {
	home := t.TempDir()
	jwt, cookie, ingest, err := loadOrCreateSidecarSecrets(home)
	if err != nil {
		t.Fatal(err)
	}
	if jwt == "" || cookie == "" || ingest == "" {
		t.Fatal("secrets should be generated")
	}
	jwt2, cookie2, ingest2, err := loadOrCreateSidecarSecrets(home)
	if err != nil {
		t.Fatal(err)
	}
	if jwt != jwt2 || cookie != cookie2 || ingest != ingest2 {
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
	if !strings.Contains(env["CORS_ORIGIN"], "http://127.0.0.1:3780") {
		t.Fatalf("CORS_ORIGIN missing sidecar self origin: %q", env["CORS_ORIGIN"])
	}
	if !strings.Contains(env["CORS_ORIGIN"], "http://localhost:3780") {
		t.Fatalf("CORS_ORIGIN missing localhost self origin: %q", env["CORS_ORIGIN"])
	}
	if !strings.Contains(env["CORS_ORIGIN"], "http://[::1]:3780") {
		t.Fatalf("CORS_ORIGIN missing ipv6 self origin: %q", env["CORS_ORIGIN"])
	}
}

func TestSidecarReadyRequiresFrontendBuild(t *testing.T) {
	root := t.TempDir()
	t.Setenv("FREEOS_HOME", root)
	t.Setenv("FREEOS_OPENXYOS_HOME", filepath.Join(root, "missing-openxyos"))
	t.Setenv("LOCALAPPDATA", filepath.Join(root, "local"))
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

func TestResolveSidecarDirUsesWorkdir(t *testing.T) {
	root := t.TempDir()
	work := filepath.Join(root, "openxyos")
	t.Setenv("FREEOS_HOME", root)
	t.Setenv("FREEOS_OPENXYOS_HOME", work)
	t.Setenv("LOCALAPPDATA", filepath.Join(root, "local"))
	writeSidecarBundle(t, work)
	if got := resolveSidecarDir(filepath.Join(root, "portable")); got != work {
		t.Fatalf("resolveSidecarDir=%q want %q", got, work)
	}
}

func TestProvisionOpenXYOSCopiesFromPortable(t *testing.T) {
	root := t.TempDir()
	t.Setenv("FREEOS_HOME", root)
	work := filepath.Join(root, "workdir")
	t.Setenv("FREEOS_OPENXYOS_HOME", work)
	t.Setenv("LOCALAPPDATA", filepath.Join(root, "local"))
	portable := filepath.Join(root, "portable")
	writeSidecarBundle(t, orgSidecarDir(portable))
	got, err := provisionOpenXYOS(portable, LocaleEN, nil)
	if err != nil {
		t.Fatal(err)
	}
	if got != work {
		t.Fatalf("provision dest=%q want %q", got, work)
	}
	if !sidecarBundleReady(work) {
		t.Fatal("workdir should contain FE+BE")
	}
	if _, err := os.Stat(filepath.Join(work, "README.txt")); err != nil {
		t.Fatal(err)
	}
}

func writeSidecarBundle(t *testing.T, bundle string) {
	t.Helper()
	node := sidecarNodeAt(bundle)
	if err := os.MkdirAll(filepath.Dir(node), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(node, []byte("node"), 0o755); err != nil {
		t.Fatal(err)
	}
	app := sidecarAppAt(bundle)
	if err := os.MkdirAll(filepath.Join(app, "backend"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(app, "backend", "server.ts"), []byte(""), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(app, "dist"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(app, "dist", "index.html"), []byte("<html></html>"), 0o644); err != nil {
		t.Fatal(err)
	}
}

func TestSidecarBundleReadyRejectsReadmeOnly(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "README.txt"), []byte("stub"), 0o644); err != nil {
		t.Fatal(err)
	}
	if sidecarBundleReady(dir) {
		t.Fatal("README-only tree must not be treated as a runtime")
	}
}

func TestProvisionOpenXYOSSkipsCopyWhenWorkdirReady(t *testing.T) {
	root := t.TempDir()
	t.Setenv("FREEOS_HOME", root)
	work := filepath.Join(root, "workdir")
	t.Setenv("FREEOS_OPENXYOS_HOME", work)
	t.Setenv("LOCALAPPDATA", filepath.Join(root, "local"))
	writeSidecarBundle(t, work)
	portable := filepath.Join(root, "portable")
	writeSidecarBundle(t, orgSidecarDir(portable))
	marker := filepath.Join(orgSidecarDir(portable), "copied-from-portable")
	if err := os.WriteFile(marker, []byte("no"), 0o644); err != nil {
		t.Fatal(err)
	}
	got, err := provisionOpenXYOS(portable, LocaleEN, nil)
	if err != nil {
		t.Fatal(err)
	}
	if got != work {
		t.Fatalf("provision dest=%q want %q", got, work)
	}
	if _, err := os.Stat(filepath.Join(work, "copied-from-portable")); err == nil {
		t.Fatal("install-time complete workdir must not be overwritten from portable")
	}
}

func TestProvisionOpenXYOSHealsFromStagedRuntime(t *testing.T) {
	root := t.TempDir()
	t.Setenv("FREEOS_HOME", root)
	work := filepath.Join(root, "workdir")
	t.Setenv("FREEOS_OPENXYOS_HOME", work)
	t.Setenv("LOCALAPPDATA", filepath.Join(root, "local"))
	inst := filepath.Join(root, "Program Files", "FreeOS")
	installerRootOverride = inst
	t.Cleanup(func() { installerRootOverride = "" })
	live := filepath.Join(inst, "openxyos")
	if err := os.MkdirAll(live, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(live, "README.txt"), []byte("stub"), 0o644); err != nil {
		t.Fatal(err)
	}
	writeSidecarBundle(t, filepath.Join(inst, "openxyos-runtime"))
	got, err := provisionOpenXYOS(filepath.Join(root, "portable"), LocaleEN, nil)
	if err != nil {
		t.Fatal(err)
	}
	if got != work {
		t.Fatalf("provision dest=%q want %q", got, work)
	}
	if !sidecarBundleReady(work) {
		t.Fatal("workdir should be copied from openxyos-runtime, not README-only openxyos")
	}
	if _, err := os.Stat(filepath.Join(work, "openxyos", "dist", "index.html")); err != nil {
		t.Fatal(err)
	}
}

func TestUnzipSidecarZipLaysOutBundle(t *testing.T) {
	root := t.TempDir()
	bundle := filepath.Join(root, "bundle")
	writeSidecarBundle(t, bundle)
	zipPath := filepath.Join(root, "openxyos-runtime.zip")
	if err := zipDir(bundle, zipPath); err != nil {
		t.Fatal(err)
	}
	dest := filepath.Join(root, "Program Files", "FreeOS", "openxyos")
	if err := unzipSidecarZip(zipPath, dest); err != nil {
		t.Fatal(err)
	}
	if !sidecarBundleReady(dest) {
		t.Fatal("extracted zip should be a complete sidecar")
	}
}

func zipDir(src, dest string) error {
	f, err := os.Create(dest)
	if err != nil {
		return err
	}
	defer f.Close()
	w := zip.NewWriter(f)
	err = filepath.Walk(src, func(path string, info os.FileInfo, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		rel, err := filepath.Rel(src, path)
		if err != nil {
			return err
		}
		if rel == "." {
			return nil
		}
		name := filepath.ToSlash(rel)
		if info.IsDir() {
			_, err := w.Create(name + "/")
			return err
		}
		hdr, err := zip.FileInfoHeader(info)
		if err != nil {
			return err
		}
		hdr.Name = name
		hdr.Method = zip.Deflate
		out, err := w.CreateHeader(hdr)
		if err != nil {
			return err
		}
		in, err := os.Open(path)
		if err != nil {
			return err
		}
		_, copyErr := io.Copy(out, in)
		in.Close()
		return copyErr
	})
	if err != nil {
		w.Close()
		return err
	}
	return w.Close()
}

func TestSidecarLiveReadsHealthURL(t *testing.T) {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/health/livez" {
			t.Fatalf("path %s", r.URL.Path)
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	}))
	t.Cleanup(srv.Close)
	sidecarHealthURLOverride = srv.URL + "/api/health/livez"
	t.Cleanup(func() { sidecarHealthURLOverride = "" })
	if !sidecarLive() {
		t.Fatal("healthy livez should count as live")
	}
}

func TestStartOrgSidecarSkipsWhenNoBundle(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	t.Cleanup(srv.Close)
	sidecarHealthURLOverride = srv.URL + "/api/health/livez"
	t.Cleanup(func() { sidecarHealthURLOverride = "" })
	cmd, err := startOrgSidecar(t.TempDir(), 8088)
	if err != nil {
		t.Fatal(err)
	}
	if cmd != nil {
		t.Fatal("missing sidecar bundle must not spawn node even if livez is up")
	}
}

func TestHealOpenXYOSLayoutPromotesNestedApp(t *testing.T) {
	root := t.TempDir()
	inner := filepath.Join(root, "openxyos")
	writeSidecarBundle(t, inner)
	if sidecarBundleReady(root) {
		t.Fatal("outer tree should be incomplete before heal")
	}
	if !healOpenXYOSLayout(root) {
		t.Fatal("heal should copy nested bundle to the live root")
	}
	if !sidecarBundleReady(root) {
		t.Fatal("healed root should be a complete sidecar")
	}
	if !fileExists(filepath.Join(root, "dist", "index.html")) &&
		!fileExists(filepath.Join(root, "openxyos", "dist", "index.html")) {
		t.Fatal("heal should expose dist/index.html at nested or flat layout")
	}
}

func TestHealOpenXYOSLayoutCopiesNestedFrontendToRoot(t *testing.T) {
	root := t.TempDir()
	writeSidecarBundle(t, root)
	flat := filepath.Join(root, "dist", "index.html")
	if fileExists(flat) {
		t.Fatal("bundled layout should keep FE under openxyos/ until promoted")
	}
	if !healOpenXYOSLayout(root) {
		t.Fatal("complete nested bundle should stay ready")
	}
	if !fileExists(flat) {
		t.Fatal("missing top-level dist/index.html should be copied from openxyos/")
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
