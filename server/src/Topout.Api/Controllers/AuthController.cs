using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Topout.Api.Contracts;
using Topout.Application.Authentication;

namespace Topout.Api.Controllers;

[ApiController]
[AllowAnonymous]
[EnableRateLimiting("auth")]
[Route("api/auth")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class AuthController : ControllerBase
{
    [HttpPost("register")]
    public async Task<ActionResult<TokenResponse>> Register(
        RegisterRequest request,
        [FromServices] RegisterHandler handler,
        CancellationToken ct
    ) =>
        StatusCode(
            StatusCodes.Status201Created,
            await handler.HandleAsync(request.Email, request.Password, request.DisplayName, ct)
        );

    [HttpPost("login")]
    public async Task<ActionResult<TokenResponse>> Login(
        LoginRequest request,
        [FromServices] LoginHandler handler,
        CancellationToken ct
    ) => Ok(await handler.HandleAsync(request.Email, request.Password, ct));

    [HttpPost("refresh")]
    public async Task<ActionResult<TokenResponse>> Refresh(
        RefreshTokenRequest request,
        [FromServices] RefreshHandler handler,
        CancellationToken ct
    ) => Ok(await handler.HandleAsync(request.RefreshToken, ct));

    [HttpPost("revoke")]
    public async Task<IActionResult> Revoke(
        RefreshTokenRequest request,
        [FromServices] RevokeHandler handler,
        CancellationToken ct
    )
    {
        await handler.HandleAsync(request.RefreshToken, ct);
        return NoContent();
    }
}
