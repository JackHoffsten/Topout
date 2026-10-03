using Topout.Application.Abstractions;
using Topout.Application.Common;
using Topout.Domain.Entities;
using Topout.Domain.ValueObjects;

namespace Topout.Application.WorkoutTemplates;

public sealed class ListWorkoutTemplatesHandler(
    IWorkoutTemplateRepository templates,
    ICurrentUser user
)
{
    public async Task<IReadOnlyList<WorkoutTemplateResponse>> HandleAsync(CancellationToken ct) =>
        (await templates.ListAsync(user.UserId, ct)).Select(WorkoutTemplateResponse.From).ToArray();
}

public sealed class GetWorkoutTemplateHandler(
    IWorkoutTemplateRepository templates,
    ICurrentUser user
)
{
    public async Task<WorkoutTemplateResponse> HandleAsync(int id, CancellationToken ct) =>
        WorkoutTemplateResponse.From(
            await templates.FindAsync(user.UserId, id, ct)
                ?? throw new RequestException(ErrorKind.NotFound, "Workout template not found.")
        );
}

public sealed class SaveWorkoutTemplateHandler(
    IWorkoutTemplateRepository templates,
    IExerciseRepository exercises,
    ICurrentUser user
)
{
    public async Task<WorkoutTemplateResponse> HandleAsync(
        int? id,
        WorkoutTemplateInput input,
        CancellationToken ct
    )
    {
        if (id.HasValue && await templates.FindAsync(user.UserId, id.Value, ct) is null)
            throw new RequestException(ErrorKind.NotFound, "Workout template not found.");
        var draft = new WorkoutDay(user.UserId, input.Name);
        if (
            input.Exercises is null
            || input.Exercises.Any(x => x is null || x.Sets is null || x.Sets.Any(s => s is null))
        )
            throw new RequestException(ErrorKind.Validation, "Exercises and sets are required.");
        if (input.Exercises.Select(x => x.ExerciseId).Distinct().Count() != input.Exercises.Count)
            throw new RequestException(
                ErrorKind.Conflict,
                "An exercise can appear only once in a template."
            );
        var available = (await exercises.ListAsync(user.UserId, ct)).ToDictionary(x => x.Id);
        foreach (var item in input.Exercises)
        {
            if (!available.TryGetValue(item.ExerciseId, out var exercise))
                throw new RequestException(ErrorKind.NotFound, "Exercise not found.");
            var entry = draft.AddExercise(exercise);
            foreach (var set in item.Sets)
                entry.AddSet(
                    set.TargetRepsMin,
                    set.TargetWeightKg is null
                        ? null
                        : Weight.FromKilograms(set.TargetWeightKg.Value),
                    set.IsWarmup,
                    set.IsAmrap,
                    set.TargetRepsMax,
                    set.RightTarget?.TargetRepsMin,
                    set.RightTarget?.TargetRepsMax,
                    set.RightTarget?.TargetWeightKg is null
                        ? null
                        : Weight.FromKilograms(set.RightTarget.TargetWeightKg.Value)
                );
        }
        return WorkoutTemplateResponse.From(await templates.SaveAsync(id, draft, ct));
    }
}

public sealed class DeleteWorkoutTemplateHandler(
    IWorkoutTemplateRepository templates,
    ICurrentUser user
)
{
    public Task HandleAsync(int id, CancellationToken ct) =>
        templates.DeleteAsync(user.UserId, id, ct);
}
