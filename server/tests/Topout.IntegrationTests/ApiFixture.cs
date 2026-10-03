using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Testcontainers.PostgreSql;
using Topout.Infrastructure.Persistence;

namespace Topout.IntegrationTests;

public sealed class ApiFixture : WebApplicationFactory<Program>, IAsyncLifetime
{
    private readonly PostgreSqlContainer postgres = new PostgreSqlBuilder(
        "postgres:18-alpine"
    ).Build();
    public string ConnectionString => postgres.GetConnectionString();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureAppConfiguration(
            (_, configuration) =>
                configuration.AddInMemoryCollection(
                    new Dictionary<string, string?>
                    {
                        ["ConnectionStrings:Default"] = postgres.GetConnectionString(),
                        ["Jwt:Issuer"] = "Topout.Tests",
                        ["Jwt:Audience"] = "Topout.Tests.Client",
                        ["Jwt:SigningKey"] = "integration-test-only-key-at-least-32-bytes-long",
                        ["Testing:ExpandedAuthRateLimit"] = "true",
                    }
                )
        );
        builder.UseContentRoot(
            Path.GetFullPath(
                Path.Combine(AppContext.BaseDirectory, "../../../../../src/Topout.Api")
            )
        );
    }

    public async Task InitializeAsync()
    {
        await postgres.StartAsync();
        using var scope = Services.CreateScope();
        await scope.ServiceProvider.GetRequiredService<AppDbContext>().Database.MigrateAsync();
    }

    public HttpClient Client() =>
        CreateClient(
            new WebApplicationFactoryClientOptions
            {
                BaseAddress = new Uri("https://localhost"),
                AllowAutoRedirect = false,
            }
        );

    async Task IAsyncLifetime.DisposeAsync()
    {
        await DisposeAsync();
        await postgres.DisposeAsync();
    }
}
