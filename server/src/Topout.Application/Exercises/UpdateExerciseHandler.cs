using Topout.Application.Abstractions;
using Topout.Application.Common;
using Topout.Domain.Entities;
using Topout.Domain.Enums;

namespace Topout.Application.Exercises;

public sealed class UpdateExerciseHandler(
    IExerciseRepository repository,
    IUnitOfWork unitOfWork,
    ICurrentUser user
)
{
    public async Task<ExerciseResponse> HandleAsync(
        int id,
        string name,
        MuscleGroup[] muscleGroups,
        CancellationToken ct
    )
    {
        var exercise =
            await repository.FindAsync(user.UserId, id, ct)
            ?? throw new RequestException(ErrorKind.NotFound, "Exercise not found.");
        if (await repository.NameExistsAsync(user.UserId, Exercise.NormalizeName(name), id, ct))
            throw new RequestException(
                ErrorKind.Conflict,
                "An exercise with this name already exists."
            );
        exercise.SetMuscleGroups(muscleGroups);
        exercise.Rename(name);
        exercise.MarkAsCustom();
        await unitOfWork.SaveChangesAsync(ct);
        return ExerciseResponse.From(exercise);
    }
}
