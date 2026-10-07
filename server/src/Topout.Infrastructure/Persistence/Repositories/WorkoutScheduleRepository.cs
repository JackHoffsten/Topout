using Microsoft.EntityFrameworkCore;
using Topout.Application.Abstractions;
using Topout.Application.Common;
using Topout.Domain.Entities;
using Topout.Domain.Enums;

namespace Topout.Infrastructure.Persistence.Repositories;

internal sealed class WorkoutScheduleRepository(AppDbContext db) : IWorkoutScheduleRepository
{
    public async Task<IReadOnlyList<ScheduledWorkout>> ListAsync(
        int userId,
        DateOnly from,
        DateOnly to,
        CancellationToken ct
    ) =>
        await db
            .ScheduledWorkouts.AsNoTracking()
            .Where(x => x.UserId == userId && x.Date >= from && x.Date <= to)
            .Include(x => x.WorkoutDay)
            .OrderBy(x => x.Date)
            .ThenBy(x => x.Id)
            .ToArrayAsync(ct);

    public async Task<ScheduledWorkout> CreateAsync(
        int userId,
        DateOnly date,
        int? templateId,
        CancellationToken ct
    )
    {
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        await db.Database.ExecuteSqlInterpolatedAsync(
            $"SELECT pg_advisory_xact_lock({userId}, {date.DayNumber})",
            ct
        );
        var existing = await db
            .ScheduledWorkouts.Where(x => x.UserId == userId && x.Date == date)
            .ToArrayAsync(ct);
        if (
            !templateId.HasValue
            && (
                await db.ClimbLogs.AnyAsync(x => x.UserId == userId && x.Date == date, ct)
                || await db.ClimbingDayMarks.AnyAsync(x => x.UserId == userId && x.Date == date, ct)
            )
        )
            throw new RequestException(
                ErrorKind.Conflict,
                "Remove the climbing logs or climbing day before marking this date as a rest day."
            );
        if (existing.Any(x => x.IsRestDay || !templateId.HasValue))
            throw new RequestException(
                ErrorKind.Conflict,
                "Rest days and planned workouts cannot share a date. Remove the existing plan first."
            );
        ScheduledWorkout workout;
        if (templateId.HasValue)
        {
            var template =
                await db.WorkoutDays.SingleOrDefaultAsync(
                    x => x.UserId == userId && x.Id == templateId.Value,
                    ct
                ) ?? throw new RequestException(ErrorKind.NotFound, "Workout template not found.");
            workout = new ScheduledWorkout(userId, date, template);
        }
        else
            workout = ScheduledWorkout.CreateRestDay(userId, date);
        db.ScheduledWorkouts.Add(workout);
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return workout;
    }

    public async Task DeleteAsync(int userId, int id, CancellationToken ct)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var workout =
            await db
                .ScheduledWorkouts.FromSqlInterpolated(
                    $"SELECT * FROM \"ScheduledWorkouts\" WHERE \"Id\" = {id} AND \"UserId\" = {userId} FOR UPDATE"
                )
                .SingleOrDefaultAsync(ct)
            ?? throw new RequestException(ErrorKind.NotFound, "Scheduled workout not found.");
        if (workout.WorkoutLogId.HasValue || workout.Status == ScheduledStatus.Completed)
            throw new RequestException(
                ErrorKind.Conflict,
                "Remove the workout log before removing this plan."
            );
        db.ScheduledWorkouts.Remove(workout);
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
    }
}
