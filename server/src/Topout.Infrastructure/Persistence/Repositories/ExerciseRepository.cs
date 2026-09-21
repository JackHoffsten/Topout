using Microsoft.EntityFrameworkCore;
using Topout.Application.Abstractions;
using Topout.Domain.Entities;

namespace Topout.Infrastructure.Persistence.Repositories;

internal sealed class ExerciseRepository(AppDbContext db) : IExerciseRepository
{
    public async Task<IReadOnlyList<Exercise>> ListAsync(int userId, CancellationToken ct) =>
        await db
            .Exercises.AsNoTracking()
            .Where(x => x.UserId == userId)
            .OrderBy(x => x.NormalizedName)
            .ThenBy(x => x.Id)
            .ToListAsync(ct);

    public Task<Exercise?> FindAsync(int userId, int id, CancellationToken ct) =>
        db.Exercises.SingleOrDefaultAsync(x => x.UserId == userId && x.Id == id, ct);

    public Task<bool> NameExistsAsync(
        int userId,
        string normalizedName,
        int? excludingId,
        CancellationToken ct
    ) =>
        db.Exercises.AnyAsync(
            x =>
                x.UserId == userId
                && x.NormalizedName == normalizedName
                && (!excludingId.HasValue || x.Id != excludingId.Value),
            ct
        );

    public async Task<bool> IsReferencedAsync(int exerciseId, CancellationToken ct) =>
        await db.WorkoutDayExercises.AnyAsync(x => x.ExerciseId == exerciseId, ct)
        || await db.WorkoutLogEntries.AnyAsync(x => x.ExerciseId == exerciseId, ct);

    public void Add(Exercise exercise) => db.Exercises.Add(exercise);

    public void Remove(Exercise exercise) => db.Exercises.Remove(exercise);
}
