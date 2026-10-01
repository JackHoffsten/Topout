using Topout.Domain.Entities;

namespace Topout.Application.Abstractions;

public interface IWorkoutScheduleRepository
{
    Task<IReadOnlyList<ScheduledWorkout>> ListAsync(
        int userId,
        DateOnly from,
        DateOnly to,
        CancellationToken ct
    );
    Task<ScheduledWorkout> CreateAsync(
        int userId,
        DateOnly date,
        int? templateId,
        CancellationToken ct
    );
    Task DeleteAsync(int userId, int id, CancellationToken ct);
}
