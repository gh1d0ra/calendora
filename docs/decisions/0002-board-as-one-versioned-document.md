# 0002 — Store each family's board as one versioned JSON document

**Status:** accepted

## Context
A family has a few hundred events, chores, list items and meals. Several devices edit at once, and some are often offline.

## Decision
Keep the whole shared state as one JSON document per family (`board` table: `data`, `version`). Every save is a
conditional `UPDATE … WHERE version = ?`. The device that loses gets `409` with the latest copy, merges section by
section against its last synced copy, and saves again. Devices poll every 15 seconds and get `unchanged` when nothing moved.

## Consequences
- Simple and atomic, with offline editing that merges cleanly in the common case (different people editing different sections).
- Two edits to the *same* section at the same moment keep the server's copy. That's acceptable for a family; finer-grained
  merging (per item) would need per-item versions.
- The document must stay under D1's ~2 MB value limit (checked: `413` above 1.9 MB). Photos live in a separate table.
