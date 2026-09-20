# FreeOS

> **简体中文** · [English](README.md) · [繁體中文](README.zh-TW.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Français](README.fr.md) · [Español](README.es.md) · [Русский](README.ru.md)

FreeOS 是面向组织协作、知识沉淀与智能体编排的开源本地优先平台。它把 FreeOS 的增强服务与 openXYOS 的本机定制工作台结合起来，帮助团队把行业经验转化为可运行、可迭代、可独立交付的管理系统。

## 能做什么

- 创建并编排专家、智能助手、流程、知识库和组织能力。
- 在 openXYOS 本地工作台中按行业需求定制角色、界面与自动化。
- 配置自己的模型后，启用智能体、群聊、知识加工与生成能力。
- 使用 FreeOS 的模板、治理、质量校验和装配能力，并导出独立部署的系统代码。

## 快速开始

Windows 用户可从 [Releases](https://github.com/XYAIStudio/FreeOS/releases/latest) 下载匹配架构的安装包。源码运行：

```bash
git clone https://github.com/XYAIStudio/FreeOS.git
cd FreeOS
uv sync
uv run freeos run
```

本地 openXYOS 的账户与模型设置由用户自己控制；FreeOS 账户只管理其云端与付费增强服务。不要将 API Key、令牌或真实客户资料提交到公开仓库。

完整功能、架构和发布说明请见 [English README](README.md) 与 [Wiki](https://github.com/XYAIStudio/FreeOS/wiki)。
