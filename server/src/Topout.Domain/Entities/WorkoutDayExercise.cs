using Topout.Domain.Abstraction;
using Topout.Domain.ValueObjects;

namespace Topout.Domain.Entities;

public class WorkoutDayExercise : Entity
{
    public int WorkoutDayId { get; private set; }
    public WorkoutDay WorkoutDay { get; private set; } = null!;
    public int ExerciseId { get; private set; }
    public Exercise Exercise { get; private set; } = null!;
    public int Order { get; private set; }

    private readonly List<WorkoutDaySet> _plannedSets = [];
    public IReadOnlyList<WorkoutDaySet> PlannedSets => _plannedSets;

    private WorkoutDayExercise() { }

    internal WorkoutDayExercise(WorkoutDay workoutDay, Exercise exercise, int order)
    {
        WorkoutDay = workoutDay;
        Exercise = exercise;
        Order = order;
    }

    internal void SetOrder(int order) => Order = order;

    public WorkoutDaySet AddSet(
        int targetReps,
        Weight? targetWeight = null,
        bool isWarmup = false,
        bool isAmrap = false,
        int? targetRepsMax = null,
        int? rightTargetRepsMin = null,
        int? rightTargetRepsMax = null,
        Weight? rightTargetWeight = null
    )
    {
        var set = new WorkoutDaySet(
            workoutDayExercise: this,
            order: _plannedSets.Count + 1,
            targetReps: targetReps,
            targetWeight: targetWeight,
            isWarmup: isWarmup,
            isAmrap: isAmrap,
            targetRepsMax: targetRepsMax,
            rightTargetRepsMin: rightTargetRepsMin,
            rightTargetRepsMax: rightTargetRepsMax,
            rightTargetWeight: rightTargetWeight
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
