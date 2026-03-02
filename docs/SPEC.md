# Simple Image Editor - Project Specification

## Overview

VSCode에서 이미지(PNG, JPG, SVG, GIF)를 보고 편집할 수 있는 익스텐션.
Rust(WebAssembly) 기반 이미지 엔진과 React.js UI를 결합하여 빠르고 안정적인 편집 환경을 제공한다.

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Extension Host | TypeScript / Node.js | VSCode API, 파일 I/O, AI API 호출 |
| Webview UI | React.js + Zustand | 에디터 UI, 상태 관리 |
| Image Engine | Rust → WebAssembly | 픽셀 연산, 필터, 레이어 합성, 인코딩 |
| Package Manager | pnpm | 의존성 관리 |
| Test Framework | Vitest + cargo test | TDD 기반 개발 |
| Node.js | v22.16.0 (.nvmrc) | 런타임 |

## Entry Points

### 1. Explorer에서 이미지 파일 클릭
- 지원 형식: `.png`, `.jpg`, `.jpeg`, `.svg`, `.gif`
- `CustomEditorProvider`로 등록 (priority: `"default"`)
- 기본 뷰어 모드로 열림

### 2. Command Palette: "New Image"
- `Cmd+Shift+P` → "Image Editor: New Image"
- 빈 캔버스로 에디터 모드 바로 진입

## Modes

### Viewer Mode (기본)
- 이미지를 캔버스에 표시
- 줌/팬 지원 (스크롤 휠, 드래그)
- 우측 상단 **Edit** 버튼 → 에디터 모드 전환

### Editor Mode
- 전체 편집 기능 활성화
- 레이아웃: Toolbar (상단) | Canvas (중앙) | Sidebar Tabs (우측)

## Tools

| Tool | Description | Shortcut |
|------|------------|----------|
| Select | 오브젝트 선택/이동, 바운딩 박스 핸들 | V |
| Marquee | 사각 영역 선택, marching ants | M |
| Brush | 프리핸드 드로잉, 크기/경도/색상 조절 | B |
| Text | 텍스트 배치 및 래스터화 | T |
| Zoom | 확대/축소, 뷰포트 맞춤 | Z |

## Features

### Layer System
- 레이어 추가/삭제/복제/병합
- 드래그 앤 드롭으로 순서 변경
- 가시성 토글 (눈 아이콘)
- 투명도(opacity) 슬라이더
- 썸네일 미리보기
- Porter-Duff "over" 알파 합성 (WASM)

### History (Undo/Redo)
- `Cmd+Z` / `Cmd+Shift+Z`
- Region-based snapshot (메모리 효율)
- 최대 50개 히스토리 스택
- 히스토리 패널에서 시점 클릭으로 이동
- VSCode dirty 상태 자동 동기화

### Fill & Stroke
- Fill: 선택 영역 또는 전체 레이어 색상 채우기 (`Alt+Backspace`)
- Stroke: 선택 영역 테두리 그리기
- 컬러 피커, 크기/투명도 슬라이더

### Clipboard
- `Cmd+C` Copy / `Cmd+X` Cut / `Cmd+V` Paste
- Paste는 새 레이어에 배치
- WASM 내부 클립보드 버퍼

### Filters
- Gaussian Blur (분리형 1D 커널)
- Box Blur (슬라이딩 윈도우)
- Motion Blur (각도 방향)
- 선택 영역 제한 적용 가능
- 라이브 프리뷰 + Apply/Cancel
- Web Worker에서 실행 (UI 논블로킹)

### Save / Export
- `Cmd+S`: 기존 파일 → 원본 형식 유지 저장
- `Cmd+S` (새 파일): 형식 선택 다이얼로그 → 네이티브 저장
- `Cmd+Shift+S`: Save As (형식 변환 가능)
- 지원 형식: PNG (lossless), JPEG (품질 조절), GIF
- 저장 파이프라인: 레이어 합성 → WASM encode → 파일 쓰기

### AI Image Generation
- 우측 사이드바 **AI** 탭
- 지원 프로바이더:
  - **OpenAI DALL-E** (dall-e-3)
  - **Google Imagen**
- 생성 대상:
  - 캔버스 전체: 캔버스 크기에 맞게 생성 → 새 레이어에 배치
  - 선택 영역: 선택 영역 크기에 맞게 생성 → 해당 위치의 새 레이어에 배치
- 프롬프트 입력 + 결과 미리보기 → Apply
- API 키: VSCode `SecretStorage`에 안전 저장
- API 호출은 Extension Host에서만 수행 (Webview에 키 미전달)

## Sidebar Tabs

우측 사이드바는 3개 탭으로 구성:

| Tab | Contents |
|-----|----------|
| **Layers** | 레이어 목록, 추가/삭제, 정렬, 가시성, 투명도 |
| **Properties** | Fill/Stroke 속성, 히스토리 목록 |
| **AI** | AI 이미지 생성, 프로바이더 선택, API 키 설정 |

## Development Methodology

**TDD (Test-Driven Development)** — 모든 기능에 대해:
1. **RED**: 실패하는 테스트 먼저 작성
2. **GREEN**: 테스트를 통과하는 최소 구현
3. **REFACTOR**: 코드 정리

### Test Commands
```bash
pnpm test              # 전체 테스트
pnpm test:rust         # Rust 유닛 테스트
pnpm test:wasm         # WASM 통합 테스트
pnpm test:webview      # React 컴포넌트/상태 테스트
pnpm test:extension    # Extension Host 테스트
pnpm test:e2e          # E2E 통합 테스트
```

### Build & Package
```bash
pnpm build             # 전체 빌드 (WASM + Webpack)
pnpm package           # .vsix 패키지 생성
pnpm dev               # 개발 모드 (watch + WASM dev)
```

## Implementation Phases

| Phase | Name | Dependencies |
|-------|------|-------------|
| 0 | 프로젝트 스캐폴딩 + 테스트 인프라 | - |
| 1 | Extension 스켈레톤 | Phase 0 |
| 2 | Rust WASM 엔진 | Phase 0 |
| 3 | React UI (뷰어/에디터 모드) | Phase 1, 2 |
| 4 | 핵심 도구 (선택, 브러시, 텍스트, 줌) | Phase 3 |
| 5 | 레이어 시스템 | Phase 3 |
| 6 | History (Undo/Redo) | Phase 4, 5 |
| 7 | Fill, Stroke, Clipboard | Phase 6 |
| 8 | 필터 (Blur 계열) | Phase 6 |
| 9 | 저장/내보내기 | Phase 5 |
| 10 | AI 이미지 생성 | Phase 4, 5 |

병렬 가능: Phase 1+2, Phase 4+5, Phase 7+8, Phase 9+10
