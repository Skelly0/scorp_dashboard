# Command opens on the live year

## Goal

Every new visit to the Command route must show the most recent, live year by
default. A prior visit to an archive year must not change that opening view.

## Design

The Command timeline's selected-year cursor becomes session-only:

- The store initialises the cursor as `null`, which its existing derived index
  interprets as the final (live) frame.
- Scrubbing, arrow controls, and timeline playback continue to set the cursor
  for the current session.
- The cursor is no longer read from or written to `localStorage`.
- The existing `scorp.command` storage key continues to retain the Command /
  Telemetry view and scanline preference.
- A legacy `yearIdx` value in that key is ignored safely.

## Testing

Add a store-level regression test that initialises a legacy `yearIdx`, builds
multiple frames, and verifies the effective cursor selects the final live
frame. Verify selecting an archive year does not add or update `yearIdx` in
the persisted Command preferences.

## Scope

This is a frontend-only behaviour adjustment. It does not change history
loading, frame ordering, data exports, or the user's ability to inspect
archive years during a visit.
