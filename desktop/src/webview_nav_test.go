package main

import (
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func TestSafeSetURLRecoversNavigatePanic(t *testing.T) {
	err := safeSetURL(func(string) {
		panic("runtime error: invalid memory address or nil pointer dereference")
	}, "http://127.0.0.1:8088/?desktop=1")
	if err == nil {
		t.Fatal("expected recovered panic")
	}
	if !strings.Contains(err.Error(), "webview navigate failed") {
		t.Fatalf("error = %v", err)
	}
}

func TestNavigateWhenReadyRetriesAfterChromiumPanic(t *testing.T) {
	var calls atomic.Int32
	var got string
	url := "http://127.0.0.1:8088/?desktop=1"
	err := navigateWhenReady(func(next string) {
		n := calls.Add(1)
		if n < 3 {
			panic("runtime error: invalid memory address or nil pointer dereference")
		}
		got = next
	}, url, 4)
	if err != nil {
		t.Fatal(err)
	}
	if got != url {
		t.Fatalf("url = %q", got)
	}
	if calls.Load() != 3 {
		t.Fatalf("calls = %d, want 3", calls.Load())
	}
}

func TestNavigateWhenReadySucceedsAfterReady(t *testing.T) {
	var calls atomic.Int32
	var got string
	url := "http://127.0.0.1:8090/?desktop=1"
	if err := navigateWhenReady(func(next string) {
		calls.Add(1)
		got = next
	}, url, 1); err != nil {
		t.Fatal(err)
	}
	if got != url || calls.Load() != 1 {
		t.Fatalf("url=%q calls=%d", got, calls.Load())
	}
}

func TestMarkWebviewReadyUnblocksWait(t *testing.T) {
	api := &App{webviewReady: make(chan struct{})}
	done := make(chan bool, 1)
	go func() {
		done <- api.waitWebviewReady(2 * time.Second)
	}()
	time.Sleep(20 * time.Millisecond)
	api.markWebviewReady()
	api.markWebviewReady()
	if !<-done {
		t.Fatal("waitWebviewReady should succeed after ignition")
	}
}

func TestWaitWebviewReadyTimesOut(t *testing.T) {
	api := &App{webviewReady: make(chan struct{})}
	if api.waitWebviewReady(15 * time.Millisecond) {
		t.Fatal("expected timeout before ignition")
	}
}

func TestSafeSetURLNilWindow(t *testing.T) {
	if err := safeSetURL(nil, "http://127.0.0.1/"); err == nil {
		t.Fatal("expected error")
	}
}
