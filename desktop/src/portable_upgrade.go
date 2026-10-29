package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

var runPreUpgradeBackup = func(python, launch, home, dest string) error {
	cmd := exec.Command(python, launch, "backup", "create", "--home", home, "--include-chats", "-o", dest)
	if output, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("pre-upgrade backup failed: %w: %s", err, strings.TrimSpace(string(output)))
	}
	return nil
}

func sha256File(path string) (string, error) {
	file, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer file.Close()
	sum := sha256.New()
	if _, err := io.Copy(sum, file); err != nil {
		return "", err
	}
	return hex.EncodeToString(sum.Sum(nil)), nil
}

type desktopDatabaseConfig struct {
	Database struct {
		Driver     string `json:"driver"`
		SQLitePath string `json:"sqlite_path"`
	} `json:"database"`
}

func desktopSQLitePath(home string) (string, bool, error) {
	driver := "sqlite"
	sqlitePath := "octop.db"
	configPath := filepath.Join(home, "config.json")
	if data, err := os.ReadFile(configPath); err == nil {
		var config desktopDatabaseConfig
		if err := json.Unmarshal(data, &config); err != nil {
			return "", false, fmt.Errorf("read database config: %w", err)
		}
		if config.Database.Driver != "" {
			driver = strings.ToLower(strings.TrimSpace(config.Database.Driver))
		}
		if config.Database.SQLitePath != "" {
			sqlitePath = config.Database.SQLitePath
		}
	} else if !os.IsNotExist(err) {
		return "", false, fmt.Errorf("read database config: %w", err)
	}

	if os.Getenv("OCTOP_DATABASE_URL") != "" {
		driver = "postgresql"
	}
	if value := strings.TrimSpace(os.Getenv("OCTOP_DATABASE_DRIVER")); value != "" {
		driver = strings.ToLower(value)
	}
	if value := os.Getenv("OCTOP_DATABASE_SQLITE_PATH"); value != "" {
		sqlitePath = value
	}
	if driver == "postgresql" {
		return "", false, nil
	}
	if driver != "sqlite" {
		return "", false, fmt.Errorf("unsupported database driver %q", driver)
	}
	if !filepath.IsAbs(sqlitePath) {
		sqlitePath = filepath.Join(home, sqlitePath)
	}
	return filepath.Clean(sqlitePath), true, nil
}

func safeVersion(value string) string {
	var result strings.Builder
	for _, char := range value {
		if (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') ||
			(char >= '0' && char <= '9') || char == '.' || char == '-' {
			result.WriteRune(char)
		}
	}
	if result.Len() == 0 {
		return "unknown"
	}
	return result.String()
}

func backupSQLiteBeforeUpgrade(root, currentVersion, nextVersion string) (string, error) {
	home := octopHome()
	if strings.TrimSpace(home) == "" {
		return "", fmt.Errorf("product home is empty")
	}
	backupDir := filepath.Join(home, "backups")
	if err := os.MkdirAll(backupDir, 0o700); err != nil {
		return "", fmt.Errorf("create backup directory: %w", err)
	}
	name := fmt.Sprintf(
		"freeos-pre-upgrade-%s-to-%s-%s.tar.gz",
		safeVersion(currentVersion),
		safeVersion(nextVersion),
		time.Now().UTC().Format("20060102T150405.000000000Z"),
	)
	destination := filepath.Join(backupDir, name)
	launch := filepath.Join(root, "launch.py")
	if err := runPreUpgradeBackup(pythonExe(root), launch, home, destination); err != nil {
		_ = os.Remove(destination)
		return "", err
	}
	sum, err := sha256File(destination)
	if err != nil {
		_ = os.Remove(destination)
		return "", fmt.Errorf("hash pre-upgrade backup: %w", err)
	}
	record := sum + "  " + filepath.Base(destination) + "\n"
	if err := os.WriteFile(destination+".sha256", []byte(record), 0o600); err != nil {
		_ = os.Remove(destination)
		_ = os.Remove(destination + ".sha256")
		return "", fmt.Errorf("record backup sha256: %w", err)
	}
	return destination, nil
}
