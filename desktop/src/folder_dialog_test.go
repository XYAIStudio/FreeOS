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
	if strings.Contains(script, "$d.SelectedPath }") && !strings.Contains(script, "ToBase64String") {
		t.Fatal("must not print SelectedPath as raw ACP text")
	}
}

func TestDecodeFolderPickerOutputPreservesChinese(t *testing.T) {
	want := `D:\源码\组织控制台`
	raw := []byte(base64.StdEncoding.EncodeToString([]byte(want)) + "\r\n")
	got, err := decodeFolderPickerOutput(raw)
	if err != nil {
		t.Fatal(err)
	}
	if got != want {
		t.Fatalf("got %q want %q", got, want)
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
