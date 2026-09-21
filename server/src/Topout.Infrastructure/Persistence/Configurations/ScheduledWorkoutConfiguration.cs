using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Topout.Domain.Entities;

namespace Topout.Infrastructure.Persistence.Configurations;

internal sealed class ScheduledWorkoutConfiguration
    : IEntityTypeConfiguration<ScheduledWorkout>
{
    public void Configure(EntityTypeBuilder<ScheduledWorkout> builder)
    {
        builder.ConfigureOwner();
        builder
            .HasOne(x => x.WorkoutDay)
            .WithMany()
            .HasForeignKey(x => x.WorkoutDayId)
            .OnDelete(DeleteBehavior.Restrict);
        builder
            .HasOne(x => x.WorkoutLog)
            .WithMany()
            .HasForeignKey(x => x.WorkoutLogId)
            .OnDelete(DeleteBehavior.SetNull);
        builder.HasIndex(x => x.WorkoutLogId).IsUnique();
        builder.HasIndex(x => new { x.UserId, x.Date });
    }
}
