using Topout.Application.Abstractions;
using Topout.Application.Common;
using Topout.Domain.Entities;
using Topout.Domain.Enums;

namespace Topout.Application.Exercises;

public sealed class CreateExerciseHandler(
    IExerciseRepository repository,
    IUnitOfWork unitOfWork,
    ICurrentUser user
)
{
    public async Task<ExerciseResponse> HandleAsync(
        string name,
        MuscleGroup[] muscleGroups,
        CancellationToken ct
    )
    {
        var exercise = new Exercise(user.UserId, name, muscleGroups);
        if (await repository.NameExistsAsync(user.UserId, exercise.NormalizedName, null, ct))
            throw new RequestException(
                ErrorKind.Conflict,
                "An exercise with this name already exists."
            );
        repository.Add(exercise);
        await unitOfWork.SaveChangesAsync(ct);
        return ExerciseResponse.From(exercise);
    }
}
