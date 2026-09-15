package main

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"time"
)

func launchReady(root string) bool {
	if _, err := os.Stat(filepath.Join(root, "launch.py")); err != nil {
		return false
	}
	info, err := os.Stat(pythonExe(root))
	if err != nil || !info.Mode().IsRegular() || info.Size() < 1024 {
		return false
	}
	return runtime.GOOS == "windows" || info.Mode().Perm()&0o111 != 0
}

func pythonExe(root string) string {
	if runtime.GOOS == "windows" {
		return filepath.Join(root, "runtime", "python.exe")
	}
	return filepath.Join(root, "runtime", "bin", "python3")
}

func ensurePortable(locale Locale, status func(string)) error {
	root := portableDir()
	if launchReady(root) {
		if !shouldReplacePortable(root) {
			status(desktopText(locale, copyStatusUsingRuntime))
			return nil
		}
		currentVersion := portableVersion(root)
		bundledVersion, err := bundledPortableVersion()
		if err != nil || bundledVersion == "" {
			bundledVersion = "FreeOS"
		}
		status(desktopText(locale, copyStatusBackupDatabase, bundledVersion))
		if _, err := backupSQLiteBeforeUpgrade(root, currentVersion, bundledVersion); err != nil {
			return fmt.Errorf("%s: %w", desktopText(locale, copyErrorBackupFailed), err)
		}
		status(desktopText(locale, copyStatusUpdatingRuntime))
	} else {
		status(desktopText(locale, copyStatusFirstExtract))
	}
	if err := replacePortable(root); err != nil {
		if launchReady(root) && !isOctopLineageRuntime(root) && installedPortableStamp(root) != "" {
			status(desktopText(locale, copyStatusUpdateFailedKeep))
			return nil
		}
		if isOctopLineageRuntime(root) || (launchReady(root) && installedPortableStamp(root) == "") {
			log.Printf("discarding leftover Octop portable at %s after failed refresh", root)
			_ = os.RemoveAll(root)
		}
		return err
	}
	if runtime.GOOS == "darwin" {
		_ = exec.Command("xattr", "-dr", "com.apple.quarantine", root).Run()
	}
	if !launchReady(root) {
		return fmt.Errorf("portable extract missing launch.py or python under %s", root)
	}
	return nil
}

func replacePortable(root string) error {
	next := root + ".new"
	previous := root + ".previous"
	_ = os.RemoveAll(next)
	if err := extractPortable(next); err != nil {
		_ = os.RemoveAll(next)
		return err
	}
	if !launchReady(next) {
		_ = os.RemoveAll(next)
		return fmt.Errorf("portable extract missing launch.py or python under %s", next)
	}

	_ = os.RemoveAll(previous)
	hadCurrent := false
	if _, err := os.Stat(root); err == nil {
		if err := os.Rename(root, previous); err != nil {
			_ = os.RemoveAll(next)
			return err
		}
		hadCurrent = true
	}
	if err := os.Rename(next, root); err != nil {
		if hadCurrent {
			_ = os.Rename(previous, root)
		}
		return err
	}
	_ = os.RemoveAll(previous)
	return nil
}

const portableStampName = "FREEOS_STAMP"

func shouldReplacePortable(root string) bool {
	bundledStamp := bundledPortableStamp()
	if bundledStamp != "" && installedPortableStamp(root) == bundledStamp {
		return false
	}
	currentVersion := portableVersion(root)
	bundledVersion, err := bundledPortableVersion()
	if err != nil {
		bundledVersion = ""
	}
	if pendingPortableZip() != "" {
		return true
	}
	// Keep a newer in-app FreeOS portable over an older bundled zip.
	// Do not keep Octop 0.9 / 1.0 leftovers — FreeOS is 0.0.1 and must replace them.
	if currentVersion != "" && bundledVersion != "" &&
		compareVersions(bundledVersion, currentVersion) < 0 &&
		!isOctopLineageRuntime(root) {
		return false
	}
	return true
}

func isOctopLineageRuntime(root string) bool {
	if installedPortableStamp(root) != "" {
		return false
	}
	version := portableVersion(root)
	return version != "" && compareVersions(version, "0.9.0") >= 0
}

func installedPortableStamp(root string) string {
	data, err := os.ReadFile(filepath.Join(root, portableStampName))
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(data))
}

