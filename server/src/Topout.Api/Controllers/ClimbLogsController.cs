using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Topout.Application.Climbing;

namespace Topout.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/climb-logs")]
public sealed class ClimbLogsController : ControllerBase
{
    [HttpGet("history")]
    public async Task<IActionResult> History(
        [FromServices] ClimbLogHandler handler,
        CancellationToken ct,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] ClimbHistoryQuery? query = null
    ) => Ok(await handler.HistoryAsync(page, pageSize, ct, query));

    [HttpGet("{id:int:min(1)}")]
    public async Task<IActionResult> Get(
        int id,
        [FromServices] ClimbLogHandler handler,
        CancellationToken ct
    ) => Ok(await handler.GetAsync(id, ct));

    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] DateOnly from,
        [FromQuery] DateOnly to,
        [FromServices] ClimbLogHandler handler,
        CancellationToken ct
    ) => Ok(await handler.ListAsync(from, to, ct));

    [HttpPost]
    public async Task<IActionResult> Create(
        ClimbLogInput input,
        [FromServices] ClimbLogHandler handler,
        CancellationToken ct
    )
    {
        var log = await handler.SaveAsync(null, input, ct);
        return Created($"/api/climb-logs/{log.Id}", log);
    }

    [HttpPut("{id:int:min(1)}")]
    public async Task<IActionResult> Update(
        int id,
        ClimbLogInput input,
        [FromServices] ClimbLogHandler handler,
        CancellationToken ct
    ) => Ok(await handler.SaveAsync(id, input, ct));

    [HttpDelete("{id:int:min(1)}")]
    public async Task<IActionResult> Delete(
        int id,
        [FromServices] ClimbLogHandler handler,
        CancellationToken ct
    )
    {
        await handler.DeleteAsync(id, ct);
        return NoContent();
    }
}
