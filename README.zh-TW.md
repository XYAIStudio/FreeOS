# FreeOS

> **繁體中文** · [English](README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Français](README.fr.md) · [Español](README.es.md) · [Русский](README.ru.md)

<p>
  <a href="https://github.com/TencentCloud/Octop"><img alt="Upstream: Octop" src="https://img.shields.io/badge/upstream-Octop-MIT-1677ff" /></a>
  <a href="https://github.com/XYAIStudio/openXYOS"><img alt="Organization module: openXYOS" src="https://img.shields.io/badge/organization-openXYOS-Apache--2.0-0f766e" /></a>
</p>
FreeOS 是一個面向組織協作、知識沉澱與智慧代理編排的開源、本機優先平台。它把 Octop 與 openXYOS 合在同一套自託管安裝裡：模型與知識庫盡量本機；兩邊資產互通；最終可匯出新的 openXYOS 系統原始碼。方向是把 openXYOS **遷入** 宿主，而不是永久嵌入大型 Node。產品契約：[English](docs/product-contract.md) · [簡體中文](docs/product-contract.zh-CN.md)。

## 可以做什麼

- 建立與編排專家、智慧助理、流程、知識庫及組織能力。
- 在 openXYOS 本機工作台中依產業需求自訂角色、介面與自動化。
- 設定自己的模型後，啟用智慧代理、群組聊天、知識加工與生成能力。
- 使用 FreeOS 的範本、治理、品質檢查與組裝能力，並匯出可獨立部署的系統程式碼。

## 快速開始

Windows 使用者可從 [Releases](https://github.com/XYAIStudio/FreeOS/releases/latest) 下載對應架構的安裝程式。從原始碼執行：

```bash
git clone https://github.com/XYAIStudio/FreeOS.git
cd FreeOS
uv sync
uv run freeos run
```

FreeOS 更像你自己的工作室：先在本機安頓好，註冊登入、資料與工作階段留在夠得著的地方。更廣的服務或授權之後可選打開，不擋起步。組織能力像工作室裡另一間可獨立布置的房間，與日常對話、助手同在一個 FreeOS，兩種進入方式不捏成一種。請勿將 API Key、權杖或真實客戶資料提交到公開倉庫。

完整功能、架構與發布說明請參閱 [English README](README.md) 與 [Wiki](https://github.com/XYAIStudio/FreeOS/wiki)。

