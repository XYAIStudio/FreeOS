package main

import "fmt"

const (
	copyStatusConnecting       = "status.connecting"
	copyStatusCheckingRuntime  = "status.checking_runtime"
	copyStatusStartingService  = "status.starting_service"
	copyStatusStartingOrg      = "status.starting_org"
	copyStatusProvisioningOrg  = "status.provisioning_org"
	copyStatusReady            = "status.ready"
	copyStatusUsingRuntime     = "status.using_runtime"
	copyStatusBackupDatabase   = "status.backup_database"
	copyStatusInstallingUpdate = "status.installing_update"
	copyStatusUpdatingRuntime  = "status.updating_runtime"
	copyStatusFirstExtract     = "status.first_extract"
	copyStatusUpdateFailedKeep = "status.update_failed_keep"
	copyErrorBackupFailed      = "error.backup_failed"
	copyErrorUpgradeFailed     = "error.upgrade_failed"
	copyWait1Minute            = "wait.1_minute"
	copyWaitNMinutes           = "wait.n_minutes"
	copyWait1Second            = "wait.1_second"
	copyWaitNSeconds           = "wait.n_seconds"
	copyHealthNotReady5xx      = "health.not_ready_5xx"
	copyHealthNotReadyConnect  = "health.not_ready_connect"
	copyHealthNotReady         = "health.not_ready"
	copySeeDesktopLog          = "error.see_desktop_log"
	copyAlreadyRunning         = "error.already_running"
	copyNavigateFailed         = "error.navigate_failed"
	copyHealthForeignHost      = "health.foreign_host"
)

var desktopCopy = map[Locale]map[string]string{
	LocaleEN: {
		copyStatusConnecting:       "Connecting to FreeOS…",
		copyStatusCheckingRuntime:  "Checking the runtime…",
		copyStatusStartingService:  "Starting the FreeOS service…",
		copyStatusStartingOrg:      "Starting FreeOS…",
		copyStatusProvisioningOrg:  "Preparing the optional openXYOS sidecar…",
		copyStatusReady:            "FreeOS is ready",
		copyStatusUsingRuntime:     "Using the existing runtime…",
		copyStatusBackupDatabase:   "Desktop update %s found. Backing up the database…",
		copyStatusInstallingUpdate: "Installing the bundled desktop update…",
		copyStatusUpdatingRuntime:  "Updating the bundled runtime…",
		copyStatusFirstExtract:     "First launch: unpacking the bundled runtime…",
		copyStatusUpdateFailedKeep: "Runtime update failed; using the existing runtime…",
		copyErrorBackupFailed:      "Database backup failed before upgrade; the current version was preserved",
		copyErrorUpgradeFailed:     "Desktop runtime upgrade failed; the current version was preserved",
		copyWait1Minute:            "1 minute",
		copyWaitNMinutes:           "%d minutes",
		copyWait1Second:            "1 second",
		copyWaitNSeconds:           "%d seconds",
		copyHealthNotReady5xx:      "FreeOS did not become ready within %s (%s). The service responded but is not ready yet. Try again, or check logs/desktop.log.",
		copyHealthNotReadyConnect:  "FreeOS did not become ready within %s (%s). Could not connect — make sure FreeOS is running. Check logs/desktop.log and logs/host.log.",
		copyHealthNotReady:         "FreeOS did not become ready within %s (%s). Make sure FreeOS is running at this address, or check logs/desktop.log.",
		copySeeDesktopLog:          "Details were written to %s",
		copyAlreadyRunning:         "FreeOS is already running. Check the system tray, or quit the existing process and try again.",
		copyNavigateFailed:         "FreeOS could not open the window. Close any leftover FreeOS or Octop process, delete %LOCALAPPDATA%\\FreeOS\\WebView2 if it exists, then open FreeOS again. Details are in logs/desktop.log.",
		copyHealthForeignHost:      "FreeOS did not become ready within %s (%s). A leftover service on that address is not FreeOS. Quit the old process or reinstall, then try again.",
	},
	LocaleZH: {
		copyStatusConnecting:       "正在连接 FreeOS…",
		copyStatusCheckingRuntime:  "正在检查运行环境…",
		copyStatusStartingService:  "正在启动 FreeOS 服务…",
		copyStatusStartingOrg:      "正在启动 FreeOS…",
		copyStatusProvisioningOrg:  "正在准备可选的 openXYOS 边车…",
		copyStatusReady:            "FreeOS 已就绪",
		copyStatusUsingRuntime:     "正在使用已有运行环境…",
		copyStatusBackupDatabase:   "发现客户端新版 %s，正在备份数据库…",
		copyStatusInstallingUpdate: "正在安装客户端内置新版…",
		copyStatusUpdatingRuntime:  "正在更新内置运行环境…",
		copyStatusFirstExtract:     "首次启动，正在解压内置运行环境…",
		copyStatusUpdateFailedKeep: "更新内置运行环境失败，继续使用已有运行环境…",
		copyErrorBackupFailed:      "升级前数据库备份失败，已保留当前版本",
		copyErrorUpgradeFailed:     "客户端运行环境升级失败，已保留当前版本",
		copyWait1Minute:            "1 分钟",
		copyWaitNMinutes:           "%d 分钟",
		copyWait1Second:            "1 秒",
		copyWaitNSeconds:           "%d 秒",
		copyHealthNotReady5xx:      "FreeOS 服务未在%s内就绪（%s）。服务已响应但尚未就绪，请稍后再试，或查看 logs/desktop.log。",
		copyHealthNotReadyConnect:  "FreeOS 服务未在%s内就绪（%s）。目前无法连接该地址，请确认 FreeOS 正在运行，并查看 logs/desktop.log 与 logs/host.log。",
		copyHealthNotReady:         "FreeOS 服务未在%s内就绪（%s）。请确认本机已启动 FreeOS，且地址、端口正确；也可查看 logs/desktop.log。",
		copySeeDesktopLog:          "详细日志已写入 %s",
		copyAlreadyRunning:         "FreeOS 已在运行。请查看系统托盘，或退出已有进程后再试。",
		copyNavigateFailed:         "FreeOS 无法打开窗口。请退出残留的 FreeOS / Octop 进程，必要时删除 %LOCALAPPDATA%\\FreeOS\\WebView2，然后重新打开。详情见 logs/desktop.log。",
		copyHealthForeignHost:      "FreeOS 服务未在%s内就绪（%s）。该地址上已有服务但不是 FreeOS。请退出旧进程或重新安装后再试。",
	},
}

func desktopText(locale Locale, key string, args ...any) string {
	msg := lookupDesktopCopy(locale, key)
	if len(args) == 0 {
		return msg
	}
	return fmt.Sprintf(msg, args...)
}

func lookupDesktopCopy(locale Locale, key string) string {
	if msgs := desktopCopy[locale]; msgs != nil {
		if msg, ok := msgs[key]; ok {
			return msg
		}
	}
	if msg, ok := desktopCopy[LocaleEN][key]; ok {
		return msg
	}
	return key
}
