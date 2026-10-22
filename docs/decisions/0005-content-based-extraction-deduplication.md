# 0005 Content-based extraction deduplication

Date: 2026-10-21 · Status: accepted

## Context

Hourly external calls must not create duplicate snapshots of an unchanged Sheet. Parsing warnings and blocking row errors must still be reported on every invocation. An empty or rejected capture also needs a persistent comparison baseline, separate from the active processed data.

## Decision

- Refine 0004: read and parse on every request, but persist only changed captures. Compare SHA-256 over spreadsheet identity, tab title and A:S original/calculated/display cell values, formulas, headers and row positions. Exclude capture time, object-key order and empty trailing padding. Preserve text exactly.
- Extend the atomic manifest with `lastExtractionId` and `sourceHash`, independently of optional active `extractionId`. Read legacy manifests by hashing their referenced source. Do not migrate them through an unchanged request's write.
- Return 201 for a new saved capture, 200 for unchanged content. Both responses contain full current diagnostics and counts. Unchanged responses reuse archived snapshot/report paths and set `changed` and `applied` to false; `checkedAt` identifies the current read. The inline report belongs to the current invocation, while `reportPath` identifies the immutable archived report.
- Publish the baseline only after successful snapshot storage and atomic reference replacement. Failure leaves the previous baseline so the same content is retried. Unchanged calls do not recalculate accumulation, replace memory or write files.

## Consequences

Restarting does not reset deduplication. Parsing and remote reads still happen every call; their diagnostics are not suppressed by the content check. Existing empty/rejected snapshots created before this manifest extension are not inferred from directory ordering: the first call may save one baseline for them. Changes to parser rules alone do not trigger publication. Scheduler and email delivery remain separate work.
