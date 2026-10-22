# 0003 Google Sheets data extractions

Date: 2026-10-21 · Status: superseded by [0004](0004-captured-and-accumulated-sheet-data.md)

## Context

The frontend mock JSON no longer represents production data. The Google Sheet is the source for patient form responses and current psychologist assignments. The service must retain an auditable copy of every import while serving the newest successful import without a restart.

## Decision

- This supersedes the resource-data portion of 0001.
- `POST /api/v1/data/extractions` is restricted to the `fibras` role.
- The service reads `PELUFFO GIGUENS!A:S`, validates its expected form headers, and writes patients, unique assigned psychologists, and current assignments.
- Every successful extraction writes three JSON files to `data/<UTC ISO timestamp>/` and replaces the active resource JSON files. The in-memory accessor reloads those resources after persistence succeeds.
- Snapshots and local spreadsheet exports are ignored by Git because they contain sensitive personal data.
- Invalid rows, unavailable Google Sheets, or persistence failures leave active in-memory data unchanged.

## Consequences

- The Sheet schema is now an operational contract. A header or tab rename stops extraction until the mapping is changed.
- The Sheet holds only current assignments. It cannot reconstruct assignment history.
- The service remains single-instance: active in-memory data differs between instances until a shared store exists.
