using Topout.Domain.Entities;

namespace Topout.UnitTests;

public class ClimbLogTests
{
    private static ClimbLog Save(
        string type = "Bouldering",
        string system = "Font",
        string grade = "7A",
        string environment = "Indoor",
        int attempts = 3,
        string outcome = "Redpoint",
        string[]? styles = null
    )
    {
        var log = new ClimbLog(1);
        log.Update(
            new DateOnly(2026, 10, 3),
            type,
            system,
            grade,
            environment,
            attempts,
            outcome,
            "Overhang",
            styles ?? ["Crimpy", "Powerful"],
            "  Problem  ",
            "  Gym  "
        );
        return log;
    }

    [Theory]
    [InlineData("Bouldering", "Font", "7A")]
    [InlineData("Bouldering", "V", "V5")]
    [InlineData("Sport", "French", "7a")]
    [InlineData("TopRope", "YDS", "5.10a")]
    public void Preserves_original_grades_and_trims_optional_fields(
        string type,
        string system,
        string grade
    )
    {
        var log = Save(type, system, grade);
        Assert.Equal(grade, log.Grade);
        Assert.Equal("Problem", log.Name);
        Assert.Equal("Gym", log.Location);
        Assert.Equal(2, log.Styles.Length);
    }

    [Theory]
    [InlineData("Bouldering", "French", "7a", "Indoor", 3, "Redpoint")]
    [InlineData("Sport", "Font", "7A", "Indoor", 3, "Redpoint")]
    [InlineData("Sport", "French", "7a", "Board", 3, "Redpoint")]
    [InlineData("Bouldering", "Font", "7a", "Indoor", 3, "Redpoint")]
    [InlineData("Bouldering", "Font", "7A", "Indoor", 0, "Redpoint")]
    [InlineData("Bouldering", "Font", "7A", "Indoor", 1001, "Attempted")]
    [InlineData("Bouldering", "Font", "7A", "Indoor", 2, "Flash")]
    [InlineData("Sport", "French", "7a", "Outdoor", 2, "Onsight")]
    public void Rejects_incompatible_targets(
        string type,
        string system,
        string grade,
        string environment,
        int attempts,
        string outcome
    ) =>
        Assert.Throws<ArgumentException>(() =>
            Save(type, system, grade, environment, attempts, outcome)
        );

    [Fact]
    public void Styles_are_multiple_distinct_values_and_copied_from_input()
    {
        string[] styles = ["Crimpy", "Slopy"];
        var log = Save(styles: styles);
        styles[0] = "Unknown";
        Assert.Equal("Crimpy", log.Styles[0]);
        Assert.Throws<ArgumentException>(() => Save(styles: ["Crimpy", "Crimpy"]));
        Assert.Throws<ArgumentException>(() => Save(styles: ["Unknown"]));
        Assert.Equal("Attempted", Save(outcome: "Attempted").Outcome);
        Assert.Equal("Flash", Save(attempts: 1, outcome: "Flash").Outcome);
    }
}
