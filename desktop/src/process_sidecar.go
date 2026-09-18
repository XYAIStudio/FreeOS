package main

import (
	"archive/zip"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"
)

func orgSidecarWanted() bool {
	switch strings.ToLower(strings.TrimSpace(os.Getenv("FREEOS_ORG_SIDECAR"))) {
	case "1", "true", "yes", "on":
		return true
	default:
		return false
	}
}

func orgSidecarDir(root string) string {
	return filepath.Join(root, "org-sidecar")
}

func sidecarNodeExe(root string) string {
	return sidecarNodeAt(orgSidecarDir(root))
}

func sidecarAppDir(root string) string {
	return sidecarAppAt(orgSidecarDir(root))
}

func sidecarNodeAt(bundle string) string {
	base := filepath.Join(bundle, "node")
	if runtime.GOOS == "windows" {
		return filepath.Join(base, "node.exe")
	}
	return filepath.Join(base, "bin", "node")
}

func sidecarAppReady(app string) bool {
	if strings.TrimSpace(app) == "" {
		return false
	}
	if _, err := os.Stat(filepath.Join(app, "dist", "index.html")); err != nil {
		return false
	}
	if _, err := os.Stat(filepath.Join(app, "backend-dist", "server.js")); err == nil {
		return true
	}
	if _, err := os.Stat(filepath.Join(app, "backend", "server.ts")); err == nil {
		return true
	}
	return false
}

func sidecarAppAt(bundle string) string {
	// Prefer the healed live root. Nested openxyos\openxyos cwd makes
	// `node backend-dist/server.js` exit immediately with an empty console.
	if sidecarAppReady(bundle) {
		return bundle
	}
	nested := filepath.Join(bundle, "openxyos")
	if sidecarAppReady(nested) {
		return nested
	}
	return nested
}

func sidecarNodeArgs(app string) []string {
	compiled := filepath.Join(app, "backend-dist", "server.js")
	if _, err := os.Stat(compiled); err == nil {
		return []string{"backend-dist/server.js"}
	}
	return []string{"--import", "tsx", "backend/server.ts"}
}

func sidecarBundleReady(bundle string) bool {
	if strings.TrimSpace(bundle) == "" {
		return false
	}
	if _, err := os.Stat(sidecarNodeAt(bundle)); err != nil {
		return false
	}
	if sidecarAppReady(sidecarAppAt(bundle)) {
		return true
	}
	log.Printf("organization sidecar frontend missing under %s", bundle)
	return false
}

func sidecarReady(root string) bool {
	return resolveSidecarDir(root) != ""
}

func openxyosUserWorkDir() string {
	if v := strings.TrimSpace(os.Getenv("FREEOS_OPENXYOS_HOME")); v != "" {
		return v
	}
	if runtime.GOOS == "windows" {
		if base := strings.TrimSpace(os.Getenv("LOCALAPPDATA")); base != "" {
			return filepath.Join(base, "FreeOS", "openxyos")
		}
	}
	return filepath.Join(productHome(), "openxyos")
}

// installerRootOverride is a test seam for a fake $INSTDIR (Program Files).
var installerRootOverride string

func installerRoot() string {
	if installerRootOverride != "" {
		return installerRootOverride
	}
	exe, err := os.Executable()
	if err != nil {
		return ""
	}
	dir := filepath.Dir(exe)
	if resolved, err := filepath.EvalSymlinks(dir); err == nil {
		dir = resolved
	}
	return dir
}

func openxyosInstallDir() string {
	root := installerRoot()
	if root == "" {
		return ""
	}
	return filepath.Join(root, "openxyos")
}

func openxyosStagedRuntimeDir() string {
	root := installerRoot()
	if root == "" {
		return ""
	}
	return filepath.Join(root, "openxyos-runtime")
}

func sidecarSearchDirs(portableRoot string) []string {
	seen := map[string]bool{}
	var out []string
	add := func(p string) {
		p = strings.TrimSpace(p)
		if p == "" {
			return
		}
		clean := filepath.Clean(p)
		if seen[clean] {
			return
		}
		seen[clean] = true
		out = append(out, clean)
	}
	add(os.Getenv("FREEOS_OPENXYOS_HOME"))
	add(openxyosUserWorkDir())
	add(filepath.Join(productHome(), "openxyos"))
	add(openxyosInstallDir())
	add(openxyosStagedRuntimeDir())
	if portableRoot != "" {
		add(orgSidecarDir(portableRoot))
	}
	return out
}

