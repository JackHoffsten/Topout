using Microsoft.EntityFrameworkCore;
using Topout.Application.Abstractions;
using Topout.Application.Progress;

namespace Topout.Infrastructure.Persistence.Repositories;

public sealed class ProgressRepository(AppDbContext db) : IProgressRepository
{
    public async Task<ProgressResponse> ReadAsync(
        int userId,
        DateOnly? from,
        DateOnly? to,
        CancellationToken ct
    )
    {
        // Weight is a converted value object. Aggregate its numeric column in PostgreSQL;
        // EF cannot translate Weight.Kilograms inside Sum/Max. All inputs remain parameters.
        var exercises = await db
            .Database.SqlQuery<ExerciseProgressDay>(
                $"""
                SELECT w."Date", e."ExerciseId", x."Name",
                    CASE s."Side" WHEN 0 THEN 'Both' WHEN 1 THEN 'Left' ELSE 'Right' END AS "Side",
                    COUNT(*)::int AS "Sets", SUM(s."Reps")::int AS "Reps",
                    MAX(s."Weight") AS "MaxWeightKg", SUM(s."Weight" * s."Reps") AS "VolumeKg"
                FROM "WorkoutLogSets" s
                JOIN "WorkoutLogEntries" e ON e."Id" = s."WorkoutLogEntryId"
                JOIN "WorkoutLogs" w ON w."Id" = e."WorkoutLogId"
                JOIN "Exercises" x ON x."Id" = e."ExerciseId"
                WHERE w."UserId" = {userId} AND NOT s."IsWarmup"
                    AND w."Date" >= {from ?? DateOnly.MinValue} AND w."Date" <= {to
                    ?? DateOnly.MaxValue}
                GROUP BY w."Date", e."ExerciseId", x."Name", s."Side"
                ORDER BY w."Date", e."ExerciseId", s."Side"
                """
            )
            .ToArrayAsync(ct);
        var climbs = await db
            .ClimbLogs.AsNoTracking()
            .Where(c =>
                c.UserId == userId
                && (!from.HasValue || c.Date >= from.Value)
                && (!to.HasValue || c.Date <= to.Value)
            )
            .GroupBy(c => new
            {
                c.Date,
                c.ClimbingType,
                c.GradeSystem,
                c.Grade,
                c.Environment,
            })
            .OrderBy(g => g.Key.Date)
            .Select(g => new ClimbingProgressDay(
                g.Key.Date,
                g.Key.ClimbingType,
                g.Key.GradeSystem,
                g.Key.Grade,
                g.Key.Environment,
                g.Count(),
                g.Count(c => c.Outcome != "Attempted"),
                g.Count(c => c.Outcome == "Flash"),
                g.Sum(c => c.Attempts)
            ))
            .ToArrayAsync(ct);
        return new ProgressResponse(exercises, climbs);
    }
}
