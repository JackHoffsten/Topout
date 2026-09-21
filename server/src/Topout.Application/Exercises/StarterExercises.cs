using Topout.Domain.Entities;
using Topout.Domain.Enums;

namespace Topout.Application.Exercises;

public static class StarterExercises
{
    public static IReadOnlyList<Exercise> CreateFor(int userId) =>
        [
            new(userId, "Bench Press", MuscleGroup.Chest, false),
            new(userId, "Overhead Press", MuscleGroup.Shoulders, false),
            new(userId, "Incline Dumbbell Press", MuscleGroup.Chest, false),
            new(userId, "Dips", MuscleGroup.Triceps, false),
            new(userId, "Pull-Up", MuscleGroup.Back, false),
            new(userId, "Lat Pulldown", MuscleGroup.Back, false),
            new(userId, "Barbell Row", MuscleGroup.Back, false),
            new(userId, "Seated Cable Row", MuscleGroup.Back, false),
            new(userId, "Deadlift", MuscleGroup.FullBody, false),
            new(userId, "Back Squat", MuscleGroup.Quads, false),
            new(userId, "Romanian Deadlift", MuscleGroup.Hamstrings, false),
            new(userId, "Bulgarian Split Squat", MuscleGroup.Quads, false),
            new(userId, "Leg Curl", MuscleGroup.Hamstrings, false),
            new(userId, "Calf Raise", MuscleGroup.Calves, false),
            new(userId, "Biceps Curl", MuscleGroup.Biceps, false),
            new(userId, "Triceps Pushdown", MuscleGroup.Triceps, false),
            new(userId, "Face Pull", MuscleGroup.Shoulders, false),
            new(userId, "Hanging Leg Raise", MuscleGroup.Core, false),
            new(userId, "Scapular Pull-Up", MuscleGroup.Back, false),
            new(userId, "Wrist Curl", MuscleGroup.Forearms, false),
        ];
}
