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
        return workout;
    }

    public async Task DeleteAsync(int userId, int id, CancellationToken ct)
    {
        var workout =
            await db.ScheduledWorkouts.SingleOrDefaultAsync(
                x => x.UserId == userId && x.Id == id,
                ct
            ) ?? throw new RequestException(ErrorKind.NotFound, "Scheduled workout not found.");
        if (workout.Status == ScheduledStatus.Completed)
            throw new RequestException(
                ErrorKind.Conflict,
                "Completed workouts cannot be removed from the calendar."
            );
        db.ScheduledWorkouts.Remove(workout);
        await db.SaveChangesAsync(ct);
    }
}
