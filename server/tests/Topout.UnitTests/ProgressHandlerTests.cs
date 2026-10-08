using Topout.Application.Abstractions;
using Topout.Application.Common;
using Topout.Application.Progress;

namespace Topout.UnitTests;

public class ProgressHandlerTests
{
    [Fact]
    public async Task Reads_are_scoped_and_optional_date_bounds_are_preserved()
    {
        var repository = new Repository();
        var handler = new ProgressHandler(repository, new CurrentUser());
        var result = await handler.GetAsync(null, new DateOnly(2026, 10, 3), default);
        Assert.Empty(result.Exercises);
        Assert.Equal(7, repository.UserId);
        Assert.Null(repository.From);
        Assert.Equal(new DateOnly(2026, 10, 3), repository.To);
    }

    [Fact]
    public async Task Invalid_ranges_are_rejected_before_querying()
    {
        var repository = new Repository();
        var handler = new ProgressHandler(repository, new CurrentUser());
        var error = await Assert.ThrowsAsync<RequestException>(() =>
            handler.GetAsync(new DateOnly(2026, 10, 3), new DateOnly(2026, 10, 1), default)
        );
        Assert.Equal(ErrorKind.Validation, error.Kind);
        Assert.Equal(0, repository.UserId);
    }

    private sealed class CurrentUser : ICurrentUser
    {
        public int UserId => 7;
    }

    private sealed class Repository : IProgressRepository
    {
        public int UserId { get; private set; }
        public DateOnly? From { get; private set; }
        public DateOnly? To { get; private set; }

        public Task<ProgressResponse> ReadAsync(
            int userId,
            DateOnly? from,
            DateOnly? to,
            CancellationToken ct,
            string[]? locations = null
        )
        {
            UserId = userId;
            From = from;
            To = to;
            return Task.FromResult(new ProgressResponse([], []));
        }
    }
}
