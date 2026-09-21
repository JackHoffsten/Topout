namespace Topout.Application.Authentication;

public sealed class RevokeHandler(IAuthenticationService authentication)
{
    public Task HandleAsync(string refreshToken, CancellationToken ct) =>
        authentication.RevokeAsync(refreshToken, ct);
}
