using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Topout.Domain.Entities;
using Topout.Domain.ValueObjects;

namespace Topout.Infrastructure.Persistence.Configurations;

internal sealed class WorkoutDaySetConfiguration : IEntityTypeConfiguration<WorkoutDaySet>
{
    public void Configure(EntityTypeBuilder<WorkoutDaySet> builder)
    {
        builder
            .HasOne(x => x.WorkoutDayExercise)
            .WithMany(x => x.PlannedSets)
            .HasForeignKey(x => x.WorkoutDayExerciseId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasIndex(x => new { x.WorkoutDayExerciseId, x.Order }).IsUnique();
        builder
            .Property(x => x.TargetWeight)
            .HasConversion(
                value => value == null ? (decimal?)null : value.Kilograms,
                value => value == null ? null : Weight.FromKilograms(value.Value)
            )
            .HasPrecision(8, 3);
        builder
            .Property(x => x.RightTargetWeight)
            .HasConversion(
                value => value == null ? (decimal?)null : value.Kilograms,
                value => value == null ? null : Weight.FromKilograms(value.Value)
            )
            .HasPrecision(8, 3);
    }
}
