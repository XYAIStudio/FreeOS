# openXYOS 소개 및 설치 안내

openXYOS는 인간과 AI 에이전트가 함께 일하는 조직을 위한 오픈 소스 운영 체제입니다. 다계층 조직, 멀티 테넌시, 구성 가능한 모듈, 인간-AI 상호작용, 에이전트 맞춤화, 작업 및 지식 관리 기능을 제공합니다. 로컬 평가, 확장 개발 및 커뮤니티 협업을 위해 설계되었습니다.

## 제품 범위

로그인 후 워크스페이스, 공지, 조직, 인적·AI 자원, 스킬 및 플러그인, 협업, 에이전트 스튜디오, 작업, 지식, 회고, 거버넌스 및 설정을 사용할 수 있습니다. 관리자는 **설정 → 모듈 관리**에서 구성 가능한 모듈을 켜거나 끄고 표시 이름을 변경할 수 있습니다. 워크스페이스와 설정은 기본 진입점으로 유지됩니다.

## 로컬 설치

요구 사항: Node.js 20.19 이상.

```bash
git clone <your-fork-or-repository-url>
cd openXYOS
npm ci
cp .env.example .env
npm run dev
```

Windows PowerShell에서는 `Copy-Item .env.example .env`를 사용합니다. 시작 전 `.env`의 `JWT_SECRET` 및 `COOKIE_SECRET`을 강력한 값으로 변경하고 해당 파일을 커밋하지 마십시오. 브라우저 주소는 `http://localhost:5174`, 기본 API 주소는 `http://localhost:3000/api`입니다.

## 검증

```bash
npm run lint
npm run typecheck
npm test
npm run verify:open-source
npm run build
```

자세한 화면 사용법은 [English operation guide](../guides/operation-guide.en.md)를 참조하십시오.
