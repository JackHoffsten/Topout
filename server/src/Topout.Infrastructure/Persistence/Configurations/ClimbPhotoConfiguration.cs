using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Topout.Domain.Entities;

namespace Topout.Infrastructure.Persistence.Configurations;

public sealed class ClimbPhotoConfiguration : IEntityTypeConfiguration<ClimbPhoto>
{
    public void Configure(EntityTypeBuilder<ClimbPhoto> builder)
    {
        builder.HasKey(x => x.ClimbLogId);
        builder
            .HasOne<ClimbLog>()
            .WithOne()
            .HasForeignKey<ClimbPhoto>(x => x.ClimbLogId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.Property(x => x.Jpeg).IsRequired();
    }
}
