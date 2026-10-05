using Microsoft.EntityFrameworkCore;
using Topout.Application.Abstractions;

namespace Topout.Infrastructure.Persistence.Repositories;

internal sealed class LogLocationRepository(AppDbContext db) : ILogLocationRepository
{
    public async Task<IReadOnlyList<string>> SuggestionsAsync(int userId, string activity, string search, CancellationToken ct)
    {
        var locations = activity == "workout"
            ? db.WorkoutLogs.Where(x => x.UserId == userId && x.Location != null).Select(x => x.Location!)
            : db.ClimbLogs.Where(x => x.UserId == userId && x.Location != null).Select(x => x.Location!);
        var term = search.Trim().ToLowerInvariant();
        return await locations.Where(x => x.ToLower().Contains(term))
            .GroupBy(x => x.ToLower()).Select(g => g.Min()!)
            .OrderBy(x => x).Take(8).ToArrayAsync(ct);
    }
}
