//go:build !windows

package main

import "syscall"

func pidAlive(pid int) bool {
	if pid <= 0 {
		return false
	}
	err := syscall.Kill(pid, 0)
	return err == nil
}

func activateExistingInstance() bool {
	return false
}
