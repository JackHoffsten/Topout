namespace Topout.Domain.Entities;

using Topout.Domain.Abstraction;
using Topout.Domain.Enums;

public class ScheduledWorkout : OwnedEntity
{
    public DateOnly Date { get; private set; }
    public int? WorkoutDayId { get; private set; }
    public WorkoutDay? WorkoutDay { get; private set; }
    public ScheduledStatus Status { get; private set; } = ScheduledStatus.Planned;
    public int? WorkoutLogId { get; private set; }
    public WorkoutLog? WorkoutLog { get; private set; }
    public bool IsRestDay { get; private set; }
    public DateOnly? LastMovedFromDate { get; private set; }

    private ScheduledWorkout() { }

    public ScheduledWorkout(int userId, DateOnly date, WorkoutDay workoutDay)
        : base(userId)
    {
        ArgumentNullException.ThrowIfNull(workoutDay);
        if (workoutDay.UserId != userId)
            throw new InvalidOperationException("Workout day and schedule must belong to the same user.");
        Date = date;
        WorkoutDay = workoutDay;
    }

    private ScheduledWorkout(int userId, DateOnly date)
        : base(userId)
    {
        Date = date;
        IsRestDay = true;
    }

    public static ScheduledWorkout CreateRestDay(int userId, DateOnly date) => new(userId, date);

    public void MoveTo(DateOnly newDate)
    {
        if (Status == ScheduledStatus.Completed)
            throw new ArgumentException("Cannot move a completed workout.");
        LastMovedFromDate = Date;
        Date = newDate;
        Status = ScheduledStatus.Planned;
    }

    public void MarkSkipped()
    {
        if (Status == ScheduledStatus.Completed)
            throw new ArgumentException("Cannot skip a completed workout.");
        Status = ScheduledStatus.Skipped;
    }

    public void AttachLog(WorkoutLog log)
    {
        if (IsRestDay)
            throw new InvalidOperationException("A workout log cannot be attached to a rest day.");
        ArgumentNullException.ThrowIfNull(log);
        if (log.UserId != UserId)
            throw new InvalidOperationException("Workout log and schedule must belong to the same user.");
        if (!log.IsCompleted)
            throw new InvalidOperationException("Only a completed workout log can be attached.");
        if (Status == ScheduledStatus.Completed)
            throw new ArgumentException("Workout already completed.");
        WorkoutLog = log;
        Status = ScheduledStatus.Completed;
    }

    public void DetachLog()
    {
        WorkoutLogId = null;
        WorkoutLog = null;
        Status = ScheduledStatus.Planned;
    }
}
