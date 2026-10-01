using Microsoft.EntityFrameworkCore;
using Topout.Application.Abstractions;
using Topout.Application.Common;
using Topout.Domain.Entities;

namespace Topout.Infrastructure.Persistence.Repositories;

internal sealed class WorkoutTemplateRepository(AppDbContext db) : IWorkoutTemplateRepository
{
    private IQueryable<WorkoutDay> ReadQuery(int userId) =>
        db
            .WorkoutDays.AsNoTracking()
            .Where(x => x.UserId == userId)
            .Include(x => x.Exercises)
                .ThenInclude(x => x.Exercise)
            .Include(x => x.Exercises)
                .ThenInclude(x => x.PlannedSets)
            .AsSingleQuery();

    public async Task<IReadOnlyList<WorkoutDay>> ListAsync(int userId, CancellationToken ct) =>
        await ReadQuery(userId).OrderBy(x => x.NormalizedName).ToArrayAsync(ct);

    public Task<WorkoutDay?> FindAsync(int userId, int id, CancellationToken ct) =>
        ReadQuery(userId).SingleOrDefaultAsync(x => x.Id == id, ct);

    public async Task<WorkoutDay> SaveAsync(int? id, WorkoutDay template, CancellationToken ct)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        WorkoutDay target;
        if (id.HasValue)
        {
            // Serialize replacements and delete old children before inserting new positions.
            // A single transaction avoids unique-order collisions and partial templates.
            target =
                await db
                    .WorkoutDays.FromSqlInterpolated(
                        $"SELECT * FROM \"WorkoutDays\" WHERE \"Id\" = {id.Value} AND \"UserId\" = {template.UserId} FOR UPDATE"
                    )
                    .SingleOrDefaultAsync(ct)
                ?? throw new RequestException(ErrorKind.NotFound, "Workout template not found.");
            await db
                .WorkoutDayExercises.Where(x => x.WorkoutDayId == target.Id)
                .ExecuteDeleteAsync(ct);
            target.ReplaceContents(template);
        }
        else
        {
            target = template;
            db.WorkoutDays.Add(target);
        }
        foreach (var entry in target.Exercises)
            db.Entry(entry.Exercise).State = EntityState.Unchanged;
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return target;
    }

    public async Task DeleteAsync(int userId, int id, CancellationToken ct)
    {
        var target =
            await db.WorkoutDays.SingleOrDefaultAsync(x => x.UserId == userId && x.Id == id, ct)
            ?? throw new RequestException(ErrorKind.NotFound, "Workout template not found.");
        db.WorkoutDays.Remove(target);
        await db.SaveChangesAsync(ct);
    }
}
