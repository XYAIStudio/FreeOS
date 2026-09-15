//go:build !windows

package main

import "log"

func showFatalError(title, msg string) {
	log.Printf("fatal: %s: %s", title, msg)
}
