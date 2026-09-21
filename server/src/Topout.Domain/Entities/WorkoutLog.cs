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
            throw new InvalidOperationException("Exercise and workout log must belong to the same user.");

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

    private void Reorder()
    {
        for (var i = 0; i < _entries.Count; i++)
            _entries[i].SetOrder(i + 1);
    }
}
