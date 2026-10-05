using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Topout.Application.Abstractions;

namespace Topout.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/log-locations")]
public sealed class LogLocationsController : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] string activity, [FromQuery] string? search, [FromServices] ILogLocationRepository repository, [FromServices] ICurrentUser user, CancellationToken ct)
    {
        if (activity is not ("workout" or "climb") || search?.Length > 200)
            return BadRequest(new ProblemDetails { Status = 400, Title = "Invalid location query." });
        return Ok(await repository.SuggestionsAsync(user.UserId, activity, search ?? "", ct));
    }
}