func resolveSidecarDir(portableRoot string) string {
	for _, dir := range sidecarSearchDirs(portableRoot) {
		if sidecarBundleReady(dir) {
			return dir
		}
		nested := filepath.Join(dir, "org-sidecar")
		if sidecarBundleReady(nested) {
			return nested
		}
	}
	return ""
}

// sidecarHealthURLOverride is a test seam for sidecarLive / waitSidecarLive.
var sidecarHealthURLOverride string

func sidecarHealthCheckURL() string {
	if sidecarHealthURLOverride != "" {
		return sidecarHealthURLOverride
	}
	return sidecarURL() + "/api/health/livez"
}

func sidecarLive() bool {
	resp, err := http.Get(sidecarHealthCheckURL())
	if err != nil {
		return false
	}
	resp.Body.Close()
	return resp.StatusCode < 500
}

func waitSidecarLive(timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	url := sidecarHealthCheckURL()
	var last error
	for time.Now().Before(deadline) {
		resp, err := http.Get(url)
		if err == nil {
			resp.Body.Close()
			if resp.StatusCode < 500 {
				return nil
			}
			last = fmt.Errorf("HTTP %d", resp.StatusCode)
		} else {
			last = err
		}
		time.Sleep(400 * time.Millisecond)
	}
	if last == nil {
		return fmt.Errorf("sidecar not reachable at %s", url)
	}
	return fmt.Errorf("sidecar not reachable at %s: %w", url, last)
}

func sidecarDataDir(home string) string {
	return filepath.Join(home, "org-os")
}

func sidecarSecretsPath(home string) string {
	return filepath.Join(sidecarDataDir(home), "sidecar.env")
}

func randomSecret() string {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return hex.EncodeToString([]byte(fmt.Sprintf("%d", os.Getpid())))
	}
	return hex.EncodeToString(buf)
}

func loadOrCreateSidecarSecrets(home string) (jwt string, cookie string, ingest string, err error) {
	path := sidecarSecretsPath(home)
	if data, readErr := os.ReadFile(path); readErr == nil {
		for _, line := range strings.Split(string(data), "\n") {
			line = strings.TrimSpace(line)
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}
			key, value, ok := strings.Cut(line, "=")
			if !ok {
				continue
			}
			switch strings.TrimSpace(key) {
			case "JWT_SECRET":
				jwt = strings.TrimSpace(value)
			case "COOKIE_SECRET":
				cookie = strings.TrimSpace(value)
			case "FREEOS_INGEST_TOKEN":
				ingest = strings.TrimSpace(value)
			}
		}
	}
	if jwt == "" {
		jwt = randomSecret()
	}
	if cookie == "" {
		cookie = randomSecret()
	}
	if ingest == "" {
		ingest = randomSecret()
	}
	if err := os.MkdirAll(sidecarDataDir(home), 0o755); err != nil {
		return "", "", "", err
	}
	body := "JWT_SECRET=" + jwt + "\nCOOKIE_SECRET=" + cookie + "\nFREEOS_INGEST_TOKEN=" + ingest + "\n"
	if err := os.WriteFile(path, []byte(body), 0o600); err != nil {
		return "", "", "", err
	}
	return jwt, cookie, ingest, nil
}

