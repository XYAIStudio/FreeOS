package main

import (
	"context"
	"embed"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/exec"
	"runtime"
	"sync"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
)

//go:embed assets/*
var assets embed.FS

const trayDoubleClick = 400 * time.Millisecond

// App is the Wails service bound to the shell UI.
type App struct {
	app            *application.App
	window         *application.WebviewWindow
	settingsWindow *application.WebviewWindow
	store          *settingsStore
	sleep          *sleepGuard
	cmd            *exec.Cmd
	sidecar        *exec.Cmd
	mu             sync.Mutex
	quitting       bool

	trayClickMu    sync.Mutex
	lastTrayClick  time.Time
	trayClickTimer *time.Timer

	webviewReady     chan struct{}
	webviewReadyOnce sync.Once
}

func (a *App) ServiceName() string { return "desktop" }

func (a *App) ServiceStartup(context.Context, application.ServiceOptions) error { return nil }

func (a *App) ServiceShutdown() error {
	a.sleep.stop()
	a.mu.Lock()
	cmd := a.cmd
	sidecar := a.sidecar
	a.cmd = nil
	a.sidecar = nil
	a.mu.Unlock()
	stopOctop(cmd)
	stopOctop(sidecar)
	return nil
}

func (a *App) GetSettings() Settings {
	return a.store.get()
}

func (a *App) GetSettingsStatus() (Settings, error) {
	s := a.store.get()
	if a.app == nil {
		return s, nil
	}
	status, err := a.app.Autostart.Status()
	if err != nil {
		return s, fmt.Errorf("read autostart status: %w", err)
	}
	if s.Autostart != status.Enabled {
		s.Autostart = status.Enabled
		if err := a.store.save(s); err != nil {
			return s, err
		}
	}
	return s, nil
}

func (a *App) SaveSettings(next Settings) (Settings, error) {
	cur, err := a.GetSettingsStatus()
	if err != nil {
		return cur, err
	}
	autostart, err := a.setAutostart(next.Autostart)
	if err != nil {
		return cur, err
	}
	if err := a.sleep.set(next.PreventSleep); err != nil {
		if _, rollbackErr := a.setAutostart(cur.Autostart); rollbackErr != nil {
			log.Printf("rollback autostart after sleep prevention failure: %v", rollbackErr)
		}
		return cur, err
	}
	next.Autostart = autostart
	if err := a.store.save(next); err != nil {
		return cur, err
	}
	saved := a.store.get()
	a.applyDashboardPrefs(saved)
	return saved, nil
}

func (a *App) ShowMain() {
	a.showWindow()
}

func (a *App) HideSettings() {
	if a.settingsWindow == nil {
		return
	}
	a.settingsWindow.Hide()
}

func (a *App) Quit() {
	a.requestQuit()
}

func (a *App) setAutostart(on bool) (bool, error) {
	if a.app == nil {
		return false, fmt.Errorf("autostart is unavailable before the application starts")
	}
	if on {
		if err := a.app.Autostart.Enable(); err != nil {
			return false, fmt.Errorf("enable autostart: %w", err)
		}
	} else if err := a.app.Autostart.Disable(); err != nil {
		return false, fmt.Errorf("disable autostart: %w", err)
	}
	status, err := a.app.Autostart.Status()
	if err != nil {
		return false, fmt.Errorf("read autostart status: %w", err)
	}
	if status.Enabled != on {
		return status.Enabled, fmt.Errorf("autostart state did not update")
	}
	return status.Enabled, nil
}

func (a *App) applyDashboardPrefs(s Settings) {
	if a.window == nil {
		return
	}
	encoded := jsonString(string(s.Locale))
	js := fmt.Sprintf(
		`(function(){try{localStorage.setItem('octop:ui-locale',%s);localStorage.setItem('freeos:ui-locale',%s);}catch(e){}})();`,
		encoded, encoded,
	)
	a.window.ExecJS(js)
}

func jsonString(s string) string {
	b, _ := json.Marshal(s)
	return string(b)
}

func (a *App) setStatus(msg string) {
	if a.app == nil {
		return
	}
	a.app.Event.Emit("desktop:status", msg)
}

