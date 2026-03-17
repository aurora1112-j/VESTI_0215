# Generic Pipeline Progress Event Contract

Status: Active canonical runtime contract  
Audience: Runtime engineers, UI consumers, QA

## Purpose

Define the shared event shape for bounded pipeline progress reporting.

This document is generic by intent. It is not owned by Insights as a product line.

## Compatibility note

The currently shipped extension still uses the legacy message type:
- `INSIGHT_PIPELINE_PROGRESS`

That compatibility name does not make Insights the architectural owner of this contract.

## Required payload shape

Every pipeline progress payload must provide:
- `pipelineId`
- `scope`
- `targetId`
- `stage`
- `status`
- `seq`
- `attempt`
- `startedAt`
- `updatedAt`
- `route`
- `modelId`
- `promptVersion`

Optional:
- `message`

## Contract rules

- `seq` is strictly monotonic within one pipeline
- consumers deduplicate by `pipelineId + seq`
- each stage transition emits at least one event
- terminal state must be explicit
- raw stack traces do not belong in the user-facing event payload

## Stage semantics

This contract does not freeze one universal stage taxonomy.

It requires only that each bounded pipeline:
- declares its own ordered stages
- emits terminal completion or degraded fallback explicitly
- keeps stage names stable within that pipeline family

## Intended reuse

This contract can be reused by:
- legacy Insights compatibility flows
- future export multi-agent stages
- other bounded agent pipelines that need progress visibility