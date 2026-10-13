# Persist exercise removals within the workout log

Unfinished workouts combine template exercises with recorded sets, so deleting recorded sets alone cannot keep a template exercise removed after reopening. Store removed exercise IDs on the workout log and delete that exercise's recorded results in the same transaction, rather than snapshotting every template exercise into each session. This keeps removals local to the workout; recording the exercise again clears its exclusion, and completed workouts must retain at least one exercise with a logged set.
