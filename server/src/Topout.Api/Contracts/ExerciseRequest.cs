using System.ComponentModel.DataAnnotations;
using Topout.Domain.Enums;

namespace Topout.Api.Contracts;

public sealed record ExerciseRequest(
    [Required, StringLength(100)] string Name,
    [Required] MuscleGroup[] MuscleGroups
) : IValidatableObject
{
    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (MuscleGroups is null)
            yield break;
        if (MuscleGroups.Any(group => !Enum.IsDefined(group) || group == MuscleGroup.None))
            yield return new ValidationResult("Invalid muscle group.", [nameof(MuscleGroups)]);
        if (MuscleGroups.Distinct().Count() != MuscleGroups.Length)
            yield return new ValidationResult(
                "Muscle groups must not be repeated.",
                [nameof(MuscleGroups)]
            );
    }
}
