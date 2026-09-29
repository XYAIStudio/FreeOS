# FreeOS 0.0.7 安装与本机模型指南

0.0.7 应只从 FreeOS 的 [GitHub Release v0.0.7](https://github.com/XYAIStudio/FreeOS/releases/tag/v0.0.7) 下载，不要把开发分支构建当作正式安装包。

## Windows

- 常见 Intel/AMD 电脑：下载 `FreeOS-desktop-windows-amd64-0.0.7.exe`。
- Windows ARM 电脑：下载 `FreeOS-desktop-windows-arm64-0.0.7.exe`。
- 免安装版：下载对应架构的 `FreeOS-portable-windows-*.zip`，完整解压后运行。

升级前先从系统托盘退出旧版 FreeOS，再运行安装程序。安装程序保留 `%USERPROFILE%\.freeos` 中的账号、模型设置、知识库和组织数据。

## 首次选择本机模型

1. 如果电脑已安装 Ollama，FreeOS 会显示当前状态；服务未启动时，用户可点击“启动 Ollama”。
2. 如果没有 Ollama，可在“设置 → 模型 → 本地”选择 FreeOS 推荐的 GGUF 模型并点击一键安装。Windows amd64 包已带 llama.cpp 运行时，不需要另装推理程序。
3. FreeOS 会显示下载进度；关闭程序、网络中断或取消后，再次进入模型页可继续下载。
4. 下载完成后，FreeOS 会校验文件、启动模型、执行轻量测速并将成功的模型设为默认对话模型。
5. 测速结果会保留在本机。用户仍可手动测速、切换默认模型或停止 llama.cpp。

模型文件通常较大。FreeOS 会在下载前检查目标磁盘的剩余空间，并额外预留 256 MiB。模型默认保存在 FreeOS 数据目录的 `models` 文件夹。

## macOS 与 Linux

下载与设备架构一致的桌面包或 portable 包。当前内置 llama.cpp 运行时首先覆盖 Windows amd64；其他平台可以使用已安装的 Ollama，或接入 LM Studio、llama.cpp server、vLLM 等 OpenAI 兼容本机服务。

## 常见问题

- **下载中断**：重新进入本地模型页，点击“继续下载”。不要手工删除同名 `.part` 文件。
- **模型启动失败**：查看 `%USERPROFILE%\.freeos\logs\llama-sidecar.log`，确认显存或内存足够。
- **重启后模型不可用**：先确认模型文件仍在原路径；用户曾主动点击“停止”时，FreeOS 不会自动恢复。
- **Ollama 已安装但未运行**：在首次配置或本地模型页点击“启动 Ollama”，FreeOS 不会在未征得用户选择时强制启动它。
- **诊断资料**：反馈时附上发生时间、FreeOS 版本和相关日志，并移除 API Key、令牌等敏感信息。
