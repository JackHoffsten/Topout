using Topout.Domain.Abstraction;

namespace Topout.Domain.Entities;

public sealed class ClimbLog : OwnedEntity
{
    public DateOnly Date { get; private set; }
    public string ClimbingType { get; private set; } = "";
    public string GradeSystem { get; private set; } = "";
    public string Grade { get; private set; } = "";
    public string Environment { get; private set; } = "";
    public int Attempts { get; private set; }
    public string Outcome { get; private set; } = "";
    public string? WallAngle { get; private set; }
    public string[] Styles { get; private set; } = [];
    public string? Name { get; private set; }
    public string? Location { get; private set; }

    private ClimbLog() { }

    public ClimbLog(int userId)
        : base(userId) { }

    public void Update(
        DateOnly date,
        string climbingType,
        string gradeSystem,
        string grade,
        string environment,
        int attempts,
        string outcome,
        string? wallAngle,
        string[] styles,
        string? name,
        string? location
    )
    {
        if (date == default)
            throw new ArgumentException("Choose a valid date.");
        if (climbingType is not ("Bouldering" or "Sport" or "TopRope"))
            throw new ArgumentException("Choose a climbing type.");
        if (!ClimbingGrades.Systems(climbingType).Contains(gradeSystem))
            throw new ArgumentException("Choose a grade system for this climbing type.");
        grade = grade?.Trim() ?? "";
        if (!ClimbingGrades.Values(gradeSystem).Contains(grade))
            throw new ArgumentException("Choose a valid grade.");
        if (
            environment is not ("Indoor" or "Outdoor" or "Board")
            || (environment == "Board" && climbingType != "Bouldering")
        )
            throw new ArgumentException("Board climbing is available for bouldering only.");
        if (attempts is < 1 or > 1000)
            throw new ArgumentException("Attempts must be between 1 and 1000.");
        if (outcome is not ("Attempted" or "Redpoint" or "Flash" or "Onsight"))
            throw new ArgumentException("Choose an outcome.");
        if (outcome is "Flash" or "Onsight" && attempts != 1)
            throw new ArgumentException("Flash and onsight require one attempt.");
        if (wallAngle is not (null or "Slab" or "Vertical" or "Overhang" or "Roof"))
            throw new ArgumentException("Choose a valid wall angle.");
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
        Outcome = outcome;
        WallAngle = wallAngle;
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

public static class ClimbingGrades
{
    public static string[] Systems(string type) =>
        type == "Bouldering" ? ["Font", "V"] : ["French", "YDS"];

    // Store original grades; no conversion between independent grading scales.
    public static string[] Values(string system) =>
        system switch
        {
            "Font" =>
            [
                "1",
                "2",
                "3",
                "4",
                "4+",
                "5",
                "5+",
                .. Enumerable
                    .Range(6, 4)
                    .SelectMany(n =>
                        new[] { "A", "A+", "B", "B+", "C", "C+" }.Select(s => $"{n}{s}")
                    ),
            ],
            "V" => ["VB", .. Enumerable.Range(0, 18).Select(n => $"V{n}")],
            "French" =>
            [
                "1",
                "2",
                "3",
                "4a",
                "4b",
                "4c",
                "5a",
                "5b",
                "5c",
                .. Enumerable
                    .Range(6, 4)
                    .SelectMany(n =>
                        new[] { "a", "a+", "b", "b+", "c", "c+" }.Select(s => $"{n}{s}")
                    ),
            ],
            "YDS" =>
            [
                .. Enumerable.Range(0, 10).Select(n => $"5.{n}"),
                .. Enumerable
                    .Range(10, 6)
                    .SelectMany(n => new[] { "a", "b", "c", "d" }.Select(s => $"5.{n}{s}")),
            ],
            _ => [],
        };
}
