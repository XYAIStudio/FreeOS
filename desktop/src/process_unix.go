//go:build !windows

package main

import (
	"os/exec"
	"syscall"
)

func hideConsole(cmd *exec.Cmd) {}

func configureProcGroup(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
}

func killProcessTree(cmd *exec.Cmd) {
	if cmd == nil || cmd.Process == nil {
		return
	}
	killPid(cmd.Process.Pid)
	_ = cmd.Wait()
}

func killPid(pid int) {
	if pid <= 0 {
		return
	}
	_ = syscall.Kill(-pid, syscall.SIGTERM)
	_ = syscall.Kill(pid, syscall.SIGTERM)
}

func killWindowsImageAt(string) {}

func stopPortableHolders(string) {}
