using Topout.Domain.Abstraction;
using Topout.Domain.ValueObjects;

namespace Topout.Domain.Entities;

public class WorkoutDayExercise : OwnedEntity
{
    public int WorkoutDayId { get; private set; }
    public int ExerciseId { get; private set; }
    public Exercise Exercise { get; private set; } = null!;
    public int Order { get; private set; }

    private readonly List<WorkoutDaySet> _plannedSets = [];
    public IReadOnlyList<WorkoutDaySet> PlannedSets => _plannedSets;

    private WorkoutDayExercise() { }

    internal WorkoutDayExercise(int workoutDayId, int exerciseId, int order)
    {
        WorkoutDayId = workoutDayId;
        ExerciseId = exerciseId;
        Order = order;
    }

    internal void SetOrder(int order) => Order = order;

    public WorkoutDaySet AddSet(int targetReps, Weight? targetWeight = null, bool isWarmup = false)
    {
        var set = new WorkoutDaySet(
            workoutDayExerciseId: Id,
            order: _plannedSets.Count + 1,
            targetReps: targetReps,
            targetWeight: targetWeight,
            isWarmup: isWarmup
        );

        _plannedSets.Add(set);
        return set;
    }

    public void RemoveSet(int workoutDaySetId)
    {
        var set =
            _plannedSets.FirstOrDefault(s => s.Id == workoutDaySetId)
            ?? throw new ArgumentException("Set not found.");
        _plannedSets.Remove(set);
        Reorder();
    }

    private void Reorder()
    {
        for (var i = 0; i < _plannedSets.Count; i++)
            _plannedSets[i].SetOrder(i + 1);
    }
}
