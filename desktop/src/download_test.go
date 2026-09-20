package main

import (
	"archive/zip"
	"errors"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"syscall"
	"testing"
	"time"
)

func TestMain(m *testing.M) {
	// Tests that need a Windows-style install stamp set OCTOP_DESKTOP_INSTALL_STAMP_FILE
	// themselves. Default empty so leftover files beside the test binary cannot
	// force a refresh.
	if os.Getenv("OCTOP_DESKTOP_INSTALL_STAMP_FILE") == "" {
		_ = os.Setenv("OCTOP_DESKTOP_INSTALL_STAMP_FILE", "")
	}
	os.Exit(m.Run())
}

func TestEnsurePortableUsesEmbeddedPackage(t *testing.T) {
	home := t.TempDir()
	t.Setenv("OCTOP_HOME", home)
	t.Setenv("OCTOP_DESKTOP_PORTABLE_ZIP", "")

	zipPath := filepath.Join(t.TempDir(), "embedded.zip")
	writeTestGreenZip(t, zipPath, "1.0.0")
	data, err := os.ReadFile(zipPath)
	if err != nil {
		t.Fatal(err)
	}
	prev := embeddedPortable
	embeddedPortable = data
	t.Cleanup(func() { embeddedPortable = prev })

	if err := ensurePortable(LocaleZH, func(string) {}); err != nil {
		t.Fatal(err)
	}
	if !launchReady(portableDir()) {
		t.Fatal("embedded package was not extracted into the portable directory")
	}
}

func TestEnsurePortableUsesBundledPackage(t *testing.T) {
	home := t.TempDir()
	t.Setenv("OCTOP_HOME", home)

	zipPath := filepath.Join(t.TempDir(), "Octop-"+greenPlat()+".zip")
	t.Setenv("OCTOP_DESKTOP_PORTABLE_ZIP", zipPath)
	writeTestGreenZip(t, zipPath, "1.0.0")

	var statuses []string
	err := ensurePortable(LocaleZH, func(status string) {
		statuses = append(statuses, status)
	})
	if err != nil {
		t.Fatal(err)
	}
	if !launchReady(portableDir()) {
		t.Fatal("local package was not extracted into the portable directory")
	}
	if len(statuses) == 0 || statuses[0] != "首次启动，正在解压内置运行环境…" {
		t.Fatalf("unexpected statuses: %v", statuses)
	}
	if _, err := os.Stat(zipPath); err != nil {
		t.Fatalf("bundled package should be retained: %v", err)
	}
}

func TestEnsurePortableReplacesOlderRuntime(t *testing.T) {
	home := t.TempDir()
	t.Setenv("OCTOP_HOME", home)
	root := portableDir()

	oldZip := filepath.Join(t.TempDir(), "old.zip")
	writeTestGreenZip(t, oldZip, "0.9.31")
	if err := unzipGreen(oldZip, root); err != nil {
		t.Fatal(err)
	}
	stale := filepath.Join(root, "stale.txt")
	if err := os.WriteFile(stale, []byte("old"), 0o644); err != nil {
		t.Fatal(err)
	}

	newZip := filepath.Join(t.TempDir(), "new.zip")
	writeTestGreenZip(t, newZip, "0.9.32")
	t.Setenv("OCTOP_DESKTOP_PORTABLE_ZIP", newZip)
	var statuses []string
	if err := ensurePortable(LocaleZH, func(status string) { statuses = append(statuses, status) }); err != nil {
		t.Fatal(err)
	}

	if got := portableVersion(root); got != "0.9.32" {
		t.Fatalf("portable version = %q, want 0.9.32", got)
	}
	if _, err := os.Stat(stale); !os.IsNotExist(err) {
		t.Fatalf("old runtime was not replaced: %v", err)
	}
	if len(statuses) < 2 ||
		statuses[0] != "发现客户端新版 0.9.32，正在备份数据库…" ||
		statuses[1] != "正在更新内置运行环境…" {
		t.Fatalf("unexpected statuses: %v", statuses)
	}
}

