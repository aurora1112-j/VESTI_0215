# Vesti Floating Capsule Debugging Playbook (v1.5)

Version: v1.0  
Status: Operational SOP  
Audience: Engineering + QA

---

## 1. Purpose

This playbook standardizes diagnosis for floating capsule failures, including:
- render/mount failure
- wrong state mapping
- archive button availability mismatch
- archive action failures
- host-page style/position conflicts

Reference docs:
- `documents/floating_capsule/v1_5_floating_capsule_engineering_spec.md`
- `documents/floating_capsule/v1_5_floating_capsule_state_machine_spec.md`
- `documents/capture_engine/capture_debugging_playbook.md`

---

## 2. 5-step debug lifecycle

1. **Environment isolation**
   - single extension instance
   - disable other capture extensions
   - record commit SHA and browser version
2. **Surface snapshot**
   - capture capsule state text/screenshot
   - dump active host URL + mode
3. **Root-cause classification**
   - `mount_failure`
   - `state_mapping_error`
   - `action_routing_error`
   - `host_css_conflict`
   - `runtime_permission_error`
4. **Minimal fix**
   - patch only one layer per round (UI, mapping, routing, or style)
5. **Regression sweep**
   - rerun failing case + minimum 6-platform smoke

---

## 3. Required observability keys

## 3.1 Capsule status log

```ts
{
  host: string
  platform?: Platform
  mode: CaptureMode
  state: CapsuleRuntimeState
  supported: boolean
  available: boolean
  paused: boolean
  reason?: string
  messageCount?: number
  turnCount?: number
  updatedAt: number
}
```

## 3.2 Capsule action log

```ts
{
  action: "open_dock" | "archive_now" | "pause" | "resume" | "drag_end"
  stateBefore: CapsuleRuntimeState
  stateAfter?: CapsuleRuntimeState
  ok: boolean
  error?: string
  durationMs?: number
}
```

## 3.3 Capture decision cross-check

Reuse capture log from v1.2+:
- `mode`, `decision`, `reason`, `messageCount`, `turnCount`, `forceFlag`

Mandatory relation:
- `archive_now` success must correlate to `force_archive` decision or `mode_mirror` block.

---

## 4. Fault matrix

Note: Quiet start behavior on full reload intentionally resets capsule to collapsed + right edge. Do not treat this as a persistent positioning failure; validate persistence within the same page session.

| Symptom | Likely cause | Verify first | Fix target |
| --- | --- | --- | --- |
| Capsule not visible | mount/root inject failure | DOM has `vesti-capsule-root`? | injection timing / mount guard |
| Wrong state label | mapping precedence bug | status payload vs displayed state | state resolver |
| Archive button disabled unexpectedly | availability or mode mismatch | `GET_CAPSULE_RUNTIME_STATUS` payload | background routing or mode gate |
| Archive click no effect | action route break | background/content message response | action handler wiring |
| Capsule overlaps composer | offset/anchor bug | viewport + host layout snapshot | positioning and snap logic |
| Style broken on host page | missing Shadow DOM isolation | computed styles under host CSS | shadow root styles |

---

## 5. Evidence template (per debug round)

- Round ID
- Host URL and platform
- Expected state / actual state
- Logs:
  - capsule status log
  - capsule action log
  - capture decision log
- Screenshots (before/after)
- Conclusion and next action

---

## 6. Round-based SOP

- One round = one hypothesis.
- End each round with one explicit conclusion:
  - `confirmed`, `rejected`, or `inconclusive`.
- Do not stack multiple code hypotheses before one round is closed.
