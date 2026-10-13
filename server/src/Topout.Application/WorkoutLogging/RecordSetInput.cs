using Topout.Application.Abstractions;
using Topout.Application.Common;
using Topout.Application.Exercises;
using Topout.Application.WorkoutTemplates;
using Topout.Domain.Entities;
using Topout.Domain.Enums;
using Topout.Domain.ValueObjects;

namespace Topout.Application.WorkoutLogging;

public sealed record RecordSetInput(
    int ExerciseId,
    int Order,
    int Reps,
    decimal WeightKg,
    bool IsWarmup,
    string? Notes,
    [property: System.Text.Json.Serialization.JsonIgnore(
        Condition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingDefault
    )]
        SetSide Side = SetSide.Both,
    string? Location = null
);
