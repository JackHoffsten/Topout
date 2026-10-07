using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using Topout.Application.Abstractions;
using Topout.Application.Climbing;
using Topout.Application.Common;
using Topout.Domain.Entities;

namespace Topout.Infrastructure.Persistence.Repositories;

internal sealed class ClimbLogRepository(AppDbContext db) : IClimbLogRepository
{
    public async Task<IReadOnlyList<DateOnly>> ListDaysAsync(
        int userId,
        DateOnly from,
        DateOnly to,
        CancellationToken ct
    ) =>
        await db
            .ClimbingDayMarks.AsNoTracking()
            .Where(x => x.UserId == userId && x.Date >= from && x.Date <= to)
            .OrderBy(x => x.Date)
            .Select(x => x.Date)
            .ToArrayAsync(ct);

    public async Task SetDayAsync(int userId, DateOnly date, bool marked, CancellationToken ct)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        await db.Database.ExecuteSqlInterpolatedAsync(
            $"SELECT pg_advisory_xact_lock({userId}, {date.DayNumber})",
            ct
        );
        if (await db.ClimbLogs.AnyAsync(x => x.UserId == userId && x.Date == date, ct))
            throw new RequestException(ErrorKind.Conflict, "This date already has climbing logs.");
        var existing = await db.ClimbingDayMarks.SingleOrDefaultAsync(
            x => x.UserId == userId && x.Date == date,
            ct
        );
        if (marked)
        {
            if (
                await db.ScheduledWorkouts.AnyAsync(
                    x => x.UserId == userId && x.Date == date && x.IsRestDay,
                    ct
                )
            )
                throw new RequestException(
                    ErrorKind.Conflict,
                    "Remove the rest day before marking a climbing day."
                );
            if (existing == null)
                db.ClimbingDayMarks.Add(new ClimbingDayMark(userId, date));
        }
        else if (existing != null)
            db.ClimbingDayMarks.Remove(existing);
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
    }

    public async Task<IReadOnlyList<ProjectAttempt>?> ProjectAttemptsAsync(
        int userId,
        int projectId,
        CancellationToken ct
    )
    {
        if (!await db.ClimbProjects.AnyAsync(x => x.Id == projectId && x.UserId == userId, ct))
            return null;
        return await db
            .ClimbLogs.AsNoTrackingWithIdentityResolution()
            .Where(x => x.UserId == userId && x.ProjectId == projectId)
            .OrderBy(x => x.Date)
            .ThenBy(x => x.Id)
            .Select(x => new ProjectAttempt(x.Id, x.Date))
            .ToArrayAsync(ct);
    }

    public async Task<IReadOnlyList<ClimbProjectResponse>> ListProjectsAsync(
        int userId,
        CancellationToken ct
    )
    {
        var projects = await db
            .ClimbProjects.AsNoTrackingWithIdentityResolution()
            .Where(x => x.UserId == userId && !x.IsCompleted)
            .Include(x => x.Logs)
            .OrderByDescending(x => x.Id)
            .ToArrayAsync(ct);
        return projects
            .Where(x => x.Logs.Count > 0)
            .Select(x => new ClimbProjectResponse(
                x.Id,
                ClimbLogResponse.From(
                    x.Logs.OrderByDescending(l => l.Date).ThenByDescending(l => l.Id).First()
                )
            ))
            .ToArray();
    }

    public Task<int> CountAsync(int userId, CancellationToken ct) =>
        db.ClimbLogs.CountAsync(x => x.UserId == userId, ct);

    public Task<ClimbLog?> GetAsync(int userId, int id, CancellationToken ct) =>
        db
            .ClimbLogs.AsNoTrackingWithIdentityResolution()
            .Include(x => x.Project)
                .ThenInclude(x => x!.Logs)
            .SingleOrDefaultAsync(x => x.UserId == userId && x.Id == id, ct);

    public async Task<IReadOnlyList<ClimbLog>> ListHistoryAsync(
        int userId,
        int page,
        int pageSize,
        ClimbHistoryQuery query,
        CancellationToken ct
    )
    {
        var items = db
            .ClimbLogs.AsNoTrackingWithIdentityResolution()
            .Include(x => x.Project)
                .ThenInclude(x => x!.Logs)
            .Where(x => x.UserId == userId);
        items = query.Project switch
        {
            "projects" => items.Where(x => x.ProjectId != null),
            "unfinished" => items.Where(x => x.Project != null && !x.Project.IsCompleted),
            "completed" => items.Where(x => x.Project != null && x.Project.IsCompleted),
            "none" => items.Where(x => x.ProjectId == null),
            _ => items,
        };
        if (query.ClimbingType is { Length: > 0 })
            items = items.Where(x => query.ClimbingType.Contains(x.ClimbingType));
        if (query.GradeSystem is { Length: > 0 })
            items = items.Where(x => query.GradeSystem.Contains(x.GradeSystem));
        if (query.Grade is { Length: > 0 })
        {
            // Match any selected grade within the stored range, including its endpoints.
            var matching = new[] { "Font", "V", "French", "YDS" }
                .SelectMany(system =>
                {
                    var scale = ClimbingGrades.Values(system);
                    return scale
                        .SelectMany(
                            (low, i) =>
                                scale
                                    .Skip(i)
                                    .Select(
                                        (high, offset) =>
                                            new
                                            {
                                                low,
                                                high,
                                                i,
                                                end = i + offset,
                                            }
                                    )
                        )
                        .Where(range =>
                            scale
                                .Skip(range.i)
                                .Take(range.end - range.i + 1)
                                .Any(query.Grade.Contains)
                        )
                        .Select(range =>
                            range.low == range.high ? range.low : $"{range.low}-{range.high}"
                        );
                })
                .Distinct()
                .ToArray();
            items = items.Where(x => matching.Contains(x.Grade));
        }
        if (query.Environment is { Length: > 0 })
            items = items.Where(x => query.Environment.Contains(x.Environment));
        if (query.Outcome is { Length: > 0 })
            items = items.Where(x => query.Outcome.Contains(x.Outcome));
        if (query.WallAngle is { Length: > 0 })
            items = items.Where(x => query.WallAngle.Contains(x.WallAngle!));
        if (query.Style is { Length: > 0 })
            items = items.Where(x => x.Styles.Any(style => query.Style.Contains(style)));
        if (query.From != null)
            items = items.Where(x => x.Date >= query.From);
        if (query.To != null)
            items = items.Where(x => x.Date <= query.To);
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var search = query.Search.Trim().ToLowerInvariant();
            var typeSearch = search.Replace(" ", "").Replace("-", "");
            items = items.Where(x =>
                (x.Name != null && x.Name.ToLower().Contains(search))
                || (x.Location != null && x.Location.ToLower().Contains(search))
                || x.Grade.ToLower().Contains(search)
                || (typeSearch.Length > 0 && x.ClimbingType.ToLower().Contains(typeSearch))
            );
        }
        IOrderedQueryable<ClimbLog> ordered;
        if (query.Sort.StartsWith("grade"))
        {
            // Grade systems are distinct scales: group by system, then difficulty, never alphabetical grade text.
            var parameter = Expression.Parameter(typeof(ClimbLog), "x");
            Expression lower = Expression.Constant(-1);
            Expression upper = Expression.Constant(-1);
            foreach (var system in new[] { "Font", "V", "French", "YDS" })
            foreach (
                var (grade, index) in ClimbingGrades
                    .Values(system)
                    .Select((grade, index) => (grade, index))
            )
            {
                var text = Expression.Property(parameter, nameof(ClimbLog.Grade));
                Expression EndpointRank(Expression fallback, bool last) =>
                    Expression.Condition(
                        Expression.AndAlso(
                            Expression.Equal(
                                Expression.Property(parameter, nameof(ClimbLog.GradeSystem)),
                                Expression.Constant(system)
                            ),
                            Expression.OrElse(
                                Expression.Equal(text, Expression.Constant(grade)),
                                Expression.Call(
                                    text,
                                    last ? nameof(string.EndsWith) : nameof(string.StartsWith),
                                    Type.EmptyTypes,
                                    Expression.Constant(last ? $"-{grade}" : $"{grade}-")
                                )
                            )
                        ),
                        Expression.Constant(index),
                        fallback
                    );
                lower = EndpointRank(lower, false);
                upper = EndpointRank(upper, true);
            }
            var rank = Expression.Divide(Expression.Add(lower, upper), Expression.Constant(2));
            var key = Expression.Lambda<Func<ClimbLog, int>>(rank, parameter);
            var grouped = items.OrderBy(x => x.GradeSystem);
            ordered =
                query.Sort == "grade-asc" ? grouped.ThenBy(key) : grouped.ThenByDescending(key);
            ordered = ordered.ThenByDescending(x => x.Date);
        }
        else
            ordered =
                query.Sort == "date-asc"
                    ? items.OrderBy(x => x.Date)
                    : items.OrderByDescending(x => x.Date);
        return await ordered
            .ThenByDescending(x => x.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize + 1)
            .ToArrayAsync(ct);
    }

    public async Task<IReadOnlyList<ClimbLog>> ListAsync(
        int userId,
        DateOnly from,
        DateOnly to,
        CancellationToken ct
    ) =>
        await db
            .ClimbLogs.AsNoTrackingWithIdentityResolution()
            .Include(x => x.Project)
                .ThenInclude(x => x!.Logs)
            .Where(x => x.UserId == userId && x.Date >= from && x.Date <= to)
            .OrderBy(x => x.Date)
            .ThenBy(x => x.Id)
            .ToArrayAsync(ct);

    public async Task<ClimbLog> SaveAsync(
        int userId,
        int? id,
        Action<ClimbLog> update,
        bool? isProject,
        int? projectId,
        CancellationToken ct
    )
    {
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        await db.Database.ExecuteSqlInterpolatedAsync(
            $"SELECT pg_advisory_xact_lock({userId}, -1)",
            ct
        );
        var log = id.HasValue
            ? await db.ClimbLogs.SingleOrDefaultAsync(x => x.UserId == userId && x.Id == id, ct)
                ?? throw new RequestException(ErrorKind.NotFound, "Climbing log not found.")
            : new ClimbLog(userId);
        var previousProjectId = log.ProjectId;
        isProject ??= previousProjectId != null || projectId != null;
        if (projectId is <= 0 || (isProject == false && projectId != null))
            throw new RequestException(ErrorKind.Validation, "Choose a valid project.");
        if (isProject == true)
        {
            projectId ??= previousProjectId;
            var project = projectId.HasValue
                ? await db.ClimbProjects.SingleOrDefaultAsync(
                    x => x.Id == projectId && x.UserId == userId,
                    ct
                ) ?? throw new RequestException(ErrorKind.NotFound, "Climbing project not found.")
                : new ClimbProject(userId);
            if (project.IsCompleted && previousProjectId != project.Id)
                throw new RequestException(
                    ErrorKind.Conflict,
                    "This project is already completed."
                );
            if (!projectId.HasValue)
                db.ClimbProjects.Add(project);
            log.SetProject(project);
        }
        else
            log.SetProject(null);
        update(log);
        var earlier = db.ClimbLogs.Where(x =>
            x.UserId == userId
            && x.ProjectId == log.ProjectId
            && (x.Date < log.Date || (x.Date == log.Date && (!id.HasValue || x.Id < id.Value)))
        );
        log.ClassifySingleAttemptSend(
            log.ProjectId != null && await earlier.AnyAsync(ct),
            log.ProjectId != null && await earlier.AnyAsync(x => x.Date == log.Date, ct)
        );
        if (log.ProjectId != null && log.Outcome is "Flash" or "Onsight" or "DayFlash")
        {
            var prior = db.ClimbLogs.Where(x =>
                x.UserId == userId
                && x.ProjectId == log.ProjectId
                && (x.Date < log.Date || (x.Date == log.Date && (!id.HasValue || x.Id < id.Value)))
            );
            if (log.Outcome is "Flash" or "Onsight" && await prior.AnyAsync(ct))
                throw new RequestException(
                    ErrorKind.Validation,
                    "Flash and onsight are not available after previous project attempts."
                );
            if (log.Outcome == "DayFlash" && await prior.AnyAsync(x => x.Date == log.Date, ct))
                throw new RequestException(
                    ErrorKind.Validation,
                    "Day flash requires the first attempt of the day."
                );
        }
        await db.Database.ExecuteSqlInterpolatedAsync(
            $"SELECT pg_advisory_xact_lock({userId}, {log.Date.DayNumber})",
            ct
        );
        if (
            await db.ScheduledWorkouts.AnyAsync(
                x => x.UserId == userId && x.Date == log.Date && x.IsRestDay,
                ct
            )
        )
            throw new RequestException(
                ErrorKind.Conflict,
                "Remove the rest day before logging a climb."
            );
        if (!id.HasValue)
            db.ClimbLogs.Add(log);
        await db.SaveChangesAsync(ct);
        foreach (var project in new[] { previousProjectId, log.ProjectId }.OfType<int>().Distinct())
            await SynchronizeProject(project, ct);
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        if (log.Project != null)
            await db.Entry(log.Project).Collection(x => x.Logs).LoadAsync(ct);
        return log;
    }

    public async Task DeleteAsync(int userId, int id, CancellationToken ct)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        await db.Database.ExecuteSqlInterpolatedAsync(
            $"SELECT pg_advisory_xact_lock({userId}, -1)",
            ct
        );
        var log =
            await db.ClimbLogs.SingleOrDefaultAsync(x => x.UserId == userId && x.Id == id, ct)
            ?? throw new RequestException(ErrorKind.NotFound, "Climbing log not found.");
        db.ClimbLogs.Remove(log);
        await db.SaveChangesAsync(ct);
        if (log.ProjectId is int projectId)
            await SynchronizeProject(projectId, ct);
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
    }

    private async Task SynchronizeProject(int projectId, CancellationToken ct)
    {
        var project = await db.ClimbProjects.SingleAsync(x => x.Id == projectId, ct);
        if (!await db.ClimbLogs.AnyAsync(x => x.ProjectId == projectId, ct))
            db.ClimbProjects.Remove(project);
        else
            project.SetCompleted(
                await db.ClimbLogs.AnyAsync(
                    x => x.ProjectId == projectId && x.Outcome != "Attempted",
                    ct
                )
            );
    }
}
