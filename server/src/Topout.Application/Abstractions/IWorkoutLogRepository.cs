using Topout.Domain.Entities;
using Topout.Domain.Enums;

namespace Topout.Application.Abstractions;

public interface IWorkoutLogRepository
{
    Task<IReadOnlyList<Topout.Application.WorkoutLogging.PreviousSetResponse>> PreviousSetsAsync(
        int userId,
        DateOnly date,
        int? excludedLogId,
        CancellationToken ct
    );
    Task DeleteAsync(int userId, int scheduleId, CancellationToken ct);
    Task<ScheduledWorkout?> FindScheduleAsync(int userId, int scheduleId, CancellationToken ct);
    Task<ScheduledWorkout> CompleteAsync(
        int userId,
        int scheduleId,
        WorkoutLog log,
        bool editing,
        CancellationToken ct
    );
    Task RecordSetAsync(
        int userId,
        int scheduleId,
        Exercise exercise,
        int order,
        int reps,
        Topout.Domain.ValueObjects.Weight weight,
        bool warmup,
        string? notes,
        CancellationToken ct,
        SetSide side = SetSide.Both
    );
    Task RemoveSetAsync(
        int userId,
        int scheduleId,
        int exerciseId,
        int order,
        CancellationToken ct,
        SetSide side = SetSide.Both
    );
}
