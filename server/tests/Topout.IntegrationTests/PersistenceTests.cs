using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Topout.Application.Common;
using Topout.Domain.Entities;
using Topout.Domain.Enums;
using Topout.Domain.ValueObjects;
using Topout.Infrastructure.Persistence;

namespace Topout.IntegrationTests;

[Collection("api")]
public class PersistenceTests(ApiFixture fixture)
{
    [Fact]
    public async Task Unsaved_graphs_round_trip_weights_and_completion_and_delete_children()
    {
        using var client = fixture.Client();
        var email = $"{Guid.NewGuid():N}@example.com";
        await ExerciseApiTests.Register(client, email);
        using var scope = fixture.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var userId = (await db.Users.SingleAsync(x => x.Email == email)).Id;
        var exercise = new Exercise(userId, "Graph exercise", MuscleGroup.Back);
        var second = new Exercise(userId, "Graph second", MuscleGroup.Back);
        var day = new WorkoutDay(userId, "Graph");
        day.AddExercise(exercise)
            .AddSet(8, Weight.FromKilograms(42.125m), isAmrap: true, targetRepsMax: 12);
        day.AddExercise(second).AddSet(10);
        var log = new WorkoutLog(userId, new DateOnly(2026, 9, 21));
        var entry = log.AddEntry(exercise);
        entry.AddSet(8, Weight.FromKilograms(42.125m));
        entry.AddSet(6, Weight.FromKilograms(45));
        log.Complete(DateTime.UtcNow);
        var schedule = new ScheduledWorkout(userId, log.Date, day);
        schedule.AttachLog(log);
        db.ScheduledWorkouts.Add(schedule);
        await db.SaveChangesAsync();
        Assert.True(exercise.Id > 0 && day.Id > 0 && log.Id > 0);
        Assert.Equal(log.Id, schedule.WorkoutLogId);
        db.ChangeTracker.Clear();

        var loadedDay = await db
            .WorkoutDays.Include(x => x.Exercises)
                .ThenInclude(x => x.PlannedSets)
            .SingleAsync(x => x.Id == day.Id);
        var loadedLog = await db
            .WorkoutLogs.Include(x => x.Entries)
                .ThenInclude(x => x.Sets)
            .SingleAsync(x => x.Id == log.Id);
        Assert.Equal(42.125m, loadedLog.Entries[0].Sets.Single(x => x.Order == 1).Weight.Kilograms);
        Assert.True(loadedLog.IsCompleted);
        var planned = loadedDay.Exercises.Single(x => x.ExerciseId == exercise.Id).PlannedSets[0];
        Assert.True(planned.IsAmrap);
        Assert.Equal(12, planned.TargetRepsMax);
        Assert.Equal(42.125m, planned.TargetWeight!.Kilograms);
        Assert.Throws<InvalidOperationException>(() =>
            loadedLog.Entries[0].Sets[0].Update(9, Weight.Zero)
        );

        var loadedSchedule = await db.ScheduledWorkouts.SingleAsync(x => x.Id == schedule.Id);
        loadedSchedule.DetachLog();
        db.ScheduledWorkouts.Remove(loadedSchedule);
        db.WorkoutDays.Remove(loadedDay);
        await db.SaveChangesAsync();
        Assert.False(await db.WorkoutDayExercises.AnyAsync(x => x.WorkoutDayId == day.Id));
        Assert.False(
            await db.WorkoutDaySets.AnyAsync(x =>
                x.WorkoutDayExerciseId == planned.WorkoutDayExerciseId
            )
        );
        Assert.True(await db.WorkoutLogs.AnyAsync(x => x.Id == log.Id));
        db.ChangeTracker.Clear(); // Exercise restriction must also be enforced with unloaded dependents.
        db.Exercises.Remove(await db.Exercises.SingleAsync(x => x.Id == exercise.Id));
        var conflict = await Assert.ThrowsAsync<RequestException>(() => db.SaveChangesAsync());
        Assert.Equal(ErrorKind.Conflict, conflict.Kind);
    }

    [Fact]
    public async Task Removing_first_set_preserves_unique_order_after_reload()
    {
        using var client = fixture.Client();
        var email = $"{Guid.NewGuid():N}@example.com";
        await ExerciseApiTests.Register(client, email);
        using var scope = fixture.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var userId = (await db.Users.SingleAsync(x => x.Email == email)).Id;
        var exercise = await db.Exercises.FirstAsync(x => x.UserId == userId);
        var log = new WorkoutLog(userId, new DateOnly(2026, 9, 21));
        var entry = log.AddEntry(exercise);
        entry.AddSet(8, Weight.Zero);
        entry.AddSet(9, Weight.Zero);
        entry.AddSet(10, Weight.Zero);
        db.WorkoutLogs.Add(log);
        await db.SaveChangesAsync();
        var removedId = entry.Sets[0].Id;
        entry.RemoveSet(removedId);
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        var sets = await db
            .WorkoutLogSets.Where(x => x.WorkoutLogEntryId == entry.Id)
            .OrderBy(x => x.Order)
            .ToArrayAsync();
        Assert.Equal(new[] { 1, 2 }, sets.Select(x => x.Order));
        Assert.Equal(new[] { 9, 10 }, sets.Select(x => x.Reps));
        Assert.False(await db.WorkoutLogSets.AnyAsync(x => x.Id == removedId));
    }

    [Fact]
    public async Task Unique_name_constraint_protects_racing_writes()
    {
        using var client = fixture.Client();
        var email = $"{Guid.NewGuid():N}@example.com";
        await ExerciseApiTests.Register(client, email);
        using var scope = fixture.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var userId = (await db.Users.SingleAsync(x => x.Email == email)).Id;
        db.Exercises.Add(new Exercise(userId, "bench press", MuscleGroup.Chest));
        Assert.Equal(
            ErrorKind.Conflict,
            (await Assert.ThrowsAsync<RequestException>(() => db.SaveChangesAsync())).Kind
        );
    }

    [Fact]
    public async Task Model_matches_migration_snapshot()
    {
        using var scope = fixture.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.False(db.Database.HasPendingModelChanges());
        Assert.Empty(await db.Database.GetPendingMigrationsAsync());
    }
}
