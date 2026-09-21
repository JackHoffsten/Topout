using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Topout.Infrastructure.Identity;

namespace Topout.Infrastructure.Persistence.Configurations;

internal sealed class ApplicationUserConfiguration : IEntityTypeConfiguration<ApplicationUser>
{
    public void Configure(EntityTypeBuilder<ApplicationUser> builder)
    {
        builder.Property(x => x.DisplayName).HasMaxLength(100);
        builder.HasIndex(x => x.NormalizedEmail).HasDatabaseName("EmailIndex").IsUnique();
    }
}
