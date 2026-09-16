namespace Topout.Domain.Entities;

public class WorkoutLog : OwnedEntity
{
    public DateTime Date { get; set; }
    public List<WorkoutLogEntry> Entries { get; set; } = new List<WorkoutLogEntry>();
}