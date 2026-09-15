# openXYOS 概要・インストールガイド

openXYOS は、人機組織のためのオープンソース・オペレーティングシステムです。多階層組織、マルチテナント、設定可能なモジュール、人機インタラクション、エージェント作成、タスク管理、ナレッジ管理の汎用機能を提供します。ローカル評価、拡張開発、コミュニティ協働を目的としています。

## 機能範囲

ログイン後は、ワークスペース、お知らせ、組織、人機リソース、スキルとプラグイン、コラボレーション、エージェントスタジオ、タスク、ナレッジ、リフレクション、ガバナンス、設定を利用できます。管理者は「設定 → モジュール管理」で設定可能なモジュールを有効化・無効化し、表示名を変更できます。ワークスペースと設定は常に利用可能です。

## ローカルインストール

前提条件：Node.js 20.19 以降。

```bash
git clone <your-fork-or-repository-url>
cd openXYOS
npm ci
cp .env.example .env
npm run dev
```

Windows PowerShell では `Copy-Item .env.example .env` を使用してください。起動前に `.env` の `JWT_SECRET` と `COOKIE_SECRET` を強力な値へ変更し、このファイルをコミットしないでください。ブラウザは `http://localhost:5174`、API は標準で `http://localhost:3000/api` です。

## 検証

```bash
npm run lint
npm run typecheck
npm test
npm run verify:open-source
npm run build
```

詳細な画面操作は[英語の操作ガイド](../guides/operation-guide.en.md)を参照してください。
