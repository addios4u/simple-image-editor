# Simple Image Editor — Claude Code Context

## Project Overview

VSCode 이미지 에디터 익스텐션. Rust(WASM) 엔진 + React UI + TypeScript Extension Host.

## Quick Reference

### Commands
```bash
pnpm install              # 의존성 설치
pnpm build                # 전체 빌드 (WASM + Webpack)
pnpm build:wasm           # Rust → WASM 빌드
pnpm build:webpack        # TypeScript/React 빌드
pnpm dev                  # 개발 모드 (watch + WASM dev)
pnpm test                 # 전체 테스트 (Rust + Extension + Webview)
pnpm test:rust            # Rust 유닛 테스트 (cargo test)
pnpm test:wasm            # WASM 브라우저 테스트 (Chrome 필요)
pnpm test:webview         # React 컴포넌트/상태 테스트 (Vitest + jsdom)
pnpm test:extension       # Extension Host 테스트 (Vitest)
pnpm test:e2e             # E2E 통합 테스트
pnpm test:watch           # Webview 테스트 watch 모드
pnpm package              # 빌드 + dist/sie-{version}.vsix 생성
```

### Prerequisites
- **Node.js**: v20+ (vsce 패키징에 필요, `nvm use 20`)
- **Rust**: rustup (Homebrew Rust 아님) + `wasm32-unknown-unknown` 타겟
- **wasm-pack**: `cargo install wasm-pack`

### Debug
- F5 → Extension Development Host 실행

## Tech Stack

- **Node.js**: v20+ (패키징 시 필수)
- **Package Manager**: pnpm
- **Extension Host**: TypeScript (CommonJS, target ES2022)
- **Webview UI**: React 18 + Zustand + CSS
- **Image Engine**: Rust → WebAssembly (wasm-pack, target web)
- **Build**: Webpack (dual target: node + web)
- **Test**: Vitest (TS/React) + cargo test (Rust)

## Project Structure

```
src/extension/     # VSCode Extension Host (TypeScript)
src/webview/       # React Webview App
src/engine/        # Rust WASM Crate
test/              # E2E 테스트 + fixtures
docs/              # 프로젝트 문서 (SPEC, AGENTS, ARCHITECTURE)
```

## Key Files

- `src/extension/imageEditorProvider.ts` — CustomEditorProvider (핵심 진입점)
- `src/extension/imageDocument.ts` — CustomDocument 모델
- `src/extension/aiService.ts` — AI API 호출 (DALL-E, Google)
- `src/webview/App.tsx` — React 루트 (뷰어/에디터 모드 라우팅)
- `src/webview/components/Canvas.tsx` — HTML Canvas 렌더링 + 도구 이벤트
- `src/webview/engine/wasmBridge.ts` — WASM 초기화 + API 래퍼
- `src/engine/src/lib.rs` — WASM 진입점
- `src/engine/src/canvas.rs` — PixelBuffer (핵심 데이터 구조)

## Development Rules

### Commit Policy (필수)
- **작업 단위별 즉시 커밋**: 하나의 기능/수정이 완료되면 바로 커밋한다
- 여러 작업을 모아서 한 번에 커밋하지 않는다
- 커밋 메시지는 한글로 작성하되, conventional commits 형식을 따른다
- 예: `feat: 브러시 도구 구현`, `fix: aiService 타입 오류 수정`, `test: 필터 테스트 추가`
- 테스트와 구현은 같은 커밋에 포함해도 된다
- 빌드/설정 변경은 별도 커밋으로 분리한다

### TDD Required
모든 기능은 테스트 먼저 작성 (RED → GREEN → REFACTOR)

### Code Conventions
- 패키지 매니저: pnpm (npm/yarn 사용 금지)
- Extension Host: CommonJS module
- Webview: ESM module
- Rust WASM: `#[wasm_bindgen]`으로 JS 노출 함수 명시
- 상태 관리: Zustand (Redux 사용 금지)
- 테스트 파일: 각 소스 디렉토리의 `__tests__/` 하위에 배치
- Rust 테스트: `src/engine/tests/` + 모듈 내 `#[cfg(test)]`

### Security
- API 키는 Extension Host의 SecretStorage에만 저장
- Webview에 API 키 전달 금지
- AI API 호출은 Extension Host에서만 수행
- Webview CSP에 `'wasm-unsafe-eval'` 필수

### Architecture Constraints
- Extension ↔ Webview 통신: postMessage만 사용
- 픽셀 연산: 반드시 Rust WASM에서 수행 (JS에서 직접 픽셀 조작 금지)
- 무거운 연산 (필터, 인코딩): Web Worker에서 실행
- `retainContextWhenHidden: true` 필수 (WASM 상태 유지)

## Multi-Agent Workflow

에이전트 팀 구조에 대한 상세 정보: `docs/AGENTS.md` 참조

- **Orchestrator**: 총괄 관리, 사용자 보고
- **Test Writer**: 테스트 먼저 작성 (RED)
- **Developer**: 구현 코드 작성 (GREEN + REFACTOR)
- **Verifier**: 테스트 실행, 오류 분석 및 리포트

### Phase별 작업 순서
1. Test Writer가 테스트 작성
2. Verifier가 RED 상태 확인
3. Developer가 구현
4. Verifier가 전체 테스트 실행
5. 실패 시 → 오류 분석 후 담당 에이전트에게 리포트
6. 통과 시 → Orchestrator가 Phase 완료 선언

## Documentation

- `docs/SPEC.md` — 프로젝트 사양서 (기능 명세)
- `docs/AGENTS.md` — 에이전트 팀 워크플로우
- `docs/ARCHITECTURE.md` — 아키텍처 상세 (데이터 흐름, 메모리 구조)
