# FreeOS

> **Français** · [English](README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Русский](README.ru.md)

<p>
  <a href="https://github.com/TencentCloud/Octop"><img alt="Upstream: Octop" src="https://img.shields.io/badge/Upstream-Octop-1677ff.svg?style=flat" /></a>
  <a href="https://github.com/XYAIStudio/openXYOS"><img alt="Organization module: openXYOS" src="https://img.shields.io/badge/Organization-openXYOS-0f766e.svg?style=flat" /></a>
</p>
FreeOS réunit Octop et openXYOS sur une seule plateforme auto-hébergée. Modèles et bases de connaissances d’abord en local. Les actifs des deux mondes s’enrichissent. On doit pouvoir exporter une nouvelle source openXYOS. La direction : migrer openXYOS **dans** l’hôte, pas embarquer Node pour toujours. Contrat : [product-contract.md](docs/product-contract.md).

## Capacités

- Créer et orchestrer des experts, assistants IA, processus, bases de connaissances et fonctions d’organisation.
- Personnaliser rôles, interfaces et automatisations dans l’espace local openXYOS.
- Activer les agents, discussions de groupe, traitements de connaissances et fonctions de génération après configuration de votre modèle.
- Utiliser les modèles, la gouvernance, les contrôles qualité et l’assemblage de FreeOS, puis exporter un système autonome.

## Démarrage rapide

Les utilisateurs Windows peuvent télécharger l’installeur adapté depuis [Releases](https://github.com/XYAIStudio/FreeOS/releases/latest). Depuis les sources :

```bash
git clone https://github.com/XYAIStudio/FreeOS.git
cd FreeOS
uv sync
uv run freeos run
```

FreeOS ressemble davantage à un studio à soi : on s’installe d’abord en local, inscription, connexion, données et sessions à portée de main. Des services ou licences plus larges pourront s’ouvrir plus tard, en option, sans barrer le départ. Les capacités d’organisation sont comme une autre pièce de ce studio, à aménager librement — même FreeOS que le chat et les assistants du quotidien, sans fondre les deux façons d’entrer en une seule. Ne publiez jamais de clé API, jeton ou donnée client réelle.

Consultez le [README anglais](README.md) et le [Wiki](https://github.com/XYAIStudio/FreeOS/wiki) pour les détails.

