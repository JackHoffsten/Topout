using Topout.Application.Progress;

namespace Topout.Application.Abstractions;

public interface IProgressRepository
{
    Task<ProgressResponse> ReadAsync(
        int userId,
        DateOnly? from,
        DateOnly? to,
        CancellationToken ct
    );
}
