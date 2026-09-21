using Topout.Application.Abstractions;

namespace Topout.Application.Exercises;

public sealed class ListExercisesHandler(IExerciseRepository repository, ICurrentUser user)
{
    public async Task<IReadOnlyList<ExerciseResponse>> HandleAsync(CancellationToken ct) =>
        (await repository.ListAsync(user.UserId, ct)).Select(ExerciseResponse.From).ToArray();
}
