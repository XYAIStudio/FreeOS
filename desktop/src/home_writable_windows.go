//go:build windows

package main

import "os/exec"

func repairProductHomeAccess(home string) {
	// An elevated finish-page launch can stamp ~/.freeos with a High
	// mandatory integrity label. Medium-IL shortcut clicks then cannot
	// write logs, desktop.pid, or the portable extract.
	grant := exec.Command("icacls", home, "/grant", "*S-1-5-32-545:(OI)(CI)M", "/T")
	hideConsole(grant)
	_ = grant.Run()
	integrity := exec.Command("icacls", home, "/setintegritylevel", "(OI)(CI)M", "/T")
	hideConsole(integrity)
	_ = integrity.Run()
}
