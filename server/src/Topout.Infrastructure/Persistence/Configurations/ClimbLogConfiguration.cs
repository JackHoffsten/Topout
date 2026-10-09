using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Topout.Domain.Entities;

namespace Topout.Infrastructure.Persistence.Configurations;

internal sealed class ClimbLogConfiguration : IEntityTypeConfiguration<ClimbLog>
{
    public void Configure(EntityTypeBuilder<ClimbLog> builder)
    {
        builder.ConfigureOwner();
        builder.Property(x => x.AttemptsMode).HasMaxLength(10).HasDefaultValue("Exact");
        builder.HasIndex(x => new { x.UserId, x.Date });
        builder.Property(x => x.ClimbingType).HasMaxLength(20);
        builder.Property(x => x.GradeSystem).HasMaxLength(20);
        builder.Property(x => x.Grade).HasMaxLength(20);
        builder.Property(x => x.Environment).HasMaxLength(20);
        builder.Property(x => x.Outcome).HasMaxLength(20);
        builder.Ignore(x => x.WallAngle);
        builder.Property(x => x.WallAngles).IsRequired();
        builder.Property(x => x.Name).HasMaxLength(100);
        builder.Property(x => x.Location).HasMaxLength(200);
        builder.Property(x => x.Styles).IsRequired();
    }
}