func bundledPortableStamp() string {
	if os.Getenv("OCTOP_DESKTOP_PORTABLE_ZIP") == "" && len(embeddedPortable) > 0 {
		reader, err := zip.NewReader(bytes.NewReader(embeddedPortable), int64(len(embeddedPortable)))
		if err != nil {
			return ""
		}
		return stampFromZip(reader.File)
	}
	zipPath, err := bundledPortableZip()
	if err != nil {
		return ""
	}
	reader, err := zip.OpenReader(zipPath)
	if err != nil {
		return ""
	}
	defer reader.Close()
	return stampFromZip(reader.File)
}

func stampFromZip(files []*zip.File) string {
	for _, file := range files {
		if filepath.Base(filepath.FromSlash(file.Name)) != portableStampName {
			continue
		}
		reader, err := file.Open()
		if err != nil {
			return ""
		}
		data, readErr := io.ReadAll(reader)
		reader.Close()
		if readErr != nil {
			return ""
		}
		return strings.TrimSpace(string(data))
	}
	return ""
}

func portableVersion(root string) string {
	version := installedPackageVersion(root)
	data, err := os.ReadFile(filepath.Join(root, "VERSION.txt"))
	if err == nil {
		bundledVersion := versionFromText(string(data))
		if version == "" || compareVersions(bundledVersion, version) > 0 {
			version = bundledVersion
		}
	}
	return version
}

func installedPackageVersion(root string) string {
	matches, _ := filepath.Glob(filepath.Join(root, "packages", "octop-*.dist-info", "METADATA"))
	version := ""
	for _, metadata := range matches {
		data, err := os.ReadFile(metadata)
		if err != nil {
			continue
		}
		value := metadataVersion(string(data))
		if value == "" {
			continue
		}
		if version == "" || compareVersions(value, version) > 0 {
			version = value
		}
	}
	return version
}

func bundledPortableVersion() (string, error) {
	if os.Getenv("OCTOP_DESKTOP_PORTABLE_ZIP") == "" && len(embeddedPortable) > 0 {
		reader, err := zip.NewReader(bytes.NewReader(embeddedPortable), int64(len(embeddedPortable)))
		if err != nil {
			return "", err
		}
		return versionFromZip(reader.File)
	}
	zipPath, err := bundledPortableZip()
	if err != nil {
		return "", err
	}
	reader, err := zip.OpenReader(zipPath)
	if err != nil {
		return "", err
	}
	defer reader.Close()
	return versionFromZip(reader.File)
}

func versionFromZip(files []*zip.File) (string, error) {
	fromFile, err := zipEntryVersion(files, func(name string) bool {
		return filepath.Base(filepath.FromSlash(name)) == "VERSION.txt"
	}, versionFromText)
	if err != nil {
		return "", err
	}
	if fromFile != "" {
		return fromFile, nil
	}
	return zipEntryVersion(files, func(name string) bool {
		rel := filepath.ToSlash(name)
		return strings.Contains(rel, "/octop-") && strings.HasSuffix(rel, ".dist-info/METADATA")
	}, metadataVersion)
}

func zipEntryVersion(files []*zip.File, match func(string) bool, parse func(string) string) (string, error) {
	version := ""
	for _, file := range files {
		if !match(file.Name) {
			continue
		}
		reader, err := file.Open()
		if err != nil {
			return "", err
		}
		data, readErr := io.ReadAll(reader)
		closeErr := reader.Close()
		if readErr != nil {
			return "", readErr
		}
		if closeErr != nil {
			return "", closeErr
		}
		value := parse(string(data))
		if value == "" {
			continue
		}
		if version == "" || compareVersions(value, version) > 0 {
			version = value
		}
	}
	return version, nil
}

