using Topout.Domain.Abstraction;

namespace Topout.Domain.Entities;

public sealed class ClimbingDayMark : OwnedEntity
{
    public DateOnly Date { get; private set; }

    private ClimbingDayMark() { }

    public ClimbingDayMark(int userId, DateOnly date)
        : base(userId)
    {
        if (date == default)
            throw new ArgumentException("Choose a valid date.");
        Date = date;
    }
}
