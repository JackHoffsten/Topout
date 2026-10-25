namespace Topout.Application.Common;

public sealed record ExerciseOrderInput(IReadOnlyList<int> ExerciseIds)
{
    public void Validate()
    {
        if (
            ExerciseIds is null
            || ExerciseIds.Count is < 1 or > 100
            || ExerciseIds.Any(id => id <= 0)
            || ExerciseIds.Distinct().Count() != ExerciseIds.Count
        )
            throw new RequestException(ErrorKind.Validation, "Choose 1–100 distinct exercises.");
    }
}