func (a *App) boot() {
	locale := LocaleEN
	if a.store != nil {
		locale = a.store.get().Locale
	}
	if url := os.Getenv("OCTOP_DESKTOP_URL"); url != "" {
		a.setStatus(desktopText(locale, copyStatusConnecting))
		if err := waitHealth(locale, url, 60*time.Second); err != nil {
			a.setStatus(err.Error())
			return
		}
		a.showDashboard(url)
		return
	}
	s := a.store.get()
	a.setStatus(desktopText(locale, copyStatusCheckingRuntime))
	discardStaleOctopPortable()
	firstLaunch := !launchReady(portableDir())
	if err := ensurePortable(locale, a.setStatus); err != nil {
		logStartupError("portable runtime", err)
		a.setStatus(err.Error())
		showFatalError("FreeOS", formatFatalStartup(locale, err))
		return
	}
	root := portableDir()
	port := chooseHostPort(s.Port)
	if port != s.Port {
		log.Printf("port %d is occupied; starting FreeOS host on %d", s.Port, port)
	}
	a.mu.Lock()
	stopOctop(a.cmd)
	stopOctop(a.sidecar)
	if sidecarReady(root) {
		a.setStatus(desktopText(locale, copyStatusStartingOrg))
		sidecar, serr := startOrgSidecar(root, port)
		a.sidecar = sidecar
		if serr != nil {
			logStartupError("organization sidecar", serr)
		}
		// Sidecar health is non-blocking: Node/tsx cold start must not hold
		// the splash. Dashboard Organization polls until livez is up.
	} else {
		log.Printf("organization sidecar not bundled under %s", orgSidecarDir(root))
	}
	cmd, err := startOctop(root, port)
	a.cmd = cmd
	a.mu.Unlock()
	if err != nil {
		logStartupError("start host", err)
		a.setStatus(err.Error())
		showFatalError("FreeOS", formatFatalStartup(locale, err))
		return
	}
	base := dashboardURL(port)
	a.setStatus(desktopText(locale, copyStatusStartingService))
	timeout := 2 * time.Minute
	if firstLaunch {
		timeout = 5 * time.Minute
	}
	if err := waitHealth(locale, base, timeout); err != nil {
		logStartupError("host health", err)
		a.setStatus(err.Error())
		showFatalError("FreeOS", formatFatalStartup(locale, err))
		return
	}
	a.showDashboard(base)
}

func (a *App) showDashboard(base string) {
	if a.window == nil {
		return
	}
	if !a.waitWebviewReady(20 * time.Second) {
		log.Printf("webview not ignited after wait; retrying SetURL")
	}
	url := withDesktopQuery(base)
	if err := navigateWhenReady(func(next string) { a.window.SetURL(next) }, url, 8); err != nil {
		logStartupError("navigate dashboard", err)
		locale := LocaleEN
		if a.store != nil {
			locale = a.store.get().Locale
		}
		a.setStatus(desktopText(locale, copyNavigateFailed))
		showFatalError("FreeOS", desktopText(locale, copyNavigateFailed))
		return
	}
	a.scheduleDragOverlay()
	s := a.store.get()
	go func() {
		time.Sleep(800 * time.Millisecond)
		a.applyDashboardPrefs(s)
	}()
	a.setStatus(desktopText(s.Locale, copyStatusReady))
}

func (a *App) hideToTray() {
	if a.window == nil {
		return
	}
	a.window.Hide()
}

func (a *App) showWindow() {
	if a.window == nil {
		return
	}
	if a.window.IsMinimised() {
		a.window.UnMinimise()
	}
	a.window.Show()
	a.window.Focus()
}

func (a *App) toggleMainWindow() {
	if a.window == nil {
		return
	}
	if a.window.IsVisible() && !a.window.IsMinimised() {
		a.hideToTray()
		return
	}
	a.showWindow()
}

func (a *App) onTrayLeftClick() {
	a.trayClickMu.Lock()
	defer a.trayClickMu.Unlock()
	if a.trayClickTimer != nil {
		a.trayClickTimer.Stop()
		a.trayClickTimer = nil
	}
	now := time.Now()
	if !a.lastTrayClick.IsZero() && now.Sub(a.lastTrayClick) < trayDoubleClick {
		a.lastTrayClick = time.Time{}
		go a.toggleMainWindow()
		return
	}
	a.lastTrayClick = now
	a.trayClickTimer = time.AfterFunc(trayDoubleClick, func() {
		a.trayClickMu.Lock()
		a.trayClickTimer = nil
		a.trayClickMu.Unlock()
		a.showWindow()
	})
}

func (a *App) installDragOverlay() {
	if a.window == nil {
		return
	}
	a.window.ExecJS(dragOverlayJS())
}

func (a *App) scheduleDragOverlay() {
	go func() {
		for range 40 {
			time.Sleep(250 * time.Millisecond)
			a.installDragOverlay()
			a.installExternalLinks()
		}
	}()
}

func (a *App) requestQuit() {
	a.mu.Lock()
	a.quitting = true
	a.mu.Unlock()
	if a.app != nil {
		a.app.Quit()
	}
}

