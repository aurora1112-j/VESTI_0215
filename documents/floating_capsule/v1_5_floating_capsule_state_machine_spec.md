# Vesti v1.5 Floating Capsule State Machine Spec

Version: v1.0  
Status: Decision Complete  
Scope: Capsule UI runtime states and event transitions

---

## 1. State Definitions

```ts
type CapsuleRuntimeState =
  | "idle"
  | "mirroring"
  | "holding"
  | "ready_to_archive"
  | "archiving"
  | "saved"
  | "paused"
  | "error"
```

Semantic meaning:
- `idle`: unsupported/disabled/no host context.
- `mirroring`: mirror mode active, auto-save flow healthy.
- `holding`: smart/manual mode but no archivable transient yet.
- `ready_to_archive`: smart/manual mode and transient available.
- `archiving`: archive action in-flight.
- `saved`: recent archive success feedback state.
- `paused`: capsule-local pause enabled.
- `error`: runtime call failed or action failed.

---

## 2. Inputs

- `CapsuleSettings.enabled`
- `paused` (tab-local runtime flag)
- `ActiveCaptureStatus`
- `CaptureMode`
- action result from `FORCE_ARCHIVE_TRANSIENT`

Derived booleans:
- `isSupportedTab`
- `isSmartOrManual`
- `isArchiveAvailable`
- `isActionInFlight`

---

## 3. Transition Rules

Priority-ordered resolution (top wins):

1. `enabled=false` or unsupported host -> `idle`
2. `paused=true` -> `paused`
3. `action=inFlight` -> `archiving`
4. `lastArchiveResult=success` and within feedback window -> `saved`
5. runtime request failed -> `error`
6. `mode=mirror` -> `mirroring`
7. `mode in smart/manual` and `available=true` -> `ready_to_archive`
8. `mode in smart/manual` and `available=false` -> `holding`

---

## 4. Event-to-Transition Map

| Event | Condition | Next state | Side effects |
| --- | --- | --- | --- |
| `CAPSULE_MOUNTED` | host unsupported | `idle` | hide action row |
| `CAPSULE_MOUNTED` | mirror + supported | `mirroring` | poll status start |
| `STATUS_POLLED` | smart/manual + available | `ready_to_archive` | enable archive button |
| `STATUS_POLLED` | smart/manual + unavailable | `holding` | disable archive button |
| `ARCHIVE_CLICKED` | archive enabled | `archiving` | call `FORCE_ARCHIVE_TRANSIENT` |
| `ARCHIVE_SUCCESS` | saved=true | `saved` | emit toast + collapse timer |
| `ARCHIVE_FAILURE` | any error | `error` | show mapped reason |
| `PAUSE_CLICKED` | pause on | `paused` | stop action buttons except resume/open |
| `RESUME_CLICKED` | pause off | recompute | restore status polling behavior |
| `TIMER_EXPIRED` | in `saved` | recompute | collapse if configured |

---

## 5. UI Contract by State

| State | Badge/Text | Archive button | Pause button | Auto-collapse |
| --- | --- | --- | --- | --- |
| `idle` | `Unavailable` | disabled | hidden | no |
| `mirroring` | `Mirroring` | secondary/hidden | enabled (`Pause`) | optional |
| `holding` | `Held` | disabled | enabled | no |
| `ready_to_archive` | `Ready` | enabled primary | enabled | no |
| `archiving` | `Archiving...` | loading/disabled | disabled | no |
| `saved` | `Saved` | disabled | enabled | yes |
| `paused` | `Paused` | disabled | enabled (`Resume`) | no |
| `error` | `Action failed` | retry-enabled when possible | enabled | no |

---

## 6. Error Code Mapping

| Error / reason | UI message |
| --- | --- |
| `ARCHIVE_MODE_DISABLED` | Archive is disabled in mirror mode |
| `ACTIVE_TAB_UNSUPPORTED` | Host not supported |
| `ACTIVE_TAB_UNAVAILABLE` | Active tab unavailable |
| `TRANSIENT_NOT_FOUND` | No thread snapshot available yet |
| `missing_conversation_id` | Waiting for stable conversation URL |
| `empty_payload` | No parsed messages to archive |
| `storage_limit_blocked` | Storage full, export/clean required |
| `persist_failed` / `FORCE_ARCHIVE_FAILED` | Archive failed, retry |

---

## 7. Timing Rules

- Poll interval: 3000ms (default).
- Saved feedback hold: `autoCollapseMs` from settings.
- Retry backoff for status request: 1s -> 2s -> 4s (max), then continue normal poll interval.

---

## 8. Non-goals

- No platform-specific state machine branch.
- No direct mutation of global capture mode from capsule.
- No background-only render path; capsule remains content-script owned UI.
