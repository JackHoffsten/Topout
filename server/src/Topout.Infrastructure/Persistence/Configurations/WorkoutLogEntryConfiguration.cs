using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Topout.Domain.Entities;

namespace Topout.Infrastructure.Persistence.Configurations;

internal sealed class WorkoutLogEntryConfiguration
    : IEntityTypeConfiguration<WorkoutLogEntry>
{
    public void Configure(EntityTypeBuilder<WorkoutLogEntry> builder)
    {
        builder
            .HasOne(x => x.WorkoutLog)
            .WithMany(x => x.Entries)
            .HasForeignKey(x => x.WorkoutLogId)
            .OnDelete(DeleteBehavior.Cascade);
        builder
            .HasOne(x => x.Exercise)
            .WithMany()
            .HasForeignKey(x => x.ExerciseId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.Property(x => x.Notes).HasMaxLength(2000);
        builder.HasIndex(x => new { x.WorkoutLogId, x.Order }).IsUnique();
        builder.Navigation(x => x.Sets).UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}
