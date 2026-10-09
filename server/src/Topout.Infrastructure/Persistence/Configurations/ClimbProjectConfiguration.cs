using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Topout.Domain.Entities;

namespace Topout.Infrastructure.Persistence.Configurations;

internal sealed class ClimbProjectConfiguration : IEntityTypeConfiguration<ClimbProject>
{
    public void Configure(EntityTypeBuilder<ClimbProject> builder)
    {
        builder.ConfigureOwner();
        builder.HasIndex(x => new { x.UserId, x.IsCompleted });
        builder
            .HasMany(x => x.Logs)
            .WithOne(x => x.Project)
            .HasForeignKey(x => x.ProjectId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
