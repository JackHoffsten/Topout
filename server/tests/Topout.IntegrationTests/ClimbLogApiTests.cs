using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Topout.Application.Climbing;
using Topout.Application.WorkoutSchedule;
using Topout.Application.WorkoutTemplates;

namespace Topout.IntegrationTests;

[Collection("api")]
public class ClimbLogApiTests(ApiFixture fixture)
{
    private const string Path = "/api/climb-logs";
    private const string Range = "?from=2026-10-01&to=2026-10-31";
    private static ClimbLogInput Input =>
        new(
            new DateOnly(2026, 10, 3),
            "Bouldering",
            "Font",
            "7A",
            "Board",
            3,
            "Redpoint",
            "Overhang",
            ["Crimpy", "Slopy"],
            "  Problem  ",
            "  Board  "
        );

    private async Task<HttpClient> Client()
    {
        var client = fixture.Client();
        var session = await ExerciseApiTests.Register(client);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Bearer",
            session.AccessToken
        );
        return client;
    }

    [Fact]
    public async Task History_search_matches_grade_and_readable_climbing_types()
    {
        using var client = await Client();
        using var other = await Client();
        await client.PostAsJsonAsync(Path, Input with { Name = null, Location = null });
        await client.PostAsJsonAsync(Path, Input with { ClimbingType = "TopRope", GradeSystem = "French", Grade = "6b", Environment = "Indoor", Name = null, Location = null });
        await other.PostAsJsonAsync(Path, Input);
        foreach (var (search, type) in new[] { ("7a", "Bouldering"), ("BOULDER", "Bouldering"), ("top rope", "TopRope"), ("top-rope", "TopRope"), ("6B", "TopRope") })
        {
            var result = (await client.GetFromJsonAsync<ClimbHistoryResponse>(Path + "/history?search=" + Uri.EscapeDataString(search)))!;
            Assert.Equal(type, Assert.Single(result.Items).ClimbingType);
        }
        var filtered = (await client.GetFromJsonAsync<ClimbHistoryResponse>(Path + "/history?search=7a&climbingType=TopRope"))!;
        Assert.Empty(filtered.Items);
    }

    [Fact]
    public async Task History_sorts_by_difficulty_and_filters_before_pagination()
    {
        using var client = await Client();
        foreach (var (grade, date) in new[] { ("V2", 3), ("V10", 1), ("V3", 2) })
            Assert.Equal(
                HttpStatusCode.Created,
                (
                    await client.PostAsJsonAsync(
                        Path,
                        Input with
                        {
                            GradeSystem = "V",
                            Grade = grade,
                            Date = new DateOnly(2026, 10, date),
                            Outcome = grade == "V3" ? "Attempted" : "Redpoint",
                        }
                    )
                ).StatusCode
            );
        var hardest = (
            await client.GetFromJsonAsync<ClimbHistoryResponse>(
                Path + "/history?sort=grade-desc&pageSize=1"
            )
        )!;
        Assert.Equal("V10", Assert.Single(hardest.Items).Grade);
        Assert.Equal(3, hardest.TotalCount);
        var gradeOnly = (
            await client.GetFromJsonAsync<ClimbHistoryResponse>(
                Path + "/history?gradeSystem=V&grade=V2"
            )
        )!;
        Assert.Equal("V2", Assert.Single(gradeOnly.Items).Grade);
        Assert.Equal(3, gradeOnly.TotalCount);
        var multiple = (
            await client.GetFromJsonAsync<ClimbHistoryResponse>(
                Path
                    + "/history?gradeSystem=V&grade=V2&grade=V10&outcome=Attempted&outcome=Redpoint&style=Juggy&style=Slopy&sort=grade-asc"
            )
        )!;
        Assert.Equal(new[] { "V2", "V10" }, multiple.Items.Select(x => x.Grade));
        var combined = (
            await client.GetFromJsonAsync<ClimbHistoryResponse>(
                Path + "/history?gradeSystem=V&grade=V2&grade=V3&outcome=Attempted"
            )
        )!;
        Assert.Equal("V3", Assert.Single(combined.Items).Grade);
        Assert.Equal(
            HttpStatusCode.BadRequest,
            (await client.GetAsync(Path + "/history?style=Slopy&style=Unknown")).StatusCode
        );
        Assert.Equal(
            HttpStatusCode.BadRequest,
            (await client.GetAsync(Path + "/history?grade=V2")).StatusCode
        );
        Assert.Equal(
            HttpStatusCode.BadRequest,
            (await client.GetAsync(Path + "/history?gradeSystem=Font&grade=V2")).StatusCode
        );
        Assert.Equal(2, hardest.NextPage);
        var easiest = (
            await client.GetFromJsonAsync<ClimbHistoryResponse>(Path + "/history?sort=grade-asc")
        )!;
        Assert.Equal(new[] { "V2", "V3", "V10" }, easiest.Items.Select(x => x.Grade));
        var oldest = (
            await client.GetFromJsonAsync<ClimbHistoryResponse>(Path + "/history?sort=date-asc")
        )!;
        Assert.Equal(new[] { "V10", "V3", "V2" }, oldest.Items.Select(x => x.Grade));
        var filtered = (
            await client.GetFromJsonAsync<ClimbHistoryResponse>(
                Path
                    + "/history?climbingType=Bouldering&gradeSystem=V&environment=Board&outcome=Attempted&wallAngle=Overhang&style=Slopy&search=problem&from=2026-10-02&to=2026-10-02&pageSize=1"
            )
        )!;
        Assert.Equal("V3", Assert.Single(filtered.Items).Grade);
        Assert.Null(filtered.NextPage);
        Assert.Empty(
            (
                await client.GetFromJsonAsync<ClimbHistoryResponse>(
                    Path + "/history?environment=Outdoor"
                )
            )!.Items
        );
        foreach (
            var query in new[]
            {
                "sort=unknown",
                "style=unknown",
                "environment=unknown",
                "from=2026-10-03&to=2026-10-01",
            }
        )
            Assert.Equal(
                HttpStatusCode.BadRequest,
                (await client.GetAsync(Path + "/history?" + query)).StatusCode
            );
    }

    [Fact]
    public async Task Crud_persists_independent_routes_and_enforces_ownership()
    {
        using var owner = await Client();
        using var other = await Client();
        var response = await owner.PostAsJsonAsync(Path, Input);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var log = (await response.Content.ReadFromJsonAsync<ClimbLogResponse>())!;
        Assert.Equal("Problem", log.Name);
        Assert.Equal("Board", log.Location);
        Assert.Equal(new[] { "Crimpy", "Slopy" }, log.Styles);
        Assert.Equal(
            HttpStatusCode.Created,
            (await owner.PostAsJsonAsync(Path, Input with { Grade = "7B" })).StatusCode
        );
        var entries = (await owner.GetFromJsonAsync<ClimbLogResponse[]>(Path + Range))!;
        Assert.Equal(new[] { "7A", "7B" }, entries.Select(x => x.Grade));
        Assert.Empty((await other.GetFromJsonAsync<ClimbLogResponse[]>(Path + Range))!);
        Assert.Equal(
            HttpStatusCode.NotFound,
            (await other.PutAsJsonAsync($"{Path}/{log.Id}", Input)).StatusCode
        );
        Assert.Equal(
            HttpStatusCode.NotFound,
            (await other.DeleteAsync($"{Path}/{log.Id}")).StatusCode
        );
        var update = Input with
        {
            Grade = "7C",
            Attempts = 1,
            Outcome = "Flash",
            Styles = [],
            WallAngle = null,
            Name = null,
            Location = null,
        };
        Assert.Equal(
            HttpStatusCode.OK,
            (await owner.PutAsJsonAsync($"{Path}/{log.Id}", update)).StatusCode
        );
        var saved = (await owner.GetFromJsonAsync<ClimbLogResponse[]>(Path + Range))!.First();
        Assert.Equal("7C", saved.Grade);
        Assert.Equal("Flash", saved.Outcome);
        Assert.Empty(saved.Styles);
        Assert.Null(saved.Name);
        Assert.Equal(
            HttpStatusCode.NoContent,
            (await owner.DeleteAsync($"{Path}/{log.Id}")).StatusCode
        );
        Assert.Single((await owner.GetFromJsonAsync<ClimbLogResponse[]>(Path + Range))!);
        Assert.Equal(
            HttpStatusCode.NotFound,
            (await owner.DeleteAsync($"{Path}/{log.Id}")).StatusCode
        );
    }

    [Fact]
    public async Task Validation_returns_problem_details_and_failed_updates_preserve_original()
    {
        using var client = await Client();
        var created = await client.PostAsJsonAsync(Path, Input);
        var log = (await created.Content.ReadFromJsonAsync<ClimbLogResponse>())!;
        ClimbLogInput[] invalid =
        [
            Input with
            {
                Date = default,
            },
            Input with
            {
                GradeSystem = "French",
            },
            Input with
            {
                Grade = "7a",
            },
            Input with
            {
                Attempts = 0,
            },
            Input with
            {
                Outcome = "Flash",
            },
            Input with
            {
                WallAngle = "Unknown",
            },
            Input with
            {
                Styles = ["Crimpy", "Crimpy"],
            },
            Input with
            {
                Styles = ["Unknown"],
            },
            Input with
            {
                Name = new string('x', 101),
            },
            Input with
            {
                Location = new string('x', 201),
            },
            Input with
            {
                ClimbingType = "Sport",
                GradeSystem = "French",
                Grade = "7a",
            },
        ];
        foreach (var input in invalid)
        {
            var response = await client.PutAsJsonAsync($"{Path}/{log.Id}", input);
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Equal(
                "application/problem+json",
                response.Content.Headers.ContentType?.MediaType
            );
        }
        var saved = Assert.Single(
            (await client.GetFromJsonAsync<ClimbLogResponse[]>(Path + Range))!
        );
        Assert.Equal("7A", saved.Grade);
        Assert.Equal(3, saved.Attempts);
        foreach (
            var range in new[]
            {
                "?from=2026-10-31&to=2026-10-01",
                "?from=2026-01-01&to=2026-12-31",
            }
        )
            Assert.Equal(
                HttpStatusCode.BadRequest,
                (await client.GetAsync(Path + range)).StatusCode
            );
        using var anonymous = fixture.Client();
        Assert.Equal(
            HttpStatusCode.Unauthorized,
            (await anonymous.GetAsync(Path + Range)).StatusCode
        );
    }

    [Fact]
    public async Task Rest_days_conflict_with_climbs_in_both_directions_and_moving_is_atomic()
    {
        using var client = await Client();
        var date = Input.Date;
        await client.PostAsJsonAsync(Path, Input);
        var templateResponse = await client.PostAsJsonAsync(
            "/api/workout-templates",
            new WorkoutTemplateInput("Climbing and gym", [])
        );
        var template = (
            await templateResponse.Content.ReadFromJsonAsync<WorkoutTemplateResponse>(
                ExerciseApiTests.Json
            )
        )!;
        Assert.Equal(
            HttpStatusCode.Created,
            (
                await client.PostAsJsonAsync(
                    "/api/workout-schedule",
                    new ScheduleWorkoutInput(date, template.Id)
                )
            ).StatusCode
        );
        Assert.Equal(
            HttpStatusCode.Conflict,
            (
                await client.PostAsJsonAsync(
                    "/api/workout-schedule",
                    new ScheduleWorkoutInput(date, null)
                )
            ).StatusCode
        );
        Assert.Equal(
            HttpStatusCode.Created,
            (
                await client.PostAsJsonAsync(
                    "/api/workout-schedule",
                    new ScheduleWorkoutInput(date.AddDays(1), null)
                )
            ).StatusCode
        );
        Assert.Equal(
            HttpStatusCode.Conflict,
            (await client.PostAsJsonAsync(Path, Input with { Date = date.AddDays(1) })).StatusCode
        );
        var log = Assert.Single((await client.GetFromJsonAsync<ClimbLogResponse[]>(Path + Range))!);
        Assert.Equal(
            HttpStatusCode.Conflict,
            (
                await client.PutAsJsonAsync(
                    $"{Path}/{log.Id}",
                    Input with
                    {
                        Date = date.AddDays(1),
                    }
                )
            ).StatusCode
        );
        Assert.Equal(
            date,
            Assert.Single((await client.GetFromJsonAsync<ClimbLogResponse[]>(Path + Range))!).Date
        );
        await client.DeleteAsync($"{Path}/{log.Id}");
        var plans = (
            await client.GetFromJsonAsync<ScheduledWorkoutResponse[]>(
                "/api/workout-schedule" + Range
            )
        )!;
        await client.DeleteAsync($"/api/workout-schedule/{plans.Single(x => !x.IsRestDay).Id}");
        Assert.Equal(
            HttpStatusCode.Created,
            (
                await client.PostAsJsonAsync(
                    "/api/workout-schedule",
                    new ScheduleWorkoutInput(date, null)
                )
            ).StatusCode
        );
    }

    [Fact]
    public async Task Concurrent_rest_day_and_climb_creation_cannot_share_a_date()
    {
        using var client = await Client();
        for (var day = 10; day < 15; day++)
        {
            var date = new DateOnly(2026, 10, day);
            var results = await Task.WhenAll(
                client.PostAsJsonAsync(Path, Input with { Date = date }),
                client.PostAsJsonAsync(
                    "/api/workout-schedule",
                    new ScheduleWorkoutInput(date, null)
                )
            );
            Assert.Single(results, x => x.StatusCode == HttpStatusCode.Created);
            Assert.Single(results, x => x.StatusCode == HttpStatusCode.Conflict);
        }
    }

    [Fact]
    public async Task History_pages_all_dates_newest_first_and_single_logs_are_user_scoped()
    {
        using var owner = await Client();
        using var other = await Client();
        var ids = new List<int>();
        foreach (
            var date in new[]
            {
                Input.Date.AddYears(-1),
                Input.Date.AddMonths(-4),
                Input.Date,
                Input.Date,
            }
        )
        {
            var response = await owner.PostAsJsonAsync(Path, Input with { Date = date });
            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            ids.Add((await response.Content.ReadFromJsonAsync<ClimbLogResponse>())!.Id);
        }
        var first = (
            await owner.GetFromJsonAsync<ClimbHistoryResponse>(Path + "/history?page=1&pageSize=2")
        )!;
        Assert.Equal(new[] { ids[3], ids[2] }, first.Items.Select(x => x.Id));
        Assert.Equal(2, first.NextPage);
        var second = (
            await owner.GetFromJsonAsync<ClimbHistoryResponse>(Path + "/history?page=2&pageSize=2")
        )!;
        Assert.Equal(new[] { ids[1], ids[0] }, second.Items.Select(x => x.Id));
        Assert.Null(second.NextPage);
        Assert.Empty(
            (await other.GetFromJsonAsync<ClimbHistoryResponse>(Path + "/history"))!.Items
        );
        Assert.Equal(
            ids[0],
            (await owner.GetFromJsonAsync<ClimbLogResponse>($"{Path}/{ids[0]}"))!.Id
        );
        Assert.Equal(
            HttpStatusCode.NotFound,
            (await other.GetAsync($"{Path}/{ids[0]}")).StatusCode
        );
        foreach (var query in new[] { "page=0", "pageSize=0", "pageSize=101", "page=100001" })
            Assert.Equal(
                HttpStatusCode.BadRequest,
                (await owner.GetAsync(Path + "/history?" + query)).StatusCode
            );
        await owner.DeleteAsync($"{Path}/{ids[0]}");
        Assert.Equal(
            HttpStatusCode.NotFound,
            (await owner.GetAsync($"{Path}/{ids[0]}")).StatusCode
        );
    }
}
