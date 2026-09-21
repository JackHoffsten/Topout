using Topout.Application.Abstractions;
using Topout.Application.Common;

namespace Topout.Application.Exercises;

public sealed class DeleteExerciseHandler(
    IExerciseRepository repository,
    IUnitOfWork unitOfWork,
    ICurrentUser user
)
{
    public async Task HandleAsync(int id, CancellationToken ct)
    {
        var exercise =
            await repository.FindAsync(user.UserId, id, ct)
            ?? throw new RequestException(ErrorKind.NotFound, "Exercise not found.");
        if (await repository.IsReferencedAsync(exercise.Id, ct))
            throw new RequestException(
                ErrorKind.Conflict,
                "This exercise is used by a workout template or log."
            );
        repository.Remove(exercise);
        await unitOfWork.SaveChangesAsync(ct);
    }
}
