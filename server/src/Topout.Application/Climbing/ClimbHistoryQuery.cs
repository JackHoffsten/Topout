using Topout.Application.Abstractions;
using Topout.Application.Common;
using Topout.Domain.Entities;

namespace Topout.Application.Climbing;

public sealed record ClimbHistoryQuery(
    string Sort = "date-desc",
    string[]? ClimbingType = null,
    string[]? GradeSystem = null,
    string[]? Environment = null,
    string[]? Outcome = null,
    string[]? WallAngle = null,
    string[]? Style = null,
    string? Search = null,
    DateOnly? From = null,
    DateOnly? To = null,
    string[]? Grade = null,
    string? Project = null
);
