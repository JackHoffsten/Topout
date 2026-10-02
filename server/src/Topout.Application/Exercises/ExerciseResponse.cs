using Topout.Domain.Entities;
using Topout.Domain.Enums;

namespace Topout.Application.Exercises;

public sealed record ExerciseResponse(
    int Id,
    string Name,
    MuscleGroup[] MuscleGroups,
    bool IsCustom
)
{
    public static ExerciseResponse From(Exercise exercise) =>
        new(exercise.Id, exercise.Name, exercise.MuscleGroups, exercise.IsCustom);
}
