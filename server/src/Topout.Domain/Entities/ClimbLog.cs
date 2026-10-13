using Topout.Domain.Abstraction;

namespace Topout.Domain.Entities;

public sealed class ClimbLog : OwnedEntity
{
    public DateOnly Date { get; private set; }
    public string ClimbingType { get; private set; } = "";
    public string GradeSystem { get; private set; } = "";
    public string Grade { get; private set; } = "";
    public string Environment { get; private set; } = "";
    public int? Attempts { get; private set; }
    public string AttemptsMode { get; private set; } = "Exact";
    public string Outcome { get; private set; } = "";
    public string[] WallAngles { get; private set; } = [];
    public string? WallAngle => WallAngles.FirstOrDefault();
    public string[] Styles { get; private set; } = [];
    public string? Name { get; private set; }
    public string? Location { get; private set; }
    public int? ProjectId { get; private set; }
    public ClimbProject? Project { get; private set; }

    public void SetProject(ClimbProject? project)
    {
        if (project is not null && project.UserId != UserId)
            throw new ArgumentException("Project must belong to the same account.");
        Project = project;
        ProjectId = project?.Id;
    }

    private ClimbLog() { }

    public void ClassifySingleAttemptSend(bool hasPreviousAttempts, bool hasAttemptsToday)
    {
        if (Outcome != "Redpoint" || Attempts != 1 || AttemptsMode != "Exact" || hasAttemptsToday)
            return;
        Outcome = hasPreviousAttempts ? "DayFlash" : "Flash";
    }

    public ClimbLog(int userId)
        : base(userId) { }

    public void Update(
        DateOnly date,
        string climbingType,
        string gradeSystem,
        string grade,
        string environment,
        int? attempts,
        string outcome,
        string? wallAngle,
        string[] styles,
        string? name,
        string? location,
        string attemptsMode = "Exact",
        string[]? wallAngles = null
    )
    {
        if (date == default)
            throw new ArgumentException("Choose a valid date.");
        if (climbingType is not ("Bouldering" or "Sport" or "TopRope"))
            throw new ArgumentException("Choose a climbing type.");
        if (!ClimbingGrades.Systems(climbingType).Contains(gradeSystem))
            throw new ArgumentException("Choose a grade system for this climbing type.");
        grade = grade?.Trim() ?? "";
        if (!ClimbingGrades.IsValid(gradeSystem, grade))
            throw new ArgumentException("Choose a valid grade.");
        if (
            environment is not ("Indoor" or "Outdoor" or "Board")
            || (environment == "Board" && climbingType != "Bouldering")
        )
            throw new ArgumentException("Board climbing is available for bouldering only.");
        if (attemptsMode is not ("Exact" or "MoreThan" or "Unknown"))
            throw new ArgumentException("Choose how attempts are counted.");
        if (attemptsMode == "Unknown" ? attempts != null : attempts is null or < 1 or > 1000)
            throw new ArgumentException("Attempts must be between 1 and 1000.");
        if (outcome is not ("Attempted" or "Redpoint" or "Flash" or "Onsight" or "DayFlash"))
            throw new ArgumentException("Choose an outcome.");
        if (
            outcome is "Flash" or "Onsight" or "DayFlash"
            && (attempts != 1 || attemptsMode != "Exact")
        )
            throw new ArgumentException("Flash, onsight and day flash require one attempt.");
        var angles = wallAngles ?? (wallAngle == null ? [] : new[] { wallAngle });
        if (
            angles.Length > 4
            || angles.Distinct().Count() != angles.Length
            || angles.Any(x => x is not ("Slab" or "Vertical" or "Overhang" or "Roof"))
        )
            throw new ArgumentException("Choose distinct valid wall angles.");
        string[] allowedStyles =
        [
            "Crimpy",
            "Slopy",
            "Juggy",
            "Pinchy",
            "Technical",
            "Powerful",
            "Dynamic",
            "Balance",
            "Endurance",
        ];
        if (
            styles is null
            || styles.Length > allowedStyles.Length
            || styles.Distinct().Count() != styles.Length
            || styles.Except(allowedStyles).Any()
        )
            throw new ArgumentException("Choose distinct climbing styles.");
        var validatedName = OptionalText(name, 100, "Route name");
        var validatedLocation = OptionalText(location, 200, "Location");
        Name = validatedName;
        Location = validatedLocation;
        Date = date;
        ClimbingType = climbingType;
        GradeSystem = gradeSystem;
        Grade = grade;
        Environment = environment;
        Attempts = attempts;
        AttemptsMode = attemptsMode;
        Outcome = outcome;
        WallAngles = angles.ToArray();
        Styles = styles.ToArray();
    }

    private static string? OptionalText(string? value, int max, string label)
    {
        value = value?.Trim();
        if (value?.Length > max)
            throw new ArgumentException($"{label} must be at most {max} characters.");
        return string.IsNullOrEmpty(value) ? null : value;
    }
}
