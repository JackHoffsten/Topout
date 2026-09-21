namespace Topout.Application.Authentication;

public sealed class RefreshHandler(IAuthenticationService authentication)
{
    public Task<TokenResponse> HandleAsync(string refreshToken, CancellationToken ct) =>
        authentication.RefreshAsync(refreshToken, ct);
}
