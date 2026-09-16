namespace Topout.Domain.Entities;

public abstract class OwnedEntity : Entity
{
    public int UserId { get; protected set; }
}
