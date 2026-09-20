# FreeOS

> **한국어** · [English](README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [日本語](README.ja.md) · [Français](README.fr.md) · [Español](README.es.md) · [Русский](README.ru.md)

<p>
  <a href="https://github.com/TencentCloud/Octop"><img alt="Upstream: Octop" src="https://img.shields.io/badge/upstream-Octop-MIT-1677ff" /></a>
  <a href="https://github.com/XYAIStudio/openXYOS"><img alt="Organization module: openXYOS" src="https://img.shields.io/badge/organization-openXYOS-Apache--2.0-0f766e" /></a>
</p>
FreeOS는 Octop과 openXYOS를 하나의 셀프호스트 플랫폼에 모읍니다. 모델과 지식 베이스는 가능한 한 로컬. 자산은 서로 강화하고, 최종적으로 새로운 openXYOS 소스를 내보낼 수 있습니다. 방향은 큰 Node 런타임을 영구 내장하는 것이 아니라 openXYOS를 호스트로 **네이티브 이전**하는 것입니다. 계약: [product-contract.md](docs/product-contract.md).

## 주요 기능

- 전문가 에이전트, AI 도우미, 업무 흐름, 지식 베이스 및 조직 기능을 생성하고 편성합니다.
- openXYOS 로컬 작업 공간에서 역할, 화면 및 자동화를 산업 요구에 맞게 맞춤화합니다.
- 자체 모델을 설정한 후 에이전트, 그룹 채팅, 지식 처리 및 생성 기능을 사용합니다.
- FreeOS의 템플릿, 거버넌스, 품질 검증 및 조립 기능을 사용하고 독립 배포 가능한 시스템 코드를 내보냅니다.

## 시작하기

Windows 사용자는 [Releases](https://github.com/XYAIStudio/FreeOS/releases/latest)에서 환경에 맞는 설치 프로그램을 내려받을 수 있습니다. 소스에서 실행하려면:

```bash
git clone https://github.com/XYAIStudio/FreeOS.git
cd FreeOS
uv sync
uv run freeos run
```

먼저 자신의 환경에서 가입·로그인하고, 데이터와 세션을 로컬에 둡니다. 외부 계정과 상용 라이선스는 나중에 선택적으로 열 수 있으며 시작 조건이 아닙니다. 조직 기능은 비교적 독립된 작업 공간으로 나타나며, 호스트의 일상 사용과 함께 가되 경계를 유지합니다. API Key, 토큰 또는 실제 고객 데이터를 공개 저장소에 올리지 마십시오.

자세한 내용은 [English README](README.md) 및 [Wiki](https://github.com/XYAIStudio/FreeOS/wiki)를 참조하십시오.