func sidecarLaunchEnv(home string, dashboardPort int) (map[string]string, error) {
	jwt, cookie, ingest, err := loadOrCreateSidecarSecrets(home)
	if err != nil {
		return nil, err
	}
	origin := fmt.Sprintf(
		"http://127.0.0.1:%d,http://localhost:%d,http://127.0.0.1:18900,http://localhost:18900,http://127.0.0.1:8088,http://localhost:8088,http://127.0.0.1:%d,http://localhost:%d,http://[::1]:%d",
		dashboardPort, dashboardPort, defaultSidecarPort, defaultSidecarPort, defaultSidecarPort,
	)
	return map[string]string{
		"NODE_ENV":                  "production",
		"PORT":                      strconv.Itoa(defaultSidecarPort),
		"DB_DIALECT":                "sqlite",
		"DATABASE_PATH":             filepath.Join(sidecarDataDir(home), "xiongyuan.db"),
		"AIR_GAP_MODE":              "true",
		"ALLOW_PUBLIC_REGISTRATION": "false",
		"SEED_DEMO_DATA":            "false",
		"JWT_SECRET":                jwt,
		"COOKIE_SECRET":             cookie,
		"FREEOS_INGEST_TOKEN":       ingest,
		"CORS_ORIGIN":               origin,
		"FREEOS_HOME":               home,
		"OCTOP_HOME":                home,
		"FREEOS_ORG_SIDECAR_PORT":   strconv.Itoa(defaultSidecarPort),
	}, nil
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

func promoteNestedOpenXYOSApp(root string) {
	nested := filepath.Join(root, "openxyos")
	need := (fileExists(filepath.Join(nested, "dist", "index.html")) &&
		!fileExists(filepath.Join(root, "dist", "index.html"))) ||
		(fileExists(filepath.Join(nested, "backend-dist", "server.js")) &&
			!fileExists(filepath.Join(root, "backend-dist", "server.js")))
	if !need {
		return
	}
	if err := copyTree(nested, root); err != nil {
		log.Printf("heal openXYOS nested layout: %v", err)
	}
}

func healOpenXYOSLayout(root string) bool {
	if strings.TrimSpace(root) == "" {
		return false
	}
	promoteNestedOpenXYOSApp(root)
	if sidecarBundleReady(root) {
		return true
	}
	candidates := []string{
		filepath.Join(root, "openxyos"),
		filepath.Join(root, "org-sidecar"),
		filepath.Join(root, "openxyos", "openxyos"),
		filepath.Join(root, "openxyos", "org-sidecar"),
	}
	if entries, err := os.ReadDir(root); err == nil {
		for _, entry := range entries {
			if !entry.IsDir() {
				continue
			}
			child := filepath.Join(root, entry.Name())
			candidates = append(candidates, child)
			candidates = append(candidates, filepath.Join(child, "openxyos"))
			candidates = append(candidates, filepath.Join(child, "org-sidecar"))
		}
	}
	seen := map[string]bool{}
	for _, candidate := range candidates {
		clean := filepath.Clean(candidate)
		if seen[clean] || clean == filepath.Clean(root) {
			continue
		}
		seen[clean] = true
		if !sidecarBundleReady(clean) {
			continue
		}
		if err := copyTree(clean, root); err != nil {
			log.Printf("heal openXYOS from %s: %v", clean, err)
			continue
		}
		promoteNestedOpenXYOSApp(root)
		return sidecarBundleReady(root)
	}
	promoteNestedOpenXYOSApp(root)
	return sidecarBundleReady(root)
}

func stopStaleOpenXYOS(bundle string) {
	if strings.TrimSpace(bundle) == "" {
		return
	}
	pidFile := filepath.Join(bundle, "start.pid")
	if data, err := os.ReadFile(pidFile); err == nil {
		if pid, err := strconv.Atoi(strings.TrimSpace(string(data))); err == nil && pid > 0 {
			killPid(pid)
		}
		_ = os.Remove(pidFile)
	}
	if runtime.GOOS == "windows" {
		node := sidecarNodeAt(bundle)
		killWindowsImageAt(node)
	}
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) && sidecarLive() {
		time.Sleep(200 * time.Millisecond)
	}
}

func startViaWindowsHelper(bundle string) (*exec.Cmd, error) {
	helper := filepath.Join(bundle, "start-sidecar.ps1")
	if !fileExists(helper) {
		return nil, nil
	}
	systemRoot := strings.TrimSpace(os.Getenv("SystemRoot"))
	if systemRoot == "" {
		systemRoot = `C:\Windows`
	}
	ps := filepath.Join(systemRoot, `System32`, `WindowsPowerShell`, `v1.0`, `powershell.exe`)
	cmd := exec.Command(ps, "-NoProfile", "-WindowStyle", "Hidden", "-ExecutionPolicy", "Bypass", "-File", helper)
	cmd.Dir = bundle
	configureProcGroup(cmd)
	if f, err := attachProcessLogFile("org-sidecar"); err == nil {
		cmd.Stdout = f
		cmd.Stderr = f
	}
	if err := cmd.Start(); err != nil {
		return nil, err
	}
	return cmd, nil
}

