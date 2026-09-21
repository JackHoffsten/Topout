using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Topout.Domain.Entities;
using Topout.Infrastructure.Persistence;

namespace Topout.IntegrationTests;

[Collection("api")]
public class RegistrationTransactionTests(ApiFixture fixture)
{
    [Fact]
    public async Task Failed_starter_save_rolls_back_the_identity_user()
    {
        using var factory = fixture.WithWebHostBuilder(builder =>
            builder.ConfigureServices(services =>
                services.AddDbContext<AppDbContext>(options =>
                    options.AddInterceptors(new FailStarterSave())
                )
            )
        );
        using var client = factory.CreateClient(
            new() { BaseAddress = new Uri("https://localhost") }
        );
        var email = $"{Guid.NewGuid():N}@example.com";
        var response = await client.PostAsJsonAsync(
            "/api/auth/register",
            new
            {
                email,
                password = "StrongPassword123!",
                displayName = "Rollback",
            }
        );
        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        using var scope = fixture.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.False(await db.Users.AnyAsync(x => x.Email == email));
    }

    private sealed class FailStarterSave : SaveChangesInterceptor
    {
        public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
            DbContextEventData eventData,
            InterceptionResult<int> result,
            CancellationToken ct = default
        )
        {
            if (
                eventData
                    .Context!.ChangeTracker.Entries<Exercise>()
                    .Any(x => x.State == EntityState.Added)
            )
                throw new InvalidOperationException(
                    "Simulated storage failure during starter exercise creation."
                );
            return ValueTask.FromResult(result);
        }
    }
}