func versionFromText(text string) string {
	for _, line := range strings.Split(text, "\n") {
		if value, ok := strings.CutPrefix(strings.TrimSpace(line), "octop_version="); ok {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func metadataVersion(text string) string {
	for _, line := range strings.Split(text, "\n") {
		value, ok := strings.CutPrefix(strings.TrimSpace(line), "Version:")
		if ok {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func compareVersions(left, right string) int {
	leftParts := strings.Split(left, ".")
	rightParts := strings.Split(right, ".")
	count := max(len(leftParts), len(rightParts))
	for index := 0; index < count; index++ {
		var leftPart, rightPart int
		if index < len(leftParts) {
			leftPart = versionPart(leftParts[index])
		}
		if index < len(rightParts) {
			rightPart = versionPart(rightParts[index])
		}
		if leftPart < rightPart {
			return -1
		}
		if leftPart > rightPart {
			return 1
		}
	}
	return 0
}

func versionPart(segment string) int {
	numeric := ""
	for _, ch := range segment {
		if ch < '0' || ch > '9' {
			break
		}
		numeric += string(ch)
	}
	if numeric == "" {
		return 0
	}
	value, _ := strconv.Atoi(numeric)
	return value
}

func pendingPortableZip() string {
	path := filepath.Join(productHome(), "updates", "pending-portable.zip")
	if _, err := os.Stat(path); err != nil {
		return ""
	}
	reader, err := zip.OpenReader(path)
	if err != nil {
		return ""
	}
	defer reader.Close()
	if stampFromZip(reader.File) == "" {
		return ""
	}
	return path
}

func clearPendingPortable() {
	dir := filepath.Join(productHome(), "updates")
	_ = os.Remove(filepath.Join(dir, "pending-portable.zip"))
	_ = os.Remove(filepath.Join(dir, "pending.json"))
}

func extractPortable(root string) error {
	if pending := pendingPortableZip(); pending != "" {
		if err := unzipGreen(pending, root); err != nil {
			return err
		}
		clearPendingPortable()
		return nil
	}
	if os.Getenv("OCTOP_DESKTOP_PORTABLE_ZIP") != "" {
		zipPath, err := bundledPortableZip()
		if err != nil {
			return err
		}
		return unzipGreen(zipPath, root)
	}
	if len(embeddedPortable) > 0 {
		return unzipGreenBytes(embeddedPortable, root)
	}
	zipPath, err := bundledPortableZip()
	if err != nil {
		return err
	}
	return unzipGreen(zipPath, root)
}

func bundledPortableZip() (string, error) {
	if pending := pendingPortableZip(); pending != "" {
		return pending, nil
	}
	if override := os.Getenv("OCTOP_DESKTOP_PORTABLE_ZIP"); override != "" {
		if _, err := os.Stat(override); err != nil {
			return "", fmt.Errorf("bundled portable package: %w", err)
		}
		return override, nil
	}
	exe, err := os.Executable()
	if err != nil {
		return "", err
	}
	dir := filepath.Dir(exe)
	plat := greenPlat()
	names := []string{
		fmt.Sprintf("FreeOS-%s.zip", plat),
	}
	globs := []string{
		"FreeOS-portable-" + plat + "-*.zip",
	}
	searchDirs := []string{
		dir,
		filepath.Join(dir, "..", "Resources"),
	}
	for _, search := range searchDirs {
		search = filepath.Clean(search)
		for _, name := range names {
			legacyPath := filepath.Join(search, name)
			if _, err := os.Stat(legacyPath); err == nil {
				return legacyPath, nil
			}
		}
		for _, pattern := range globs {
			matches, _ := filepath.Glob(filepath.Join(search, pattern))
			if len(matches) > 0 {
				sort.Strings(matches)
				return matches[len(matches)-1], nil
			}
		}
	}
	return "", fmt.Errorf("bundled portable package FreeOS-%s.zip not found beside application", plat)
}

func unzipGreen(zipPath, dest string) error {
	r, err := zip.OpenReader(zipPath)
	if err != nil {
		return err
	}
	defer r.Close()
	return unzipGreenFiles(r.File, dest)
}

func unzipGreenBytes(data []byte, dest string) error {
	r, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return err
	}
	return unzipGreenFiles(r.File, dest)
}

func unzipGreenFiles(files []*zip.File, dest string) error {
	_ = os.RemoveAll(dest)
	if err := os.MkdirAll(dest, 0o755); err != nil {
		return err
	}
	// Zip root is FreeOS-<plat>/… (or legacy Octop-<plat>/) — strip that prefix.
	for _, f := range files {
		name := filepath.ToSlash(strings.ReplaceAll(f.Name, "\\", "/"))
		parts := strings.SplitN(name, "/", 2)
		if len(parts) < 2 {
			continue
		}
		rel := parts[1]
		if rel == "" {
			continue
		}
		target := filepath.Join(dest, filepath.FromSlash(rel))
		if !strings.HasPrefix(target, filepath.Clean(dest)+string(os.PathSeparator)) && target != filepath.Clean(dest) {
			return fmt.Errorf("illegal zip path %s", name)
		}
		if f.FileInfo().IsDir() {
			if err := os.MkdirAll(target, 0o755); err != nil {
				return err
			}
			continue
		}
		if f.Mode()&os.ModeSymlink != 0 {
			rc, err := f.Open()
			if err != nil {
				return err
			}
			linkTarget, err := io.ReadAll(rc)
			rc.Close()
			if err != nil {
				return err
			}
			if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
				return err
			}
			if err := os.Symlink(string(linkTarget), target); err != nil {
				return err
			}
			continue
		}
		if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
			return err
		}
		rc, err := f.Open()
		if err != nil {
			return err
		}
		out, err := os.OpenFile(target, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, f.Mode())
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
	return nil
}

var errForeignHost = errors.New("host is not FreeOS")

type healthPayload struct {
	OK      bool   `json:"ok"`
	Product string `json:"product"`
}

func isFreeOSHealth(body []byte) bool {
	var payload healthPayload
	if json.Unmarshal(body, &payload) != nil {
		return false
	}
	return payload.OK && strings.EqualFold(strings.TrimSpace(payload.Product), "freeos")
}

func probeHealthURL(base string) (reachable bool, freeos bool) {
	resp, err := http.Get(strings.TrimRight(base, "/") + "/api/health")
	if err != nil {
		return false, false
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 500 {
		return false, false
	}
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
	return true, isFreeOSHealth(body)
}

func chooseHostPort(preferred int) int {
	if preferred <= 0 {
		preferred = 8088
	}
	for port := preferred; port < preferred+20; port++ {
		reachable, _ := probeHealthURL(dashboardURL(port))
		if reachable {
			continue
		}
		return port
	}
	return preferred
}

func discardStaleOctopPortable() {
	home := userProfileDir()
	if home == "" {
		return
	}
	legacy := filepath.Join(home, ".octop", "portable")
	if filepath.Clean(legacy) == filepath.Clean(portableDir()) {
		return
	}
	if _, err := os.Stat(legacy); err != nil {
		return
	}
	if installedPortableStamp(legacy) != "" {
		return
	}
	log.Printf("discarding leftover Octop portable at %s", legacy)
	_ = os.RemoveAll(legacy)
}

func waitHealth(locale Locale, base string, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	url := strings.TrimRight(base, "/") + "/api/health"
	var lastErr error
	var lastStatus int
	for time.Now().Before(deadline) {
		resp, err := http.Get(url)
		if err == nil {
			lastStatus = resp.StatusCode
			body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
			resp.Body.Close()
			if resp.StatusCode >= 200 && resp.StatusCode < 500 {
				if isFreeOSHealth(body) {
					return nil
				}
				lastErr = errForeignHost
			} else {
				lastErr = nil
			}
		} else {
			lastErr = err
			lastStatus = 0
		}
		time.Sleep(400 * time.Millisecond)
	}
	return formatHealthWaitError(locale, base, timeout, lastErr, lastStatus)
}

func formatWaitDuration(locale Locale, d time.Duration) string {
	sec := int(d.Round(time.Second) / time.Second)
	if sec < 1 {
		sec = 1
	}
	minutes := sec%60 == 0
	n := sec
	if minutes {
		n = sec / 60
	}
	switch {
	case minutes && n == 1:
		return desktopText(locale, copyWait1Minute)
	case minutes:
		return desktopText(locale, copyWaitNMinutes, n)
	case n == 1:
		return desktopText(locale, copyWait1Second)
	default:
		return desktopText(locale, copyWaitNSeconds, n)
	}
}

func formatHealthWaitError(locale Locale, base string, timeout time.Duration, lastErr error, lastStatus int) error {
	addr := strings.TrimRight(base, "/")
	wait := formatWaitDuration(locale, timeout)
	switch {
	case lastStatus >= 500:
		return fmt.Errorf("%s", desktopText(locale, copyHealthNotReady5xx, wait, addr))
	case errors.Is(lastErr, errForeignHost):
		return fmt.Errorf("%s", desktopText(locale, copyHealthForeignHost, wait, addr))
	case lastErr != nil:
		return fmt.Errorf("%s", desktopText(locale, copyHealthNotReadyConnect, wait, addr))
	default:
		return fmt.Errorf("%s", desktopText(locale, copyHealthNotReady, wait, addr))
	}
}
