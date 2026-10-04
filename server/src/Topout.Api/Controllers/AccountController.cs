using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Topout.Application.Abstractions;
using Topout.Application.Accounts;

namespace Topout.Api.Controllers;

[ApiController]
[Authorize]
[EnableRateLimiting("auth")]
[Route("api/account")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class AccountController : ControllerBase
{
    public sealed record DeleteAccountRequest([Required, StringLength(256)] string Password);

    [HttpDelete]
    public async Task<IActionResult> Delete(
        DeleteAccountRequest request,
        [FromServices] ICurrentUser currentUser,
        [FromServices] IAccountService accounts,
        [FromServices] IWebHostEnvironment environment,
        CancellationToken ct
    )
    {
        await accounts.DeleteAsync(currentUser.UserId, request.Password, ct);
        var development = environment.IsDevelopment();
        Response.Cookies.Delete(
            development ? "topout-dev-refresh" : WebAuthController.RefreshCookie,
            new CookieOptions
            {
                Path = "/api/auth/web",
                HttpOnly = true,
                Secure = !development,
                SameSite = SameSiteMode.Lax,
            }
        );
        Response.Cookies.Delete(
            development ? "topout-dev-csrf" : WebAuthController.CsrfCookie,
            new CookieOptions
            {
                Path = "/",
                Secure = !development,
                SameSite = SameSiteMode.Lax,
            }
        );
        return NoContent();
    }
}
