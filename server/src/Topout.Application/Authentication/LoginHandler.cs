namespace Topout.Application.Authentication;

public sealed class LoginHandler(IAuthenticationService authentication)
{
    public Task<TokenResponse> HandleAsync(string email, string password, CancellationToken ct) =>
        authentication.LoginAsync(email, password, ct);
}
