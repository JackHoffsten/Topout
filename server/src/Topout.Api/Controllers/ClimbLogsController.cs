using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Topout.Application.Climbing;

namespace Topout.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/climb-logs")]
public sealed class ClimbLogsController : ControllerBase
{
    [HttpGet("days")]
    public async Task<IActionResult> Days(
        [FromQuery] DateOnly from,
        [FromQuery] DateOnly to,
        [FromServices] ClimbLogHandler handler,
        CancellationToken ct
    ) => Ok(await handler.DaysAsync(from, to, ct));

    [HttpPut("days/{date}")]
    public async Task<IActionResult> MarkDay(
        DateOnly date,
        [FromServices] ClimbLogHandler handler,
        CancellationToken ct
    )
    {
        await handler.SetDayAsync(date, true, ct);
        return NoContent();
    }

    [HttpDelete("days/{date}")]
    public async Task<IActionResult> RemoveDay(
        DateOnly date,
        [FromServices] ClimbLogHandler handler,
        CancellationToken ct
    )
    {
        await handler.SetDayAsync(date, false, ct);
        return NoContent();
    }

    [HttpGet("projects/{id:int:min(1)}/attempts")]
    public async Task<IActionResult> ProjectAttempts(
        int id,
        [FromServices] ClimbLogHandler handler,
        CancellationToken ct
    ) => Ok(await handler.ProjectAttemptsAsync(id, ct));

    [HttpGet("projects")]
    public async Task<IActionResult> Projects(
        [FromServices] ClimbLogHandler handler,
        CancellationToken ct
    ) => Ok(await handler.ProjectsAsync(ct));

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
