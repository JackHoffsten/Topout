using Topout.Application.Abstractions;
using Topout.Application.Common;

namespace Topout.Application.Progress;

public sealed record ExerciseProgressDay(
    DateOnly Date,
    int ExerciseId,
    string Name,
    string Side,
    int Sets,
    int Reps,
    decimal MaxWeightKg,
    decimal VolumeKg
);

public sealed record ClimbingProgressDay(
    DateOnly Date,
    string ClimbingType,
    string GradeSystem,
    string Grade,
    string Environment,
    int Climbs,
    int Sends,
    int Flashes,
    int Attempts
);

public sealed record ProgressResponse(
    IReadOnlyList<ExerciseProgressDay> Exercises,
    IReadOnlyList<ClimbingProgressDay> Climbing
);

public sealed class ProgressHandler(IProgressRepository repository, ICurrentUser user)
{
    public Task<ProgressResponse> GetAsync(DateOnly? from, DateOnly? to, CancellationToken ct)
    {
        if (from == default(DateOnly) || to == default(DateOnly) || from > to)
            throw new RequestException(ErrorKind.Validation, "Choose a valid date range.");
        return repository.ReadAsync(user.UserId, from, to, ct);
    }
}
