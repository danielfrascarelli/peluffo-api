# 0006 — Accumulated patient statistics

Status: accepted.

## Context

The statistics screen needs summary cards, a cumulative monthly series, age and sex distributions, and patients by department. Immutable extraction folders overlap; summing them would duplicate patients. The Sheet collects age, city, submission date and assignment date/name, but not birth date, sex or clinical treatment completion. Removed assignments carry observation timestamps, not discharge dates.

## Decision

- Expose one authenticated `GET /api/v1/statistics`, restricted to `peluffo` and `fibras`. No frontend changes or filters in this delivery.
- Read one stable in-memory accumulated processed snapshot. No filesystem/Google requests or writes per statistics request. Preserve existing extraction fingerprint/idempotency behavior.
- Define active/waiting as latest valid assignment status. Count distinct patients assigned in the current local month, including historical assignments, excluding future calendar dates. Never interpret `closedObservedAt` as treatment completion.
- Return clinical completions as null and sex as unavailable, with explicit machine-readable reasons. Missing data must not masquerade as measured zero.
- Produce 12 chronological cumulative patient counts from the latest valid processed submission timestamp, including prior-window carry and excluding future instants. Report missing/future date counts separately. Corrected submission dates legitimately change historical buckets.
- Estimate age by adding whole elapsed twelve-month periods, measured in local calendar months, to the declared age. Preserve `ageRecordedAt` alongside that observation. Replace age/reference only as a valid pair; a separately corrected submission date cannot move the previous age's reference. Missing or future reference months produce an unavailable age.
- Restore legacy age references in memory at startup only when the same active published extracted patient's ID, age and submission timestamp match. Explicit references win. Never guess for unmatched accumulated patients or rewrite old snapshots.
- Derive department from the local versioned official INE 2023 locality catalog. Normalize case, diacritics, whitespace and trailing periods only. Ambiguous/unrecognized/free-text cities use an unresolved bucket; original patient data remains unchanged.
- Use one captured request clock and `America/Montevideo` for every local date/month calculation. Return aggregate counts only, no identities or clinical text.

The exact chart contract and formulas live in the [README statistics section](../../README.md#statistics); catalog provenance lives in [the catalog note](../data/ine-localities.md). Swagger publishes typed response schemas.

## Consequences

No added service, dependency or statistics persistence is required. Current accumulated assignment state is not proof of clinical activity. Age is approximate without a birth date. Department coverage is limited to unambiguous catalog matches. Correct treatment completions and sex charts require new collected fields and an explicit contract change, not inference from existing data. Legacy uncertain ages remain unavailable until a valid new observation supplies the pair. Frontend integration remains separate.
