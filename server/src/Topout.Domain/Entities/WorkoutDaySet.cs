using Topout.Domain.ValueObjects;

namespace Topout.Domain.Entities;

public class WorkoutDaySet : OwnedEntity
{
    public int WorkoutDayExerciseId { get; private set; }
    public int Order { get; private set; }
    public int TargetRepsMin { get; private set; }
    public int? TargetRepsMax { get; private set; } // null = exact
    public Weight? TargetWeight { get; private set; } // null = not pre-planned
    public bool IsWarmup { get; private set; }

    private WorkoutDaySet() { }

    internal WorkoutDaySet(
        int workoutDayExerciseId,
        int order,
        int targetReps,
        Weight? targetWeight,
        bool isWarmup,
        int? targetRepsMax = null
    )
    {
        if (targetReps is < 1 or > 1000)
            throw new ArgumentException("Target reps must be between 1 and 1000.");
        if (targetRepsMax is not null && targetRepsMax < targetReps)
            throw new ArgumentException("Target reps max must be greater than or equal to min.");

        WorkoutDayExerciseId = workoutDayExerciseId;
        Order = order;
        TargetRepsMin = targetReps;
        TargetRepsMax = targetRepsMax;
        TargetWeight = targetWeight;
        IsWarmup = isWarmup;
    }

    internal void SetOrder(int order) => Order = order;

    public void UpdateTarget(int repsMin, int? repsMax, bool isAmrap)
    {
        if (repsMin is < 1 or > 1000)
            throw new ArgumentException("Target reps must be between 1 and 1000.");
        if (repsMax is not null && repsMax < repsMin)
            throw new ArgumentException("Target reps max must be greater than or equal to min.");
        TargetRepsMin = repsMin;
        TargetRepsMax = repsMax;
    }

    public void SetTargetWeight(Weight? weight) => TargetWeight = weight;

    public void MarkAsWarmup(bool isWarmup) => IsWarmup = isWarmup;
}
