using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Topout.Api.Contracts;
using Topout.Application.Authentication;
using Topout.Application.Common;

namespace Topout.Api.Controllers;

[ApiController]
[AllowAnonymous]
[EnableRateLimiting("auth")]
[Route("api/auth/web")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class WebAuthController(
    IAntiforgery antiforgery,
    IConfiguration configuration,
    IWebHostEnvironment environment
)
    : ControllerBase
{
    public const string RefreshCookie = "__Secure-topout-refresh";
    public const string CsrfCookie = "__Host-topout-csrf";

    [HttpGet("csrf")]
    public IActionResult Csrf()
    {
        if (!TrustedOrigin())
            return StatusCode(403);
        var token = antiforgery.GetAndStoreTokens(HttpContext).RequestToken!;
        Response.Cookies.Append(CsrfCookieName, token, CookieOptions(false, "/"));
        return Ok(new { csrfToken = token });
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register(
        RegisterRequest request,
        [FromServices] RegisterHandler handler,
        CancellationToken ct
    )
    {
        if (!await ValidRequest())
            return StatusCode(403);
        var tokens = await handler.HandleAsync(
            request.Email,
            request.Password,
            request.DisplayName,
            ct
        );
        return StatusCode(201, Store(tokens));
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login(
        LoginRequest request,
        [FromServices] LoginHandler handler,
        CancellationToken ct
    )
    {
        if (!await ValidRequest())
            return StatusCode(403);
        return Ok(Store(await handler.HandleAsync(request.Email, request.Password, ct)));
    }

    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh(
        [FromServices] RefreshHandler handler,
        CancellationToken ct
    )
    {
        if (!await ValidRequest())
            return StatusCode(403);
        if (!Request.Cookies.TryGetValue(RefreshCookieName, out var refreshToken))
            return Unauthorized();
        try
        {
            return Ok(Store(await handler.HandleAsync(refreshToken, ct)));
        }
        catch (RequestException error) when (error.Kind == ErrorKind.Unauthorized)
        {
            ClearCookies();
            throw;
        }
    }

    [HttpPost("revoke")]
    public async Task<IActionResult> Revoke(
        [FromServices] RevokeHandler handler,
        CancellationToken ct
    )
    {
        if (!await ValidRequest())
            return StatusCode(403);
        if (Request.Cookies.TryGetValue(RefreshCookieName, out var refreshToken))
            await handler.HandleAsync(refreshToken, ct);
        ClearCookies();
        return NoContent();
    }

    private object Store(TokenResponse tokens)
    {
        var cookie = CookieOptions(true, "/api/auth/web");
        cookie.Expires = new DateTimeOffset(tokens.RefreshTokenExpiresAt);
        Response.Cookies.Append(RefreshCookieName, tokens.RefreshToken, cookie);
        return new { tokens.AccessToken, tokens.AccessTokenExpiresAt };
    }

    private void ClearCookies()
    {
        Response.Cookies.Delete(RefreshCookieName, CookieOptions(true, "/api/auth/web"));
        Response.Cookies.Delete(CsrfCookieName, CookieOptions(false, "/"));
    }

    private string RefreshCookieName =>
        environment.IsDevelopment() ? "topout-dev-refresh" : RefreshCookie;

    private string CsrfCookieName => environment.IsDevelopment() ? "topout-dev-csrf" : CsrfCookie;

    private CookieOptions CookieOptions(bool httpOnly, string path) =>
        new()
        {
            HttpOnly = httpOnly,
            Secure = !environment.IsDevelopment(),
            SameSite = SameSiteMode.Lax,
            Path = path,
            IsEssential = true,
        };

    private bool TrustedOrigin()
    {
        var origin = Request.Headers.Origin.ToString();
        // Same-origin GETs may omit Origin; writes below always require an origin.
        if (string.IsNullOrEmpty(origin))
            return HttpMethods.IsGet(Request.Method);
        return origin == $"{Request.Scheme}://{Request.Host}"
            || (configuration.GetSection("Web:AllowedOrigins").Get<string[]>() ?? []).Contains(
                origin,
                StringComparer.Ordinal
            );
    }

    private async Task<bool> ValidRequest()
    {
        if (!TrustedOrigin())
            return false;
        if (
            !Request.Cookies.TryGetValue(CsrfCookieName, out var csrf)
            || !string.Equals(
                csrf,
                Request.Headers["X-CSRF-Token"].ToString(),
                StringComparison.Ordinal
            )
        )
            return false;
        try
        {
            await antiforgery.ValidateRequestAsync(HttpContext);
            return true;
        }
        catch (AntiforgeryValidationException)
        {
            return false;
        }
    }
}
