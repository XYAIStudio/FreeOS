# FreeOS

> **简体中文** · [English](README.md) · [繁體中文](README.zh-TW.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Français](README.fr.md) · [Español](README.es.md) · [Русский](README.ru.md)

<p>
  <a href="https://github.com/TencentCloud/Octop"><img alt="Upstream: Octop" src="https://img.shields.io/badge/upstream-Octop-MIT-1677ff" /></a>
  <a href="https://github.com/XYAIStudio/openXYOS"><img alt="Organization module: openXYOS" src="https://img.shields.io/badge/organization-openXYOS-Apache--2.0-0f766e" /></a>
</p>

## 创立初心

FreeOS 诞生于一个简单而清晰的目标：在 Octop 的自托管多智能体能力之上，让每个人都能同时拥有 Octop + openXYOS 两套系统的力量——不必在「对话与自动化」和「组织与治理」之间二选一。

我们希望模型尽量跑在本地，知识尽量留在本地；Octop 与 openXYOS 已有的能力与资产能够互通、互相增强。用户可以在此基础上开发、优化、自我定制，生长出更贴合自身场景的新 openXYOS，并导出其系统源码，以便进一步产品化与商业化。

为避免整包内嵌 openXYOS 带来的安装负担与体积膨胀，FreeOS 选择另一条路：把 openXYOS 的网页与组织能力，逐步转化为 Octop 宿主上的原生能力，从而形成新的统一系统——FreeOS。当前桌面中的托管 Node / 内嵌组织页，只是通往这一终态的过渡桥，而非终点。

在使用方式上，FreeOS 首先保证你能在自己的环境里独立完成注册与登录，把数据与会话留在本机可控范围；与外部账号体系、商业授权的衔接，会在合适的时机以可选方式开放，而不是作为起步门槛。组织相关能力则以相对独立的工作空间呈现——便于试用、演练与定制组织侧流程；它与宿主侧的日常使用彼此协作，又各自保有清晰边界，避免把两套场景揉成一套账号逻辑。

一句话：FreeOS = 本地可控的 Octop 底座 + 可生长、可导出的组织能力，双系统合一，双身份分立。

权威契约：[产品契约](docs/product-contract.zh-CN.md) · [English](docs/product-contract.md)。

**接下来不要做：** 不要把捆绑 Node / 内嵌组织页当成终点；不要把组织工作空间与宿主日常使用揉成一套账号逻辑；不要把外部账号或商业授权当成起步门槛。资产总线、导出重写、拆除 Node、迁移地图是后续项（P0.2+）。

## 能做什么

- 创建并编排专家、智能助手、流程、知识库和组织能力。
- 在组织能力上按行业需求定制角色、界面与自动化（当前桌面的托管 Node / 内嵌组织页是过渡桥）。
- 配置本地模型与知识库后，启用智能体、群聊、知识加工与生成能力。
- 开发、优化、自我定制，生长更贴合自身场景的新 openXYOS，并导出其系统源码。

## 快速开始

Windows 用户可从 [Releases](https://github.com/XYAIStudio/FreeOS/releases/latest) 下载匹配架构的安装包。源码运行：

```bash
git clone https://github.com/XYAIStudio/FreeOS.git
cd FreeOS
uv sync
uv run freeos run
```

不要将 API Key、令牌或真实客户资料提交到公开仓库。

完整功能、架构和发布说明请见 [English README](README.md)、[中文宿主说明](README_CN.md) 与 [Wiki](https://github.com/XYAIStudio/FreeOS/wiki)。
