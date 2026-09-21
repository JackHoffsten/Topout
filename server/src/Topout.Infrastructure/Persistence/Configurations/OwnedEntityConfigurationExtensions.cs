using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Topout.Domain.Abstraction;
using Topout.Infrastructure.Identity;

namespace Topout.Infrastructure.Persistence.Configurations;

internal static class OwnedEntityConfigurationExtensions
{
    public static void ConfigureOwner<TOwned>(this EntityTypeBuilder<TOwned> builder)
        where TOwned : OwnedEntity
    {
        builder
            .HasOne<ApplicationUser>()
            .WithMany()
            .HasForeignKey(entity => entity.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
