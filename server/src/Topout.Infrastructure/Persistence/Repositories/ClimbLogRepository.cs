using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using Topout.Application.Abstractions;
using Topout.Application.Climbing;
using Topout.Application.Common;
using Topout.Domain.Entities;

namespace Topout.Infrastructure.Persistence.Repositories;

internal sealed class ClimbLogRepository(AppDbContext db) : IClimbLogRepository
{
    public Task<int> CountAsync(int userId, CancellationToken ct) =>
        db.ClimbLogs.CountAsync(x => x.UserId == userId, ct);

    public Task<ClimbLog?> GetAsync(int userId, int id, CancellationToken ct) =>
        db.ClimbLogs.AsNoTracking().SingleOrDefaultAsync(x => x.UserId == userId && x.Id == id, ct);

    public async Task<IReadOnlyList<ClimbLog>> ListHistoryAsync(
        int userId,
        int page,
        int pageSize,
        ClimbHistoryQuery query,
        CancellationToken ct
    )
    {
        var items = db.ClimbLogs.AsNoTracking().Where(x => x.UserId == userId);
        if (query.ClimbingType is { Length: > 0 })
            items = items.Where(x => query.ClimbingType.Contains(x.ClimbingType));
        if (query.GradeSystem is { Length: > 0 })
            items = items.Where(x => query.GradeSystem.Contains(x.GradeSystem));
        if (query.Grade is { Length: > 0 })
            items = items.Where(x => query.Grade.Contains(x.Grade));
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
            Expression rank = Expression.Constant(-1);
            foreach (var system in new[] { "Font", "V", "French", "YDS" })
            foreach (
                var (grade, index) in ClimbingGrades
                    .Values(system)
                    .Select((grade, index) => (grade, index))
            )
                rank = Expression.Condition(
                    Expression.AndAlso(
                        Expression.Equal(
                            Expression.Property(parameter, nameof(ClimbLog.GradeSystem)),
                            Expression.Constant(system)
                        ),
                        Expression.Equal(
                            Expression.Property(parameter, nameof(ClimbLog.Grade)),
                            Expression.Constant(grade)
                        )
                    ),
                    Expression.Constant(index),
                    rank
                );
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
            .ClimbLogs.AsNoTracking()
            .Where(x => x.UserId == userId && x.Date >= from && x.Date <= to)
            .OrderBy(x => x.Date)
            .ThenBy(x => x.Id)
            .ToArrayAsync(ct);

    public async Task<ClimbLog> SaveAsync(
        int userId,
        int? id,
        Action<ClimbLog> update,
        CancellationToken ct
    )
    {
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var log = id.HasValue
            ? await db.ClimbLogs.SingleOrDefaultAsync(x => x.UserId == userId && x.Id == id, ct)
                ?? throw new RequestException(ErrorKind.NotFound, "Climbing log not found.")
            : new ClimbLog(userId);
        update(log);
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
        await transaction.CommitAsync(ct);
        return log;
    }

    public async Task DeleteAsync(int userId, int id, CancellationToken ct)
    {
        var log =
            await db.ClimbLogs.SingleOrDefaultAsync(x => x.UserId == userId && x.Id == id, ct)
            ?? throw new RequestException(ErrorKind.NotFound, "Climbing log not found.");
        db.ClimbLogs.Remove(log);
        await db.SaveChangesAsync(ct);
    }
}
