using Topout.Domain.Entities;
using Topout.Domain.Enums;
using Topout.Domain.ValueObjects;

namespace Topout.UnitTests;

public class GymDomainTests
{
    [Fact]
    public void Split_results_keep_one_order_and_cannot_overwrite_another_side()
    {
        var log = new WorkoutLog(1, new DateOnly(2026, 10, 1));
        var exercise = new Exercise(1, "Curl", MuscleGroup.Biceps);
        log.RecordSet(exercise, 1, 8, Weight.FromKilograms(12), false, null, SetSide.Left);
        log.RecordSet(exercise, 1, 10, Weight.FromKilograms(14), false, null, SetSide.Right);
        log.RecordSet(exercise, 1, 9, Weight.FromKilograms(12), false, null, SetSide.Left);
        Assert.Equal(2, log.Entries.Single().Sets.Count);
        Assert.Equal(10, log.Entries.Single().Sets.Single(s => s.Side == SetSide.Right).Reps);
        Assert.Throws<InvalidOperationException>(() =>
            log.RecordSet(exercise, 1, 8, Weight.Zero, false, null)
        );
        log.RemoveRecordedSet(exercise.Id, 1, SetSide.Left);
        Assert.Equal(SetSide.Right, log.Entries.Single().Sets.Single().Side);
    }

    [Fact]
    public void Exercise_supports_multiple_groups_and_rejects_invalid_selections()
    {
        var exercise = new Exercise(1, "Row", new[] { MuscleGroup.Biceps, MuscleGroup.Back });
        Assert.Equal(new[] { MuscleGroup.Back, MuscleGroup.Biceps }, exercise.MuscleGroups);
        Assert.Throws<ArgumentException>(() =>
            exercise.SetMuscleGroups([MuscleGroup.Back, MuscleGroup.Back])
        );
        Assert.Throws<ArgumentException>(() => exercise.SetMuscleGroups([MuscleGroup.None]));
        exercise.SetMuscleGroups([]);
        Assert.Empty(exercise.MuscleGroups);
    }

    [Fact]
    public void Exercise_normalizes_names_and_retains_origin_when_edited()
    {
        var exercise = new Exercise(1, "  Pull-Up  ", MuscleGroup.Back, false);
        Assert.Equal("Pull-Up", exercise.Name);
        Assert.Equal("PULL-UP", exercise.NormalizedName);
        exercise.Rename(" chin-up ");
        exercise.SetMuscleGroup(MuscleGroup.Biceps);
        Assert.Equal("CHIN-UP", exercise.NormalizedName);
        Assert.False(exercise.IsCustom);
        Assert.Throws<ArgumentOutOfRangeException>(() => new Exercise(0, "Row", MuscleGroup.Back));
        Assert.Throws<ArgumentOutOfRangeException>(() => exercise.SetMuscleGroup((MuscleGroup)999));
        Assert.Throws<ArgumentException>(() => exercise.Rename(" "));
    }

    [Fact]
    public void Unsaved_exercises_are_distinct_but_same_reference_is_rejected()
    {
        var day = new WorkoutDay(1, "Pull");
        var row = new Exercise(1, "Row", MuscleGroup.Back);
        day.AddExercise(row);
        day.AddExercise(new Exercise(1, "Pull-Up", MuscleGroup.Back));
        Assert.Equal(2, day.Exercises.Count);
        Assert.Throws<InvalidOperationException>(() => day.AddExercise(row));
        Assert.Throws<InvalidOperationException>(() =>
            day.AddExercise(new Exercise(2, "Row", MuscleGroup.Back))
        );
        Assert.Throws<InvalidOperationException>(() =>
            new WorkoutLog(2, DateOnly.FromDateTime(DateTime.Today)).AddEntry(row)
        );
    }

    [Fact]
    public void Completed_workout_rejects_nested_mutation()
    {
        var log = new WorkoutLog(1, new DateOnly(2026, 9, 21));
        Assert.Throws<InvalidOperationException>(() => log.Complete(DateTime.UtcNow));
        var exercise = new Exercise(1, "Row", MuscleGroup.Back);
        var entry = log.AddEntry(exercise);
        Assert.Throws<InvalidOperationException>(() => log.Complete(DateTime.UtcNow));
        var set = entry.AddSet(8, Weight.FromKilograms(40));
        log.Complete(DateTime.UtcNow);
        Assert.True(log.IsCompleted);
        Assert.Throws<InvalidOperationException>(() => log.AddEntry(exercise));
        Assert.Throws<InvalidOperationException>(() => entry.AddSet(8, Weight.Zero));
        Assert.Throws<InvalidOperationException>(() => set.Update(9, Weight.Zero));
        Assert.Throws<InvalidOperationException>(() => set.SetNotes("changed"));
        Assert.Throws<InvalidOperationException>(() => set.MarkAsWarmup(true));
        Assert.Throws<InvalidOperationException>(() => entry.RemoveSet(set.Id));
        Assert.Throws<InvalidOperationException>(() => log.RemoveEntry(entry.Id));
    }

    [Fact]
    public void Planned_sets_validate_ranges_and_store_amrap()
    {
        var entry = new WorkoutDay(1, "Pull").AddExercise(new Exercise(1, "Row", MuscleGroup.Back));
        var set = entry.AddSet(8, isAmrap: true, targetRepsMax: 12);
        Assert.True(set.IsAmrap);
        Assert.Equal(12, set.TargetRepsMax);
        Assert.Throws<ArgumentException>(() => set.UpdateTarget(10, 9, false));
        Assert.Throws<ArgumentException>(() => set.UpdateTarget(10, 1001, false));
    }

    [Fact]
    public void Schedule_enforces_ownership_completion_and_rest_days()
    {
        var date = new DateOnly(2026, 9, 21);
        var day = new WorkoutDay(1, "Pull");
        Assert.Throws<InvalidOperationException>(() => new ScheduledWorkout(2, date, day));
        var schedule = new ScheduledWorkout(1, date, day);
        schedule.MoveTo(date.AddDays(1));
        Assert.Equal(date, schedule.LastMovedFromDate);
        Assert.Equal(ScheduledStatus.Planned, schedule.Status);
        var log = new WorkoutLog(1, date.AddDays(1));
        Assert.Throws<InvalidOperationException>(() => schedule.AttachLog(log));
        log.AddEntry(new Exercise(1, "Row", MuscleGroup.Back)).AddSet(8, Weight.Zero);
        log.Complete(DateTime.UtcNow);
        Assert.Throws<InvalidOperationException>(() =>
            ScheduledWorkout.CreateRestDay(1, date).AttachLog(log)
        );
        schedule.AttachLog(log);
        Assert.Same(log, schedule.WorkoutLog);
        Assert.Throws<ArgumentException>(() => schedule.MoveTo(date));
        schedule.DetachLog();
        Assert.Null(schedule.WorkoutLog);
        Assert.Equal(ScheduledStatus.Planned, schedule.Status);
    }

    [Fact]
    public void Weight_converts_units_without_losing_precision()
    {
        var weight = Weight.FromPounds(100);
        Assert.Equal(45.359237m, weight.Kilograms);
        Assert.InRange(weight.Pounds, 99.999999m, 100.000001m);
        Assert.Throws<ArgumentException>(() => Weight.FromKilograms(-1));
    }
}
