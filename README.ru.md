# FreeOS

> **Русский** · [English](README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Français](README.fr.md) · [Español](README.es.md)

<p>
  <a href="https://github.com/TencentCloud/Octop"><img alt="Upstream: Octop" src="https://img.shields.io/badge/Upstream-Octop-1677ff.svg?style=flat" /></a>
  <a href="https://github.com/XYAIStudio/openXYOS"><img alt="Organization module: openXYOS" src="https://img.shields.io/badge/Organization-openXYOS-0f766e.svg?style=flat" /></a>
</p>
FreeOS объединяет Octop и openXYOS в одной самостоятельно размещаемой платформе. Модели и базы знаний — по возможности локально. Активы усиливают друг друга. Цель — экспорт нового исходного кода openXYOS. Курс: перенести openXYOS **в** хост, а не навсегда встраивать Node. Контракт: [product-contract.md](docs/product-contract.md).

## Возможности

- Создание и оркестрация экспертов, ИИ-помощников, процессов, баз знаний и организационных функций.
- Настройка ролей, интерфейсов и автоматизации в локальном рабочем пространстве openXYOS.
- Активация агентов, группового чата, обработки знаний и генерации после подключения собственной модели.
- Использование шаблонов, управления, проверки качества и сборки FreeOS с экспортом кода независимой системы.

## Быстрый старт

Пользователи Windows могут скачать подходящий установщик в [Releases](https://github.com/XYAIStudio/FreeOS/releases/latest). Запуск из исходного кода:

```bash
git clone https://github.com/XYAIStudio/FreeOS.git
cd FreeOS
uv sync
uv run freeos run
```

FreeOS больше похож на свою студию: сначала устраиваетесь локально — регистрация, вход, данные и сессии под рукой. Более широкие сервисы или лицензии могут открыться позже, по желанию, не закрывая старт. Организационные возможности — как ещё одна комната этой студии, которую можно обставить отдельно: тот же FreeOS, что повседневный чат и помощники, но два входа не сливаются в один. Не публикуйте API-ключи, токены и реальные данные клиентов.

Подробности доступны в [английском README](README.md) и [Wiki](https://github.com/XYAIStudio/FreeOS/wiki).