func startOrgSidecar(root string, dashboardPort int) (*exec.Cmd, error) {
	if !orgSidecarWanted() {
		return nil, nil
	}
	bundle := resolveSidecarDir(root)
	if bundle == "" {
		work := openxyosUserWorkDir()
		if healOpenXYOSLayout(work) {
			bundle = work
		}
	}
	if bundle == "" {
		return nil, nil
	}
	if !healOpenXYOSLayout(bundle) && !sidecarBundleReady(bundle) {
		return nil, nil
	}
	stopStaleOpenXYOS(bundle)
	if runtime.GOOS == "windows" {
		if cmd, err := startViaWindowsHelper(bundle); err != nil {
			return nil, err
		} else if cmd != nil {
			log.Printf("organization sidecar restart via start-sidecar.ps1 at %s", bundle)
			return cmd, nil
		}
	}
	home := productHome()
	env, err := sidecarLaunchEnv(home, dashboardPort)
	if err != nil {
		return nil, err
	}
	env["FREEOS_OPENXYOS_HOME"] = bundle
	app := sidecarAppAt(bundle)
	node := sidecarNodeAt(bundle)
	cmd := exec.Command(node, sidecarNodeArgs(app)...)
	cmd.Dir = app
	mustEnv(cmd, env)
	configureProcGroup(cmd)
	if f, err := attachProcessLogFile("org-sidecar"); err == nil {
		cmd.Stdout = f
		cmd.Stderr = f
	}
	if runtime.GOOS != "windows" && runtime.GOOS != "linux" {
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
	}
	if err := cmd.Start(); err != nil {
		return nil, err
	}
	return cmd, nil
}

func provisionOpenXYOS(portableRoot string, locale Locale, status func(string)) (string, error) {
	dest := openxyosUserWorkDir()
	if sidecarBundleReady(dest) {
		// Windows NSIS writes this tree during Setup. First launch must
		// not copy or unpack when the install-time live root is complete.
		log.Printf("openXYOS workdir already complete at %s", dest)
		return dest, nil
	}
	if status != nil {
		status(desktopText(locale, copyStatusProvisioningOrg))
	}
	if err := os.MkdirAll(dest, 0o755); err != nil {
		return "", err
	}
	for _, source := range openxyosSourceDirs(portableRoot) {
		if !sidecarBundleReady(source) {
			continue
		}
		if filepath.Clean(source) == filepath.Clean(dest) {
			_ = writeOpenXYOSReadme(dest)
			return dest, nil
		}
		if err := copyTree(source, dest); err != nil {
			log.Printf("copy openXYOS from %s: %v", source, err)
			continue
		}
		if sidecarBundleReady(dest) {
			_ = writeOpenXYOSReadme(dest)
			log.Printf("openXYOS workdir ready at %s", dest)
			return dest, nil
		}
	}
	if zipPath := openxyosRuntimeZip(); zipPath != "" {
		if err := unzipSidecarZip(zipPath, dest); err != nil {
			log.Printf("extract openxyos-runtime.zip: %v", err)
		} else if sidecarBundleReady(dest) {
			_ = writeOpenXYOSReadme(dest)
			log.Printf("openXYOS workdir extracted to %s", dest)
			return dest, nil
		}
	}
	if bundle := resolveSidecarDir(portableRoot); bundle != "" {
		_ = writeOpenXYOSReadme(bundle)
		return bundle, nil
	}
	_ = writeOpenXYOSReadme(dest)
	return dest, fmt.Errorf("openXYOS runtime missing (expected node + FE + BE)")
}

func openxyosSourceDirs(portableRoot string) []string {
	var out []string
	if install := openxyosInstallDir(); install != "" {
		out = append(out, install)
	}
	if staged := openxyosStagedRuntimeDir(); staged != "" {
		out = append(out, staged)
	}
	if portableRoot != "" {
		out = append(out, orgSidecarDir(portableRoot))
	}
	return out
}

func openxyosRuntimeZip() string {
	exe, err := os.Executable()
	if err != nil {
		return ""
	}
	dir := filepath.Dir(exe)
	for _, name := range []string{"openxyos-runtime.zip", "openXYOS-runtime.zip"} {
		path := filepath.Join(dir, name)
		if _, err := os.Stat(path); err == nil {
			return path
		}
	}
	return ""
}

