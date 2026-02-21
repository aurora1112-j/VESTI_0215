# Vesti Floating Capsule Spec Package (v1.5)

Status: Opened for v1.5 planning and implementation.
Owner: Engineering + QA

## Files

- `v1_5_floating_capsule_engineering_spec.md`
  - v1.5 主规格（范围、架构、协议、实施里程碑）
- `v1_5_floating_capsule_state_machine_spec.md`
  - 胶囊状态机与交互规则（状态定义、转移、文案映射）
- `floating_capsule_debugging_playbook.md`
  - 调试和故障闭环流程（开发/QA 共用）
- `floating_capsule_manual_sampling_and_acceptance.md`
  - 手测采样矩阵、证据标准、Go/No-Go 门禁

## Version policy

- v1.3 is closed.
- v1.4 is reserved for global UI refactor package (`documents/ui_refactor/*`).
- v1.5 starts from floating capsule upgrade only.
- Cross-version dependencies must reference `documents/capture_engine/*` and `documents/ui_refactor/*`.
