package main

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
)

func orgSidecarDir(root string) string {
	return filepath.Join(root, "org-sidecar")
}

func sidecarNodeExe(root string) string {
	base := filepath.Join(orgSidecarDir(root), "node")
	if runtime.GOOS == "windows" {
		return filepath.Join(base, "node.exe")
	}
	return filepath.Join(base, "bin", "node")
}

func sidecarAppDir(root string) string {
	return filepath.Join(orgSidecarDir(root), "openxyos")
}

func sidecarReady(root string) bool {
	if _, err := os.Stat(sidecarNodeExe(root)); err != nil {
		return false
	}
	if _, err := os.Stat(filepath.Join(sidecarAppDir(root), "backend", "server.ts")); err != nil {
		return false
	}
	return true
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

func loadOrCreateSidecarSecrets(home string) (jwt string, cookie string, err error) {
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
			}
		}
	}
	if jwt == "" {
		jwt = randomSecret()
	}
	if cookie == "" {
		cookie = randomSecret()
	}
	if err := os.MkdirAll(sidecarDataDir(home), 0o755); err != nil {
		return "", "", err
	}
	body := "JWT_SECRET=" + jwt + "\nCOOKIE_SECRET=" + cookie + "\n"
	if err := os.WriteFile(path, []byte(body), 0o600); err != nil {
		return "", "", err
	}
	return jwt, cookie, nil
}

func sidecarLaunchEnv(home string, dashboardPort int) (map[string]string, error) {
	jwt, cookie, err := loadOrCreateSidecarSecrets(home)
	if err != nil {
		return nil, err
	}
	origin := fmt.Sprintf(
		"http://127.0.0.1:%d,http://localhost:%d,http://127.0.0.1:18900,http://localhost:18900",
		dashboardPort, dashboardPort,
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
		"CORS_ORIGIN":               origin,
		"FREEOS_HOME":               home,
		"OCTOP_HOME":                home,
		"FREEOS_ORG_SIDECAR_PORT":   strconv.Itoa(defaultSidecarPort),
	}, nil
}

func startOrgSidecar(root string, dashboardPort int) (*exec.Cmd, error) {
	if !sidecarReady(root) {
		return nil, nil
	}
	home := productHome()
	env, err := sidecarLaunchEnv(home, dashboardPort)
	if err != nil {
		return nil, err
	}
	app := sidecarAppDir(root)
	node := sidecarNodeExe(root)
	cmd := exec.Command(node, "--import", "tsx", "backend/server.ts")
	cmd.Dir = app
	mustEnv(cmd, env)
	configureProcGroup(cmd)
	if runtime.GOOS != "windows" && runtime.GOOS != "linux" {
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
	}
	if err := cmd.Start(); err != nil {
		return nil, err
	}
	return cmd, nil
}