func writeOpenXYOSReadme(dir string) error {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	body := strings.Join([]string{
		"FreeOS local openXYOS environment",
		"",
		"This folder is the local organization console (frontend + backend).",
		"FreeOS starts it automatically at http://127.0.0.1:3780",
		"Data/SQLite lives under {FREEOS_HOME}/org-os/ (usually ~/.freeos/org-os).",
		"",
		"Windows workdir: %LOCALAPPDATA%\\FreeOS\\openxyos",
		"Profile workdir: %USERPROFILE%\\.freeos\\openxyos",
		"Installer copy:  <install dir>\\openxyos",
		"",
	}, "\n")
	return os.WriteFile(filepath.Join(dir, "README.txt"), []byte(body), 0o644)
}

func copyTree(src, dest string) error {
	src = filepath.Clean(src)
	dest = filepath.Clean(dest)
	return filepath.Walk(src, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		rel, err := filepath.Rel(src, path)
		if err != nil {
			return err
		}
		target := filepath.Join(dest, rel)
		if info.IsDir() {
			return os.MkdirAll(target, 0o755)
		}
		if info.Mode()&os.ModeSymlink != 0 {
			link, err := os.Readlink(path)
			if err != nil {
				return err
			}
			_ = os.Remove(target)
			return os.Symlink(link, target)
		}
		return copyFile(path, target, info.Mode())
	})
}

func copyFile(src, dest string, mode os.FileMode) error {
	if err := os.MkdirAll(filepath.Dir(dest), 0o755); err != nil {
		return err
	}
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := os.OpenFile(dest, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, mode)
	if err != nil {
		return err
	}
	_, copyErr := io.Copy(out, in)
	closeErr := out.Close()
	if copyErr != nil {
		return copyErr
	}
	return closeErr
}

func unzipSidecarZip(zipPath, dest string) error {
	reader, err := zip.OpenReader(zipPath)
	if err != nil {
		return err
	}
	defer reader.Close()
	if err := os.MkdirAll(dest, 0o755); err != nil {
		return err
	}
	prefix := sidecarZipPrefix(reader.File)
	for _, file := range reader.File {
		name := filepath.ToSlash(strings.ReplaceAll(file.Name, "\\", "/"))
		rel := name
		if prefix != "" {
			if name == prefix || name == prefix+"/" {
				continue
			}
			if !strings.HasPrefix(name, prefix+"/") {
				continue
			}
			rel = strings.TrimPrefix(name, prefix+"/")
		}
		if rel == "" {
			continue
		}
		target := filepath.Join(dest, filepath.FromSlash(rel))
		cleanDest := filepath.Clean(dest) + string(os.PathSeparator)
		if !strings.HasPrefix(target, cleanDest) && target != filepath.Clean(dest) {
			return fmt.Errorf("illegal zip path %s", name)
		}
		if file.FileInfo().IsDir() {
			if err := os.MkdirAll(target, 0o755); err != nil {
				return err
			}
			continue
		}
		if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
			return err
		}
		rc, err := file.Open()
		if err != nil {
			return err
		}
		out, err := os.OpenFile(target, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, file.Mode())
		if err != nil {
			rc.Close()
			return err
		}
		_, err = io.Copy(out, rc)
		out.Close()
		rc.Close()
		if err != nil {
			return err
		}
	}
	if sidecarBundleReady(filepath.Join(dest, "org-sidecar")) && !sidecarBundleReady(dest) {
		return copyTree(filepath.Join(dest, "org-sidecar"), dest)
	}
	return nil
}

func sidecarZipPrefix(files []*zip.File) string {
	var top string
	for _, file := range files {
		name := filepath.ToSlash(strings.ReplaceAll(file.Name, "\\", "/"))
		if name == "" {
			continue
		}
		first := strings.SplitN(name, "/", 2)[0]
		if first == "node" || first == "openxyos" || first == "start-sidecar.bat" || first == "start-sidecar.sh" {
			return ""
		}
		if top == "" {
			top = first
		} else if first != top {
			return ""
		}
	}
	return top
}
