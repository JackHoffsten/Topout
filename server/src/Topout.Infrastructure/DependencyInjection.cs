using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Topout.Application.Abstractions;
using Topout.Application.Authentication;
using Topout.Infrastructure.Identity;
using Topout.Infrastructure.Persistence;
using Topout.Infrastructure.Persistence.Repositories;

namespace Topout.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration config
    )
    {
        services.AddDbContext<AppDbContext>(options =>
            options.UseNpgsql(config.GetConnectionString("Default"))
        );

        services.AddScoped<IUnitOfWork>(sp => sp.GetRequiredService<AppDbContext>());
        services.AddScoped<IExerciseRepository, ExerciseRepository>();
        services.AddScoped<IClimbLogRepository, ClimbLogRepository>();
        services.AddScoped<IWorkoutScheduleRepository, WorkoutScheduleRepository>();
        services.AddScoped<IWorkoutLogRepository, WorkoutLogRepository>();
        services.AddScoped<IWorkoutTemplateRepository, WorkoutTemplateRepository>();
        services.AddScoped<IAuthenticationService, AuthenticationService>();
        services.AddScoped<TokenIssuer>();
        services.AddSingleton(TimeProvider.System);

        services.AddIdentityServices();

        return services;
    }

    public static IServiceCollection AddIdentityServices(this IServiceCollection services)
    {
        services
            .AddIdentityCore<ApplicationUser>(options =>
            {
                options.Password.RequireDigit = true;
                options.Password.RequiredLength = 8;
                options.Password.RequireNonAlphanumeric = false;
                options.User.RequireUniqueEmail = true;
                options.Lockout.MaxFailedAccessAttempts = 5;
                options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
            })
            .AddRoles<ApplicationRole>()
            .AddSignInManager()
            .AddEntityFrameworkStores<AppDbContext>()
            .AddDefaultTokenProviders();

        return services;
    }
}
