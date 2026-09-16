namespace Topout.Domain;

public enum UnitSystem
{
    Metric,
    Imperial
}

public enum GradeSystem
{
    Yosemite,
    Fontainebleau,
    Hueco,
    French,
    VScale,
    British,
    Ewbank
}

public enum ClimbingEnvironment
{
    Indoor,
    Outdoor,
    Board,
    HomeWall,
    TrainingWall
}

public enum ClimbStyle
{
    Slab,
    Vertical,
    Overhang,
    Crimpy,
    Slopy,
    Steep,
    Roof,
    Pocketed
}

public enum RouteOutcome
{
    Flash,
    Onsight,
    Redpoint,
    Repeat,
    Project,
    Fall
}

public enum ExerciseCategory
{
    Strength,
    Hypertrophy,
    Power,
    Endurance,
    Mobility,
    Conditioning
}

public sealed class User
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Timezone { get; set; }
}

public sealed class Exercise
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public ExerciseCategory Category { get; set; } = ExerciseCategory.Strength;
    public UnitSystem UnitSystem { get; set; } = UnitSystem.Metric;
    public bool IsCustom { get; set; }
}

public sealed class WorkoutLog
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public Guid ExerciseId { get; set; }
    public DateOnly Date { get; set; }
    public int Sets { get; set; }
    public int RepsPerSet { get; set; }
    public decimal? Weight { get; set; }
    public UnitSystem WeightUnit { get; set; } = UnitSystem.Metric;
    public string? Notes { get; set; }
}

public sealed class GymDayTemplate
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public string Name { get; set; } = string.Empty;
    public List<Guid> ExerciseIds { get; set; } = [];
    public string? Notes { get; set; }
}

public sealed class RouteLog
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public DateOnly Date { get; set; }
    public string Grade { get; set; } = string.Empty;
    public GradeSystem GradeSystem { get; set; } = GradeSystem.Yosemite;
    public ClimbingEnvironment Environment { get; set; } = ClimbingEnvironment.Indoor;
    public List<ClimbStyle> Styles { get; set; } = [];
    public int Attempts { get; set; } = 1;
    public RouteOutcome Outcome { get; set; } = RouteOutcome.Redpoint;
    public bool IsRestDay { get; set; }
    public string? Notes { get; set; }
}

public sealed class RestDay
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public DateOnly Date { get; set; }
    public bool IsRestDay { get; set; } = true;
    public string? Notes { get; set; }
}
