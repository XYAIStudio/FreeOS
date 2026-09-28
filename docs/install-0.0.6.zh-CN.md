# FreeOS 0.0.6 安装指南

请只从 [GitHub Releases](https://github.com/XYAIStudio/FreeOS/releases/tag/v0.0.6) 下载。文件名中的系统和架构必须与设备一致。

## Windows

- 常见 Intel/AMD 电脑：`FreeOS-desktop-windows-amd64-0.0.6.exe`
- Windows ARM 电脑：`FreeOS-desktop-windows-arm64-0.0.6.exe`
- 免安装版：选择对应架构的 `FreeOS-portable-windows-*.zip`，完整解压后运行 FreeOS。

升级前退出托盘里的 FreeOS，再运行新版安装程序。安装程序保留 `~/.freeos` 中的用户数据和设置。首次启动可能需要解压本机运行时，请等待主界面出现，不要重复双击。

## macOS

- Apple Silicon（M1/M2/M3/M4）：`FreeOS-desktop-darwin-arm64-0.0.6.dmg`
- Intel Mac：`FreeOS-desktop-darwin-amd64-0.0.6.dmg`

打开 DMG，把 FreeOS 拖入“应用程序”。如果系统拦截首次打开，请在“系统设置 → 隐私与安全性”中允许。免安装包为对应架构的 `FreeOS-portable-darwin-*.zip`。

## Linux

- x86-64：`FreeOS-desktop-linux-amd64-0.0.6.tar.gz`
- ARM64：`FreeOS-desktop-linux-arm64-0.0.6.tar.gz`

解压桌面包后运行其中的 FreeOS。免安装运行时为对应架构的 `FreeOS-portable-linux-*.zip`。桌面环境需要 GTK4 与 WebKitGTK 6。

## 首次使用

1. FreeOS 工作室账号默认走本机注册和登录，不绑定 Octop 官方账号。
2. 先在“模型”中配置本机 Ollama 或用户自己的云模型密钥。未配置模型时，对话页会引导设置。
3. “组织”中的 openXYOS 是独立测试环境，有独立用户系统；可用一键测试登录进入，不与 FreeOS 工作室账号互相替代。
4. 本机 Ollama 模型如果不支持工具调用，0.0.6 会自动退回普通对话，不再连续报 `stream_error`。

## 常见问题

- **组织页一直等待端口**：在组织页点击“重启前后端服务”。0.0.6 会避免桌面宿主与 Python 启动器重复拉起进程。
- **最小化后无法恢复**：从托盘菜单点击“显示 FreeOS”；0.0.6 已修复显示后又立即隐藏的问题。
- **模型调用失败**：先在 Ollama 中确认模型已下载并运行，再到“模型”页设为默认。云模型还需检查 API Key 与余额。
- **诊断日志**：Windows 默认位于 `%USERPROFILE%\.freeos\logs`。提交问题时请附上问题发生时间和相关日志，移除任何密钥。

卸载程序不会主动删除 `~/.freeos` 用户数据。需要彻底清理时，请先备份导出内容，再由用户自行删除该目录。
