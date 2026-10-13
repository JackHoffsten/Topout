using Topout.Application.Abstractions;
using Topout.Application.Common;

namespace Topout.Application.Progress;

public sealed class ProgressHandler(IProgressRepository repository, ICurrentUser user)
{
    public Task<ProgressResponse> GetAsync(
        DateOnly? from,
        DateOnly? to,
        CancellationToken ct,
        string[]? locations = null
    )
    {
        if (from == default(DateOnly) || to == default(DateOnly) || from > to)
            throw new RequestException(ErrorKind.Validation, "Choose a valid date range.");
        if (
            locations is { Length: > 50 }
            || locations?.Any(x => string.IsNullOrWhiteSpace(x) || x.Trim().Length > 200) == true
        )
            throw new RequestException(
                ErrorKind.Validation,
                "Choose up to 50 locations with names of at most 200 characters."
            );
        return repository.ReadAsync(
            user.UserId,
            from,
            to,
            ct,
            locations?.Select(x => x.Trim().ToLowerInvariant()).Distinct().ToArray()
        );
    }
}