func TestEnsurePortableUpgradesBundledVersionAfterDatabaseBackup(t *testing.T) {
	home := t.TempDir()
	t.Setenv("OCTOP_HOME", home)
	root := portableDir()

	oldZip := filepath.Join(t.TempDir(), "old.zip")
	writeTestGreenZip(t, oldZip, "0.9.29")
	if err := unzipGreen(oldZip, root); err != nil {
		t.Fatal(err)
	}
	database := filepath.Join(home, "octop.db")
	if err := os.WriteFile(database, []byte("database"), 0o600); err != nil {
		t.Fatal(err)
	}

	newZip := filepath.Join(t.TempDir(), "new.zip")
	writeTestGreenZip(t, newZip, "0.9.32")
	t.Setenv("OCTOP_DESKTOP_PORTABLE_ZIP", newZip)

	previousBackup := runSQLiteBackup
	runSQLiteBackup = func(_ string, source string, destination string) error {
		if source != database {
			t.Fatalf("backup source = %q, want %q", source, database)
		}
		return os.WriteFile(destination, []byte("backup"), 0o600)
	}
	t.Cleanup(func() { runSQLiteBackup = previousBackup })

	if err := ensurePortable(LocaleZH, func(string) {}); err != nil {
		t.Fatal(err)
	}
	if got := portableVersion(root); got != "0.9.32" {
		t.Fatalf("portable version = %q, want 0.9.32", got)
	}
	backups, err := filepath.Glob(filepath.Join(home, "backups", "octop-desktop-pre-upgrade-*.db"))
	if err != nil || len(backups) != 1 {
		t.Fatalf("upgrade backup = %v, err = %v", backups, err)
	}
}

func TestEnsurePortableKeepsRuntimeWhenDatabaseBackupFails(t *testing.T) {
	home := t.TempDir()
	t.Setenv("OCTOP_HOME", home)
	root := portableDir()

	oldZip := filepath.Join(t.TempDir(), "old.zip")
	writeTestGreenZip(t, oldZip, "0.9.29")
	if err := unzipGreen(oldZip, root); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(home, "octop.db"), []byte("database"), 0o600); err != nil {
		t.Fatal(err)
	}
	newZip := filepath.Join(t.TempDir(), "new.zip")
	writeTestGreenZip(t, newZip, "0.9.32")
	t.Setenv("OCTOP_DESKTOP_PORTABLE_ZIP", newZip)

	previousBackup := runSQLiteBackup
	runSQLiteBackup = func(_, _, _ string) error { return errors.New("backup unavailable") }
	t.Cleanup(func() { runSQLiteBackup = previousBackup })

	if err := ensurePortable(LocaleZH, func(string) {}); err == nil {
		t.Fatal("backup failure should abort the runtime upgrade")
	}
	if got := portableVersion(root); got != "0.9.29" {
		t.Fatalf("portable version = %q, want preserved 0.9.29", got)
	}
}

func TestEnsurePortableKeepsNewerExistingRuntime(t *testing.T) {
	home := t.TempDir()
	t.Setenv("OCTOP_HOME", home)
	root := portableDir()

	newZip := filepath.Join(t.TempDir(), "new.zip")
	writeTestGreenZip(t, newZip, "0.0.2")
	if err := unzipGreen(newZip, root); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(
		filepath.Join(root, "VERSION.txt"),
		[]byte("octop_version=0.0.1\n"),
		0o644,
	); err != nil {
		t.Fatal(err)
	}
	sentinel := filepath.Join(root, "keep.txt")
	if err := os.WriteFile(sentinel, []byte("keep"), 0o644); err != nil {
		t.Fatal(err)
	}

	oldZip := filepath.Join(t.TempDir(), "old.zip")
	writeTestGreenZip(t, oldZip, "0.0.1")
	t.Setenv("OCTOP_DESKTOP_PORTABLE_ZIP", oldZip)
	if err := ensurePortable(LocaleZH, func(string) {}); err != nil {
		t.Fatal(err)
	}

	if got := portableVersion(root); got != "0.0.2" {
		t.Fatalf("portable version = %q, want 0.0.2", got)
	}
	if _, err := os.Stat(sentinel); err != nil {
		t.Fatalf("newer runtime was unexpectedly replaced: %v", err)
	}
}

