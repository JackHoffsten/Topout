using Topout.Domain;

namespace Topout.Application;

public interface ITrainingService
{
    IReadOnlyList<Exercise> GetExercises();
    Exercise CreateExercise(Exercise exercise);
    IReadOnlyList<WorkoutLog> GetWorkoutLogs();
    WorkoutLog AddWorkoutLog(WorkoutLog workoutLog);
    IReadOnlyList<RouteLog> GetRouteLogs();
    RouteLog AddRouteLog(RouteLog routeLog);
    IReadOnlyList<GymDayTemplate> GetGymDays();
    GymDayTemplate AddGymDay(GymDayTemplate gymDayTemplate);
    IReadOnlyList<RestDay> GetRestDays();
    RestDay AddRestDay(RestDay restDay);
}

public sealed class TrainingService : ITrainingService
{
    private readonly List<Exercise> _exercises =
    [
        new Exercise
        {
            UserId = Guid.Parse("11111111-1111-1111-1111-111111111111"),
            Name = "Bench Press",
            Category = ExerciseCategory.Strength,
            UnitSystem = UnitSystem.Imperial,
            IsCustom = false
        },
        new Exercise
        {
            UserId = Guid.Parse("11111111-1111-1111-1111-111111111111"),
            Name = "Pull Up",
            Category = ExerciseCategory.Strength,
            UnitSystem = UnitSystem.Metric,
            IsCustom = false
        },
        new Exercise
        {
            UserId = Guid.Parse("11111111-1111-1111-1111-111111111111"),
            Name = "Squat",
            Category = ExerciseCategory.Strength,
            UnitSystem = UnitSystem.Metric,
            IsCustom = false
        }
    ];

    private readonly List<WorkoutLog> _workoutLogs = [];
    private readonly List<RouteLog> _routeLogs = [];
    private readonly List<GymDayTemplate> _gymDays = [];
    private readonly List<RestDay> _restDays = [];

    public IReadOnlyList<Exercise> GetExercises() => _exercises.AsReadOnly();

    public Exercise CreateExercise(Exercise exercise)
    {
        if (string.IsNullOrWhiteSpace(exercise.Name))
        {
            throw new ArgumentException("Exercise name is required.", nameof(exercise));
        }

        exercise.Id = Guid.NewGuid();
        _exercises.Add(exercise);
        return exercise;
    }

    public IReadOnlyList<WorkoutLog> GetWorkoutLogs() => _workoutLogs.AsReadOnly();

    public WorkoutLog AddWorkoutLog(WorkoutLog workoutLog)
    {
        workoutLog.Id = Guid.NewGuid();
        _workoutLogs.Add(workoutLog);
        return workoutLog;
    }

    public IReadOnlyList<RouteLog> GetRouteLogs() => _routeLogs.AsReadOnly();

    public RouteLog AddRouteLog(RouteLog routeLog)
    {
        routeLog.Id = Guid.NewGuid();
        _routeLogs.Add(routeLog);
        return routeLog;
    }

    public IReadOnlyList<GymDayTemplate> GetGymDays() => _gymDays.AsReadOnly();

    public GymDayTemplate AddGymDay(GymDayTemplate gymDayTemplate)
    {
        if (string.IsNullOrWhiteSpace(gymDayTemplate.Name))
        {
            throw new ArgumentException("Gym day name is required.", nameof(gymDayTemplate));
        }

        gymDayTemplate.Id = Guid.NewGuid();
        _gymDays.Add(gymDayTemplate);
        return gymDayTemplate;
    }

    public IReadOnlyList<RestDay> GetRestDays() => _restDays.AsReadOnly();

    public RestDay AddRestDay(RestDay restDay)
    {
        restDay.Id = Guid.NewGuid();
        _restDays.Add(restDay);
        return restDay;
    }
}
