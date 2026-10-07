using Topout.Domain.Abstraction;

namespace Topout.Domain.Entities;

public sealed class ClimbProject : OwnedEntity
{
    public bool IsCompleted { get; private set; }
    public ICollection<ClimbLog> Logs { get; private set; } = new List<ClimbLog>();

    private ClimbProject() { }

    public ClimbProject(int userId)
        : base(userId) { }

    public void SetCompleted(bool completed) => IsCompleted = completed;
}