func TestEnsurePortableAppliesPendingFreeOSZip(t *testing.T) {
	home := t.TempDir()
	t.Setenv("OCTOP_HOME", home)
	root := portableDir()

	oldZip := filepath.Join(t.TempDir(), "old.zip")
	writeTestGreenZip(t, oldZip, "0.0.1")
	if err := unzipGreen(oldZip, root); err != nil {
		t.Fatal(err)
	}

	pendingDir := filepath.Join(home, "updates")
	if err := os.MkdirAll(pendingDir, 0o755); err != nil {
		t.Fatal(err)
	}
	pending := filepath.Join(pendingDir, "pending-portable.zip")
	writeTestGreenZipWithStamp(t, pending, "0.0.2", "github-pending")
	if err := os.WriteFile(filepath.Join(pendingDir, "pending.json"), []byte(`{"version":"0.0.2"}`), 0o644); err != nil {
		t.Fatal(err)
	}

	if err := ensurePortable(LocaleZH, func(string) {}); err != nil {
		t.Fatal(err)
	}
	if got := portableVersion(root); got != "0.0.2" {
		t.Fatalf("portable version = %q, want 0.0.2", got)
	}
	if got := installedPortableStamp(root); got != "github-pending" {
		t.Fatalf("stamp = %q, want github-pending", got)
	}
	if _, err := os.Stat(pending); !os.IsNotExist(err) {
		t.Fatalf("pending zip should be consumed: %v", err)
	}
}

func TestEnsurePortableReplacesOctopLineageWithFreeOS(t *testing.T) {
	home := t.TempDir()
	t.Setenv("OCTOP_HOME", home)
	root := portableDir()

	oldZip := filepath.Join(t.TempDir(), "octop.zip")
	writeTestGreenZipNoStamp(t, oldZip, "1.0.0")
	if err := unzipGreen(oldZip, root); err != nil {
		t.Fatal(err)
	}
	stale := filepath.Join(root, "stale-octop.txt")
	if err := os.WriteFile(stale, []byte("octop"), 0o644); err != nil {
		t.Fatal(err)
	}

	newZip := filepath.Join(t.TempDir(), "freeos.zip")
	writeTestGreenZip(t, newZip, "0.0.1")
	t.Setenv("OCTOP_DESKTOP_PORTABLE_ZIP", newZip)
	if err := ensurePortable(LocaleZH, func(string) {}); err != nil {
		t.Fatal(err)
	}
	if got := portableVersion(root); got != "0.0.1" {
		t.Fatalf("portable version = %q, want 0.0.1", got)
	}
	if _, err := os.Stat(stale); !os.IsNotExist(err) {
		t.Fatalf("Octop runtime was not replaced: %v", err)
	}
	if installedPortableStamp(root) == "" {
		t.Fatal("replaced runtime should carry FREEOS_STAMP")
	}
}

func TestEnsurePortableAppliesPendingEvenWhenBundledStampMatches(t *testing.T) {
	home := t.TempDir()
	t.Setenv("OCTOP_HOME", home)
	t.Setenv("OCTOP_DESKTOP_INSTALL_STAMP_FILE", "")
	root := portableDir()

	currentZip := filepath.Join(t.TempDir(), "current.zip")
	writeTestGreenZipWithStamp(t, currentZip, "0.0.1", "same-stamp")
	if err := unzipGreen(currentZip, root); err != nil {
		t.Fatal(err)
	}
	t.Setenv("OCTOP_DESKTOP_PORTABLE_ZIP", currentZip)

	pendingDir := filepath.Join(home, "updates")
	if err := os.MkdirAll(pendingDir, 0o755); err != nil {
		t.Fatal(err)
	}
	pending := filepath.Join(pendingDir, "pending-portable.zip")
	writeTestGreenZipWithStamp(t, pending, "0.0.2", "pending-stamp")

	if err := ensurePortable(LocaleZH, func(string) {}); err != nil {
		t.Fatal(err)
	}
	if got := portableVersion(root); got != "0.0.2" {
		t.Fatalf("portable version = %q, want 0.0.2 from pending zip", got)
	}
	if got := installedPortableStamp(root); got != "pending-stamp" {
		t.Fatalf("stamp = %q, want pending-stamp", got)
	}
}

