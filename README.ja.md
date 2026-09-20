# FreeOS

> **日本語** · [English](README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [한국어](README.ko.md) · [Français](README.fr.md) · [Español](README.es.md) · [Русский](README.ru.md)

FreeOS は、組織協働、知識の蓄積、AI エージェントのオーケストレーションのための、オープンソースかつローカル優先のプラットフォームです。FreeOS の拡張サービスと openXYOS のローカルなカスタマイズ環境を組み合わせ、業界の知見を実行可能で継続的に改善でき、独立して提供できる管理システムへ変換します。

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

openXYOS のローカルアカウントとモデル設定は利用者が管理します。FreeOS アカウントはクラウドおよび有料拡張サービスだけを管理します。API Key、トークン、実データを公開リポジトリへ送信しないでください。

詳細は [English README](README.md) と [Wiki](https://github.com/XYAIStudio/FreeOS/wiki) を参照してください。
