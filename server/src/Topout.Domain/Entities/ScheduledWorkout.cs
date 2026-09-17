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

    private ScheduledWorkout() { }

    public ScheduledWorkout(DateOnly date, int workoutDayId)
    {
        Date = date;
        WorkoutDayId = workoutDayId;
    }

    public void MoveTo(DateOnly newDate)
    {
        if (Status == ScheduledStatus.Completed)
            throw new ArgumentException("Cannot move a completed workout.");
        Date = newDate;
        Status = ScheduledStatus.Moved;
    }

    public void MarkSkipped()
    {
        if (Status == ScheduledStatus.Completed)
            throw new ArgumentException("Cannot skip a completed workout.");
        Status = ScheduledStatus.Skipped;
    }

    public void AttachLog(WorkoutLog log)
    {
        if (Status == ScheduledStatus.Completed)
            throw new ArgumentException("Workout already completed.");
        WorkoutLogId = log.Id;
        Status = ScheduledStatus.Completed;
    }

    public void DetachLog()
    {
        WorkoutLogId = null;
        Status = ScheduledStatus.Planned;
    }
}