func TestEnsurePortableReinstallStampRefreshesMatchingZip(t *testing.T) {
	home := t.TempDir()
	t.Setenv("OCTOP_HOME", home)
	root := portableDir()

	zipPath := filepath.Join(t.TempDir(), "same.zip")
	writeTestGreenZipWithStamp(t, zipPath, "0.0.4", "same-payload")
	if err := unzipGreen(zipPath, root); err != nil {
		t.Fatal(err)
	}
	stale := filepath.Join(root, "old-dashboard.txt")
	if err := os.WriteFile(stale, []byte("stale-ui"), 0o644); err != nil {
		t.Fatal(err)
	}

	stampFile := filepath.Join(t.TempDir(), installStampName)
	if err := os.WriteFile(stampFile, []byte("setup-run-2\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	t.Setenv("OCTOP_DESKTOP_INSTALL_STAMP_FILE", stampFile)
	t.Setenv("OCTOP_DESKTOP_PORTABLE_ZIP", zipPath)

	if err := ensurePortable(LocaleZH, func(string) {}); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(stale); !os.IsNotExist(err) {
		t.Fatalf("reinstall did not replace extracted portable: %v", err)
	}
	if got := appliedInstallStamp(root); got != "setup-run-2" {
		t.Fatalf("applied install stamp = %q, want setup-run-2", got)
	}

	keep := filepath.Join(root, "keep-after-match.txt")
	if err := os.WriteFile(keep, []byte("keep"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := ensurePortable(LocaleZH, func(string) {}); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(keep); err != nil {
		t.Fatalf("second launch should skip extract when install stamp matches: %v", err)
	}
}

func TestEnsurePortableClearedRuntimeStampRefreshesSameVersion(t *testing.T) {
	home := t.TempDir()
	t.Setenv("OCTOP_HOME", home)
	t.Setenv("OCTOP_DESKTOP_INSTALL_STAMP_FILE", "")
	root := portableDir()

	zipPath := filepath.Join(t.TempDir(), "v004.zip")
	writeTestGreenZipWithStamp(t, zipPath, "0.0.4", "build-old")
	if err := unzipGreen(zipPath, root); err != nil {
		t.Fatal(err)
	}
	stale := filepath.Join(root, "index.DfMCjOvx.js")
	if err := os.WriteFile(stale, []byte("old-dashboard"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.Remove(filepath.Join(root, portableStampName)); err != nil {
		t.Fatal(err)
	}

	newZip := filepath.Join(t.TempDir(), "v004-new.zip")
	writeTestGreenZipWithStamp(t, newZip, "0.0.4", "build-new")
	t.Setenv("OCTOP_DESKTOP_PORTABLE_ZIP", newZip)
	if err := ensurePortable(LocaleZH, func(string) {}); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(stale); !os.IsNotExist(err) {
		t.Fatalf("cleared FREEOS_STAMP should force same-version refresh: %v", err)
	}
	if got := installedPortableStamp(root); got != "build-new" {
		t.Fatalf("stamp = %q, want build-new", got)
	}
}

func TestEnsurePortableReplacesSameVersionWhenStampChanges(t *testing.T) {
	home := t.TempDir()
	t.Setenv("OCTOP_HOME", home)
	root := portableDir()

	oldZip := filepath.Join(t.TempDir(), "old-001.zip")
	writeTestGreenZipWithStamp(t, oldZip, "0.0.1", "build-a")
	if err := unzipGreen(oldZip, root); err != nil {
		t.Fatal(err)
	}
	stale := filepath.Join(root, "old-dashboard.txt")
	if err := os.WriteFile(stale, []byte("octop-login"), 0o644); err != nil {
		t.Fatal(err)
	}

	newZip := filepath.Join(t.TempDir(), "new-001.zip")
	writeTestGreenZipWithStamp(t, newZip, "0.0.1", "build-b")
	t.Setenv("OCTOP_DESKTOP_PORTABLE_ZIP", newZip)
	if err := ensurePortable(LocaleZH, func(string) {}); err != nil {
		t.Fatal(err)
	}
	if got := portableVersion(root); got != "0.0.1" {
		t.Fatalf("portable version = %q, want 0.0.1", got)
	}
	if _, err := os.Stat(stale); !os.IsNotExist(err) {
		t.Fatalf("same-version rebuild was not replaced: %v", err)
	}
	if got := installedPortableStamp(root); got != "build-b" {
		t.Fatalf("stamp = %q, want build-b", got)
	}
}

func TestIsBusyPathError(t *testing.T) {
	if isBusyPathError(nil) {
		t.Fatal("nil must not look busy")
	}
	if !isBusyPathError(errors.New("The process cannot access the file because it is being used by another process")) {
		t.Fatal("Windows sharing-violation text should look busy")
	}
	if !isBusyPathError(syscall.Errno(32)) {
		t.Fatal("ERROR_SHARING_VIOLATION should look busy")
	}
	if isBusyPathError(errors.New("no such file or directory")) {
		t.Fatal("missing path is not a busy lock")
	}
}

func TestReplacePortableFallsBackToInPlaceWhenRenameBusy(t *testing.T) {
	home := t.TempDir()
	t.Setenv("OCTOP_HOME", home)
	root := portableDir()

	oldZip := filepath.Join(t.TempDir(), "old.zip")
	writeTestGreenZip(t, oldZip, "0.0.1")
	if err := unzipGreen(oldZip, root); err != nil {
		t.Fatal(err)
	}
	stale := filepath.Join(root, "stale.txt")
	if err := os.WriteFile(stale, []byte("old"), 0o644); err != nil {
		t.Fatal(err)
	}

	newZip := filepath.Join(t.TempDir(), "new.zip")
	writeTestGreenZip(t, newZip, "0.0.2")
	t.Setenv("OCTOP_DESKTOP_PORTABLE_ZIP", newZip)

	stopped := 0
	prevStop := stopPortableHoldersFn
	stopPortableHoldersFn = func(path string) {
		stopped++
		if path != root {
			t.Fatalf("stopPortableHolders path = %q, want %q", path, root)
		}
	}
	prevRename := renamePortableImpl
	renamePortableImpl = func(source, target string) error {
		if source == root && strings.HasSuffix(target, ".previous") {
			return errors.New("The process cannot access the file because it is being used by another process")
		}
		return os.Rename(source, target)
	}
	t.Cleanup(func() {
		stopPortableHoldersFn = prevStop
		renamePortableImpl = prevRename
	})

	if err := ensurePortable(LocaleZH, func(string) {}); err != nil {
		t.Fatal(err)
	}
	if stopped == 0 {
		t.Fatal("expected leftover portable holders to be stopped before in-place refresh")
	}
	if got := portableVersion(root); got != "0.0.2" {
		t.Fatalf("portable version = %q, want 0.0.2 after in-place refresh", got)
	}
	if _, err := os.Stat(stale); !os.IsNotExist(err) {
		t.Fatalf("stale file should be pruned during in-place refresh: %v", err)
	}
	if _, err := os.Stat(root + ".new"); !os.IsNotExist(err) {
		t.Fatalf("temporary .new tree should be removed: %v", err)
	}
	if _, err := os.Stat(root + ".previous"); !os.IsNotExist(err) {
		t.Fatalf("failed rename should not leave portable.previous: %v", err)
	}
	if !launchReady(root) {
		t.Fatal("in-place refresh should leave a launch-ready runtime")
	}
}

func TestEnsurePortableKeepsCurrentRuntimeWhenReplacementIsInvalid(t *testing.T) {
	home := t.TempDir()
	t.Setenv("OCTOP_HOME", home)
	root := portableDir()

	currentZip := filepath.Join(t.TempDir(), "current.zip")
	writeTestGreenZip(t, currentZip, "0.0.1")
	if err := unzipGreen(currentZip, root); err != nil {
		t.Fatal(err)
	}

	invalidZip := filepath.Join(t.TempDir(), "invalid.zip")
	writeVersionOnlyZip(t, invalidZip, "0.0.2")
	t.Setenv("OCTOP_DESKTOP_PORTABLE_ZIP", invalidZip)
	var statuses []string
	if err := ensurePortable(LocaleZH, func(status string) { statuses = append(statuses, status) }); err != nil {
		t.Fatalf("existing FreeOS runtime should still boot after a failed replacement: %v", err)
	}

	if !launchReady(root) {
		t.Fatal("current runtime should remain usable after replacement failure")
	}
	if got := portableVersion(root); got != "0.0.1" {
		t.Fatalf("portable version = %q, want 0.0.1", got)
	}
	if installedPortableStamp(root) == "" {
		t.Fatal("kept runtime should still carry FREEOS_STAMP")
	}
	if len(statuses) == 0 || statuses[len(statuses)-1] != "更新内置运行环境失败，继续使用已有运行环境…" {
		t.Fatalf("unexpected statuses: %v", statuses)
	}
}

func TestEnsurePortableDoesNotKeepOctopAfterFailedRefresh(t *testing.T) {
	home := t.TempDir()
	t.Setenv("OCTOP_HOME", home)
	root := portableDir()

	currentZip := filepath.Join(t.TempDir(), "current.zip")
	writeTestGreenZipNoStamp(t, currentZip, "0.9.31")
	if err := unzipGreen(currentZip, root); err != nil {
		t.Fatal(err)
	}

	invalidZip := filepath.Join(t.TempDir(), "invalid.zip")
	writeVersionOnlyZip(t, invalidZip, "0.0.1")
	t.Setenv("OCTOP_DESKTOP_PORTABLE_ZIP", invalidZip)
	if err := ensurePortable(LocaleZH, func(string) {}); err == nil {
		t.Fatal("Octop leftover should not be kept after a failed FreeOS refresh")
	}
	if launchReady(root) {
		t.Fatal("Octop leftover portable should have been discarded")
	}
}

func TestEnsurePortableReplacesLegacyRuntimeWithoutVersionFiles(t *testing.T) {
	home := t.TempDir()
	t.Setenv("OCTOP_HOME", home)
	root := portableDir()

	oldZip := filepath.Join(t.TempDir(), "old.zip")
	writeTestGreenZip(t, oldZip, "0.9.31")
	if err := unzipGreen(oldZip, root); err != nil {
		t.Fatal(err)
	}
	if err := os.Remove(filepath.Join(root, "VERSION.txt")); err != nil {
		t.Fatal(err)
	}
	if err := os.RemoveAll(filepath.Join(root, "packages")); err != nil {
		t.Fatal(err)
	}

	newZip := filepath.Join(t.TempDir(), "new.zip")
	writeTestGreenZip(t, newZip, "0.9.32")
	t.Setenv("OCTOP_DESKTOP_PORTABLE_ZIP", newZip)
	if err := ensurePortable(LocaleZH, func(string) {}); err != nil {
		t.Fatal(err)
	}
	if got := portableVersion(root); got != "0.9.32" {
		t.Fatalf("portable version = %q, want 0.9.32", got)
	}
}

func TestBundledPortableVersionFallsBackToMetadata(t *testing.T) {
	zipPath := filepath.Join(t.TempDir(), "meta-only.zip")
	writeMetadataOnlyZip(t, zipPath, "0.9.32")
	t.Setenv("OCTOP_DESKTOP_PORTABLE_ZIP", zipPath)
	got, err := bundledPortableVersion()
	if err != nil {
		t.Fatal(err)
	}
	if got != "0.9.32" {
		t.Fatalf("bundled version = %q, want 0.9.32", got)
	}
}

func TestCompareVersions(t *testing.T) {
	for _, test := range []struct {
		left, right string
		want        int
	}{
		{"0.9.32", "0.9.31", 1},
		{"0.9.32", "0.9.32", 0},
		{"0.9.31", "0.9.32", -1},
		{"1.0", "1.0.0", 0},
		{"0.9.32rc1", "0.9.31", 1},
	} {
		if got := compareVersions(test.left, test.right); got != test.want {
			t.Fatalf("compareVersions(%q, %q) = %d, want %d", test.left, test.right, got, test.want)
		}
	}
}

func TestBundledPortableZipRequiresMatchingPackage(t *testing.T) {
	t.Setenv("OCTOP_DESKTOP_PORTABLE_ZIP", filepath.Join(t.TempDir(), "missing.zip"))
	if _, err := bundledPortableZip(); err == nil {
		t.Fatal("missing bundled package should fail")
	}
}

func TestLaunchReadyRejectsFlattenedPythonSymlink(t *testing.T) {
	home := t.TempDir()
	t.Setenv("OCTOP_HOME", home)
	root := portableDir()
	if err := os.MkdirAll(filepath.Join(root, "runtime", "bin"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "launch.py"), []byte("test"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "runtime", "bin", "python3"), []byte("python3.12"), 0o755); err != nil {
		t.Fatal(err)
	}
	if launchReady(root) {
		t.Fatal("flattened Python symlink must not be treated as a ready runtime")
	}
}

func TestFormatHealthWaitErrorIsActionableChinese(t *testing.T) {
	err := formatHealthWaitError(LocaleZH, "http://127.0.0.1:8088/", time.Minute, errors.New("connection refused"), 0)
	if err == nil {
		t.Fatal("expected an error")
	}
	msg := err.Error()
	for _, needle := range []string{
		"FreeOS 服务未在",
		"1 分钟",
		"http://127.0.0.1:8088",
		"请确认",
	} {
		if !strings.Contains(msg, needle) {
			t.Fatalf("friendly health error missing %q: %s", needle, msg)
		}
	}
	if strings.Contains(msg, "/api/health") {
		t.Fatalf("user-facing status should not expose the health path: %s", msg)
	}
	if strings.Contains(msg, "did not become healthy") {
		t.Fatalf("should not use the old English diagnostic: %s", msg)
	}
}

func TestFormatHealthWaitErrorUsesEnglishWhenLocaleIsEn(t *testing.T) {
	msg := formatHealthWaitError(LocaleEN, "http://127.0.0.1:8088", time.Minute, errors.New("connection refused"), 0).Error()
	for _, needle := range []string{
		"FreeOS did not become ready within",
		"1 minute",
		"http://127.0.0.1:8088",
		"make sure FreeOS is running",
	} {
		if !strings.Contains(msg, needle) {
			t.Fatalf("English health error missing %q: %s", needle, msg)
		}
	}
	if strings.Contains(msg, "服务未在") || strings.Contains(msg, "请确认") {
		t.Fatalf("English locale should not use Chinese splash copy: %s", msg)
	}
}

func TestFormatHealthWaitErrorUsesServiceNotReadyHintOn5xx(t *testing.T) {
	zh := formatHealthWaitError(LocaleZH, "http://127.0.0.1:8088", 2*time.Minute, nil, 503).Error()
	if !strings.Contains(zh, "2 分钟") || !strings.Contains(zh, "尚未就绪") {
		t.Fatalf("zh 5xx hint: %s", zh)
	}
	en := formatHealthWaitError(LocaleEN, "http://127.0.0.1:8088", 2*time.Minute, nil, 503).Error()
	if !strings.Contains(en, "2 minutes") || !strings.Contains(en, "not ready yet") {
		t.Fatalf("en 5xx hint: %s", en)
	}
}

func TestWaitHealthSucceedsOnOK(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ok":true,"product":"freeos"}`))
	}))
	t.Cleanup(srv.Close)
	if err := waitHealth(LocaleZH, srv.URL, time.Second); err != nil {
		t.Fatal(err)
	}
}

func TestWaitHealthRejectsOctopPayload(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ok":true}`))
	}))
	t.Cleanup(srv.Close)
	err := waitHealth(LocaleEN, srv.URL, 80*time.Millisecond)
	if err == nil {
		t.Fatal("legacy Octop health should not count as ready")
	}
	if !strings.Contains(err.Error(), "not FreeOS") {
		t.Fatalf("foreign host error = %v", err)
	}
}

