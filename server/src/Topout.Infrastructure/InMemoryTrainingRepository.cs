using Topout.Application;
using Topout.Domain;

namespace Topout.Infrastructure;

public sealed class InMemoryTrainingService : ITrainingService
{
    private readonly TrainingService _inner = new();

    public IReadOnlyList<Exercise> GetExercises() => _inner.GetExercises();

    public Exercise CreateExercise(Exercise exercise) => _inner.CreateExercise(exercise);

    public IReadOnlyList<WorkoutLog> GetWorkoutLogs() => _inner.GetWorkoutLogs();

    public WorkoutLog AddWorkoutLog(WorkoutLog workoutLog) => _inner.AddWorkoutLog(workoutLog);

    public IReadOnlyList<RouteLog> GetRouteLogs() => _inner.GetRouteLogs();

    public RouteLog AddRouteLog(RouteLog routeLog) => _inner.AddRouteLog(routeLog);

    public IReadOnlyList<GymDayTemplate> GetGymDays() => _inner.GetGymDays();

    public GymDayTemplate AddGymDay(GymDayTemplate gymDayTemplate) => _inner.AddGymDay(gymDayTemplate);

    public IReadOnlyList<RestDay> GetRestDays() => _inner.GetRestDays();

    public RestDay AddRestDay(RestDay restDay) => _inner.AddRestDay(restDay);
}
