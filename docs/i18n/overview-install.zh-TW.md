# openXYOS 繁體中文簡介與安裝指南

openXYOS 是面向人機組織的開源作業系統，提供多層級組織、多租戶、可設定模組、人機互動、智慧體自訂、任務與知識管理等通用能力，適合本機評估、二次開發與社群協作。

## 系統範圍

登入後可使用工作臺、通知公告、組織架構、人機資源、技能外掛、溝通協作、智慧體自訂、任務管理、知識庫、反思引擎、治理引擎和系統設定。管理員可在「系統設定 → 模組管理」啟停可設定模組並修改顯示名稱；工作臺和系統設定會保留。

## 本機安裝

需求：Node.js 20.19 或更新版本。

```bash
git clone <your-fork-or-repository-url>
cd openXYOS
npm ci
cp .env.example .env
npm run dev
```

Windows PowerShell 使用 `Copy-Item .env.example .env`。啟動前請在 `.env` 設定強度足夠的 `JWT_SECRET` 與 `COOKIE_SECRET`，且不要提交此檔案。瀏覽器網址為 `http://localhost:5174`，API 預設為 `http://localhost:3000/api`。

## 驗證

```bash
npm run lint
npm run typecheck
npm test
npm run verify:open-source
npm run build
```

詳細操作請參考[簡體中文操作指南](../guides/operation-guide.zh-CN.md)或[English guide](../guides/operation-guide.en.md)。
