using Topout.Domain.Abstraction;

namespace Topout.Domain.Entities;

public sealed class ClimbProject : OwnedEntity
{
    public bool IsCompleted { get; private set; }
    public ICollection<ClimbLog> Logs { get; private set; } = new List<ClimbLog>();

    private ClimbProject() { }

    public ClimbProject(int userId)
        : base(userId) { }

    public static bool Precedes(ClimbLog earlier, ClimbLog current, int? id) => earlier.Date < current.Date || (earlier.Date == current.Date && (!id.HasValue || earlier.Id < id.Value));
    [System.ComponentModel.DataAnnotations.Schema.NotMapped]
    public ClimbLog? LatestAttempt => Logs.OrderByDescending(x => x.Date).ThenByDescending(x => x.Id).FirstOrDefault();
    public ProjectAttemptSummary AttemptsThrough(ClimbLog log)
    {
        var attempts = Logs.Where(x => x.Date < log.Date || (x.Date == log.Date && x.Id <= log.Id)).ToArray();
        var total = attempts.Sum(x => x.Attempts);
        return new(total > 0 ? total : null, attempts.Any(x => x.AttemptsMode != "Exact"));
    }
    public void ClassifyAttempt(ClimbLog log, IEnumerable<ClimbLog> previous)
    {
        var prior = previous.ToArray();
        var today = prior.Any(x => x.Date == log.Date);
        log.ClassifySingleAttemptSend(prior.Length > 0, today);
        if (log.Outcome is "Flash" or "Onsight" && prior.Length > 0)
            throw new ArgumentException("Flash and onsight are not available after previous project attempts.");
        if (log.Outcome == "DayFlash" && today)
            throw new ArgumentException("Day flash requires the first attempt of the day.");
    }
    public void SynchronizeCompletion() => SetCompleted(Logs.Any(x => x.Outcome != "Attempted"));
    public void SetCompleted(bool completed) => IsCompleted = completed;
}

public sealed record ProjectAttemptSummary(int? TotalAttempts, bool IsLowerBound);
