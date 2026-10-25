using Topout.Domain.Abstraction;
using Topout.Domain.Enums;
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
    public int? OriginalExerciseId { get; private set; }
    public int? ReplacementOrder { get; private set; }
    private int[] ReplacementSetOrders { get; set; } = [];
    private SetSide[] ReplacementSetSides { get; set; } = [];
    private bool[] ReplacementWarmups { get; set; } = [];
    public IReadOnlyList<WorkoutReplacementSet> ReplacementSets =>
        ReplacementSetOrders
            .Select(
                (order, index) =>
                    new WorkoutReplacementSet(
                        order,
                        ReplacementSetSides[index],
                        ReplacementWarmups[index]
                    )
            )
            .ToArray();

    internal void ReplaceExercise(
        Exercise exercise,
        int originalId,
        int order,
        IReadOnlyList<WorkoutReplacementSet> sets
    )
    {
        OriginalExerciseId ??= originalId;
        Exercise = exercise;
        ExerciseId = exercise.Id;
        ReplacementOrder = order;
        SetReplacementShape(sets);
    }

    private readonly List<WorkoutLogSet> _sets = [];
    public IReadOnlyList<WorkoutLogSet> Sets => _sets;

    private WorkoutLogEntry() { }

    internal WorkoutLogEntry(WorkoutLog workoutLog, Exercise exercise, int order)
    {
        WorkoutLog = workoutLog;
        Exercise = exercise;
        Order = order;
        ExerciseId = exercise.Id;
    }

    internal void SetOrder(int order) => Order = order;

    internal void RecordSet(
        int order,
        int reps,
        Weight weight,
        bool warmup,
        string? notes,
        SetSide side = SetSide.Both
    )
    {
        if (!Enum.IsDefined(side))
            throw new ArgumentException("Invalid set side.");
        if (_sets.Any(s => s.Order == order && (s.Side == SetSide.Both) != (side == SetSide.Both)))
            throw new InvalidOperationException(
                "Remove the existing set before changing its split mode."
            );
        var existing = _sets.FirstOrDefault(s => s.Order == order && s.Side == side);
        if (existing is not null)
            existing.ReplaceActual(reps, weight, warmup, notes);
        else
            _sets.Add(new WorkoutLogSet(this, order, reps, weight, warmup, notes, side));
        if (OriginalExerciseId.HasValue)
        {
            var shape = ReplacementSets.ToList();
            if (
                shape.Any(s =>
                    s.Order == order && (s.Side == SetSide.Both) != (side == SetSide.Both)
                )
            )
                shape.RemoveAll(s => s.Order == order);
            var sides =
                side == SetSide.Both
                    ? new[] { SetSide.Both }
                    : new[] { SetSide.Left, SetSide.Right };
            foreach (var value in sides)
                if (!shape.Any(s => s.Order == order && s.Side == value))
                    shape.Add(new WorkoutReplacementSet(order, value, warmup));
            SetReplacementShape(shape);
        }
    }

    internal void RemoveRecordedSet(int order, SetSide side = SetSide.Both)
    {
        _sets.RemoveAll(s => s.Order == order && s.Side == side);
        if (OriginalExerciseId.HasValue)
            SetReplacementShape(ReplacementSets.Where(s => s.Order != order || s.Side != side));
    }

    private void SetReplacementShape(IEnumerable<WorkoutReplacementSet> sets)
    {
        var shape = sets.OrderBy(s => s.Order).ThenBy(s => s.Side).ToArray();
        ReplacementSetOrders = shape.Select(s => s.Order).ToArray();
        ReplacementSetSides = shape.Select(s => s.Side).ToArray();
        ReplacementWarmups = shape.Select(s => s.IsWarmup).ToArray();
    }

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
