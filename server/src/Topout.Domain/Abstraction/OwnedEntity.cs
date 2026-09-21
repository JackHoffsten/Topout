namespace Topout.Domain.Abstraction;

public abstract class OwnedEntity : Entity
{
    public int UserId { get; protected set; }

    protected OwnedEntity() { }

    protected OwnedEntity(int userId)
    {
        if (userId <= 0)
            throw new ArgumentOutOfRangeException(nameof(userId), "A valid user is required.");

        UserId = userId;
    }
}
