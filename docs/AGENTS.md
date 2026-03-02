# Multi-Agent Team Workflow

## Overview

4개의 전문 에이전트가 TDD 기반으로 협업하여 프로젝트를 진행한다.
에이전트 간 통신과 피드백 루프를 통해 품질을 보장하며, 병렬 실행으로 속도를 극대화한다.

## Team Structure

```
┌─────────────────────────────────────────────────────────────┐
│                    Orchestrator (총괄)                        │
│                                                             │
│  - Phase별 진행 상황 관리 및 사용자 보고                        │
│  - 에이전트 작업 할당, 순서 조율, 병렬 실행 관리                 │
│  - 교착 상태 감지 및 해결                                      │
│  - pnpm test 전체 통과 확인 후 Phase 완료 선언                  │
└────────┬──────────────────┬──────────────────┬──────────────┘
         │                  │                  │
         ▼                  ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  Test Writer │  │  Developer   │  │  Verifier    │
│  (테스트 작성) │  │  (구현 개발)   │  │  (검증)      │
│              │  │              │  │              │
│ TDD RED 단계  │  │ TDD GREEN    │  │ 테스트 실행    │
│ 테스트 먼저   │  │ + REFACTOR   │  │ + 오류 분석    │
└──────────────┘  └──────────────┘  └──────────────┘
```

## Agent Roles

### 1. Orchestrator (총괄 에이전트)

**역할**: 프로젝트 매니저 — 전체 흐름 관리 및 사용자 커뮤니케이션

**책임**:
- Phase 시작 전: 스펙 문서(SPEC.md)에서 해당 Phase의 요구사항 추출
- 각 에이전트에게 작업 범위, 대상 파일 목록, 기술 제약 조건 전달
- TDD 사이클 순서 보장: Test Writer → (RED 검증) → Developer → Verifier
- 병렬 가능한 Phase 식별 및 동시 실행 (Phase 1+2, 4+5, 7+8, 9+10)
- Phase 완료 조건 확인: `pnpm test` 전체 통과
- 사용자에게 단계별 진행 보고:
  - Phase 시작/완료 알림
  - 현재 테스트 통과율
  - 발견된 이슈 및 해결 상태
- 교착 상태 감지: Verifier → Test Writer/Developer 피드백 루프가 3회 이상 반복 시 개입

**보고 형식**:
```
## Phase N 진행 보고

### 상태: [진행 중 / 완료 / 블로킹]

### 완료된 작업
- [x] 테스트 작성 (N개 테스트 케이스)
- [x] 구현 코드 작성
- [ ] 검증 통과

### 테스트 결과
- Rust: 12/12 passed
- Webview: 8/10 passed (2 failing)
- Extension: 5/5 passed

### 이슈
- BrushTool.test.ts:42 — point interpolation 로직 누락
  → Developer에게 수정 요청 완료

### 다음 단계
- Developer 수정 후 Verifier 재검증 예정
```

---

### 2. Test Writer (테스트 작성 에이전트)

**역할**: TDD RED 단계 — 실패하는 테스트를 먼저 작성

**책임**:
- Orchestrator로부터 Phase 스펙을 받아 테스트 코드 작성
- 테스트 파일 위치 규약 준수:
  - TypeScript: `__tests__/` 디렉토리, `*.test.ts` / `*.test.tsx`
  - Rust: `tests/` 디렉토리, `*_tests.rs` + 모듈 내 `#[cfg(test)]`
- 테스트 범위:
  - **정상 동작** (happy path)
  - **엣지 케이스** (경계값, 빈 입력, 최대값)
  - **에러 처리** (잘못된 입력, 네트워크 실패)
- WASM 모킹: Webview 테스트에서 WASM 의존성을 모킹하여 격리
- Verifier로부터 오류 리포트 수신 시:
  - 테스트 자체의 결함 → 테스트 수정
  - 테스트 커버리지 부족 → 추가 테스트 작성

**산출물**: 실패하는 테스트 코드 (RED 상태)

**테스트 작성 가이드라인**:
```typescript
// 좋은 테스트: 명확한 의도, 하나의 동작 검증
describe('LayerStore', () => {
  it('should add a new layer above the active layer', () => {
    const store = createLayerStore();
    store.addLayer('Background');
    store.addLayer('Layer 1');  // active layer
    store.addLayer('Layer 2');

    expect(store.layers).toHaveLength(3);
    expect(store.layers[2].name).toBe('Layer 2');
    expect(store.activeLayerId).toBe(store.layers[2].id);
  });

  it('should not remove the last remaining layer', () => {
    const store = createLayerStore();
    store.addLayer('Background');

    expect(() => store.removeLayer(store.layers[0].id)).toThrow();
    expect(store.layers).toHaveLength(1);
  });
});
```

