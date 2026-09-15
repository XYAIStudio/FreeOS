//go:build windows

package main

import (
	"log"
	"syscall"
	"unsafe"

	"golang.org/x/sys/windows"
)

func pidAlive(pid int) bool {
	h, err := windows.OpenProcess(windows.PROCESS_QUERY_LIMITED_INFORMATION, false, uint32(pid))
	if err != nil {
		return false
	}
	defer windows.CloseHandle(h)
	var code uint32
	if err := windows.GetExitCodeProcess(h, &code); err != nil {
		return false
	}
	return code == 259 // STILL_ACTIVE
}

var (
	user32            = windows.NewLazySystemDLL("user32.dll")
	procFindWindowW   = user32.NewProc("FindWindowW")
	procShowWindow    = user32.NewProc("ShowWindow")
	procSetForeground = user32.NewProc("SetForegroundWindow")
	procIsIconic      = user32.NewProc("IsIconic")
)

const swRestore = 9

func activateExistingInstance() bool {
	title, err := syscall.UTF16PtrFromString("FreeOS")
	if err != nil {
		return false
	}
	hwnd, _, _ := procFindWindowW.Call(0, uintptr(unsafe.Pointer(title)))
	if hwnd == 0 {
		log.Printf("another instance is running but no FreeOS window was found")
		return false
	}
	iconic, _, _ := procIsIconic.Call(hwnd)
	if iconic != 0 {
		_, _, _ = procShowWindow.Call(hwnd, swRestore)
	} else {
		_, _, _ = procShowWindow.Call(hwnd, 1) // SW_SHOWNORMAL
	}
	_, _, _ = procSetForeground.Call(hwnd)
	log.Printf("activated existing FreeOS window")
	return true
}
