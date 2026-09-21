using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Topout.Application.Abstractions;
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

    public override Task<int> SaveChangesAsync(CancellationToken ct = default)
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

        return base.SaveChangesAsync(ct);
    }
}
