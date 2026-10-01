using Microsoft.EntityFrameworkCore;
using Topout.Application.Abstractions;
using Topout.Application.Common;
using Topout.Domain.Entities;
using Topout.Domain.Enums;

namespace Topout.Infrastructure.Persistence.Repositories;

internal sealed class WorkoutLogRepository(AppDbContext db) : IWorkoutLogRepository
{
    public async Task DeleteAsync(int userId, int scheduleId, CancellationToken ct)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var schedule = await LockAsync(userId, scheduleId, ct);
        var log =
            schedule.WorkoutLog
            ?? throw new RequestException(ErrorKind.NotFound, "Workout log not found.");
        schedule.DetachLog();
        db.WorkoutLogs.Remove(log);
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
    }

    public Task<ScheduledWorkout?> FindScheduleAsync(
        int userId,
        int scheduleId,
        CancellationToken ct
    ) =>
        db
            .ScheduledWorkouts.AsNoTracking()
            .Where(s => s.UserId == userId && s.Id == scheduleId)
            .Include(s => s.WorkoutDay!)
                .ThenInclude(t => t.Exercises)
                    .ThenInclude(e => e.Exercise)
            .Include(s => s.WorkoutDay!)
                .ThenInclude(t => t.Exercises)
                    .ThenInclude(e => e.PlannedSets)
            .Include(s => s.WorkoutLog!)
                .ThenInclude(l => l.Entries)
                    .ThenInclude(e => e.Exercise)
            .Include(s => s.WorkoutLog!)
                .ThenInclude(l => l.Entries)
                    .ThenInclude(e => e.Sets)
            .AsSplitQuery()
            .SingleOrDefaultAsync(ct);

    public async Task<ScheduledWorkout> CompleteAsync(
        int userId,
        int scheduleId,
        WorkoutLog log,
        bool editing,
        CancellationToken ct
    )
    {
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var schedule =
            await db
                .ScheduledWorkouts.FromSqlInterpolated(
                    $"SELECT * FROM \"ScheduledWorkouts\" WHERE \"Id\" = {scheduleId} AND \"UserId\" = {userId} FOR UPDATE"
                )
                .SingleOrDefaultAsync(ct)
            ?? throw new RequestException(ErrorKind.NotFound, "Scheduled workout not found.");
        if (
            schedule.IsRestDay
            || (
                editing
                    ? schedule.Status != ScheduledStatus.Completed
                    : schedule.Status != ScheduledStatus.Planned
            )
        )
            throw new RequestException(ErrorKind.Conflict, "This workout cannot be logged again.");
        foreach (var entry in log.Entries)
            db.Entry(entry.Exercise).State = EntityState.Unchanged;
        if (schedule.WorkoutLogId.HasValue)
        {
            await db.Entry(schedule).Reference(s => s.WorkoutLog).LoadAsync(ct);
            var target = schedule.WorkoutLog!;
            await db
                .WorkoutLogEntries.Where(e => e.WorkoutLogId == target.Id)
                .ExecuteDeleteAsync(ct);
            target.ReplaceContents(log);
            if (!editing)
                schedule.AttachLog(target);
        }
        else
        {
            db.WorkoutLogs.Add(log);
            schedule.AttachLog(log);
        }
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return schedule;
    }

    private async Task<ScheduledWorkout> LockAsync(int userId, int id, CancellationToken ct)
    {
        var schedule =
            await db
                .ScheduledWorkouts.FromSqlInterpolated(
                    $"SELECT * FROM \"ScheduledWorkouts\" WHERE \"Id\" = {id} AND \"UserId\" = {userId} FOR UPDATE"
                )
                .SingleOrDefaultAsync(ct)
            ?? throw new RequestException(ErrorKind.NotFound, "Scheduled workout not found.");
        if (schedule.IsRestDay || schedule.Status == ScheduledStatus.Skipped)
            throw new RequestException(ErrorKind.Conflict, "This workout cannot be logged.");
        await db.Entry(schedule)
            .Reference(s => s.WorkoutLog)
            .Query()
            .Include(l => l.Entries)
                .ThenInclude(e => e.Sets)
            .AsSplitQuery()
            .LoadAsync(ct);
        return schedule;
    }

    public async Task RecordSetAsync(
        int userId,
        int scheduleId,
        Exercise exercise,
        int order,
        int reps,
        Topout.Domain.ValueObjects.Weight weight,
        bool warmup,
        string? notes,
        CancellationToken ct
    )
    {
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var schedule = await LockAsync(userId, scheduleId, ct);
        var log = schedule.WorkoutLog;
        if (log is null)
        {
            log = new WorkoutLog(userId, schedule.Date);
            schedule.StartLog(log);
            db.WorkoutLogs.Add(log);
        }
        db.Entry(exercise).State = EntityState.Unchanged;
        log.RecordSet(exercise, order, reps, weight, warmup, notes);
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
    }

    public async Task RemoveSetAsync(
        int userId,
        int scheduleId,
        int exerciseId,
        int order,
        CancellationToken ct
    )
    {
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var schedule = await LockAsync(userId, scheduleId, ct);
        var log = schedule.WorkoutLog;
        if (
            log is null
            || !log.Entries.Any(e =>
                e.ExerciseId == exerciseId && e.Sets.Any(s => s.Order == order)
            )
        )
            throw new RequestException(ErrorKind.NotFound, "Set not found.");
        if (log.IsCompleted && log.Entries.Sum(e => e.Sets.Count) == 1)
            throw new RequestException(
                ErrorKind.Conflict,
                "A completed workout needs at least one set."
            );
        log.RemoveRecordedSet(exerciseId, order);
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
    }
}
