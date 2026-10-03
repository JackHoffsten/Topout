using Topout.Application.Abstractions;
using Topout.Application.Common;
using Topout.Application.Exercises;
using Topout.Application.WorkoutTemplates;
using Topout.Domain.Entities;
using Topout.Domain.Enums;
using Topout.Domain.ValueObjects;

namespace Topout.Application.WorkoutLogging;

public sealed record LoggedSetInput(
    int Reps,
    decimal WeightKg,
    bool IsWarmup,
    string? Notes,
    [property: System.Text.Json.Serialization.JsonIgnore(
        Condition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingDefault
    )]
        SetSide Side = SetSide.Both,
    int? Order = null
);

public sealed record LoggedSetResponse(
    int Reps,
    decimal WeightKg,
    bool IsWarmup,
    string? Notes,
    int Order,
    SetSide Side = SetSide.Both
);

public sealed record RecordSetInput(
    int ExerciseId,
    int Order,
    int Reps,
    decimal WeightKg,
    bool IsWarmup,
    string? Notes,
    [property: System.Text.Json.Serialization.JsonIgnore(
        Condition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingDefault
    )]
        SetSide Side = SetSide.Both
);

public sealed record LoggedExerciseInput(int ExerciseId, IReadOnlyList<LoggedSetInput> Sets);

public sealed record CompleteWorkoutInput(
    string? Notes,
    IReadOnlyList<LoggedExerciseInput> Exercises
);

public sealed record LoggedExerciseResponse(
    ExerciseResponse Exercise,
    IReadOnlyList<LoggedSetResponse> Sets
);

public sealed record WorkoutLogResponse(
    int Id,
    DateOnly Date,
    string? Notes,
    DateTime? CompletedAt,
    IReadOnlyList<LoggedExerciseResponse> Exercises
)
{
    public static WorkoutLogResponse From(WorkoutLog log) =>
        new(
            log.Id,
            log.Date,
            log.Notes,
            log.CompletedAt,
            log.Entries.OrderBy(e => e.Order)
                .Select(e => new LoggedExerciseResponse(
                    ExerciseResponse.From(e.Exercise),
                    e.Sets.OrderBy(s => s.Order)
                        .ThenBy(s => s.Side)
                        .Select(s => new LoggedSetResponse(
                            s.Reps,
                            s.Weight.Kilograms,
                            s.IsWarmup,
                            s.Notes,
                            s.Order,
                            s.Side
                        ))
                        .ToArray()
                ))
                .ToArray()
        );
}

public sealed record WorkoutLoggingResponse(
    int ScheduleId,
    DateOnly Date,
    string? TemplateName,
    WorkoutTemplateResponse? Template,
    WorkoutLogResponse? Log,
    IReadOnlyList<PreviousSetResponse>? PreviousSets = null
)
{
    public static WorkoutLoggingResponse From(ScheduledWorkout schedule) =>
        new(
            schedule.Id,
            schedule.Date,
            schedule.WorkoutDay?.Name,
            schedule.WorkoutDay is null ? null : WorkoutTemplateResponse.From(schedule.WorkoutDay),
            schedule.WorkoutLog is null ? null : WorkoutLogResponse.From(schedule.WorkoutLog)
        );
}

public sealed record PreviousSetResponse(
    int ExerciseId,
    int Order,
    DateOnly Date,
    int Reps,
    decimal WeightKg,
    bool IsWarmup,
    SetSide Side = SetSide.Both
);

