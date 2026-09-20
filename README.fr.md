# FreeOS

> **Français** · [English](README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Русский](README.ru.md)

<p>
  <a href="https://github.com/TencentCloud/Octop"><img alt="Upstream: Octop" src="https://img.shields.io/badge/upstream-Octop-MIT-1677ff" /></a>
  <a href="https://github.com/XYAIStudio/openXYOS"><img alt="Organization module: openXYOS" src="https://img.shields.io/badge/organization-openXYOS-Apache--2.0-0f766e" /></a>
</p>
FreeOS est une plateforme open source, locale par défaut, destinée à la collaboration organisationnelle, à la capitalisation des connaissances et à l’orchestration d’agents IA. Elle associe les services d’extension de FreeOS à l’espace de personnalisation local openXYOS afin de transformer l’expérience métier en systèmes de gestion exécutables, évolutifs et déployables de façon indépendante.

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

Les comptes locaux et les paramètres de modèle d’openXYOS restent sous le contrôle de l’utilisateur. Le compte FreeOS ne gère que les services cloud et les extensions payantes. Ne publiez jamais de clé API, jeton ou donnée client réelle.

Consultez le [README anglais](README.md) et le [Wiki](https://github.com/XYAIStudio/FreeOS/wiki) pour les détails.

