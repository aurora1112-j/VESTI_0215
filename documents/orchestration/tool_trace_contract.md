# Tool Trace Contract

Status: Active canonical runtime contract  
Audience: Runtime engineers, UI engineers, QA

## Purpose

Define the generic trace shape for bounded tool-chain execution.

This contract is inspired by Explore's transparent tooling path, but it is not owned by Explore and is not tied to Explore UI.

## Trace record

A tool trace record should capture:
- stable step name
- human-readable description
- status (`planned`, `running`, `succeeded`, `failed`, `degraded`)
- start and finish timestamps
- duration when available
- compact input summary
- compact output summary
- error summary when failed

## Contract rules

- trace records are ordered and append-only for one run
- failed steps remain visible; they are not erased by fallback
- successful earlier steps remain visible even when later stages degrade
- raw stack traces stay in logs, not in the user-facing trace payload

## Intended use

This contract is the reusable pattern layer for:
- Explore transparent tooling
- future export multi-agent stage traces
- other bounded multi-step flows that need inspectable execution history

## Explicit non-goals

This contract does not define:
- any specific UI layout
- any specific product tab
- any one feature's tool names
- open-ended autonomous agent loops