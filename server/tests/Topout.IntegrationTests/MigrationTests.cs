using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql;
using Topout.Infrastructure.Identity;
using Topout.Infrastructure.Persistence;

namespace Topout.IntegrationTests;

[Collection("api")]
public class MigrationTests(ApiFixture fixture)
{
    [Fact]
    public async Task Upgrade_preserves_existing_exercises_and_backfills_metadata()
    {
        var databaseName = "upgrade_" + Guid.NewGuid().ToString("N");
        await using var admin = new NpgsqlConnection(fixture.ConnectionString);
        await admin.OpenAsync();
        // The identifier consists exclusively of this fixed prefix and a generated GUID.
        await using (var create = new NpgsqlCommand($"CREATE DATABASE {databaseName}", admin))
            await create.ExecuteNonQueryAsync();
        var connection = new NpgsqlConnectionStringBuilder(fixture.ConnectionString)
        {
            Database = databaseName,
        };
        await using var db = new AppDbContext(
            new DbContextOptionsBuilder<AppDbContext>()
                .UseNpgsql(connection.ConnectionString)
                .Options
        );
        var migrator = db.GetService<IMigrator>();
        await migrator.MigrateAsync("20260921091545_InitialGymSchema");
        var user = new ApplicationUser { UserName = "existing", DisplayName = "Existing" };
        db.Users.Add(user);
        await db.SaveChangesAsync();
        await db.Database.ExecuteSqlInterpolatedAsync(
            $"""INSERT INTO "Exercises" ("Name", "MuscleGroup", "UserId") VALUES ({"Existing Row"}, {2}, {user.Id}), ({"Existing Curl"}, {4}, {user.Id})"""
        );
        await db.Database.ExecuteSqlInterpolatedAsync(
            $"""INSERT INTO "WorkoutDays" ("Name", "UserId") VALUES ({" Pull "}, {user.Id}), ({"Push"}, {user.Id})"""
        );
        await db.Database.MigrateAsync();
        var templates = await db
            .WorkoutDays.Where(x => x.UserId == user.Id)
            .OrderBy(x => x.Name)
            .ToArrayAsync();
        Assert.Equal(new[] { "PULL", "PUSH" }, templates.Select(x => x.NormalizedName));
        Assert.Equal("Pull", templates[0].Name);
        var exercises = await db
            .Exercises.Where(x => x.UserId == user.Id)
            .OrderBy(x => x.Name)
            .ToArrayAsync();
        Assert.Equal(2, exercises.Length);
        Assert.All(exercises, x => Assert.True(x.IsCustom));
        Assert.Equal("EXISTING CURL", exercises[0].NormalizedName);
        Assert.Equal("EXISTING ROW", exercises[1].NormalizedName);
        // This disposable database is removed with its fixture container.
    }
}