```rust
// Rust 테스트: 픽셀 수준 정확도 검증
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn gaussian_blur_preserves_uniform_region() {
        let mut buf = PixelBuffer::new(10, 10);
        buf.clear(128, 128, 128, 255);
        gaussian_blur(&mut buf, 3.0);
        // 균일한 영역은 블러 후에도 동일해야 함
        for y in 2..8 {
            for x in 2..8 {
                let p = buf.get_pixel(x, y);
                assert_eq!(p, [128, 128, 128, 255]);
            }
        }
    }
}
```

---

### 3. Developer (개발 에이전트)

**역할**: TDD GREEN + REFACTOR 단계 — 테스트를 통과시키는 구현

**책임**:
- Test Writer가 작성한 테스트를 분석하여 요구사항 파악
- 테스트를 통과하는 **최소한의 구현** 작성 (GREEN)
- 코드 정리 및 리팩토링 (REFACTOR) — 테스트는 여전히 통과해야 함
- 대상 코드:
  - TypeScript: Extension Host (`src/extension/`) + Webview (`src/webview/`)
  - Rust: WASM 엔진 (`src/engine/src/`)
- Verifier로부터 오류 리포트 수신 시:
  - 구현 코드의 버그 → 수정
  - 타입 에러, 빌드 실패 → 수정
  - 성능 이슈 → 최적화

**코딩 규칙**:
- 기존 패턴과 유틸리티를 재사용 (새로 만들기 전 기존 코드 검색)
- 과도한 추상화 금지 — 현재 필요한 만큼만 구현
- WASM 바인딩: `#[wasm_bindgen]`으로 JS에 노출할 함수 명확히 정의
- React 컴포넌트: 상태는 Zustand 스토어에, 컴포넌트는 렌더링에 집중
- 보안: API 키는 Extension Host에서만 처리, Webview에 전달 금지

---

### 4. Verifier (검증 에이전트)

**역할**: 품질 게이트 — 테스트 실행, 빌드 검증, 오류 분석 및 리포트

**책임**:
- **RED 검증**: Test Writer 작성 후 테스트가 실패하는지 확인
  - 테스트가 이미 통과하면 → Test Writer에게 리포트 (테스트가 의미 없음)
- **GREEN 검증**: Developer 구현 후 전체 테스트 실행
  - `pnpm test:rust` — Rust 유닛 테스트
  - `pnpm test:webview` — React/Zustand/Tool 테스트
  - `pnpm test:extension` — Extension Host 테스트
  - `pnpm build` — 빌드 성공 여부
- **오류 분석**: 실패 시 원인을 분류하여 적절한 에이전트에게 전달
  - 테스트 코드 자체의 문제 (잘못된 assertion, 설정 누락) → **Test Writer**
  - 구현 코드의 버그 (로직 오류, 타입 불일치) → **Developer**
  - 양쪽 모두 수정 필요 → **양쪽 모두에게** 전달
- **회귀 검증**: 새 Phase 코드가 이전 Phase 테스트를 깨뜨리지 않는지 확인

**산출물**: 검증 결과 리포트

**리포트 형식**:
```
## Verification Report — Phase N

### Test Results
| Suite | Passed | Failed | Total |
|-------|--------|--------|-------|
| Rust (cargo test) | 24 | 0 | 24 |
| Webview (vitest) | 15 | 2 | 17 |
| Extension (vitest) | 8 | 0 | 8 |
| Build (webpack) | ✅ | - | - |

### Failures

#### 1. BrushTool.test.ts:42
- **Test**: "brush_stroke should interpolate points between samples"
- **Error**: Expected WASM brush_stroke to be called with 4 interpolated points, received 2
- **Root Cause**: Implementation — BrushTool.onPointerMove missing interpolation
- **Assigned To**: Developer
- **Affected File**: src/webview/tools/BrushTool.ts:67

#### 2. MarqueeTool.test.ts:28
- **Test**: "shift+drag should constrain to square"
- **Error**: Selection width 150, height 200 — not constrained
- **Root Cause**: Implementation — shift key check not implemented
- **Assigned To**: Developer
- **Affected File**: src/webview/tools/MarqueeTool.ts:34

### Regression Check
- Phase 0-2 tests: All passing ✅
- No regressions detected
```

---

## Workflow: Phase Execution Cycle

