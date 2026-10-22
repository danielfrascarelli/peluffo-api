# 0004 Captured and accumulated Sheet data

Date: 2026-10-21 · Status: accepted

## Context

A current Sheet snapshot and accumulated patient records answer different questions. A patient removed from the Sheet must disappear from the current extraction but remain in accumulated data. Replacing three active files separately can leave mixed resources after a failure.

## Decision

- Supersede 0003. Keep the admin-only extraction endpoint, with an in-process single-flight guard returning 409 for concurrent calls.
- Capture selected original cell data in one Sheets read. Preserve source rows even when interpretation excludes them.
- Map current rows independently; report warnings and blocking row errors. Duplicate normalized cedulas exclude every matching row. Non-parsable ages omit age, not the patient. Incomplete assignments leave the patient pending.
- Merge valid extracted patients by cedula with the prior accumulated snapshot. Absent, rejected and duplicate patients preserve their last valid state. Missing new field values do not clear prior values. Assignment removal or replacement is observed through `closedObservedAt`, never an invented clinical end date.
- Write an immutable directory containing source, report, extracted data and, when applicable, processed data. Atomically replace `current.json` to publish the processed set; update memory immediately after publication. Old root resource JSON files are retired.
- No valid patients means capture/report only and no active reference update. Reports remain local; email and frontend migration are deferred.
- Reuse Node filesystem primitives, Joi and the Google auth client. No database, queue, generic storage layer or new dependencies. Snapshots have restrictive permissions and never enter Git.

## Alternatives rejected

- Three active JSON files with rollback: crash recovery and concurrency are harder than publishing one reference.
- Reprocess all historical snapshots on every request: unnecessary while the previous processed snapshot is available.
- Stop the entire extraction for a bad row: valid patient data should still be ingested, with an explicit report.

## Consequences

The app must stay single-instance on a persistent local filesystem. The active reference, not directory ordering, defines publication. A completed but unpublished snapshot may remain after a failed publication. Files are flushed before reference publication; this is process-crash consistency, not a guarantee against every power-loss/filesystem failure. Recover from backups if storage is damaged.

Psychologists are identified only by normalized names available in the Sheet. Resource contracts change; the frontend migration is separate. Runtime snapshots are retained without automatic deletion so historical captures remain available.
