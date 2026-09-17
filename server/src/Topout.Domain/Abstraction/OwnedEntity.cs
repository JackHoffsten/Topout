namespace Topout.Domain.Abstraction;

public abstract class OwnedEntity : Entity
{
    public int UserId { get; protected set; }
}
