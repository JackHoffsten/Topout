using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Topout.Application.Abstractions;
using Topout.Application.Common;
using Topout.Domain.Abstraction;
using Topout.Domain.Entities;
using Topout.Infrastructure.Identity;

namespace Topout.Infrastructure.Persistence;

public sealed class AppDbContext
    : IdentityDbContext<ApplicationUser, ApplicationRole, int>,
        IUnitOfWork
{
    public AppDbContext(DbContextOptions<AppDbContext> options)
        : base(options) { }

    public DbSet<Exercise> Exercises => Set<Exercise>();
    public DbSet<ClimbLog> ClimbLogs => Set<ClimbLog>();
    public DbSet<ClimbPhoto> ClimbPhotos => Set<ClimbPhoto>();
    public DbSet<RefreshSession> RefreshSessions => Set<RefreshSession>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<WorkoutDay> WorkoutDays => Set<WorkoutDay>();
    public DbSet<WorkoutDayExercise> WorkoutDayExercises => Set<WorkoutDayExercise>();
    public DbSet<WorkoutDaySet> WorkoutDaySets => Set<WorkoutDaySet>();
    public DbSet<ScheduledWorkout> ScheduledWorkouts => Set<ScheduledWorkout>();
    public DbSet<WorkoutLog> WorkoutLogs => Set<WorkoutLog>();
    public DbSet<WorkoutLogEntry> WorkoutLogEntries => Set<WorkoutLogEntry>();
    public DbSet<WorkoutLogSet> WorkoutLogSets => Set<WorkoutLogSet>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        builder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }

    public override async Task<int> SaveChangesAsync(CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;

        foreach (var entry in ChangeTracker.Entries<Entity>())
        {
            if (entry.State == EntityState.Added && entry.Entity is ICreatedAt created)
                created.CreatedAt = now;

            if (entry.State == EntityState.Modified && entry.Entity is ICreatedAt)
                entry.Property(nameof(ICreatedAt.CreatedAt)).IsModified = false;

            if (
                entry.State is EntityState.Added or EntityState.Modified
                && entry.Entity is IUpdatedAt updated
            )
                updated.UpdatedAt = now;
        }

        try
        {
            return await base.SaveChangesAsync(ct);
        }
        catch (DbUpdateException exception)
            when (exception.InnerException
                    is PostgresException
                    {
                        SqlState: PostgresErrorCodes.UniqueViolation,
                        ConstraintName: "IX_WorkoutDays_UserId_NormalizedName"
                    }
            )
        {
            throw new RequestException(
                ErrorKind.Conflict,
                "A workout template with this name already exists."
            );
        }
        catch (DbUpdateException exception)
            when (exception.InnerException
                    is PostgresException
                    {
                        SqlState: PostgresErrorCodes.ForeignKeyViolation
                            or PostgresErrorCodes.RestrictViolation,
                        ConstraintName: "FK_ScheduledWorkouts_WorkoutDays_WorkoutDayId"
                    }
            )
        {
            throw new RequestException(
                ErrorKind.Conflict,
                "This workout template is used by a scheduled workout."
            );
        }
        catch (DbUpdateException exception)
            when (exception.InnerException
                    is PostgresException
                    {
                        SqlState: PostgresErrorCodes.UniqueViolation,
                        ConstraintName: "IX_Exercises_UserId_NormalizedName"
                    }
            )
        {
            throw new RequestException(
                ErrorKind.Conflict,
                "An exercise with this name already exists."
            );
        }
        catch (DbUpdateException exception)
            when (exception.InnerException
                    is PostgresException
                    {
                        SqlState: PostgresErrorCodes.UniqueViolation,
                        ConstraintName: "EmailIndex" or "UserNameIndex"
                    }
            )
        {
            throw new RequestException(
                ErrorKind.Conflict,
                "An account with this email already exists."
            );
        }
        catch (DbUpdateException exception)
            when (exception.InnerException
                    is PostgresException
                    {
                        SqlState: PostgresErrorCodes.ForeignKeyViolation
                            or PostgresErrorCodes.RestrictViolation,
                        ConstraintName: "FK_WorkoutDayExercises_Exercises_ExerciseId"
                            or "FK_WorkoutLogEntries_Exercises_ExerciseId"
                    }
            )
        {
            throw new RequestException(
                ErrorKind.Conflict,
                "This exercise is used by a workout template or log."
            );
        }
    }
}
