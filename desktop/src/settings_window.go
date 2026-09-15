package main

import (
	"runtime"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
)

const (
	settingsWindowWidth  = 400
	settingsWindowHeight = 460
	// Windows DWM frameless decorations shrink the WebView2 client area, which
	// clips the 28px bottom gap used on macOS.
	settingsWindowWindowsExtraHeight = 24
)

func settingsWindowOuterHeight() int {
	if runtime.GOOS == "windows" {
		return settingsWindowHeight + settingsWindowWindowsExtraHeight
	}
	return settingsWindowHeight
}

func newSettingsWindow(app *application.App) *application.WebviewWindow {
	settingsWin := app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:            "FreeOS 设置",
		Width:            settingsWindowWidth,
		Height:           settingsWindowOuterHeight(),
		URL:              "/?settings=1",
		Hidden:           true,
		Frameless:        true,
		AlwaysOnTop:      true,
		DisableResize:    true,
		BackgroundColour: application.NewRGB(255, 255, 255),
		Windows: application.WindowsWindow{
			HiddenOnTaskbar: true,
		},
	})
	settingsWin.RegisterHook(events.Common.WindowClosing, func(e *application.WindowEvent) {
		e.Cancel()
		settingsWin.Hide()
	})
	settingsWin.OnWindowEvent(events.Common.WindowLostFocus, func(_ *application.WindowEvent) {
		settingsWin.Hide()
	})
	return settingsWin
}
