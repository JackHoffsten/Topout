using Microsoft.Extensions.DependencyInjection;
using Topout.Application.Authentication;
using Topout.Application.Exercises;

namespace Topout.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddScoped<ListExercisesHandler>();
        services.AddScoped<CreateExerciseHandler>();
        services.AddScoped<UpdateExerciseHandler>();
        services.AddScoped<DeleteExerciseHandler>();
        services.AddScoped<RegisterHandler>();
        services.AddScoped<LoginHandler>();
        services.AddScoped<RefreshHandler>();
        services.AddScoped<RevokeHandler>();
        return services;
    }
}
