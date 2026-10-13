using Topout.Domain.Entities;
namespace Topout.UnitTests;

public class ClimbingGradeRulesTests
{
    [Fact]
    public void Every_scale_agrees_with_the_shared_contract_fixture()
    {
        var scales = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, string[]>>(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "grade-scales.json")))!;
        foreach (var (system, values) in scales)
            Assert.Equal(values, ClimbingGrades.Values(system));
    }
    [Theory]
    [InlineData("Font", "6B+", "6B-6C", 10)]
    [InlineData("V", "V2", "V1-V3", 3)]
    [InlineData("French", "6b", "6a+-6b+", 11)]
    [InlineData("YDS", "5.10a", "5.9-5.10b", 10)]
    public void Grade_interval_selection_and_rank_agree(string system, string selected, string interval, int rank)
    {
        Assert.Contains(interval, ClimbingGrades.MatchingIntervals([selected]));
        Assert.Equal(rank, ClimbingGrades.Rank(system, interval));
        var log = new ClimbLog(1);
        log.Update(new DateOnly(2026, 10, 1), system is "French" or "YDS" ? "Sport" : "Bouldering", system, interval, "Indoor", 1, "Attempted", null, [], null, null);
        Assert.Equal(rank, ClimbingGrades.RankExpression().Compile()(log));
    }
}
