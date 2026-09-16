using Topout.Domain.ValueObjects;

namespace Topout.Domain.Entities;

public class WorkoutLogEntry : OwnedEntity
{
    public int WorkoutLogId { get; private set; }
    public int ExerciseId { get; private set; }
    public Exercise Exercise { get; private set; } = null!;
    public int Order { get; private set; }
    public string? Notes { get; private set; }

    private readonly List<WorkoutLogSet> _sets = [];
    public IReadOnlyList<WorkoutLogSet> Sets => _sets;

    private WorkoutLogEntry() { }

    internal WorkoutLogEntry(int workoutLogId, int exerciseId, int order)
    {
        WorkoutLogId = workoutLogId;
        ExerciseId = exerciseId;
        Order = order;
    }

    internal void SetOrder(int order) => Order = order;

    public WorkoutLogSet AddSet(
        int reps,
        Weight weight,
        bool isWarmup = false,
        string? notes = null
    )
    {
        var set = new WorkoutLogSet(
            workoutLogEntryId: Id,
            order: _sets.Count + 1,
            reps: reps,
            weight: weight,
            isWarmup: isWarmup,
            notes: notes
        );

        _sets.Add(set);
        return set;
    }

    public void RemoveSet(int setId)
    {
        var set =
            _sets.FirstOrDefault(s => s.Id == setId)
            ?? throw new InvalidOperationException("Set not found.");
        _sets.Remove(set);
        Reorder();
    }

    private void Reorder()
    {
        for (var i = 0; i < _sets.Count; i++)
            _sets[i].SetOrder(i + 1);
    }
}
