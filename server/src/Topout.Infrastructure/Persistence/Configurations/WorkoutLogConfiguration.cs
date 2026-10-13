using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Topout.Domain.Entities;

namespace Topout.Infrastructure.Persistence.Configurations;

internal sealed class WorkoutLogConfiguration : IEntityTypeConfiguration<WorkoutLog>
{
    public void Configure(EntityTypeBuilder<WorkoutLog> builder)
    {
        builder.ConfigureOwner();
        builder.Property(x => x.Notes).HasMaxLength(2000);
        builder.Property(x => x.Location).HasMaxLength(200);
        builder.Ignore(x => x.IsCompleted);
        builder.Property(x => x.RemovedExerciseIds).HasDefaultValueSql("ARRAY[]::integer[]");
        builder.Navigation(x => x.Entries).UsePropertyAccessMode(PropertyAccessMode.Field);
        builder.HasIndex(x => new { x.UserId, x.Date });
    }
}
