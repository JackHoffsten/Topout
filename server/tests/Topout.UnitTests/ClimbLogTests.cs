using Topout.Domain.Entities;

namespace Topout.UnitTests;

public class ClimbLogTests
{
    [Theory]
    [InlineData(null, "Unknown")]
    [InlineData(1, "MoreThan")]
    public void Uncertain_attempts_do_not_become_flashes(int? attempts, string mode)
    {
        var log = new ClimbLog(1);
        log.Update(
            new DateOnly(2026, 10, 3),
            "Bouldering",
            "Font",
            "7A",
            "Indoor",
            attempts,
            "Redpoint",
            null,
            [],
            null,
            null,
            mode
        );
        log.ClassifySingleAttemptSend(false, false);
        Assert.Equal("Redpoint", log.Outcome);
        Assert.Equal(mode, log.AttemptsMode);
        Assert.Throws<ArgumentException>(() =>
            log.Update(
                new DateOnly(2026, 10, 3),
                "Bouldering",
                "Font",
                "7A",
                "Indoor",
                attempts,
                "Flash",
                null,
                [],
                null,
                null,
                mode
            )
        );
    }

    [Theory]
    [InlineData("Redpoint", 1, false, false, "Flash")]
    [InlineData("Redpoint", 1, true, false, "DayFlash")]
    [InlineData("Redpoint", 1, true, true, "Redpoint")]
    [InlineData("Redpoint", 2, false, false, "Redpoint")]
    [InlineData("Attempted", 1, false, false, "Attempted")]
    [InlineData("Onsight", 1, false, false, "Onsight")]
    public void Single_attempt_sends_are_classified_from_history(
        string outcome,
        int attempts,
        bool previous,
        bool today,
        string expected
    )
    {
        var log = Save(attempts: attempts, outcome: outcome);
        log.ClassifySingleAttemptSend(previous, today);
        Assert.Equal(expected, log.Outcome);
    }

    [Fact]
    public void Project_link_requires_the_same_owner()
    {
        var log = Save();
        var project = new ClimbProject(1);
        log.SetProject(project);
        Assert.Same(project, log.Project);
        Assert.Throws<ArgumentException>(() => log.SetProject(new ClimbProject(2)));
        log.SetProject(null);
        Assert.Null(log.Project);
        Assert.Null(log.ProjectId);
    }

    [Theory]
    [InlineData("Font", "6B-6C", "6B+")]
    [InlineData("Font", "6B-6B+", "6B")]
    [InlineData("Font", "6B-6C+", "6B+")]
    [InlineData("YDS", "5.9-5.10b", "5.10a")]
    public void Grade_ranges_use_the_lower_middle_step(string system, string grade, string expected)
    {
        Assert.True(ClimbingGrades.IsValid(system, grade));
        Assert.Equal(expected, ClimbingGrades.Representative(system, grade));
        var log = Save(system == "YDS" ? "Sport" : "Bouldering", system, grade);
        Assert.Equal(grade, log.Grade);
    }

    [Theory]
    [InlineData("7A-7A")]
    [InlineData("7B-7A")]
    [InlineData("7A-7B-7C")]
    [InlineData("6B-7A")]
    public void Rejects_invalid_grade_ranges(string grade) =>
        Assert.Throws<ArgumentException>(() => Save(grade: grade));

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
    [InlineData("Bouldering", "Font", "7A", "Indoor", 2, "DayFlash")]
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
        Assert.Equal("DayFlash", Save(attempts: 1, outcome: "DayFlash").Outcome);
    }
}
