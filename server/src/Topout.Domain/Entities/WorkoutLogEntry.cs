using Topout.Domain.Abstraction;
using Topout.Domain.ValueObjects;

namespace Topout.Domain.Entities;

public class WorkoutLogEntry : Entity
{
    public int WorkoutLogId { get; private set; }
    public WorkoutLog WorkoutLog { get; private set; } = null!;
    public int ExerciseId { get; private set; }
    public Exercise Exercise { get; private set; } = null!;
    public int Order { get; private set; }
    public string? Notes { get; private set; }

    private readonly List<WorkoutLogSet> _sets = [];
    public IReadOnlyList<WorkoutLogSet> Sets => _sets;

    private WorkoutLogEntry() { }

    internal WorkoutLogEntry(WorkoutLog workoutLog, Exercise exercise, int order)
    {
        WorkoutLog = workoutLog;
        Exercise = exercise;
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
        WorkoutLog.EnsureEditable();
        var set = new WorkoutLogSet(
            workoutLogEntry: this,
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
        WorkoutLog.EnsureEditable();
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
