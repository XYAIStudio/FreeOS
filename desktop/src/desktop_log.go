package main

import (
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"sync"
)

var processLogFiles struct {
	mu    sync.Mutex
	files []*os.File
}

func keepProcessLog(f *os.File) {
	processLogFiles.mu.Lock()
	processLogFiles.files = append(processLogFiles.files, f)
	processLogFiles.mu.Unlock()
}

func desktopLogDir() string {
	return filepath.Join(productHome(), "logs")
}

func desktopLogPath() string {
	return filepath.Join(desktopLogDir(), "desktop.log")
}

func processLogPath(name string) string {
	return filepath.Join(desktopLogDir(), name+".log")
}

func initDesktopLog() {
	if err := os.MkdirAll(desktopLogDir(), 0o755); err != nil {
		log.SetOutput(os.Stderr)
		log.Printf("desktop log dir: %v", err)
		return
	}
	f, err := os.OpenFile(desktopLogPath(), os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		log.SetOutput(os.Stderr)
		log.Printf("desktop log file: %v", err)
		return
	}
	log.SetOutput(io.MultiWriter(f, os.Stderr))
	log.SetFlags(log.LstdFlags | log.Lmicroseconds)
	log.Printf("desktop log %s", desktopLogPath())
}

func attachProcessLogFile(name string) (*os.File, error) {
	if err := os.MkdirAll(desktopLogDir(), 0o755); err != nil {
		return nil, err
	}
	f, err := os.OpenFile(processLogPath(name), os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		return nil, err
	}
	keepProcessLog(f)
	return f, nil
}

func logStartupError(stage string, err error) {
	if err == nil {
		return
	}
	log.Printf("%s: %v (see %s)", stage, err, desktopLogPath())
}

func formatFatalStartup(locale Locale, err error) string {
	return fmt.Sprintf(
		"%s\n\n%s",
		err.Error(),
		desktopText(locale, copySeeDesktopLog, desktopLogPath()),
	)
}
