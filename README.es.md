# FreeOS

> **Español** · [English](README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Français](README.fr.md) · [Русский](README.ru.md)

<p>
  <a href="https://github.com/TencentCloud/Octop"><img alt="Upstream: Octop" src="https://img.shields.io/badge/upstream-Octop-MIT-1677ff" /></a>
  <a href="https://github.com/XYAIStudio/openXYOS"><img alt="Organization module: openXYOS" src="https://img.shields.io/badge/organization-openXYOS-Apache--2.0-0f766e" /></a>
</p>
FreeOS reúne Octop y openXYOS en una sola plataforma autoalojada. Modelos y bases de conocimiento lo más locales posible. Los activos se refuerzan entre sí. El objetivo incluye exportar un nuevo código fuente openXYOS. Dirección: migrar openXYOS **al** anfitrión, no incrustar Node para siempre. Contrato: [product-contract.md](docs/product-contract.md).

## Capacidades

- Crear y orquestar expertos, asistentes de IA, flujos de trabajo, bases de conocimiento y capacidades organizativas.
- Personalizar roles, interfaces y automatizaciones en el espacio de trabajo local openXYOS.
- Activar agentes, chat grupal, procesamiento de conocimiento y generación después de configurar su propio modelo.
- Usar plantillas, gobierno, controles de calidad y ensamblaje de FreeOS, y exportar código para un sistema independiente.

## Inicio rápido

Los usuarios de Windows pueden descargar el instalador adecuado desde [Releases](https://github.com/XYAIStudio/FreeOS/releases/latest). Para ejecutar desde el código fuente:

```bash
git clone https://github.com/XYAIStudio/FreeOS.git
cd FreeOS
uv sync
uv run freeos run
```

Empiece registrándose e iniciando sesión en su propio entorno; los datos y las sesiones quedan en local. Una cuenta externa o una licencia comercial podrá abrirse más adelante, de forma opcional, no como requisito de partida. Las capacidades de organización aparecen como un espacio de trabajo relativamente aparte, que colabora con el uso cotidiano del anfitrión y mantiene un límite claro. No publique claves API, tokens ni datos reales de clientes.

Consulte el [README en inglés](README.md) y el [Wiki](https://github.com/XYAIStudio/FreeOS/wiki) para más información.

