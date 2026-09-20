# FreeOS

> **Português** · [English](README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Français](README.fr.md) · [Español](README.es.md) · [Русский](README.ru.md) · [العربية](README.ar.md)

<p>
  <a href="https://github.com/TencentCloud/Octop"><img alt="Upstream: Octop" src="https://img.shields.io/badge/Upstream-Octop-1677ff.svg?style=flat" /></a>
  <a href="https://github.com/XYAIStudio/openXYOS"><img alt="Organization module: openXYOS" src="https://img.shields.io/badge/Organization-openXYOS-0f766e.svg?style=flat" /></a>
</p>

**Your FreeOS, free for you.**

FreeOS: um estúdio de IA livre; o espaço da imaginação é você quem abre.

O FreeOS reúne Octop e openXYOS em uma só plataforma auto-hospedada. Modelos e bases de conhecimento o mais locais possível. Os ativos se reforçam mutuamente. O objetivo inclui exportar um novo código-fonte openXYOS. Direção: migrar o openXYOS **para** o host, não embutir Node para sempre. Contrato: [product-contract.md](docs/product-contract.md).

## Capacidades

- Criar e orquestrar especialistas, assistentes de IA, fluxos de trabalho, bases de conhecimento e capacidades organizacionais.
- Personalizar papéis, interfaces e automações no espaço de trabalho local do openXYOS.
- Ativar agentes, chat em grupo, processamento de conhecimento e geração depois de configurar o próprio modelo.
- Usar modelos, governança, controles de qualidade e montagem do FreeOS, e exportar código para um sistema independente.

## Início rápido

Usuários Windows podem baixar o instalador adequado em [Releases](https://github.com/XYAIStudio/FreeOS/releases/latest). Para executar a partir do código-fonte:

```bash
git clone https://github.com/XYAIStudio/FreeOS.git
cd FreeOS
uv sync
uv run freeos run
```

O FreeOS se parece mais com um estúdio seu: primeiro você se instala localmente, com cadastro, login, dados e sessões ao alcance. Serviços ou licenças mais amplos poderão abrir depois, de forma opcional, sem fechar o começo. As capacidades de organização são como outro cômodo desse estúdio, para você arrumar do seu jeito — o mesmo FreeOS do chat e dos assistentes do dia a dia, sem fundir as duas formas de entrar em uma só. Não publique chaves de API, tokens nem dados reais de clientes.

Consulte o [README em inglês](README.md) e o [Wiki](https://github.com/XYAIStudio/FreeOS/wiki) para mais informações.
