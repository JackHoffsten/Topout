using Topout.Domain.Abstraction;

namespace Topout.Domain.Entities;

public class WorkoutLog : OwnedEntity, ICreatedAt, IUpdatedAt
{
    public DateOnly Date { get; private set; }
    public string? Notes { get; private set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public DateTime? CompletedAt { get; private set; }
    public bool IsCompleted => CompletedAt is not null;

    private readonly List<WorkoutLogEntry> _entries = [];
    public IReadOnlyList<WorkoutLogEntry> Entries => _entries;

    private WorkoutLog() { }

    public WorkoutLog(int userId, DateOnly date, string? notes = null)
        : base(userId)
    {
        Date = date;
        Notes = notes;
    }

    public WorkoutLogEntry AddEntry(Exercise exercise)
    {
        EnsureEditable();
        ArgumentNullException.ThrowIfNull(exercise);
        if (exercise.UserId != UserId)
            throw new InvalidOperationException(
                "Exercise and workout log must belong to the same user."
            );

        var entry = new WorkoutLogEntry(this, exercise, order: _entries.Count + 1);
        _entries.Add(entry);
        return entry;
    }

    public void RemoveEntry(int entryId)
    {
        EnsureEditable();
        var entry =
            _entries.FirstOrDefault(e => e.Id == entryId)
            ?? throw new InvalidOperationException("Entry not found.");
        _entries.Remove(entry);
        Reorder();
    }

    public void Complete(DateTime completedAtUtc)
    {
        EnsureEditable();
        if (completedAtUtc.Kind != DateTimeKind.Utc)
            throw new ArgumentException("Completion time must be UTC.", nameof(completedAtUtc));
        if (_entries.Count == 0)
            throw new InvalidOperationException("Cannot complete an empty workout.");
        if (_entries.Any(e => e.Sets.Count == 0))
            throw new InvalidOperationException("Every exercise needs at least one set.");
        CompletedAt = completedAtUtc;
    }

    internal void EnsureEditable()
    {
        if (IsCompleted)
            throw new InvalidOperationException("A completed workout cannot be changed.");
    }

    public void RecordSet(
        Exercise exercise,
        int order,
        int reps,
        Topout.Domain.ValueObjects.Weight weight,
        bool warmup,
        string? notes
    )
    {
        ArgumentNullException.ThrowIfNull(exercise);
        if (
            exercise.UserId != UserId
            || order is < 1 or > 100
            || reps is < 1 or > 1000
            || notes?.Length > 2000
        )
            throw new ArgumentException("Invalid recorded set.");
        var entry = _entries.FirstOrDefault(e =>
            e.ExerciseId == exercise.Id || ReferenceEquals(e.Exercise, exercise)
        );
        if (entry is null)
        {
            if (_entries.Count >= 100)
                throw new ArgumentException("A workout can contain at most 100 exercises.");
            entry = new WorkoutLogEntry(
                this,
                exercise,
                _entries.Select(e => e.Order).DefaultIfEmpty(0).Max() + 1
            );
            _entries.Add(entry);
        }
        entry.RecordSet(order, reps, weight, warmup, notes);
    }

    public void RemoveRecordedSet(int exerciseId, int order)
    {
        var entry = _entries.FirstOrDefault(e => e.ExerciseId == exerciseId);
        if (entry is null || !entry.Sets.Any(s => s.Order == order))
            throw new ArgumentException("Set not found.");
        if (IsCompleted && _entries.Sum(e => e.Sets.Count) == 1)
            throw new InvalidOperationException("A completed workout needs at least one set.");
        entry.RemoveRecordedSet(order);
        if (entry.Sets.Count == 0)
            _entries.Remove(entry);
    }

    public void ReplaceContents(WorkoutLog source)
    {
        if (source.UserId != UserId || source.Date != Date || !source.IsCompleted)
            throw new ArgumentException(
                "Replacement must be a completed log for the same workout."
            );
        var completedAt = CompletedAt ?? source.CompletedAt;
        CompletedAt = null;
        _entries.Clear();
        Notes = source.Notes;
        foreach (var entry in source.Entries.OrderBy(e => e.Order))
        {
            var replacement = AddEntry(entry.Exercise);
            foreach (var set in entry.Sets.OrderBy(s => s.Order))
                replacement.AddSet(set.Reps, set.Weight, set.IsWarmup, set.Notes);
        }
        CompletedAt = completedAt;
    }

    private void Reorder()
    {
        for (var i = 0; i < _entries.Count; i++)
            _entries[i].SetOrder(i + 1);
    }
}
