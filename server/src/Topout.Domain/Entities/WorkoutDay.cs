using Topout.Domain.Abstraction;

namespace Topout.Domain.Entities;

public class WorkoutDay : OwnedEntity
{
    public string Name { get; private set; } = string.Empty;
    private readonly List<WorkoutDayExercise> _exercises = [];
    public IReadOnlyList<WorkoutDayExercise> Exercises => _exercises;

    private WorkoutDay() { }

    public WorkoutDay(string name)
    {
        Rename(name);
    }

    public void Rename(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Workout day name is required.", nameof(name));
        if (name.Length > 100)
            throw new ArgumentException(
                "Workout day name must be 100 characters or fewer.",
                nameof(name)
            );
        Name = name.Trim();
    }

    public WorkoutDayExercise AddExercise(Exercise exercise)
    {
        if (_exercises.Any(e => e.ExerciseId == exercise.Id))
            throw new InvalidOperationException("Exercise already exists in this workout day.");

        var entry = new WorkoutDayExercise(Id, exercise.Id, order: _exercises.Count + 1);

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
