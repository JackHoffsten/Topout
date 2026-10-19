using Microsoft.EntityFrameworkCore;
using Topout.Application.Abstractions;
using Topout.Application.Common;
using Topout.Application.WorkoutLogging;
using Topout.Domain.Entities;
using Topout.Domain.Enums;

namespace Topout.Infrastructure.Persistence.Repositories;

internal sealed class WorkoutLogRepository(AppDbContext db) : IWorkoutLogRepository
{
    public async Task ReplaceExerciseAsync(
        int userId,
        int scheduleId,
        int exerciseId,
        Exercise replacement,
        ReplaceExerciseInput input,
        CancellationToken ct
    )
    {
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var schedule = await LockAsync(userId, scheduleId, ct);
        await db.Entry(schedule)
            .Reference(s => s.WorkoutDay)
            .Query()
            .Include(t => t.Exercises)
            .LoadAsync(ct);
        var log = schedule.WorkoutLog;
        var active =
            log?.IsCompleted == true
                ? log.Entries.Select(e => e.ExerciseId).ToHashSet()
                : (schedule.WorkoutDay?.Exercises.Select(e => e.ExerciseId) ?? []).ToHashSet();
        if (log is not null && !log.IsCompleted)
        {
            active.ExceptWith(log.RemovedExerciseIds);
            foreach (var entry in log.Entries.Where(e => e.OriginalExerciseId.HasValue))
                active.Remove(entry.OriginalExerciseId!.Value);
            active.UnionWith(log.Entries.Select(e => e.ExerciseId));
        }
        // A newly added draft exercise may have no recorded results yet, but must be visible to this account.
        if (!active.Contains(exerciseId))
        {
            if (
                log?.IsCompleted == true
                || (log?.RemovedExerciseIds.Contains(exerciseId) ?? false)
                || (log?.Entries.Any(e => e.OriginalExerciseId == exerciseId) ?? false)
                || !await db.Exercises.AnyAsync(e => e.Id == exerciseId && e.UserId == userId, ct)
            )
                throw new RequestException(ErrorKind.NotFound, "Exercise entry not found.");
        }
        if (active.Contains(replacement.Id) && replacement.Id != exerciseId)
            throw new RequestException(
                ErrorKind.Conflict,
                "An exercise can appear only once in a workout."
            );
        if (replacement.Id == exerciseId)
            throw new RequestException(ErrorKind.Conflict, "Choose a different exercise.");
        var recorded = log?.Entries.FirstOrDefault(e => e.ExerciseId == exerciseId);
        if (
            recorded is not null
            && recorded.Sets.Any(s => !input.Sets.Any(p => p.Order == s.Order && p.Side == s.Side))
        )
            throw new RequestException(
                ErrorKind.Conflict,
                "The exercise has changed. Reopen the workout and retry replacement."
            );
        if (log is null)
        {
            log = new WorkoutLog(userId, schedule.Date);
            schedule.StartLog(log);
            db.WorkoutLogs.Add(log);
        }
        db.Entry(replacement).State = EntityState.Unchanged;
        WorkoutMutation.Apply(() =>
            log.ReplaceExercise(
                exerciseId,
                replacement,
                input.Order,
                input
                    .Sets.Select(s => new Topout.Domain.ValueObjects.WorkoutReplacementSet(
                        s.Order,
                        s.Side,
                        s.IsWarmup
                    ))
                    .ToArray()
            )
        );
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
    }

    public async Task RemoveExerciseAsync(
        int userId,
        int scheduleId,
        int exerciseId,
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
        WorkoutMutation.Apply(() => log.RemoveExercise(exerciseId));
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
    }

    public async Task SetLocationAsync(
        int userId,
        int scheduleId,
        string? location,
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
        log.SetLocation(location);
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
    }

    public async Task<
        IReadOnlyList<Topout.Application.WorkoutLogging.PreviousSetResponse>
    > PreviousSetsAsync(
        int userId,
        DateOnly date,
        int? excludedLogId,
        string? location,
        CancellationToken ct
    )
    {
        var normalizedLocation = string.IsNullOrWhiteSpace(location)
            ? null
            : location.Trim().ToLowerInvariant();
        return await db
            .WorkoutLogSets.AsNoTracking()
            .Where(s =>
                s.WorkoutLogEntry.WorkoutLog.UserId == userId
                && s.WorkoutLogEntry.WorkoutLog.Date <= date
                && (
                    !excludedLogId.HasValue || s.WorkoutLogEntry.WorkoutLogId != excludedLogId.Value
                )
            )
            .GroupBy(s => new
            {
                s.WorkoutLogEntry.ExerciseId,
                s.Order,
                s.Side,
            })
            .Select(g =>
                g.OrderByDescending(s =>
                        normalizedLocation != null
                        && s.WorkoutLogEntry.WorkoutLog.Location != null
                        && s.WorkoutLogEntry.WorkoutLog.Location.Trim().ToLower()
                            == normalizedLocation
                    )
                    .ThenByDescending(s => s.WorkoutLogEntry.WorkoutLog.Date)
                    .ThenByDescending(s => s.WorkoutLogEntry.WorkoutLogId)
                    .Select(s => new Topout.Application.WorkoutLogging.PreviousSetResponse(
                        s.WorkoutLogEntry.ExerciseId,
                        s.Order,
                        s.WorkoutLogEntry.WorkoutLog.Date,
                        s.Reps,
                        s.Weight.Kilograms,
                        s.IsWarmup,
                        s.Side,
                        s.Notes,
                        s.WorkoutLogEntry.WorkoutLog.Location
                    ))
                    .First()
            )
            .ToArrayAsync(ct);
    }

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
        WorkoutMutation.Apply(() => schedule.EnsureCanComplete(editing));
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
        WorkoutMutation.Apply(schedule.EnsureCanLog);
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
        CancellationToken ct,
        SetSide side = SetSide.Both,
        string? location = null
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
        WorkoutMutation.Apply(() =>
        {
            if (location is not null)
                log.SetLocation(location);
            log.RecordSet(exercise, order, reps, weight, warmup, notes, side);
        });
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
    }

    public async Task RemoveSetAsync(
        int userId,
        int scheduleId,
        int exerciseId,
        int order,
        CancellationToken ct,
        SetSide side = SetSide.Both
    )
    {
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var schedule = await LockAsync(userId, scheduleId, ct);
        var log = schedule.WorkoutLog;
        if (
            log is null
            || !log.Entries.Any(e =>
                e.ExerciseId == exerciseId && e.Sets.Any(s => s.Order == order && s.Side == side)
            )
        )
            throw new RequestException(ErrorKind.NotFound, "Set not found.");
        WorkoutMutation.Apply(() => log.RemoveRecordedSet(exerciseId, order, side));
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
    }
}
