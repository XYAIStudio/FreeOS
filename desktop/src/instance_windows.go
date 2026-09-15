//go:build windows

package main

import (
	"log"
	"os"
	"path/filepath"
	"strings"
	"syscall"
	"unsafe"

	"golang.org/x/sys/windows"
)

var desktopMutex windows.Handle

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

func otherDesktopInstanceHeld() bool {
	name, err := windows.UTF16PtrFromString("Local\\FreeOS-desktop-instance")
	if err != nil {
		return false
	}
	h, err := windows.CreateMutex(nil, false, name)
	if err == windows.ERROR_ALREADY_EXISTS {
		if desktopMutex != 0 {
			if h != 0 && h != desktopMutex {
				_ = windows.CloseHandle(h)
			}
			return false
		}
		if h != 0 {
			_ = windows.CloseHandle(h)
		}
		return true
	}
	if err != nil {
		return false
	}
	desktopMutex = h
	return false
}

func releaseDesktopInstanceLock() {
	if desktopMutex != 0 {
		_ = windows.CloseHandle(desktopMutex)
		desktopMutex = 0
	}
}

func pidLooksLikeDesktopShell(pid int) bool {
	name := strings.ToLower(pidImageBase(pid))
	if name == "" {
		return false
	}
	want := "freeos.exe"
	if exe, err := os.Executable(); err == nil {
		want = strings.ToLower(filepath.Base(exe))
	}
	return name == want
}

func pidImageBase(pid int) string {
	h, err := windows.OpenProcess(windows.PROCESS_QUERY_LIMITED_INFORMATION, false, uint32(pid))
	if err != nil {
		return ""
	}
	defer windows.CloseHandle(h)
	var buf [windows.MAX_PATH]uint16
	size := uint32(len(buf))
	if err := windows.QueryFullProcessImageName(h, 0, &buf[0], &size); err != nil {
		return ""
	}
	return filepath.Base(windows.UTF16ToString(buf[:size]))
}
