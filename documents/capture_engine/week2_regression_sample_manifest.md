# Week 2 Regression Sample Manifest

Status: Frozen regression inputs for `feature/capture-week2-rollout`  
Audience: Parser maintainers, reader/web maintainers, QA

## Purpose

This manifest defines the approved sample set for Week 2 capture / reader / web regression work.

It is intentionally small and operator-friendly:

- the `txt` files remain the canonical human-reviewed acceptance statements
- the Playwright sample directories remain the canonical DOM/screenshot snapshots
- new parser or reader work should validate against this manifest before merge

The four text files below are no longer open investigation inputs. They are now treated as:
- implemented in shipped code
- frozen acceptance inputs
- with any remaining boundary called out as deferred rather than missing

## Approved Text Samples

These files live outside the repo and are treated as operator-provided inputs.

| Case ID | File | Primary Focus |
| --- | --- | --- |
| `CLAUDE_TITLE_001` | `C:\Users\苏祎成\Downloads\claude.txt` | Claude app-shell title vs body heading drift |
| `CLAUDE_ARTIFACT_001` | `C:\Users\苏祎成\Downloads\artifact.txt` | Claude standalone artifact capture and sanitization |
| `TABLE_FIDELITY_001` | `C:\Users\苏祎成\Downloads\table.txt` | cross-platform table / formula / code fidelity |
| `SEARCH_CITATION_001` | `C:\Users\苏祎成\Downloads\search.txt` | citation pill stripping and structured source retention |

## Approved Playwright DOM Samples

Only the directories below are the Week 2 approved DOM baselines.

| Case ID | Platform | Sample Directory | Primary Focus |
| --- | --- | --- | --- |
| `DOM_DOUBAO_W2_001` | Doubao | `.playwright-auth/samples/20260320-222437-doubao-week2-regression` | table wrapper shell, native table body, search/tool noise |
| `DOM_QWEN_W2_001` | Qwen | `.playwright-auth/samples/20260321-004643-qwen-parser-regression` | hard message root, table header noise, Monaco/code chrome |
| `DOM_YUANBAO_W2_001` | Yuanbao | `.playwright-auth/samples/20260321-004613-yuanbao-parser-regression` | bubble root, toolbar isolation, artifact presence |
| `DOM_KIMI_W2_001` | Kimi | `.playwright-auth/samples/20260321-004707-kimi-parser-regression` | segment root, code header noise, preview/action chrome |
| `DOM_DEEPSEEK_W2_001` | DeepSeek | `.playwright-auth/samples/20260321-004734-deepseek-parser-regression` | `ds-message` role split, thinking shell isolation, sidebar/input chrome |

## Reference Historical Samples

These are not the primary Week 2 freeze set, but they are still useful when debugging drift:

- `.playwright-auth/samples/20260320-194607-doubao-complex`
- `.playwright-auth/samples/20260320-194627-qwen-complex`
- `.playwright-auth/samples/20260320-194526-yuanbao-complex`
- `.playwright-auth/samples/20260320-194545-kimi-complex`
- `.playwright-auth/samples/20260320-194649-deepseek-complex`
- `.playwright-auth/samples/20260320-200707-qwen-post-fix`
- `.playwright-auth/samples/20260320-200733-yuanbao-post-fix`

## Manifest Rules

1. When a regression is reported, map it to one of the case IDs above before editing code.
2. If a new DOM structure is discovered, add a new case ID rather than silently replacing an existing one.
3. The generic `summary.json` counters are advisory only.
   - For `Qwen / Yuanbao / Kimi / DeepSeek`, `messageRoots: 0` does not mean sampling failed.
4. The source of truth for review remains:
   - `page.html`
   - `page.png`
   - the associated text sample or bug memo
5. The four approved text samples are a frozen acceptance gate:
   - do not rewrite their intent case-by-case in PR review
   - do not reopen schema or replay scope under their names
