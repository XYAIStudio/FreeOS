package main

import (
	"image/png"
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

func TestWindowsAppiconIsFullBleed(t *testing.T) {
	_, file, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("caller")
	}
	path := filepath.Join(filepath.Dir(file), "build", "appicon.png")
	ratio := contentFill(t, path)
	if ratio < 0.80 {
		t.Fatalf("appicon.png content fill %.1f%% is too small for Windows shortcuts", ratio*100)
	}
}

func TestMacosAppiconFollowsDockGrid(t *testing.T) {
	_, file, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("caller")
	}
	path := filepath.Join(filepath.Dir(file), "build", "appicon-macos.png")
	ratio := contentFill(t, path)
	if ratio < 0.75 || ratio > 0.86 {
		t.Fatalf("appicon-macos.png content fill %.1f%% want ~80.5%% (824/1024)", ratio*100)
	}
}

func contentFill(t *testing.T, path string) float64 {
	t.Helper()
	f, err := os.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	img, err := png.Decode(f)
	if err != nil {
		t.Fatal(err)
	}
	b := img.Bounds()
	minX, minY := b.Max.X, b.Max.Y
	maxX, maxY := b.Min.X, b.Min.Y
	for y := b.Min.Y; y < b.Max.Y; y++ {
		for x := b.Min.X; x < b.Max.X; x++ {
			r, g, bl, a := img.At(x, y).RGBA()
			if a < 16<<8 {
				continue
			}
			if r>>8 > 245 && g>>8 > 245 && bl>>8 > 245 {
				continue
			}
			if x < minX {
				minX = x
			}
			if y < minY {
				minY = y
			}
			if x > maxX {
				maxX = x
			}
			if y > maxY {
				maxY = y
			}
		}
	}
	if maxX < minX {
		t.Fatalf("%s has no visible artwork", path)
	}
	w := float64(maxX - minX + 1)
	return w / float64(b.Dx())
}
