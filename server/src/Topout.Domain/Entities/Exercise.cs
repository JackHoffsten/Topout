using Topout.Domain.Abstraction;
using Topout.Domain.Enums;

namespace Topout.Domain.Entities;

public class Exercise : OwnedEntity
{
    public string Name { get; private set; } = string.Empty;
    public MuscleGroup MuscleGroup { get; private set; } = MuscleGroup.None;

    private Exercise() { }

    public Exercise(int userId, string name, MuscleGroup muscleGroup)
        : base(userId)
    {
        Rename(name);
        MuscleGroup = muscleGroup;
    }

    public void Rename(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Exercise name is required.");
        if (name.Length > 100)
            throw new ArgumentException("Exercise name must be 100 characters or fewer.");
        Name = name.Trim();
    }
}