```
                    ┌─────────────────────┐
                    │    Orchestrator      │
                    │  Phase N 시작 선언    │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │    Test Writer       │
                    │  테스트 코드 작성     │
                    │  (RED 단계)          │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │     Verifier        │
                    │  RED 검증           │
                    │  (테스트가 실패하는가?)│
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │     Developer       │
                    │  구현 코드 작성      │
                    │  (GREEN 단계)       │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │     Verifier        │
                    │  GREEN 검증         │
                    │  (전체 테스트 실행)   │
                    └──────────┬──────────┘
                               │
                   ┌───────────┼───────────┐
                   │                       │
            ┌──────▼──────┐         ┌──────▼──────┐
            │   통과 ✅    │         │   실패 ❌    │
            └──────┬──────┘         └──────┬──────┘
                   │                       │
        ┌──────────▼──────────┐    ┌───────▼───────┐
        │    Orchestrator     │    │  오류 분석     │
        │  Phase N 완료 보고   │    │  → 담당자 할당  │
        │  → 다음 Phase 시작   │    │  → 수정 루프   │
        └─────────────────────┘    └───────────────┘
```

## Communication Protocol

### Message Format

에이전트 간 메시지는 다음 구조를 따른다:

```json
{
  "from": "verifier",
  "to": "developer",
  "phase": 4,
  "type": "error_report",
  "timestamp": "2024-01-15T10:30:00Z",
  "content": {
    "failing_tests": [
      "BrushTool.test.ts:42 — brush_stroke should interpolate points"
    ],
    "error_message": "Expected 4 calls, received 2",
    "affected_files": ["src/webview/tools/BrushTool.ts"],
    "root_cause": "implementation",
    "suggestion": "Add Catmull-Rom interpolation in onPointerMove between sample points"
  }
}
```

### Message Types

| Type | From | To | Description |
|------|------|----|-------------|
| `phase_start` | Orchestrator | All | Phase 시작, 작업 범위 전달 |
| `tests_ready` | Test Writer | Verifier | 테스트 작성 완료, RED 검증 요청 |
| `red_verified` | Verifier | Developer | 테스트 실패 확인, 구현 요청 |
| `implementation_ready` | Developer | Verifier | 구현 완료, GREEN 검증 요청 |
| `error_report` | Verifier | Test Writer / Developer | 실패 분석 결과 |
| `fix_ready` | Test Writer / Developer | Verifier | 수정 완료, 재검증 요청 |
| `phase_complete` | Verifier | Orchestrator | 전체 테스트 통과 |
| `progress_report` | Orchestrator | User | 진행 상황 보고 |

## Parallel Execution Plan

Phase 의존성 그래프에 따라 병렬 실행 가능한 Phase를 동시에 진행한다.

```
Phase 0 ─────────────────────────────────────────────
         │
         ├── Phase 1 (Extension) ──┐
         │                         ├── Phase 3 (UI) ─────────────────
         └── Phase 2 (WASM) ──────┘         │
                                            ├── Phase 4 (도구) ──┐
                                            │                    ├── Phase 6 ──┐
                                            └── Phase 5 (레이어) ┘             │
                                                                    ├── Phase 7 ──┐
                                                                    └── Phase 8 ──┤
                                                                                  │
                                            Phase 9 (저장) ───────────────────────┘
                                            Phase 10 (AI) ────────────────────────┘
```

| Step | Parallel Tracks | 예상 에이전트 할당 |
|------|----------------|-----------------|
| 1 | Phase 0 | 전체 공동 |
| 2 | Phase 1 + Phase 2 | Track A: Extension, Track B: WASM |
| 3 | Phase 3 | 전체 합류 |
| 4 | Phase 4 + Phase 5 | Track A: 도구, Track B: 레이어 |
| 5 | Phase 6 | 전체 합류 |
| 6 | Phase 7 + Phase 8 | Track A: Clipboard, Track B: 필터 |
| 7 | Phase 9 + Phase 10 | Track A: 저장, Track B: AI |

### 병렬 실행 시 규칙
- 각 Track의 Test Writer/Developer/Verifier 사이클은 독립적으로 운영
- 공유 파일 충돌 방지: 각 Track은 담당 파일만 수정
- 합류 시점에서 Verifier가 전체 통합 테스트 (`pnpm test`) 실행
- 충돌 발생 시 Orchestrator가 중재

## Error Escalation Policy

| Retry Count | Action |
|-------------|--------|
| 1회 실패 | Verifier → 해당 에이전트에게 오류 리포트 |
| 2회 실패 | Verifier → 상세 디버깅 정보 포함 리포트 |
| 3회 실패 | Orchestrator 개입 — 접근 방식 재검토 |
| 4회 이상 | Orchestrator → 사용자에게 보고, 방향 결정 요청 |

## Phase Completion Checklist

각 Phase 완료 시 Orchestrator가 확인하는 항목:

- [ ] Test Writer: 모든 스펙 기능에 대한 테스트 존재
- [ ] Developer: 모든 테스트 통과하는 구현 완료
- [ ] Verifier: `pnpm test` 전체 통과 확인
- [ ] Verifier: `pnpm build` 빌드 성공 확인
- [ ] Verifier: 이전 Phase 회귀 테스트 통과 확인
- [ ] Orchestrator: 사용자에게 진행 보고 완료
