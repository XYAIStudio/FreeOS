//go:build !production || darwin

package main

// Development builds look for FreeOS-<plat>.zip / FreeOS-portable-<plat>-*.zip
// (Octop-* aliases still accepted) beside the executable. macOS production
// copies the zip into Resources as FreeOS-<plat>.zip.
var embeddedPortable []byte
