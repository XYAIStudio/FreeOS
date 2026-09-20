package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
)

func mustEnv(cmd *exec.Cmd, extra map[string]string) {
	cmd.Env = mergeLaunchEnv(os.Environ(), extra)
}

// mergeLaunchEnv overlays extra onto base so later keys win. On Windows the
// environment is case-insensitive and CreateProcess keeps the first duplicate,
// so a leftover OCTOP_DESKTOP=0 from the parent would otherwise shadow "1".
func mergeLaunchEnv(base []string, extra map[string]string) []string {
	type entry struct {
		key   string
		value string
	}
	order := make([]entry, 0, len(base)+len(extra))
	index := map[string]int{}
	put := func(key, value string) {
		lk := key
		if runtime.GOOS == "windows" {
			lk = strings.ToLower(key)
		}
		if i, ok := index[lk]; ok {
			order[i] = entry{key: key, value: value}
			return
		}
		index[lk] = len(order)
		order = append(order, entry{key: key, value: value})
	}
	for _, pair := range base {
		key, value, ok := strings.Cut(pair, "=")
		if !ok {
			continue
		}
		put(key, value)
	}
	for key, value := range extra {
		put(key, value)
	}
	out := make([]string, 0, len(order))
	for _, item := range order {
		out = append(out, item.key+"="+item.value)
	}
	return out
}

const defaultSidecarPort = 3780

func hostLaunchEnv(root string, port int) map[string]string {
	home := productHome()
	env := map[string]string{
		"FREEOS_HOME":           home,
		"OCTOP_HOME":            home,
		"OCTOP_GREEN_PACKAGES":  filepath.Join(root, "packages"),
		"PYTHONNOUSERSITE":      "1",
		"PYTHONUTF8":            "1",
		"PYTHONIOENCODING":      "utf-8",
		"PYTHONPATH":            "",
		"FREEOS_ORG_ENABLE":     "1",
		"FREEOS_ORG_INTEGRATED": "1",
		"OCTOP_PORT":            strconv.Itoa(port),
		"OCTOP_DESKTOP":         "1",
		"FREEOS_DESKTOP":        "1",
	}
	if bundle := resolveSidecarDir(root); bundle != "" {
		env["FREEOS_OPENXYOS_HOME"] = bundle
	}
	if orgSidecarWanted() {
		env["FREEOS_ORG_SIDECAR"] = "1"
		env["FREEOS_ORG_SIDECAR_URL"] = sidecarURL()
		env["FREEOS_ORG_SIDECAR_PORT"] = strconv.Itoa(defaultSidecarPort)
		env["OPENXYOS_BASE_URL"] = sidecarURL()
		if install := openxyosInstallDir(); install != "" {
			env["FREEOS_OPENXYOS_INSTALL"] = install
		}
		if _, _, ingest, err := loadOrCreateSidecarSecrets(home); err == nil && ingest != "" {
			env["FREEOS_INGEST_TOKEN"] = ingest
		}
	}
	return env
}

func sidecarURL() string {
	return fmt.Sprintf("http://127.0.0.1:%d", defaultSidecarPort)
}

func startOctop(root string, port int) (*exec.Cmd, error) {
	py := pythonExe(root)
	launch := filepath.Join(root, "launch.py")
	cmd := exec.Command(py, launch, "run", "--host", "127.0.0.1", "--port", strconv.Itoa(port))
	cmd.Dir = root
	mustEnv(cmd, hostLaunchEnv(root, port))
	configureProcGroup(cmd)
	if f, err := attachProcessLogFile("host"); err == nil {
		cmd.Stdout = f
		cmd.Stderr = f
	} else if runtime.GOOS != "windows" && runtime.GOOS != "linux" {
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
	}
	if err := cmd.Start(); err != nil {
		return nil, err
	}
	return cmd, nil
}

func stopOctop(cmd *exec.Cmd) {
	if cmd == nil || cmd.Process == nil {
		return
	}
	killProcessTree(cmd)
}

func dashboardURL(port int) string {
	return fmt.Sprintf("http://127.0.0.1:%d/", port)
}

// withDesktopQuery marks the SPA as the Wails shell so it can skip PWA
// service-worker caching and treat first open as a local desktop session.
func withDesktopQuery(base string) string {
	if strings.Contains(base, "desktop=1") {
		return base
	}
	if strings.Contains(base, "?") {
		return base + "&desktop=1"
	}
	return strings.TrimRight(base, "/") + "/?desktop=1"
}
