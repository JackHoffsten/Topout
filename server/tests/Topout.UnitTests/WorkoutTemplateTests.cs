using Topout.Application.Abstractions;
using Topout.Application.Common;
using Topout.Application.WorkoutTemplates;
using Topout.Domain.Entities;
using Topout.Domain.Enums;
using Topout.Domain.ValueObjects;

namespace Topout.UnitTests;

public class WorkoutTemplateTests
{
    [Fact]
    public void Replacement_preserves_order_targets_and_ownership()
    {
        var day = new WorkoutDay(1, " Old ");
        var source = new WorkoutDay(1, " New ");
        var row = source.AddExercise(new Exercise(1, "Row", MuscleGroup.Back));
        row.AddSet(8, Weight.FromKilograms(20), true, true, 12);
        row.AddSet(5);
        source.AddExercise(new Exercise(1, "Curl", MuscleGroup.Biceps));
        day.ReplaceContents(source);
        Assert.Equal("NEW", day.NormalizedName);
        Assert.Equal("New", day.Name);
        Assert.Equal(new[] { 1, 2 }, day.Exercises.Select(e => e.Order));
        Assert.Equal(new[] { 1, 2 }, day.Exercises[0].PlannedSets.Select(s => s.Order));
        Assert.Same(day, day.Exercises[0].WorkoutDay);
        Assert.Equal(20, day.Exercises[0].PlannedSets[0].TargetWeight!.Kilograms);
        Assert.True(day.Exercises[0].PlannedSets[0].IsAmrap);
        Assert.Throws<ArgumentException>(() => day.ReplaceContents(new WorkoutDay(2, "Other")));
        Assert.Equal("New", day.Name);
        day.ReplaceContents(new WorkoutDay(1, "Empty"));
        Assert.Empty(day.Exercises);
    }

    [Fact]
    public async Task Handler_rejects_invalid_drafts_before_saving_and_builds_ordered_aggregate()
    {
        var templates = new MemoryTemplates();
        var exercises = new MemoryExercises();
        var handler = new SaveWorkoutTemplateHandler(templates, exercises, new User());
        var set = new PlannedSetInput(8, 12, null, false, true);
        var input = new WorkoutTemplateInput("Push", [new(1, [set]), new(2, [])]);
        var result = await handler.HandleAsync(null, input, default);
        Assert.Equal(1, templates.Saves);
        Assert.Equal(new[] { 1, 2 }, result.Exercises.Select(x => x.Exercise.Id));
        Assert.Null(result.Exercises[0].Sets[0].TargetWeightKg);
        var duplicate = await Assert.ThrowsAsync<RequestException>(() =>
            handler.HandleAsync(
                null,
                input with
                {
                    Exercises = [input.Exercises[0], input.Exercises[0]],
                },
                default
            )
        );
        Assert.Equal(ErrorKind.Conflict, duplicate.Kind);
        var foreign = await Assert.ThrowsAsync<RequestException>(() =>
            handler.HandleAsync(null, input with { Exercises = [new(3, [])] }, default)
        );
        Assert.Equal(ErrorKind.NotFound, foreign.Kind);
        await Assert.ThrowsAsync<ArgumentException>(() =>
            handler.HandleAsync(
                null,
                input with
                {
                    Exercises = [new(1, [set with { TargetRepsMax = 1 }])],
                },
                default
            )
        );
        Assert.Equal(1, templates.Saves);
        var missing = await Assert.ThrowsAsync<RequestException>(() =>
            handler.HandleAsync(99, input, default)
        );
        Assert.Equal(ErrorKind.NotFound, missing.Kind);
    }

    private sealed class User : ICurrentUser
    {
        public int UserId => 1;
    }

    private sealed class IdentifiedExercise : Exercise
    {
        public IdentifiedExercise(int id)
            : base(1, "Exercise " + id, MuscleGroup.Back)
        {
            Id = id;
        }
    }

    private sealed class MemoryExercises : IExerciseRepository
    {
        public Task<IReadOnlyList<Exercise>> ListAsync(int userId, CancellationToken ct) =>
            Task.FromResult<IReadOnlyList<Exercise>>([
                new IdentifiedExercise(1),
                new IdentifiedExercise(2),
            ]);

        public Task<Exercise?> FindAsync(int userId, int id, CancellationToken ct) =>
            throw new NotSupportedException();

        public Task<bool> NameExistsAsync(
            int userId,
            string normalizedName,
            int? excludingId,
            CancellationToken ct
        ) => throw new NotSupportedException();

        public Task<bool> IsReferencedAsync(int exerciseId, CancellationToken ct) =>
            throw new NotSupportedException();

        public void Add(Exercise exercise) => throw new NotSupportedException();

        public void Remove(Exercise exercise) => throw new NotSupportedException();
    }

    private sealed class MemoryTemplates : IWorkoutTemplateRepository
    {
        public int Saves;

        public Task<WorkoutDay?> FindAsync(int userId, int id, CancellationToken ct) =>
            Task.FromResult<WorkoutDay?>(null);

        public Task<IReadOnlyList<WorkoutDay>> ListAsync(int userId, CancellationToken ct) =>
            throw new NotSupportedException();

        public Task<WorkoutDay> SaveAsync(int? id, WorkoutDay template, CancellationToken ct)
        {
            Saves++;
            return Task.FromResult(template);
        }

        public Task DeleteAsync(int userId, int id, CancellationToken ct) =>
            throw new NotSupportedException();
    }
}
