using Topout.Domain.Entities;

namespace Topout.UnitTests;

public class ClimbProjectRulesTests
{
    [Fact]
    public void Summary_includes_only_attempts_through_the_selected_log()
    {
        var project = new ClimbProject(1);
        var first = Log(new DateOnly(2026, 10, 1), 3, "Exact");
        var second = Log(new DateOnly(2026, 10, 2), null, "Unknown");
        var future = Log(new DateOnly(2026, 10, 3), 8, "Exact");
        project.Logs.Add(first);
        project.Logs.Add(second);
        project.Logs.Add(future);
        Assert.Equal(new ProjectAttemptSummary(3, false), project.AttemptsThrough(first));
        Assert.Equal(new ProjectAttemptSummary(3, true), project.AttemptsThrough(second));
    }

    private static ClimbLog Log(DateOnly date, int? attempts, string mode)
    {
        var log = new ClimbLog(1);
        log.Update(
            date,
            "Bouldering",
            "Font",
            "7A",
            "Indoor",
            attempts,
            "Attempted",
            null,
            [],
            null,
            null,
            mode
        );
        return log;
    }
}
