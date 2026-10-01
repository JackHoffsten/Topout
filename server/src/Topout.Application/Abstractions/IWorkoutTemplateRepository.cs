using Topout.Domain.Entities;

namespace Topout.Application.Abstractions;

public interface IWorkoutTemplateRepository
{
    Task<IReadOnlyList<WorkoutDay>> ListAsync(int userId, CancellationToken ct);
    Task<WorkoutDay?> FindAsync(int userId, int id, CancellationToken ct);
    Task<WorkoutDay> SaveAsync(int? id, WorkoutDay template, CancellationToken ct);
    Task DeleteAsync(int userId, int id, CancellationToken ct);
}
