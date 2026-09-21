using Topout.Domain.Abstraction;
using Topout.Domain.Enums;

namespace Topout.Domain.Entities;

public class Exercise : OwnedEntity
{
    public string Name { get; private set; } = string.Empty;
    public string NormalizedName { get; private set; } = string.Empty;
    public bool IsCustom { get; private set; }
    public MuscleGroup MuscleGroup { get; private set; } = MuscleGroup.None;

    private Exercise() { }

    public Exercise(int userId, string name, MuscleGroup muscleGroup, bool isCustom = true)
        : base(userId)
    {
        Rename(name);
        SetMuscleGroup(muscleGroup);
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
        MuscleGroup = muscleGroup;
    }
}
