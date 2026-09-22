using Topout.Application.Abstractions;
using Topout.Application.Common;
using Topout.Application.Exercises;
using Topout.Domain.Entities;
using Topout.Domain.Enums;

namespace Topout.UnitTests;

public class ExerciseHandlerTests
{
    [Fact]
    public async Task Handlers_scope_reads_and_writes_to_the_current_user()
    {
        var repository = new MemoryExercises();
        var unitOfWork = new UnitOfWork();
        var currentUser = new CurrentUser(7);
        repository.Items.Add(new IdentifiedExercise(10, 7, "Row"));
        repository.Items.Add(new IdentifiedExercise(11, 8, "Private"));
        repository.Items.Add(new IdentifiedExercise(12, 7, "Starter", false));
        var list = await new ListExercisesHandler(repository, currentUser).HandleAsync(default);
        Assert.Equal(2, list.Count);
        Assert.Equal("Row", list[0].Name);
        var created = await new CreateExerciseHandler(
            repository,
            unitOfWork,
            currentUser
        ).HandleAsync("Pull-Up", MuscleGroup.Back, default);
        Assert.True(created.IsCustom);
        Assert.Equal(7, repository.Items.Last().UserId);
        Assert.Equal(1, unitOfWork.Saves);
        var update = new UpdateExerciseHandler(repository, unitOfWork, currentUser);
        Assert.Equal(
            ErrorKind.NotFound,
            (
                await Assert.ThrowsAsync<RequestException>(() =>
                    update.HandleAsync(11, "Stolen", MuscleGroup.Back, default)
                )
            ).Kind
        );
        var delete = new DeleteExerciseHandler(repository, unitOfWork, currentUser);
        Assert.Equal(
            ErrorKind.NotFound,
            (await Assert.ThrowsAsync<RequestException>(() => delete.HandleAsync(11, default))).Kind
        );
        await update.HandleAsync(10, "Renamed", MuscleGroup.Biceps, default);
        Assert.Equal("RENAMED", repository.Items[0].NormalizedName);
        var personalized = await update.HandleAsync(12, "My Starter", MuscleGroup.Core, default);
        Assert.True(personalized.IsCustom);
        Assert.True(repository.Items.Single(x => x.Id == 12).IsCustom);
        await delete.HandleAsync(10, default);
        Assert.DoesNotContain(repository.Items, x => x.Id == 10);
    }

    [Fact]
    public async Task Duplicate_names_and_referenced_deletions_are_conflicts()
    {
        var repository = new MemoryExercises();
        var unitOfWork = new UnitOfWork();
        var user = new CurrentUser(7);
        repository.Items.Add(new IdentifiedExercise(10, 7, "Row"));
        repository.Items.Add(new IdentifiedExercise(12, 7, "Curl"));
        var create = new CreateExerciseHandler(repository, unitOfWork, user);
        Assert.Equal(
            ErrorKind.Conflict,
            (
                await Assert.ThrowsAsync<RequestException>(() =>
                    create.HandleAsync(" row ", MuscleGroup.Back, default)
                )
            ).Kind
        );
        var update = new UpdateExerciseHandler(repository, unitOfWork, user);
        Assert.Equal(
            ErrorKind.Conflict,
            (
                await Assert.ThrowsAsync<RequestException>(() =>
                    update.HandleAsync(12, "ROW", MuscleGroup.Back, default)
                )
            ).Kind
        );
        repository.Referenced.Add(10);
        Assert.Equal(
            ErrorKind.Conflict,
            (
                await Assert.ThrowsAsync<RequestException>(() =>
                    new DeleteExerciseHandler(repository, unitOfWork, user).HandleAsync(10, default)
                )
            ).Kind
        );
        Assert.Equal(0, unitOfWork.Saves);
    }

    [Fact]
    public void Starter_catalog_is_distinct_and_owned_by_each_account()
    {
        var first = StarterExercises.CreateFor(1);
        var second = StarterExercises.CreateFor(2);
        Assert.Equal(20, first.Count);
        Assert.Equal(20, first.Select(x => x.NormalizedName).Distinct().Count());
        Assert.All(
            first,
            x =>
            {
                Assert.Equal(1, x.UserId);
                Assert.False(x.IsCustom);
            }
        );
        first[0].Rename("Changed");
        Assert.NotEqual(first[0].Name, second[0].Name);
    }

    private sealed record CurrentUser(int UserId) : ICurrentUser;

    private sealed class IdentifiedExercise : Exercise
    {
        public IdentifiedExercise(int id, int userId, string name, bool isCustom = true)
            : base(userId, name, MuscleGroup.Back, isCustom)
        {
            Id = id;
        }
    }

    private sealed class UnitOfWork : IUnitOfWork
    {
        public int Saves { get; private set; }

        public Task<int> SaveChangesAsync(CancellationToken ct = default) =>
            Task.FromResult(++Saves);
    }

    private sealed class MemoryExercises : IExerciseRepository
    {
        public List<Exercise> Items { get; } = [];
        public HashSet<int> Referenced { get; } = [];

        public Task<IReadOnlyList<Exercise>> ListAsync(int userId, CancellationToken ct) =>
            Task.FromResult<IReadOnlyList<Exercise>>(
                Items.Where(x => x.UserId == userId).ToArray()
            );

        public Task<Exercise?> FindAsync(int userId, int id, CancellationToken ct) =>
            Task.FromResult(Items.SingleOrDefault(x => x.UserId == userId && x.Id == id));

        public Task<bool> NameExistsAsync(
            int userId,
            string name,
            int? excludingId,
            CancellationToken ct
        ) =>
            Task.FromResult(
                Items.Any(x =>
                    x.UserId == userId && x.NormalizedName == name && x.Id != excludingId
                )
            );

        public Task<bool> IsReferencedAsync(int exerciseId, CancellationToken ct) =>
            Task.FromResult(Referenced.Contains(exerciseId));

        public void Add(Exercise exercise) => Items.Add(exercise);

        public void Remove(Exercise exercise) => Items.Remove(exercise);
    }
}
