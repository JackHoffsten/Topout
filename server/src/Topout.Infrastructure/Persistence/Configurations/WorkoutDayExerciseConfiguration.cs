using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Topout.Domain.Entities;

namespace Topout.Infrastructure.Persistence.Configurations;

internal sealed class WorkoutDayExerciseConfiguration
    : IEntityTypeConfiguration<WorkoutDayExercise>
{
    public void Configure(EntityTypeBuilder<WorkoutDayExercise> builder)
    {
        builder
            .HasOne(x => x.WorkoutDay)
            .WithMany(x => x.Exercises)
            .HasForeignKey(x => x.WorkoutDayId)
            .OnDelete(DeleteBehavior.Cascade);
        builder
            .HasOne(x => x.Exercise)
            .WithMany()
            .HasForeignKey(x => x.ExerciseId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(x => new { x.WorkoutDayId, x.ExerciseId }).IsUnique();
        builder.HasIndex(x => new { x.WorkoutDayId, x.Order }).IsUnique();
        builder.Navigation(x => x.PlannedSets).UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}
