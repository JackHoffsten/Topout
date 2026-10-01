using Microsoft.Extensions.DependencyInjection;
using Topout.Application.Authentication;
using Topout.Application.Exercises;
using Topout.Application.WorkoutTemplates;

namespace Topout.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddScoped<ListExercisesHandler>();
        services.AddScoped<ListWorkoutTemplatesHandler>();
        services.AddScoped<GetWorkoutTemplateHandler>();
        services.AddScoped<SaveWorkoutTemplateHandler>();
        services.AddScoped<DeleteWorkoutTemplateHandler>();
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
