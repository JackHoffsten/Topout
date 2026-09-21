using Topout.Domain.Abstraction;
using Topout.Domain.ValueObjects;

namespace Topout.Domain.Entities;

public class WorkoutDaySet : Entity
{
    public int WorkoutDayExerciseId { get; private set; }
    public WorkoutDayExercise WorkoutDayExercise { get; private set; } = null!;
    public int Order { get; private set; }
    public int TargetRepsMin { get; private set; }
    public int? TargetRepsMax { get; private set; } // null = exact
    public Weight? TargetWeight { get; private set; } // null = not pre-planned
    public bool IsWarmup { get; private set; }
    public bool IsAmrap { get; private set; }

    private WorkoutDaySet() { }

    internal WorkoutDaySet(
        WorkoutDayExercise workoutDayExercise,
        int order,
        int targetReps,
        Weight? targetWeight,
        bool isWarmup,
        bool isAmrap,
        int? targetRepsMax = null
    )
    {
        ValidateRange(targetReps, targetRepsMax);

        WorkoutDayExercise = workoutDayExercise;
        Order = order;
        TargetRepsMin = targetReps;
        TargetRepsMax = targetRepsMax;
        TargetWeight = targetWeight;
        IsWarmup = isWarmup;
        IsAmrap = isAmrap;
    }

    internal void SetOrder(int order) => Order = order;

    public void UpdateTarget(int repsMin, int? repsMax, bool isAmrap)
    {
        ValidateRange(repsMin, repsMax);
        TargetRepsMin = repsMin;
        TargetRepsMax = repsMax;
        IsAmrap = isAmrap;
    }

    public void SetTargetWeight(Weight? weight) => TargetWeight = weight;

    public void MarkAsWarmup(bool isWarmup) => IsWarmup = isWarmup;

    private static void ValidateRange(int repsMin, int? repsMax)
    {
        if (repsMin is < 1 or > 1000)
            throw new ArgumentException("Target reps must be between 1 and 1000.");
        if (repsMax is < 1 or > 1000)
            throw new ArgumentException("Target reps max must be between 1 and 1000.");
        if (repsMax is not null && repsMax < repsMin)
            throw new ArgumentException("Target reps max must be greater than or equal to min.");
    }
}
