namespace Topout.Application.Abstractions;

public interface ILogLocationRepository
{
    Task<IReadOnlyList<string>> SuggestionsAsync(int userId, string activity, string search, CancellationToken ct);
}
