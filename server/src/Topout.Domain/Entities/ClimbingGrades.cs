using System.Linq.Expressions;
namespace Topout.Domain.Entities;

public static class ClimbingGrades
{
    public static int Rank(string system, string grade) => Array.IndexOf(Values(system), Representative(system, grade));
    public static string[] MatchingIntervals(string[] selected)
    {
        return new[] { "Font", "V", "French", "YDS" }
            .SelectMany(system =>
            {
                var scale = ClimbingGrades.Values(system);
                return scale
                    .SelectMany(
                        (low, i) =>
                            scale
                                .Skip(i)
                                .Select(
                                    (high, offset) =>
                                        new
                                        {
                                            low,
                                            high,
                                            i,
                                            end = i + offset,
                                        }
                                )
                    )
                    .Where(range =>
                        scale
                            .Skip(range.i)
                            .Take(range.end - range.i + 1)
                            .Any(selected.Contains)
                    )
                    .Select(range =>
                        range.low == range.high ? range.low : $"{range.low}-{range.high}"
                    );
            })
            .Distinct()
            .ToArray();
    }
    // Expression adapter keeps database sorting translatable without evaluating domain methods in SQL.
    public static Expression<Func<ClimbLog, int>> RankExpression()
    {
        var parameter = Expression.Parameter(typeof(ClimbLog), "x");
        Expression lower = Expression.Constant(-1);
        Expression upper = Expression.Constant(-1);
        foreach (var system in new[] { "Font", "V", "French", "YDS" })
            foreach (
                var (grade, index) in ClimbingGrades
                    .Values(system)
                    .Select((grade, index) => (grade, index))
            )
            {
                var text = Expression.Property(parameter, nameof(ClimbLog.Grade));
                Expression EndpointRank(Expression fallback, bool last) =>
                    Expression.Condition(
                        Expression.AndAlso(
                            Expression.Equal(
                                Expression.Property(parameter, nameof(ClimbLog.GradeSystem)),
                                Expression.Constant(system)
                            ),
                            Expression.OrElse(
                                Expression.Equal(text, Expression.Constant(grade)),
                                Expression.Call(
                                    text,
                                    last ? nameof(string.EndsWith) : nameof(string.StartsWith),
                                    Type.EmptyTypes,
                                    Expression.Constant(last ? $"-{grade}" : $"{grade}-")
                                )
                            )
                        ),
                        Expression.Constant(index),
                        fallback
                    );
                lower = EndpointRank(lower, false);
                upper = EndpointRank(upper, true);
            }
        var rank = Expression.Divide(Expression.Add(lower, upper), Expression.Constant(2));
        return Expression.Lambda<Func<ClimbLog, int>>(rank, parameter);
    }
    public static bool IsValid(string system, string grade)
    {
        var parts = grade.Split('-');
        var scale = Values(system);
        return parts.Length == 1
            ? scale.Contains(grade)
            : parts.Length == 2
                && Array.IndexOf(scale, parts[0]) >= 0
                && Array.IndexOf(scale, parts[1]) > Array.IndexOf(scale, parts[0])
                && Array.IndexOf(scale, parts[1]) - Array.IndexOf(scale, parts[0]) <= 3;
    }

    public static string Representative(string system, string grade)
    {
        if (!IsValid(system, grade))
            return "";
        var parts = grade.Split('-');
        var scale = Values(system);
        return scale[(Array.IndexOf(scale, parts[0]) + Array.IndexOf(scale, parts[^1])) / 2];
    }

    public static string[] Systems(string type) =>
        type == "Bouldering" ? ["Font", "V"] : ["French", "YDS"];

    // Store original grades; no conversion between independent grading scales.
    public static string[] Values(string system) =>
        system switch
        {
            "Font" =>
            [
                "1",
                "2",
                "3",
                "4",
                "4+",
                "5",
                "5+",
                .. Enumerable
                    .Range(6, 4)
                    .SelectMany(n =>
                        new[] { "A", "A+", "B", "B+", "C", "C+" }.Select(s => $"{n}{s}")
                    ),
            ],
            "V" => ["VB", .. Enumerable.Range(0, 18).Select(n => $"V{n}")],
            "French" =>
            [
                "1",
                "2",
                "3",
                "4a",
                "4b",
                "4c",
                "5a",
                "5b",
                "5c",
                .. Enumerable
                    .Range(6, 4)
                    .SelectMany(n =>
                        new[] { "a", "a+", "b", "b+", "c", "c+" }.Select(s => $"{n}{s}")
                    ),
            ],
            "YDS" =>
            [
                .. Enumerable.Range(0, 10).Select(n => $"5.{n}"),
                .. Enumerable
                    .Range(10, 6)
                    .SelectMany(n => new[] { "a", "b", "c", "d" }.Select(s => $"5.{n}{s}")),
            ],
            _ => [],
        };
}
