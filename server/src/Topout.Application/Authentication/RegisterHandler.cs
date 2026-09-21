namespace Topout.Application.Authentication;

public sealed class RegisterHandler(IAuthenticationService authentication)
{
    public Task<TokenResponse> HandleAsync(
        string email,
        string password,
        string displayName,
        CancellationToken ct
    ) => authentication.RegisterAsync(email, password, displayName, ct);
}
