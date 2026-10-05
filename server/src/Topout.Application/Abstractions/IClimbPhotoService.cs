namespace Topout.Application.Abstractions;

public sealed record ClimbPhotoResponse(string Base64, int Width, int Height);

public interface IClimbPhotoService
{
    Task<ClimbPhotoResponse?> GetAsync(int userId, int climbId, CancellationToken ct);
    Task<ClimbPhotoResponse> SaveAsync(
        int userId,
        int climbId,
        string base64,
        CancellationToken ct
    );
    Task DeleteAsync(int userId, int climbId, CancellationToken ct);
}