public sealed class WorkoutLoggingHandler(
    IWorkoutLogRepository logs,
    IExerciseRepository exercises,
    ICurrentUser user,
    TimeProvider clock
)
{
    public async Task<WorkoutLoggingResponse> GetAsync(int scheduleId, CancellationToken ct)
    {
        var schedule =
            await logs.FindScheduleAsync(user.UserId, scheduleId, ct)
            ?? throw new RequestException(ErrorKind.NotFound, "Scheduled workout not found.");
        if (schedule.IsRestDay)
            throw new RequestException(ErrorKind.Conflict, "Rest days cannot have workout logs.");
        return WorkoutLoggingResponse.From(schedule) with
        {
            PreviousSets = await logs.PreviousSetsAsync(
                user.UserId,
                schedule.Date,
                schedule.WorkoutLogId,
                ct
            ),
        };
    }

    public async Task<WorkoutLoggingResponse> CompleteAsync(
        int scheduleId,
        CompleteWorkoutInput input,
        CancellationToken ct,
        bool editing = false
    )
    {
        var schedule =
            await logs.FindScheduleAsync(user.UserId, scheduleId, ct)
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
        if (
            input.Notes?.Length > 2000
            || input.Exercises is null
            || input.Exercises.Count is < 1 or > 100
            || input.Exercises.Any(e =>
                e is null
                || e.Sets is null
                || e.Sets.Count is < 1 or > 200
                || e.Sets.Any(s =>
                    s is null
                    || s.Reps is < 1 or > 1000
                    || s.WeightKg is < 0 or > 2000
                    || s.Notes?.Length > 2000
                    || !Enum.IsDefined(s.Side)
                    || (s.Order.HasValue && s.Order.Value is < 1 or > 100)
                )
            )
        )
            throw new RequestException(
                ErrorKind.Validation,
                "Enter at least one exercise and set. Reps must be 1–1000 and weight 0–2000 kg; notes may contain up to 2000 characters."
            );
        if (input.Exercises.Select(e => e.ExerciseId).Distinct().Count() != input.Exercises.Count)
            throw new RequestException(
                ErrorKind.Conflict,
                "An exercise can appear only once in a workout."
            );
        var available = (await exercises.ListAsync(user.UserId, ct)).ToDictionary(e => e.Id);
        var log = new WorkoutLog(user.UserId, schedule.Date, input.Notes?.Trim());
        foreach (var item in input.Exercises)
        {
            if (!available.TryGetValue(item.ExerciseId, out var exercise))
                throw new RequestException(ErrorKind.NotFound, "Exercise not found.");
            var entry = log.AddEntry(exercise);
            var ordered = item
                .Sets.Select((set, index) => (Set: set, Order: set.Order ?? index + 1))
                .ToArray();
            if (
                ordered.Any(s => s.Order is < 1 or > 100)
                || ordered
                    .GroupBy(s => s.Order)
                    .Any(g =>
                        g.Select(s => s.Set.Side).Distinct().Count() != g.Count()
                        || (g.Count() > 1 && g.Any(s => s.Set.Side == SetSide.Both))
                    )
            )
                throw new RequestException(
                    ErrorKind.Validation,
                    "Each set may contain either one normal result or separate left/right results."
                );
            foreach (var (set, order) in ordered)
                log.RecordSet(
                    exercise,
                    order,
                    set.Reps,
                    Weight.FromKilograms(set.WeightKg),
                    set.IsWarmup,
                    set.Notes?.Trim(),
                    set.Side
                );
        }
        log.Complete(clock.GetUtcNow().UtcDateTime);
        await logs.CompleteAsync(user.UserId, scheduleId, log, editing, ct);
        return await GetAsync(scheduleId, ct);
    }

    public async Task<WorkoutLoggingResponse> RecordSetAsync(
        int scheduleId,
        RecordSetInput input,
        CancellationToken ct
    )
    {
        if (
            input.Order is < 1 or > 100
            || input.Reps is < 1 or > 1000
            || input.WeightKg is < 0 or > 2000
            || input.Notes?.Length > 2000
            || !Enum.IsDefined(input.Side)
        )
            throw new RequestException(
                ErrorKind.Validation,
                "Enter 1–1000 reps and 0–2000 kg. Notes allow up to 2000 characters."
            );
        var exercise =
            (await exercises.ListAsync(user.UserId, ct)).FirstOrDefault(e =>
                e.Id == input.ExerciseId
            ) ?? throw new RequestException(ErrorKind.NotFound, "Exercise not found.");
        await logs.RecordSetAsync(
            user.UserId,
            scheduleId,
            exercise,
            input.Order,
            input.Reps,
            Weight.FromKilograms(input.WeightKg),
            input.IsWarmup,
            input.Notes?.Trim(),
            ct,
            input.Side
        );
        return await GetAsync(scheduleId, ct);
    }

    public async Task<WorkoutLoggingResponse> RemoveSetAsync(
        int scheduleId,
        int exerciseId,
        int order,
        CancellationToken ct,
        SetSide side = SetSide.Both
    )
    {
        if (!Enum.IsDefined(side))
            throw new RequestException(ErrorKind.Validation, "Invalid set side.");
        await logs.RemoveSetAsync(user.UserId, scheduleId, exerciseId, order, ct, side);
        return await GetAsync(scheduleId, ct);
    }

    public Task DeleteAsync(int scheduleId, CancellationToken ct) =>
        logs.DeleteAsync(user.UserId, scheduleId, ct);
}
