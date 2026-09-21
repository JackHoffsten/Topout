namespace Topout.Domain.ValueObjects;

using Topout.Domain.Enums;

public sealed record Weight
{
    public const decimal KilogramsPerPound = 0.45359237m;
    public const decimal PoundsPerKilogram = 1m / KilogramsPerPound;

    public decimal Kilograms { get; }

    private Weight(decimal kilograms) => Kilograms = kilograms;

    public static Weight FromKilograms(decimal kg)
    {
        if (kg < 0 || kg > 2000)
            throw new ArgumentException("Weight must be between 0 and 2000 kg.");
        return new Weight(kg);
    }

    public static Weight FromPounds(decimal lb) => FromKilograms(lb * KilogramsPerPound);

    public static Weight Zero => new(0m);

    public decimal Pounds => Kilograms * PoundsPerKilogram;

    public decimal In(UnitSystem system) => system == UnitSystem.Metric ? Kilograms : Pounds;
}