func TestChooseHostPortSkipsOccupied(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ok":true}`))
	}))
	t.Cleanup(srv.Close)
	addr, ok := srv.Listener.Addr().(*net.TCPAddr)
	if !ok {
		t.Fatal("expected tcp addr")
	}
	got := chooseHostPort(addr.Port)
	if got == addr.Port {
		t.Fatalf("chooseHostPort returned occupied port %d", got)
	}
}

func TestIsFreeOSHealth(t *testing.T) {
	if !isFreeOSHealth([]byte(`{"ok":true,"product":"FreeOS"}`)) {
		t.Fatal("expected FreeOS health")
	}
	if isFreeOSHealth([]byte(`{"ok":true}`)) {
		t.Fatal("Octop payload must not look like FreeOS")
	}
	if isFreeOSHealth([]byte(`not-json`)) {
		t.Fatal("garbage must not look like FreeOS")
	}
}

func TestDiscardStaleOctopPortable(t *testing.T) {
	root := t.TempDir()
	t.Setenv("HOME", root)
	t.Setenv("USERPROFILE", root)
	t.Setenv("FREEOS_HOME", filepath.Join(root, ".freeos"))
	t.Setenv("OCTOP_HOME", "")
	legacy := filepath.Join(root, ".octop", "portable")
	oldZip := filepath.Join(t.TempDir(), "octop.zip")
	writeTestGreenZipNoStamp(t, oldZip, "1.0.0")
	if err := unzipGreen(oldZip, legacy); err != nil {
		t.Fatal(err)
	}
	if !launchReady(legacy) {
		t.Fatal("fixture should be launch-ready")
	}
	discardStaleOctopPortable()
	if _, err := os.Stat(legacy); !os.IsNotExist(err) {
		t.Fatalf("stale Octop portable still present: %v", err)
	}
}

