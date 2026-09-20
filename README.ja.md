# FreeOS

> **日本語** · [English](README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [한국어](README.ko.md) · [Français](README.fr.md) · [Español](README.es.md) · [Português](README.pt.md) · [Русский](README.ru.md) · [العربية](README.ar.md)

<p>
  <a href="https://github.com/TencentCloud/Octop"><img alt="Upstream: Octop" src="https://img.shields.io/badge/Upstream-Octop-1677ff.svg?style=flat" /></a>
  <a href="https://github.com/XYAIStudio/openXYOS"><img alt="Organization module: openXYOS" src="https://img.shields.io/badge/Organization-openXYOS-0f766e.svg?style=flat" /></a>
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

FreeOS は自分のスタジオに近いものです。まずは手元で落ち着き、登録・ログイン、データとセッションを届く範囲に置きます。より広いサービスやライセンスは後から任意で開き、開始を妨げません。組織機能はスタジオのもう一部屋として独自に整えられ、日常の対話やアシスタントと同じ FreeOS にありつつ、入り方はひとつにまとめません。API Key、トークン、実データを公開リポジトリへ送信しないでください。

詳細は [English README](README.md) と [Wiki](https://github.com/XYAIStudio/FreeOS/wiki) を参照してください。

