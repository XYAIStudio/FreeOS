package main

import (
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
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
	return map[string]string{
		"FREEOS_HOME":             home,
		"OCTOP_HOME":              home,
		"OCTOP_GREEN_PACKAGES":    filepath.Join(root, "packages"),
		"PYTHONNOUSERSITE":        "1",
		"PYTHONPATH":              "",
		"FREEOS_ORG_ENABLE":       "1",
		"FREEOS_ORG_SIDECAR_URL":  sidecarURL(),
		"FREEOS_ORG_SIDECAR_PORT": strconv.Itoa(defaultSidecarPort),
		"OPENXYOS_BASE_URL":       sidecarURL(),
		"OCTOP_PORT":              strconv.Itoa(port),
	}
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
	if runtime.GOOS == "linux" {
		// The Linux desktop release has no server terminal; the shell owns status
		// presentation just like the Windows GUI executable.
		cmd.Stdout = io.Discard
		cmd.Stderr = io.Discard
	} else if runtime.GOOS != "windows" {
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
