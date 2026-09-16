package main

import (
	"encoding/base64"
	"strings"
	"testing"
)

func TestFolderPickerWindowsScriptUsesUTF8Base64(t *testing.T) {
	script := folderPickerWindowsScript()
	if !strings.Contains(script, "[System.Text.Encoding]::UTF8.GetBytes") {
		t.Fatal("Windows folder picker must emit UTF-8 bytes, not ACP/GBK stdout")
	}
	if !strings.Contains(script, "[Convert]::ToBase64String") {
		t.Fatal("Windows folder picker must base64 the UTF-8 path")
	}
}

func TestDecodeFolderPickerOutputPrefersUTF8Base64(t *testing.T) {
	path := `D:\项目\资料`
	encoded := base64.StdEncoding.EncodeToString([]byte(path))
	got, err := decodeFolderPickerOutput([]byte(encoded + "\r\n"))
	if err != nil {
		t.Fatal(err)
	}
	if got != path {
		t.Fatalf("got %q want %q", got, path)
	}
}

func TestDecodeFolderPickerOutputReadsUTF16LE(t *testing.T) {
	path := `D:\项目`
	encoded := base64.StdEncoding.EncodeToString([]byte(path))
	utf16 := make([]byte, 0, 2+len(encoded)*2)
	utf16 = append(utf16, 0xFF, 0xFE)
	for i := 0; i < len(encoded); i++ {
		utf16 = append(utf16, encoded[i], 0)
	}
	got, err := decodeFolderPickerOutput(utf16)
	if err != nil {
		t.Fatal(err)
	}
	if got != path {
		t.Fatalf("got %q want %q", got, path)
	}
}

func TestDecodeFolderPickerOutputEmpty(t *testing.T) {
	got, err := decodeFolderPickerOutput([]byte("\r\n"))
	if err != nil {
		t.Fatal(err)
	}
	if got != "" {
		t.Fatalf("empty picker should be %q, got %q", "", got)
	}
}

func TestRepairUTF8MojibakeChineseFilename(t *testing.T) {
	mojibake := string([]rune{
		0x00E9, 0x00A1, 0x00B9,
		0x00E7, 0x009B, 0x00AE,
		0x00E7, 0x00BB, 0x201C,
		0x00E6, 0x017E, 0x201E,
	}) + ".png"
	if got := repairUTF8Mojibake(mojibake); got != "项目结构.png" {
		t.Fatalf("got %q", got)
	}
	if got := repairUTF8Mojibake(`D:\docs`); got != `D:\docs` {
		t.Fatalf("ascii changed: %q", got)
	}
}
