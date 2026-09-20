# FreeOS

> **日本語** · [English](README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [한국어](README.ko.md) · [Français](README.fr.md) · [Español](README.es.md) · [Русский](README.ru.md)

<p>
  <a href="https://github.com/TencentCloud/Octop"><img alt="Upstream: Octop" src="https://img.shields.io/badge/upstream-Octop-MIT-1677ff" /></a>
  <a href="https://github.com/XYAIStudio/openXYOS"><img alt="Organization module: openXYOS" src="https://img.shields.io/badge/organization-openXYOS-Apache--2.0-0f766e" /></a>
</p>
FreeOS は、Octop と openXYOS を一つのセルフホスト基盤にまとめるオープンソースです。モデルとナレッジベースはできるだけローカル。資産は相互に強化し、最終的には新しい openXYOS ソースをエクスポートできます。進む方向は Node を永久同梱することではなく、openXYOS をホストへ **ネイティブ移行** することです。契約: [product-contract.md](docs/product-contract.md)。

## 主な機能

- 専門家エージェント、AI アシスタント、業務フロー、ナレッジベース、組織機能の作成と編成。
- openXYOS のローカルワークスペースで、役割、画面、自動化を業界に合わせてカスタマイズ。
- 自分のモデルを設定した後、エージェント、グループチャット、知識処理、生成機能を利用。
- FreeOS のテンプレート、ガバナンス、品質検証、組み立て機能を利用し、独立配置可能なコードをエクスポート。

## はじめに

Windows 版は [Releases](https://github.com/XYAIStudio/FreeOS/releases/latest) から環境に合うインストーラーを取得できます。ソースから実行する場合：

```bash
git clone https://github.com/XYAIStudio/FreeOS.git
cd FreeOS
uv sync
uv run freeos run
```

まずは自分の環境で登録・ログインし、データとセッションを手元に置きます。外部アカウントや商用ライセンスは後から任意でつなげるものであり、開始条件ではありません。組織機能は比較的独立したワークスペースとして現れ、ホストの日常利用と連携しつつ境界を保ちます。API Key、トークン、実データを公開リポジトリへ送信しないでください。

詳細は [English README](README.md) と [Wiki](https://github.com/XYAIStudio/FreeOS/wiki) を参照してください。

