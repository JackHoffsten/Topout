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
    string AttemptsMode = "Exact"
);

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
    bool TotalAttemptsIsLowerBound = false
)
{
    public static ClimbLogResponse From(ClimbLog x) =>
        new(
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
            x.Project == null
                ? x.Attempts
                : (
                    x
                        .Project.Logs.Where(l =>
                            l.Date < x.Date || (l.Date == x.Date && l.Id <= x.Id)
                        )
                        .Sum(l => l.Attempts)
                        is var total
                    && total > 0
                        ? total
                        : null
                ),
            x.AttemptsMode,
            x.Project == null
                ? x.AttemptsMode != "Exact"
                : x.Project.Logs.Any(l =>
                    (l.Date < x.Date || (l.Date == x.Date && l.Id <= x.Id))
                    && l.AttemptsMode != "Exact"
                )
        );
}

public sealed record ClimbHistoryResponse(
    IReadOnlyList<ClimbLogResponse> Items,
    int? NextPage,
    int TotalCount
);

public sealed record ClimbProjectResponse(int Id, ClimbLogResponse Climb);

public sealed record ProjectAttempt(int Id, DateOnly Date);

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

public sealed class ClimbLogHandler(IClimbLogRepository logs, ICurrentUser user)
{
    public Task<IReadOnlyList<DateOnly>> DaysAsync(DateOnly from, DateOnly to, CancellationToken ct)
    {
        if (from == default || to < from || to.DayNumber - from.DayNumber > 366)
            throw new RequestException(
                ErrorKind.Validation,
                "Choose a valid date range of at most 367 days."
            );
        return logs.ListDaysAsync(user.UserId, from, to, ct);
    }

    public Task SetDayAsync(DateOnly date, bool marked, CancellationToken ct)
    {
        if (date == default)
            throw new RequestException(ErrorKind.Validation, "Choose a valid date.");
        return logs.SetDayAsync(user.UserId, date, marked, ct);
    }

    public async Task<IReadOnlyList<ProjectAttempt>> ProjectAttemptsAsync(
        int id,
        CancellationToken ct
    ) =>
        await logs.ProjectAttemptsAsync(user.UserId, id, ct)
        ?? throw new RequestException(ErrorKind.NotFound, "Climbing project not found.");

    public Task<IReadOnlyList<ClimbProjectResponse>> ProjectsAsync(CancellationToken ct) =>
        logs.ListProjectsAsync(user.UserId, ct);

    public async Task<ClimbLogResponse> GetAsync(int id, CancellationToken ct) =>
        ClimbLogResponse.From(
            await logs.GetAsync(user.UserId, id, ct)
                ?? throw new RequestException(ErrorKind.NotFound, "Climbing log not found.")
        );

    public async Task<ClimbHistoryResponse> HistoryAsync(
        int page,
        int pageSize,
        CancellationToken ct,
        ClimbHistoryQuery? query = null
    )
    {
        if (page is < 1 or > 100000 || pageSize is < 1 or > 100)
            throw new RequestException(
                ErrorKind.Validation,
                "Choose a valid page and page size (1–100)."
            );
        query ??= new();
        static bool Valid(string[]? values, string[] allowed) =>
            values == null || (values.Length <= 200 && values.All(allowed.Contains));
        if (
            query.Sort is not ("date-desc" or "date-asc" or "grade-desc" or "grade-asc")
            || !Valid(query.ClimbingType, ["Bouldering", "Sport", "TopRope"])
            || !Valid(query.GradeSystem, ["Font", "V", "French", "YDS"])
            || !Valid(query.Environment, ["Indoor", "Outdoor", "Board"])
            || !Valid(query.Outcome, ["Attempted", "Redpoint", "Flash", "Onsight", "DayFlash"])
            || !Valid(query.WallAngle, ["Slab", "Vertical", "Overhang", "Roof"])
            || !Valid(
                query.Style,
                [
                    "Crimpy",
                    "Slopy",
                    "Juggy",
                    "Pinchy",
                    "Technical",
                    "Powerful",
                    "Dynamic",
                    "Balance",
                    "Endurance",
                ]
            )
            || query.Search?.Length > 200
            || query.From > query.To
            || query.Project is not (null or "projects" or "unfinished" or "completed" or "none")
        )
            throw new RequestException(
                ErrorKind.Validation,
                "Choose valid climb filters and sorting."
            );
        if (
            query.Grade is { Length: > 0 }
            && (
                query.Grade.Length > 200
                || query.GradeSystem is not { Length: > 0 }
                || query.Grade.Any(grade =>
                    !query.GradeSystem.Any(system => ClimbingGrades.Values(system).Contains(grade))
                )
            )
        )
            throw new RequestException(
                ErrorKind.Validation,
                "Choose grades from the selected grading systems."
            );
        var items = await logs.ListHistoryAsync(user.UserId, page, pageSize, query, ct);
        return new(
            items.Take(pageSize).Select(ClimbLogResponse.From).ToArray(),
            items.Count > pageSize ? page + 1 : null,
            await logs.CountAsync(user.UserId, ct)
        );
    }

    public async Task<IReadOnlyList<ClimbLogResponse>> ListAsync(
        DateOnly from,
        DateOnly to,
        CancellationToken ct
    )
    {
        if (from == default || to == default || to < from || to.DayNumber - from.DayNumber > 62)
            throw new RequestException(
                ErrorKind.Validation,
                "Choose a date range of at most 63 days."
            );
        return (await logs.ListAsync(user.UserId, from, to, ct))
            .Select(ClimbLogResponse.From)
            .ToArray();
    }

    public async Task<ClimbLogResponse> SaveAsync(
        int? id,
        ClimbLogInput input,
        CancellationToken ct
    )
    {
        try
        {
            return ClimbLogResponse.From(
                await logs.SaveAsync(
                    user.UserId,
                    id,
                    x =>
                        x.Update(
                            input.Date,
                            input.ClimbingType,
                            input.GradeSystem,
                            input.Grade,
                            input.Environment,
                            input.Attempts,
                            input.Outcome,
                            input.WallAngle,
                            input.Styles,
                            input.Name,
                            input.Location,
                            input.AttemptsMode
                        ),
                    input.IsProject,
                    input.ProjectId,
                    ct
                )
            );
        }
        catch (ArgumentException e)
        {
            throw new RequestException(ErrorKind.Validation, e.Message);
        }
    }

    public Task DeleteAsync(int id, CancellationToken ct) => logs.DeleteAsync(user.UserId, id, ct);
}
