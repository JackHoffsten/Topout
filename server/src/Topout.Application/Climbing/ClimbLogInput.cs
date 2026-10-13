using Topout.Application.Abstractions;
using Topout.Application.Common;
using Topout.Domain.Entities;

namespace Topout.Application.Climbing;

public sealed record ClimbLogInput(
    DateOnly Date,
    string ClimbingType,
    string GradeSystem,
    string Grade,
    string Environment,
    int? Attempts,
    string Outcome,
    string? WallAngle,
    string[] Styles,
    string? Name,
    string? Location,
    bool? IsProject = null,
    int? ProjectId = null,
    string AttemptsMode = "Exact",
    string[]? WallAngles = null
);
