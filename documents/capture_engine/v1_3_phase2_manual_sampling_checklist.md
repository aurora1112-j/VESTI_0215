# Vesti v1.3 Phase2 Manual Sampling Checklist (Doubao + Qwen)

Date: 2026-02-16  
Owner: QA + Engineering  
Scope: Phase2 only (Doubao, Qwen) + legacy platform regression sanity

---

## 1. Exit Criteria

- Minimum cases completed:
  - Phase2: `Qwen 6 + Doubao 8 = 14`
  - Regression sanity: `4`
  - Total minimum: `18`
- Go threshold:
  - `Blocker = 0`
  - `Major <= 2` (each Major has owner + workaround + re-test plan)
- Identity contract:
  - no stable URL session ID => `held/missing_conversation_id`

---

## 2. Preflight Checklist

- [ ] Latest RC build is loaded
- [ ] `pnpm -C frontend build` passes
- [ ] `pnpm -C frontend package` passes
- [ ] Current IndexedDB snapshot exported as baseline
- [ ] Capture settings verified (`mirror/smart/manual`)
- [ ] Supported hosts available:
  - [ ] `https://www.doubao.com/*`
  - [ ] `https://chat.qwen.ai/*`

Case metadata required for each run:
- Build commit SHA
- Browser version
- Host URL
- Local timestamp

---

## 3. Case Matrix (Phase2 mandatory)

## 3.1 Qwen (6)

1. `V13P2-QWEN-MIRROR-01`  
   - Mode: mirror  
   - Scenario: standard U-A-U-A  
   - Expected: committed (`mode_mirror`)

2. `V13P2-QWEN-MIRROR-02`  
   - Mode: mirror  
   - Scenario: long streaming answer  
   - Expected: no duplicate write amplification

3. `V13P2-QWEN-SMART-01`  
   - Mode: smart (`minTurns=3`)  
   - Scenario: below threshold then threshold reached  
   - Expected: held (`smart_below_min_turns`) then committed (`smart_pass`)

4. `V13P2-QWEN-SMART-02`  
   - Mode: smart (blacklist enabled)  
   - Scenario: keyword hit  
   - Expected: held (`smart_keyword_blocked`)

5. `V13P2-QWEN-MANUAL-01`  
   - Mode: manual  
   - Scenario: normal conversation + archive button  
   - Expected: auto held (`mode_manual_hold`), force committed (`force_archive`)

6. `V13P2-QWEN-MANUAL-02`  
   - Mode: manual  
   - Scenario: no stable session ID URL stage  
   - Expected: force held (`missing_conversation_id`)

## 3.2 Doubao (8)

7. `V13P2-DOUBAO-MIRROR-01`  
   - Mode: mirror  
   - Scenario: standard U-A-U-A  
   - Expected: committed (`mode_mirror`)

8. `V13P2-DOUBAO-MIRROR-02`  
   - Mode: mirror  
   - Scenario: long streaming answer  
   - Expected: no duplicate write amplification

9. `V13P2-DOUBAO-SMART-01`  
   - Mode: smart (`minTurns=3`)  
   - Scenario: threshold crossing  
   - Expected: held then committed

10. `V13P2-DOUBAO-SMART-02`  
    - Mode: smart (blacklist enabled)  
    - Scenario: keyword hit then removed  
    - Expected: held on hit, committed after clean payload

11. `V13P2-DOUBAO-MANUAL-01`  
    - Mode: manual  
    - Scenario: normal conversation + archive button  
    - Expected: auto held, force committed

12. `V13P2-DOUBAO-MANUAL-02`  
    - Mode: manual  
    - Scenario: tab refresh clears transient  
    - Expected: `TRANSIENT_NOT_FOUND`

13. `V13P2-DOUBAO-COT-01`  
    - Mode: mirror  
    - Scenario: CoT + 正式输出并存（同一 assistant turn）  
    - Expected: 单条 `ai` 消息包含 `思考过程` + `正式回答`，正式输出结构完整

14. `V13P2-DOUBAO-COT-02`  
    - Mode: mirror  
    - Scenario: CoT 内含检索挂件/页码/引用计数噪声（如 `2/2`, `参考链接:26`）  
    - Expected: 噪声不落库，不产生独立 assistant 伪消息

---

## 4. Regression Sanity (legacy 4)

15. `V13P2-CHATGPT-R01`  
    - Expected: capture and decision flow unchanged

16. `V13P2-CLAUDE-R02`  
    - Expected: capture and manual archive unchanged

17. `V13P2-GEMINI-R03`  
    - Expected: title + capture flow unchanged

18. `V13P2-DEEPSEEK-R04`  
    - Expected: `.ds-message` parsing unchanged

---

## 5. Per-Case Evidence Checklist (DoD)

- [ ] Case metadata (ID/platform/mode/input/expected/actual/verdict/tester/timestamp)
- [ ] Parser stats snippet
- [ ] Capture decision log snippet
- [ ] IndexedDB before/after snapshot
- [ ] At least one timestamp-visible screenshot

Missing any evidence item invalidates the case.

---

## 6. Severity Rules

- Blocker:
  - data loss
  - wrong mode decision in core path
  - force archive chain broken
- Major:
  - role misclassification in standard flow
  - repeated duplicate writes during stream updates
- Minor:
  - non-blocking UI copy/status mismatch

---

## 7. Result Summary Template

```md
# v1.3 Phase2 Sampling Result

- Total planned: 18
- Total executed: <n>
- Passed: <n>
- Failed: <n>

## Severity
- Blocker: <n>
- Major: <n>
- Minor: <n>

## Go/No-Go
- Decision: Go | No-Go
- Reason:
- Remaining risks:
- Owner sign-off:
```
