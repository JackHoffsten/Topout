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
        builder.Ignore(x => x.IsCompleted);
        builder.Navigation(x => x.Entries).UsePropertyAccessMode(PropertyAccessMode.Field);
        builder.HasIndex(x => new { x.UserId, x.Date });
    }
}
