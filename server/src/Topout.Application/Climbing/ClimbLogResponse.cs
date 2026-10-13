using Topout.Application.Abstractions;
using Topout.Application.Common;
using Topout.Domain.Entities;

namespace Topout.Application.Climbing;

public sealed record ClimbLogResponse(
    int Id,
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
    int? ProjectId = null,
    bool ProjectCompleted = false,
    int? TotalAttempts = null,
    string AttemptsMode = "Exact",
    bool TotalAttemptsIsLowerBound = false,
    string[]? WallAngles = null
)
{
    public static ClimbLogResponse From(ClimbLog x)
    {
        var attempts = x.Project?.AttemptsThrough(x);
        return new(
            x.Id,
            x.Date,
            x.ClimbingType,
            x.GradeSystem,
            x.Grade,
            x.Environment,
            x.Attempts,
            x.Outcome,
            x.WallAngle,
            x.Styles,
            x.Name,
            x.Location,
            x.ProjectId,
            x.Project?.IsCompleted ?? false,
            attempts?.TotalAttempts ?? (x.Project == null ? x.Attempts : null),
            x.AttemptsMode,
            attempts?.IsLowerBound ?? (x.AttemptsMode != "Exact"),
            x.WallAngles
        );
    }
}
