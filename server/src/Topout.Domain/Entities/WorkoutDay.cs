using Topout.Domain.Abstraction;

namespace Topout.Domain.Entities;

public class WorkoutDay : OwnedEntity
{
    public string Name { get; private set; } = string.Empty;
    public string NormalizedName { get; private set; } = string.Empty;
    private readonly List<WorkoutDayExercise> _exercises = [];
    public IReadOnlyList<WorkoutDayExercise> Exercises => _exercises;

    private WorkoutDay() { }

    public WorkoutDay(int userId, string name)
        : base(userId)
    {
        Rename(name);
    }

    public void Rename(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Workout day name is required.", nameof(name));
        if (name.Trim().Length > 100)
            throw new ArgumentException(
                "Workout day name must be 100 characters or fewer.",
                nameof(name)
            );
        Name = name.Trim();
        NormalizedName = Name.ToUpperInvariant();
    }

    public void ReplaceContents(WorkoutDay source)
    {
        if (source.UserId != UserId)
            throw new ArgumentException("Templates must belong to the same user.");
        // Build a complete valid replacement before changing the existing aggregate.
        var copy = new WorkoutDay(UserId, source.Name);
        foreach (var item in source.Exercises)
        {
            var entry = copy.AddExercise(item.Exercise);
            foreach (var set in item.PlannedSets)
                entry.AddSet(
                    set.TargetRepsMin,
                    set.TargetWeight,
                    set.IsWarmup,
                    set.IsAmrap,
                    set.TargetRepsMax,
                    set.RightTargetRepsMin,
                    set.RightTargetRepsMax,
                    set.RightTargetWeight,
                    set.IsSplit
                );
        }
        Rename(copy.Name);
        _exercises.Clear();
        foreach (var item in copy.Exercises)
        {
            var entry = AddExercise(item.Exercise);
            foreach (var set in item.PlannedSets)
                entry.AddSet(
                    set.TargetRepsMin,
                    set.TargetWeight,
                    set.IsWarmup,
                    set.IsAmrap,
                    set.TargetRepsMax,
                    set.RightTargetRepsMin,
                    set.RightTargetRepsMax,
                    set.RightTargetWeight,
                    set.IsSplit
                );
        }
    }

    public WorkoutDayExercise AddExercise(Exercise exercise)
    {
        ArgumentNullException.ThrowIfNull(exercise);
        if (exercise.UserId != UserId)
            throw new InvalidOperationException(
                "Exercise and workout day must belong to the same user."
            );
        if (
            _exercises.Any(e =>
                ReferenceEquals(e.Exercise, exercise)
                || (exercise.Id != 0 && e.Exercise.Id == exercise.Id)
            )
        )
            throw new InvalidOperationException("Exercise already exists in this workout day.");

        var entry = new WorkoutDayExercise(this, exercise, order: _exercises.Count + 1);

        _exercises.Add(entry);
        return entry;
    }

    public void RemoveExercise(int workoutDayExerciseId)
    {
        var entry =
            _exercises.FirstOrDefault(e => e.Id == workoutDayExerciseId)
            ?? throw new InvalidOperationException("Exercise not found in this workout day.");

        _exercises.Remove(entry);
        Reorder();
    }

    private void Reorder()
    {
        for (var i = 0; i < _exercises.Count; i++)
            _exercises[i].SetOrder(i + 1);
    }
}
