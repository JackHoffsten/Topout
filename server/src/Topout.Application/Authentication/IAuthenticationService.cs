namespace Topout.Application.Authentication;

public interface IAuthenticationService
{
    Task<TokenResponse> RegisterAsync(
        string email,
        string password,
        string displayName,
        CancellationToken ct
    );
    Task<TokenResponse> LoginAsync(string email, string password, CancellationToken ct);
    Task<TokenResponse> RefreshAsync(string refreshToken, CancellationToken ct);
    Task RevokeAsync(string refreshToken, CancellationToken ct);
}
