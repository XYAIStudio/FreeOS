package main

import (
	"runtime"
	"strings"
	"testing"
)

func TestMergeLaunchEnvOverridesParentDesktopFlags(t *testing.T) {
	got := mergeLaunchEnv(
		[]string{"PATH=/bin", "OCTOP_DESKTOP=0", "FREEOS_DESKTOP=", "OCTOP_GREEN_PACKAGES="},
		map[string]string{
			"OCTOP_DESKTOP":        "1",
			"FREEOS_DESKTOP":       "1",
			"OCTOP_GREEN_PACKAGES": `/opt/freeos/packages`,
		},
	)
	env := map[string]string{}
	counts := map[string]int{}
	for _, pair := range got {
		key, value, ok := strings.Cut(pair, "=")
		if !ok {
			t.Fatalf("bad pair %q", pair)
		}
		lk := key
		if runtime.GOOS == "windows" {
			lk = strings.ToLower(key)
		}
		counts[lk]++
		env[lk] = value
	}
	if counts["OCTOP_DESKTOP"] != 1 && counts["octop_desktop"] != 1 {
		t.Fatalf("duplicate or missing OCTOP_DESKTOP: %+v", got)
	}
	desktop := env["OCTOP_DESKTOP"]
	if desktop == "" {
		desktop = env["octop_desktop"]
	}
	if desktop != "1" {
		t.Fatalf("OCTOP_DESKTOP=%q, want 1 in %v", desktop, got)
	}
	if env["FREEOS_DESKTOP"] != "1" && env["freeos_desktop"] != "1" {
		t.Fatalf("FREEOS_DESKTOP not overridden: %v", got)
	}
	if env["OCTOP_GREEN_PACKAGES"] == "" && env["octop_green_packages"] == "" {
		t.Fatalf("OCTOP_GREEN_PACKAGES empty: %v", got)
	}
}
