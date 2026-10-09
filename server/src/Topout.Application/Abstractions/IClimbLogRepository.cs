using Topout.Application.Climbing;
using Topout.Domain.Entities;

namespace Topout.Application.Abstractions;

public interface IClimbLogRepository
{
    Task<IReadOnlyList<DateOnly>> ListDaysAsync(
        int userId,
        DateOnly from,
        DateOnly to,
        CancellationToken ct
    );
    Task SetDayAsync(int userId, DateOnly date, bool marked, CancellationToken ct);
    Task<IReadOnlyList<ProjectAttempt>?> ProjectAttemptsAsync(
        int userId,
        int projectId,
        CancellationToken ct
    );
    Task<IReadOnlyList<ClimbProjectResponse>> ListProjectsAsync(int userId, CancellationToken ct);
    Task<int> CountAsync(int userId, CancellationToken ct);
    Task<ClimbLog?> GetAsync(int userId, int id, CancellationToken ct);
    Task<IReadOnlyList<ClimbLog>> ListHistoryAsync(
        int userId,
        int page,
        int pageSize,
        ClimbHistoryQuery query,
        CancellationToken ct
    );
    Task<IReadOnlyList<ClimbLog>> ListAsync(
        int userId,
        DateOnly from,
        DateOnly to,
        CancellationToken ct
    );
    Task<ClimbLog> SaveAsync(
        int userId,
        int? id,
        Action<ClimbLog> update,
        bool? isProject,
        int? projectId,
        CancellationToken ct
    );
    Task DeleteAsync(int userId, int id, CancellationToken ct);
}
