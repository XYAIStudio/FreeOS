# FreeOS

> **繁體中文** · [English](README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Français](README.fr.md) · [Español](README.es.md) · [Русский](README.ru.md)

FreeOS 是一個面向組織協作、知識沉澱與智慧代理編排的開源、本機優先平台。它結合 FreeOS 的增強服務與 openXYOS 的本機自訂工作台，協助團隊把產業經驗轉化為可運行、可迭代且可獨立交付的管理系統。

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

openXYOS 的本機帳號與模型設定由使用者自行控制；FreeOS 帳號僅管理其雲端與付費增強服務。請勿將 API Key、權杖或真實客戶資料提交到公開倉庫。

完整功能、架構與發布說明請參閱 [English README](README.md) 與 [Wiki](https://github.com/XYAIStudio/FreeOS/wiki)。
