using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Topout.Domain.Entities;
using Topout.Domain.ValueObjects;

namespace Topout.Infrastructure.Persistence.Configurations;

internal sealed class WorkoutLogSetConfiguration : IEntityTypeConfiguration<WorkoutLogSet>
{
    public void Configure(EntityTypeBuilder<WorkoutLogSet> builder)
    {
        builder
            .HasOne(x => x.WorkoutLogEntry)
            .WithMany(x => x.Sets)
            .HasForeignKey(x => x.WorkoutLogEntryId)
            .OnDelete(DeleteBehavior.Cascade);
        builder
            .Property(x => x.Weight)
            .HasConversion(value => value.Kilograms, value => Weight.FromKilograms(value))
            .HasPrecision(8, 3);
        builder.Property(x => x.Notes).HasMaxLength(2000);
        builder.HasIndex(x => new { x.WorkoutLogEntryId, x.Order }).IsUnique();
    }
}
