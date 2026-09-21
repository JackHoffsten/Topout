using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace Topout.Infrastructure.Persistence;

public class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var apiDirectory = FindApiDirectory(Directory.GetCurrentDirectory());
        var configuration = new ConfigurationBuilder()
            .SetBasePath(apiDirectory)
            .AddJsonFile("appsettings.json", optional: false)
            .AddJsonFile("appsettings.Development.json", optional: true)
            .AddEnvironmentVariables()
            .Build();

        var optionsBuilder = new DbContextOptionsBuilder<AppDbContext>();
        optionsBuilder.UseNpgsql(configuration.GetConnectionString("Default"));

        return new AppDbContext(optionsBuilder.Options);
    }

    private static string FindApiDirectory(string startDirectory)
    {
        for (
            var directory = new DirectoryInfo(startDirectory);
            directory is not null;
            directory = directory.Parent
        )
        {
            var siblingCandidate = Path.Combine(directory.FullName, "Topout.Api");
            if (File.Exists(Path.Combine(siblingCandidate, "appsettings.json")))
                return siblingCandidate;

            var repositoryCandidate = Path.Combine(
                directory.FullName,
                "server",
                "src",
                "Topout.Api"
            );
            if (File.Exists(Path.Combine(repositoryCandidate, "appsettings.json")))
                return repositoryCandidate;
        }

        throw new DirectoryNotFoundException("Could not locate the Topout.Api project directory.");
    }
}
