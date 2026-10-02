using Topout.Domain.Abstraction;
using Topout.Domain.Enums;

namespace Topout.Domain.Entities;

public class Exercise : OwnedEntity
{
    public string Name { get; private set; } = string.Empty;
    public string NormalizedName { get; private set; } = string.Empty;
    public bool IsCustom { get; private set; }
    public MuscleGroup[] MuscleGroups { get; private set; } = [];

    private Exercise() { }

    public Exercise(int userId, string name, MuscleGroup muscleGroup, bool isCustom = true)
        : this(userId, name, muscleGroup == MuscleGroup.None ? [] : [muscleGroup], isCustom) { }

    public Exercise(
        int userId,
        string name,
        IEnumerable<MuscleGroup> muscleGroups,
        bool isCustom = true
    )
        : base(userId)
    {
        Rename(name);
        SetMuscleGroups(muscleGroups);
        IsCustom = isCustom;
    }

    public void Rename(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Exercise name is required.");
        if (name.Trim().Length > 100)
            throw new ArgumentException("Exercise name must be 100 characters or fewer.");
        Name = name.Trim();
        NormalizedName = NormalizeName(Name);
    }

    public static string NormalizeName(string name) => name.Trim().ToUpperInvariant();

    public void SetMuscleGroup(MuscleGroup muscleGroup)
    {
        if (!Enum.IsDefined(muscleGroup))
            throw new ArgumentOutOfRangeException(nameof(muscleGroup));
        SetMuscleGroups(muscleGroup == MuscleGroup.None ? [] : [muscleGroup]);
    }

    public void SetMuscleGroups(IEnumerable<MuscleGroup> muscleGroups)
    {
        ArgumentNullException.ThrowIfNull(muscleGroups);
        var groups = muscleGroups.ToArray();
        if (groups.Any(group => !Enum.IsDefined(group) || group == MuscleGroup.None))
            throw new ArgumentException(
                "Select valid muscle groups, or leave the selection empty."
            );
        if (groups.Distinct().Count() != groups.Length)
            throw new ArgumentException("Muscle groups must not be repeated.");
        MuscleGroups = groups.Order().ToArray();
    }

    public void MarkAsCustom() => IsCustom = true;
}
