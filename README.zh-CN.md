# FreeOS

> **简体中文** · [English](README.md) · [繁體中文](README.zh-TW.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Français](README.fr.md) · [Español](README.es.md) · [Русский](README.ru.md)

<p>
  <a href="https://github.com/TencentCloud/Octop"><img alt="Upstream: Octop" src="https://img.shields.io/badge/upstream-Octop-MIT-1677ff" /></a>
  <a href="https://github.com/XYAIStudio/openXYOS"><img alt="Organization module: openXYOS" src="https://img.shields.io/badge/organization-openXYOS-Apache--2.0-0f766e" /></a>
</p>
FreeOS 让用户在 **一个自托管平台** 里同时得到 **Octop + openXYOS** 的能力：模型和知识库尽可能本地优先；两边资产互通、互相增强；可以定制并最终 **导出一套新的 openXYOS 系统源码** 用于商业化。前进方向是把 openXYOS **迁入** 宿主做成原生能力，而不是永久嵌入一套大型 Node 运行时。

权威契约：[产品契约](docs/product-contract.zh-CN.md) · [English](docs/product-contract.md)。

**接下来不要做：** 不要把捆绑 Node / iframe 当成终点；不要把组织测试用户与 FreeOS 软件用户合成一套；不要把宿主登录绑到 Octop 官方。资产总线、导出重写、拆除 Node、迁移地图是后续项（P0.2+）。

## 能做什么

- 创建并编排专家、智能助手、流程、知识库和组织能力。
- 在 openXYOS 本地工作台中按行业需求定制角色、界面与自动化（当前 Node / iframe 是过渡桥）。
- 配置 **本地** 模型与知识库后，启用智能体、群聊、知识加工与生成能力。
- 使用 FreeOS 的模板、治理、质量校验和装配能力，并最终导出可独立部署的 openXYOS 系统源码。

## 快速开始

Windows 用户可从 [Releases](https://github.com/XYAIStudio/FreeOS/releases/latest) 下载匹配架构的安装包。源码运行：

```bash
git clone https://github.com/XYAIStudio/FreeOS.git
cd FreeOS
uv sync
uv run freeos run
```

**双身份：** FreeOS 软件用户是宿主上的 **本地优先注册 / 登录**（不绑 Octop 官方；以后可对接 FreeOS 官网做商业授权）。集成的组织模块是 **独立测试环境**，有自己的用户系统，与 FreeOS 软件用户无关。组织身份 **不是** 宿主身份的权威。

不要将 API Key、令牌或真实客户资料提交到公开仓库。

完整功能、架构和发布说明请见 [English README](README.md)、[中文宿主说明](README_CN.md) 与 [Wiki](https://github.com/XYAIStudio/FreeOS/wiki)。

