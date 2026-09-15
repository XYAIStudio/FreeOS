package main

import (
	"fmt"
	"log"
	"time"
)

type setURLFunc func(url string)

func safeSetURL(set setURLFunc, url string) (err error) {
	if set == nil {
		return fmt.Errorf("webview window is not available")
	}
	defer func() {
		if rec := recover(); rec != nil {
			err = fmt.Errorf("webview navigate failed: %v", rec)
		}
	}()
	set(url)
	return nil
}

func navigateWhenReady(set setURLFunc, url string, attempts int) error {
	if attempts < 1 {
		attempts = 1
	}
	var last error
	for i := 0; i < attempts; i++ {
		last = safeSetURL(set, url)
		if last == nil {
			return nil
		}
		log.Printf("SetURL attempt %d/%d: %v", i+1, attempts, last)
		time.Sleep(200 * time.Millisecond)
	}
	return last
}

func (a *App) markWebviewReady() {
	a.webviewReadyOnce.Do(func() {
		if a.webviewReady != nil {
			close(a.webviewReady)
		}
	})
}

func (a *App) waitWebviewReady(timeout time.Duration) bool {
	if a == nil || a.webviewReady == nil {
		return true
	}
	select {
	case <-a.webviewReady:
		return true
	case <-time.After(timeout):
		return false
	}
}
