using Topout.Domain.Abstraction;

namespace Topout.Domain.Entities;

public class WorkoutLog : OwnedEntity, ICreatedAt, IUpdatedAt
{
    public DateOnly Date { get; private set; }
    public string? Notes { get; private set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }

    private readonly List<WorkoutLogEntry> _entries = [];
    public IReadOnlyList<WorkoutLogEntry> Entries => _entries;

    private WorkoutLog() { }

    public WorkoutLog(DateOnly date, string? notes = null)
    {
        Date = date;
        Notes = notes;
    }

    public WorkoutLogEntry AddEntry(Exercise exercise)
    {
        var entry = new WorkoutLogEntry(Id, exercise.Id, order: _entries.Count + 1);
        _entries.Add(entry);
        return entry;
    }

    public void RemoveEntry(int entryId)
    {
        var entry =
            _entries.FirstOrDefault(e => e.Id == entryId)
            ?? throw new InvalidOperationException("Entry not found.");
        _entries.Remove(entry);
        Reorder();
    }

    public void Complete()
    {
        if (_entries.Count == 0)
            throw new InvalidOperationException("Cannot complete an empty workout.");
        if (_entries.Any(e => e.Sets.Count == 0))
            throw new InvalidOperationException("Every exercise needs at least one set.");
    }

    private void Reorder()
    {
        for (var i = 0; i < _entries.Count; i++)
            _entries[i].SetOrder(i + 1);
    }
}