func main() {
	defer func() {
		if rec := recover(); rec != nil {
			log.Printf("panic: %v", rec)
			showFatalError("FreeOS", desktopText(LocaleEN, copyNavigateFailed))
		}
	}()
	pinWorkingDirectory()
	if err := ensureProductHomeWritable(); err != nil {
		showFatalError("FreeOS", err.Error())
		return
	}
	initDesktopLog()
	if exe, err := os.Executable(); err == nil {
		cwd, _ := os.Getwd()
		log.Printf("launch exe=%s cwd=%s home=%s", exe, cwd, productHome())
	}
	webviewData := prepareWebviewUserData()
	if claimDesktopInstance() {
		locale := LocaleEN
		if data, err := os.ReadFile(settingsPath()); err == nil {
			var s Settings
			if json.Unmarshal(data, &s) == nil && s.Locale == LocaleZH {
				locale = LocaleZH
			}
		}
		if activateExistingInstance() {
			log.Printf("handed off to the running FreeOS window")
			return
		}
		showFatalError("FreeOS", desktopText(locale, copyAlreadyRunning))
		return
	}
	defer clearDesktopPid()

	store := &settingsStore{cur: loadSettings()}
	api := &App{
		store:        store,
		sleep:        &sleepGuard{},
		webviewReady: make(chan struct{}),
	}

	app := application.New(application.Options{
		Name:        "FreeOS",
		Description: "FreeOS desktop — Octop shell + openXYOS",
		Services: []application.Service{
			application.NewService(api),
		},
		Assets: application.AssetOptions{
			Handler: application.BundledAssetFileServer(assets),
		},
		Windows: application.WindowsOptions{
			DisableQuitOnLastWindowClosed: true,
			WebviewUserDataPath:           webviewData,
		},
		PanicHandler: func(details *application.PanicDetails) {
			log.Printf("panic: %+v", details)
			showFatalError("FreeOS", desktopText(api.store.get().Locale, copyNavigateFailed))
		},
		ErrorHandler: func(err error) {
			logStartupError("wails", err)
		},
		Linux: application.LinuxOptions{
			DisableQuitOnLastWindowClosed: true,
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: false,
		},
	})
	api.app = app
	attachOpenURLEventListener(app, api.OpenExternal)
	app.Event.OnApplicationEvent(events.Common.ApplicationStarted, func(_ *application.ApplicationEvent) {
		applyAppIcon(app)
		api.showWindow()
	})

	win := app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:                "FreeOS",
		Width:                1200,
		Height:               800,
		URL:                  "/",
		Frameless:            true,
		AllowSimpleEventEmit: true,
		BackgroundColour:     application.NewRGB(247, 248, 250),
	})
	api.window = win
	app.Event.On("desktop:toggle-maximise", func(_ *application.CustomEvent) {
		win.ToggleMaximise()
	})
	app.Event.On("desktop:minimise", func(_ *application.CustomEvent) {
		win.Minimise()
	})
	app.Event.On("desktop:close", func(_ *application.CustomEvent) {
		api.hideToTray()
	})
	tray := app.SystemTray.New()
	applyTrayIcon(tray)
	tray.SetTooltip("FreeOS")
	var settingsOnce sync.Once
	ensureSettings := func() {
		settingsOnce.Do(func() {
			settingsWin := newSettingsWindow(app)
			api.settingsWindow = settingsWin
			tray.AttachWindow(settingsWin).WindowOffset(6)
		})
	}
	onMainNavigated := func(_ *application.WindowEvent) {
		api.markWebviewReady()
		api.scheduleDragOverlay()
		ensureSettings()
	}
	win.OnWindowEvent(events.Mac.WebViewDidFinishNavigation, onMainNavigated)
	win.OnWindowEvent(events.Windows.WebViewNavigationCompleted, onMainNavigated)
	win.OnWindowEvent(events.Linux.WindowLoadFinished, onMainNavigated)
	app.Event.RegisterApplicationEventHook(events.Mac.ApplicationShouldHandleReopen, func(event *application.ApplicationEvent) {
		event.Cancel()
		restoreMainAfterDockClick(api.window, api.settingsWindow)
	})

	win.RegisterHook(events.Common.WindowClosing, func(e *application.WindowEvent) {
		api.mu.Lock()
		quit := api.quitting
		api.mu.Unlock()
		if quit {
			return
		}
		e.Cancel()
		api.hideToTray()
	})
	win.OnWindowEvent(events.Common.WindowMinimise, func(_ *application.WindowEvent) {
		if api.store.get().MinimizeToTray {
			api.hideToTray()
		}
	})
	showSettings := func() {
		ensureSettings()
		tray.ShowWindow()
	}
	if trayLeftClickShowsSettings(runtime.GOOS) {
		tray.OnClick(showSettings)
	} else {
		tray.OnClick(func() { api.onTrayLeftClick() })
	}
	tray.OnRightClick(showSettings)

	if _, err := api.setAutostart(store.get().Autostart); err != nil {
		log.Printf("sync autostart: %v", err)
	}
	if err := api.sleep.set(store.get().PreventSleep); err != nil {
		log.Printf("enable sleep prevention: %v", err)
	}

	api.scheduleDragOverlay()
	go api.boot()

	if err := app.Run(); err != nil {
		logStartupError("app.Run", err)
		showFatalError("FreeOS", formatFatalStartup(api.store.get().Locale, err))
		os.Exit(1)
	}
}
