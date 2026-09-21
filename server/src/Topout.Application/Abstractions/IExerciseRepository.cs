using Topout.Domain.Entities;

namespace Topout.Application.Abstractions;

public interface IExerciseRepository
{
    Task<IReadOnlyList<Exercise>> ListAsync(int userId, CancellationToken ct);
    Task<Exercise?> FindAsync(int userId, int id, CancellationToken ct);
    Task<bool> NameExistsAsync(
        int userId,
        string normalizedName,
        int? excludingId,
        CancellationToken ct
    );
    Task<bool> IsReferencedAsync(int exerciseId, CancellationToken ct);
    void Add(Exercise exercise);
    void Remove(Exercise exercise);
}
