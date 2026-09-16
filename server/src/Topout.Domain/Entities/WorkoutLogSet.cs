namespace Topout.Domain.Entities;

using Topout.Domain.ValueObjects;

public class WorkoutLogSet : OwnedEntity
{
    public int WorkoutLogEntryId { get; private set; }
    public int Order { get; private set; }
    public int Reps { get; private set; }
    public Weight Weight { get; private set; } = Weight.Zero;
    public bool IsWarmup { get; private set; }
    public string? Notes { get; private set; }

    private WorkoutLogSet() { }

    internal WorkoutLogSet(
        int workoutLogEntryId,
        int order,
        int reps,
        Weight weight,
        bool isWarmup,
        string? notes)
    {
        if (reps is < 1 or > 1000)
            throw new ArgumentException("Reps must be between 1 and 1000.");

        WorkoutLogEntryId = workoutLogEntryId;
        Order = order;
        Reps = reps;
        Weight = weight;
        IsWarmup = isWarmup;
        Notes = notes;
    }

    internal void SetOrder(int order) => Order = order;

    public void Update(int reps, Weight weight)
    {
        if (reps is < 1 or > 1000)
            throw new ArgumentException("Reps must be between 1 and 1000.");
        Reps = reps;
        Weight = weight;
    }

    public void MarkAsWarmup(bool isWarmup) => IsWarmup = isWarmup;
    public void SetNotes(string? notes) => Notes = notes;
}