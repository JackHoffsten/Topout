using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Topout.Application.Progress;

namespace Topout.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/progress")]
public sealed class ProgressController : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(
        DateOnly? from,
        DateOnly? to,
        [FromServices] ProgressHandler handler,
        CancellationToken ct
    ) => Ok(await handler.GetAsync(from, to, ct));
}