func TestWaitHealthTimesOutWithFriendlyMessage(t *testing.T) {
	err := waitHealth(LocaleEN, "http://127.0.0.1:1", 50*time.Millisecond)
	if err == nil {
		t.Fatal("closed port should time out")
	}
	if strings.Contains(err.Error(), "did not become healthy") {
		t.Fatalf("should not use the old English diagnostic: %s", err)
	}
	if !strings.Contains(err.Error(), "FreeOS did not become ready within") {
		t.Fatalf("timeout should follow the desktop locale: %s", err)
	}
}

func writeTestGreenZip(t *testing.T, path, version string) {
	t.Helper()
	writeTestGreenZipWithStamp(t, path, version, "stamp-"+version)
}

func writeTestGreenZipNoStamp(t *testing.T, path, version string) {
	t.Helper()
	writeTestGreenZipWithStamp(t, path, version, "")
}

func writeTestGreenZipWithStamp(t *testing.T, path, version, stamp string) {
	t.Helper()
	f, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	w := zip.NewWriter(f)
	files := []string{
		"Octop-test/launch.py",
		"Octop-test/VERSION.txt",
		"Octop-test/packages/octop-" + version + ".dist-info/METADATA",
	}
	if stamp != "" {
		files = append(files, "Octop-test/"+portableStampName)
	}
	if runtime.GOOS == "windows" {
		files = append(files, "Octop-test/runtime/python.exe")
	} else {
		files = append(files,
			"Octop-test/runtime/bin/python3",
			"Octop-test/runtime/bin/python3.12",
		)
	}
	for _, name := range files {
		header := &zip.FileHeader{Name: name, Method: zip.Store}
		content := []byte("test executable payload")
		if strings.HasSuffix(name, "/VERSION.txt") {
			content = []byte("platform=test\noctop_version=" + version + "\n")
		} else if strings.HasSuffix(name, "/"+portableStampName) {
			content = []byte(stamp + "\n")
		} else if strings.HasSuffix(name, "/METADATA") {
			content = []byte("Name: octop\nVersion: " + version + "\n")
		} else if strings.HasSuffix(name, "/python3") {
			header.SetMode(os.ModeSymlink | 0o755)
			content = []byte("python3.12")
		} else {
			header.SetMode(0o755)
			if strings.HasSuffix(name, "/python3.12") || strings.HasSuffix(name, "/python.exe") {
				content = make([]byte, 2048)
			}
		}
		entry, err := w.CreateHeader(header)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := entry.Write(content); err != nil {
			t.Fatal(err)
		}
	}
	if err := w.Close(); err != nil {
		t.Fatal(err)
	}
	if err := f.Close(); err != nil {
		t.Fatal(err)
	}
}

func writeMetadataOnlyZip(t *testing.T, path, version string) {
	t.Helper()
	f, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	w := zip.NewWriter(f)
	entry, err := w.Create("Octop-test/packages/octop-" + version + ".dist-info/METADATA")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := entry.Write([]byte("Name: octop\nVersion: " + version + "\n")); err != nil {
		t.Fatal(err)
	}
	if err := w.Close(); err != nil {
		t.Fatal(err)
	}
	if err := f.Close(); err != nil {
		t.Fatal(err)
	}
}

func writeVersionOnlyZip(t *testing.T, path, version string) {
	t.Helper()
	f, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	w := zip.NewWriter(f)
	entry, err := w.Create("Octop-test/VERSION.txt")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := entry.Write([]byte("octop_version=" + version + "\n")); err != nil {
		t.Fatal(err)
	}
	if err := w.Close(); err != nil {
		t.Fatal(err)
	}
	if err := f.Close(); err != nil {
		t.Fatal(err)
	}
}
