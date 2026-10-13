# Persist workout-local exercise replacements on the affected entry

Exercise replacement changes the entire entry, including recorded results, within one workout. Persist the replacement exercise on the existing log entry and retain its original exercise ID, workout position, and normal or left/right set structure as replacement metadata. A replaced entry can exist before it has any recorded sets; its shape is planned work, not invented results. Recording or removing results updates this shape so reopening retains subsequent logged work.

The schedule row is locked while validating current exercise membership and saving replacement identity and recorded results in one transaction. Retired exercise identities are excluded, which also prevents stale replacement requests from creating another entry. Removing a replacement excludes both its current identity and its original template exercise. Completing the workout replaces these draft entries with the actual submitted results.

This extends [ADR 0001](0001-workout-exercise-removal.md): untouched exercises still derive from their template and do not acquire a session snapshot. Only replaced entries persist enough local structure to survive reopening without results. The trade-off is that general unlogged additions and draft edits remain subject to existing restoration rules; this feature does not introduce general draft autosave.
