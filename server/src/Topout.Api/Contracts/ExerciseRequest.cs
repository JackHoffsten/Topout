using System.ComponentModel.DataAnnotations;
using Topout.Domain.Enums;

namespace Topout.Api.Contracts;

public sealed record ExerciseRequest(
    [Required, StringLength(100)] string Name,
    [Required, EnumDataType(typeof(MuscleGroup))] MuscleGroup? MuscleGroup
);
