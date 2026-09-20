# FreeOS

> **简体中文** · [English](README.md) · [繁體中文](README.zh-TW.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Français](README.fr.md) · [Español](README.es.md) · [Русский](README.ru.md)

<p>
  <a href="https://github.com/TencentCloud/Octop"><img alt="Upstream: Octop" src="https://img.shields.io/badge/Upstream-Octop-1677ff.svg?style=flat" /></a>
  <a href="https://github.com/XYAIStudio/openXYOS"><img alt="Organization module: openXYOS" src="https://img.shields.io/badge/Organization-openXYOS-0f766e.svg?style=flat" /></a>
</p>

**FreeOS：自由的 AI 工作室，想象空间由你来打开**

## 创立初心

FreeOS 诞生于一个简单而清晰的目标：在 Octop 的自托管多智能体能力之上，让每个人都能同时拥有 Octop + openXYOS 两套系统的力量——不必在「对话与自动化」和「组织与治理」之间二选一。

我们希望模型尽量跑在本地，知识尽量留在本地；Octop 与 openXYOS 已有的能力与资产能够互通、互相增强。用户可以在此基础上开发、优化、自我定制，生长出更贴合自身场景的新 openXYOS，并导出其系统源码，以便进一步产品化与商业化。

为避免整包内嵌 openXYOS 带来的安装负担与体积膨胀，FreeOS 选择另一条路：把 openXYOS 的网页与组织能力，逐步转化为 Octop 宿主上的原生能力，从而形成新的统一系统——FreeOS。当前桌面中的托管 Node / 内嵌组织页，只是通往这一终态的过渡桥，而非终点。

在使用方式上，FreeOS 更像你自己的工作室：先在本机安顿好，注册登录、数据与会话都留在你够得着的地方；以后若需要与更广的服务或授权衔接，会以可选方式慢慢打开，不挡你起步。组织相关能力则像工作室里另一间可独立布置的房间——方便试用、演练和长出自己的组织流程；与日常对话、助手协作同在一个 FreeOS 里，又各自留白，不把两种用法捏成同一种进入方式。

一句话：FreeOS = 本地可控的 Octop 底座 + 可生长、可导出的组织能力，双系统合一，双身份分立。

权威契约：[产品契约](docs/product-contract.zh-CN.md) · [English](docs/product-contract.md)。

**接下来不要做：** 不要把捆绑 Node / 内嵌组织页当成终点；不要把工作室日常与组织房间捏成同一种进入方式；不要把更广的服务或授权当成起步门槛。资产总线、导出重写、拆除 Node、迁移地图是后续项（P0.2+）。

## 能做什么

- 创建并编排专家、智能助手、流程、知识库和组织能力。
- 在组织能力上按行业需求定制角色、界面与自动化（当前桌面的托管 Node / 内嵌组织页是过渡桥）。
- 配置本地模型与知识库后，启用智能体、群聊、知识加工与生成能力。
- 开发、优化、自我定制，生长更贴合自身场景的新 openXYOS，并导出其系统源码。

## 功能动效预览

<p align="center"><img src="docs/assets/xyai-mascot-wave.gif" width="185" alt="XYAI 精灵挥手问好" /></p>

<p align="center"><img src="docs/assets/freeos-org-loop-demo.gif" width="860" alt="openXYOS 智能体定制与组织装配动效" /></p>

从画像和资料开始，生成受治理约束的智能体蓝图，再进入人才市场并装配进组织。上图是仓库内 openXYOS Agent Studio 的实际界面动效。

<p align="center"><img src="docs/assets/xyai-mascot-create-story.gif" width="220" alt="XYAI 精灵从思考到创造" /></p>

## 快速开始

Windows 用户可从 [Releases](https://github.com/XYAIStudio/FreeOS/releases/latest) 下载匹配架构的安装包。源码运行：

```bash
git clone https://github.com/XYAIStudio/FreeOS.git
cd FreeOS
uv sync
uv run freeos run
```

第一次打开控制台时，向导默认先选 **Ollama / 本机 OpenAI 兼容地址**，不必先填云厂商密钥。侧栏 **模型 → 本地** 可启动 Ollama、注册 GGUF；**知识库** 先挂接本机文件夹，向量默认本机 ONNX。说明见 [用户指南](docs/user-guide.md)、[配置](docs/configuration.md#local-models-and-knowledge-bases)。

不要将 API Key、令牌或真实客户资料提交到公开仓库。

完整功能、架构和发布说明请见 [English README](README.md)、[中文宿主说明](README_CN.md) 与 [Wiki](https://github.com/XYAIStudio/FreeOS/wiki)。openXYOS 能力哪些已在宿主原生、哪些仍在托管 Node / iframe，见 [能力迁移图（P0.2）](docs/org-capability-migration-map.zh-CN.md)。

## 开发者交流群

<table>
  <tr>
    <td align="center" width="42%"><img src="docs/assets/xyai-mascot-community.png" width="210" alt="XYAI 精灵欢迎开发者" /></td>
    <td align="center">
      <strong>XYAI Founders 开发者交流群</strong><br/><br/>
      交流组织设计、本地工作台实践、扩展开发与导出反馈。<br/><br/>
      <img src="docs/assets/xyai-developers-community-qr.png" width="180" alt="XYAI Founders 开发者交流群二维码" /><br/>
      扫码加入；请勿在公开讨论中发送 API Key、令牌或客户资料。
    </td>
  </tr>
</table>

也可前往 [GitHub Discussions](https://github.com/XYAIStudio/FreeOS/discussions) 发起讨论。
