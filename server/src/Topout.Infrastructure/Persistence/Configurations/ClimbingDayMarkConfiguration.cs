using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Topout.Domain.Entities;

namespace Topout.Infrastructure.Persistence.Configurations;

internal sealed class ClimbingDayMarkConfiguration : IEntityTypeConfiguration<ClimbingDayMark>
{
    public void Configure(EntityTypeBuilder<ClimbingDayMark> builder)
    {
        builder.ConfigureOwner();
        builder.HasIndex(x => new { x.UserId, x.Date }).IsUnique();
    }
}
