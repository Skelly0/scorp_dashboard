# Congress Page — Design

**Date:** 2026-06-11
**Status:** Approved
**Source:** New constitution sheets in the live workbook — `Trade Federations` (Art. 11–14) and `All-Worker Congress` (Art. 15–16).

## Goal

Surface the All-Worker Congress and Celestial Council seat compositions on a new public dashboard page at `/#/congress`. Deliberately lean: seats by party only, for both chambers.

## Background (what the workbook added)

- **`Trade Federations` sheet** — class→federation enrollment matrix (8 federations + Unenrolled), enrollment stats (~90% enfranchised), per-federation 6-axis stance vectors, federation→party support splits.
- **`All-Worker Congress` sheet** — 27 seats apportioned to federations by enrollment (2-seat floor + Hare largest remainder, divisor knob 3,300 citizens/delegate), delegation→party seat splits, **party totals (row 45)**, and **Celestial Council allocation (row 49, Art. 16)** — Congress totals scaled to the 15-seat Council.
- The party columns **B–P align with the Parties sheet's 15 party slots**; column **Q is Non-aligned**; column **R is the row total** (27 / 15).
- The party roster changed: **Education Party is new**; Market Interests Group, Developmental League, and Lunar Solidarity Party are no longer in the live roster (their palette entries stay, harmlessly).

## 1 · Workbook contract — 3 new named ranges

Added to the live Sheet **before** the feature merges, so the first sync emits data:

| Name | Ref | Holds |
|---|---|---|
| `CongressPartyNames` | `'All-Worker Congress'!$B$44:$Q$44` | party header (15 slots + Non-aligned) |
| `CongressPartySeats` | `'All-Worker Congress'!$B$45:$Q$45` | Congress seats per party (Σ = 27) |
| `CouncilSeatsByParty` | `'All-Worker Congress'!$B$49:$Q$49` | Art. 16 Council seats per party (Σ = 15) |

- Chamber totals are **derived by summing** the seat ranges — no extra scalar ranges.
- Column Q is included so Non-aligned can hold seats someday without a contract change.
- All three are registered **soft-optional** in the schema validator (the `Var_Year` pattern, convention #14): missing ranges → empty `congress.json` → frontend empty state; sync never fails on them.
- Both chambers read from the AWC sheet rather than `Council!C4:C18` (the existing `CouncilPartySeats` range): one sheet, one shared party header, no dependency on Council sheet layout. The existing `CouncilPartySeats` / `CouncilGoISeats` ranges are untouched.

## 2 · Sync side

New `scripts/extractors/congress.py` → `public/data/congress.json`:

```json
{
  "congress": {
    "total_seats": 27,
    "parties": [
      { "name": "Lunar Survival League", "seats": 8 },
      { "name": "Selenite Rose Front", "seats": 7 }
    ]
  },
  "council": {
    "total_seats": 15,
    "parties": [ { "name": "Lunar Survival League", "seats": 5 } ]
  }
}
```

- Names and seats pair by column index from the two row-ranges sharing the `CongressPartyNames` header.
- **Blank-name slots filtered** (convention #8). **Named zero-seat entries kept** — a founded party shut out of the chamber is information (incl. Non-aligned at 0).
- Seats flow through `coerce_number` (convention #7); `None` seats render `—`.
- Parties emitted in workbook slot order; the frontend sorts for display.
- Register page key `congress` in the `sync_sheet.py` extractor registry; bump `SCHEMA_VERSION` and `EXPECTED_SCHEMA_VERSION` (`src/lib/stores/meta.js`) in lockstep (convention #3).
- `congress.json` is always written — the page is public, not Senate-gated.

## 3 · Frontend

- `src/lib/stores/congress.js` — standard store trio (`congress`, `congressError`, `loadCongress`); `loadCongress` clears the error store on entry (convention #55).
- `src/routes/Congress.svelte` — wrapped in `PageState` (`label="Congress"`, `page="congress"`); standard route section padding.
- **Nav:** "Congress" entry after Parties (before Senate when Senate is visible). Route `/#/congress`.

### Layout (Mission-Brutalist band vocabulary)

- **Band 01 — All-Worker Congress**
  - `KpiBlock` Total Seats (27).
  - A single stacked composition strip: one horizontal bar of party-coloured segments proportional to seats.
  - Per-party `.bar-row`s sorted seats-desc: swatch, name, seat count, share %. Zero-seat parties muted (`.muted`) at the bottom.
- **Band 02 — Celestial Council** — identical treatment for the 15 seats. Band subtitle: "Art. 16 — Congress totals scaled to Council size".

### Colours

- `PARTY_COLORS` gains `'Education Party': '#1abc9c'` (turquoise — same flat-UI family as existing party hexes, no collision).
- Unpinned names (Independent, Non-aligned) fall back to `var(--accent)`.

## 4 · Tests

- **pytest:** `tests/fixtures/build_test_workbook.py` grows the `All-Worker Congress` sheet + the 3 named ranges. Cover: happy path (both chambers, totals), blank-slot filtering, zero-seat named party kept, missing ranges → empty lists (no crash).
- **e2e:** `tests-e2e/congress.spec.js` mocks `congress.json` (the `tech.spec.js` pattern — the file may be absent under Vite preview, which serves the SPA HTML fallback). Assert both bands render, seat counts and ordering, axe passes. Add `/#/congress` to the a11y spec's route list.
- **Vitest:** light — any extracted helper (e.g. share calc) gets a unit test; no component snapshot needed.

## 5 · Sequencing

1. Current `feat/frontend-hardening` work lands first (or this goes in an isolated worktree off `main`) — the working tree must not mix the two changesets.
2. Named ranges added to the live Sheet.
3. Implement on a fresh `feat/congress-page` branch: extractor + validator + fixture → frontend store/route/nav → tests → CLAUDE.md update.

## Out of scope (deliberate)

- Apportionment & enrollment band (divisor, citizens/delegate, % enfranchised).
- Federation stance radars.
- Federation→party / delegation→party matrices.
- Popular vote-share reference column.
- Senate page / Council sheet rework.
- Removing retired parties from `PARTY_COLORS`.

These can each become a follow-up band on this page later; the named-range pattern extends naturally.
