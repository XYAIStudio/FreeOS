package main

import (
	"fmt"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
)

func mustEnv(cmd *exec.Cmd, extra map[string]string) {
	cmd.Env = os.Environ()
	for key, value := range extra {
		cmd.Env = append(cmd.Env, key+"="+value)
	}
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
		// Desktop always claims the openXYOS module. Missing Node is a
		// packaging/startup failure, not a reason to unset this flag.
		"FREEOS_ORG_INTEGRATED": "1",
		"OCTOP_PORT":            strconv.Itoa(port),
		"OCTOP_DESKTOP":         "1",
		"FREEOS_DESKTOP":        "1",
	}
	if bundle := resolveSidecarDir(root); bundle != "" {
		env["FREEOS_OPENXYOS_HOME"] = bundle
	} else {
		env["FREEOS_OPENXYOS_HOME"] = openxyosUserWorkDir()
	}
	if orgSidecarWanted() {
		env["FREEOS_ORG_INTEGRATED"] = "1"
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
// Origin-only URLs open the first agent (`/chat/main`), not `/` → `/projects`
// and not the organization room.
func withDesktopQuery(base string) string {
	if strings.Contains(base, "desktop=1") {
		return base
	}
	trimmed := strings.TrimRight(base, "/")
	if strings.Contains(base, "?") {
		return base + "&desktop=1"
	}
	parsed, err := url.Parse(trimmed)
	if err == nil && (parsed.Path == "" || parsed.Path == "/") {
		return trimmed + "/chat/main?desktop=1"
	}
	return trimmed + "?desktop=1"
}
