//go:build windows

package main

import (
	"log"

	"golang.org/x/sys/windows"
)

func showFatalError(title, msg string) {
	log.Printf("fatal: %s: %s", title, msg)
	_, _ = windows.MessageBox(
		0,
		windows.StringToUTF16Ptr(msg),
		windows.StringToUTF16Ptr(title),
		windows.MB_OK|windows.MB_ICONERROR,
	)
}
