using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Topout.Application.WorkoutSchedule;

namespace Topout.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/workout-schedule")]
public sealed class WorkoutScheduleController : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] DateOnly from,
        [FromQuery] DateOnly to,
        [FromServices] WorkoutScheduleHandler handler,
        CancellationToken ct
    ) => Ok(await handler.ListAsync(from, to, ct));

    [HttpPost]
    public async Task<IActionResult> Create(
        ScheduleWorkoutInput input,
        [FromServices] WorkoutScheduleHandler handler,
        CancellationToken ct
    )
    {
        var workout = await handler.CreateAsync(input, ct);
        return Created($"/api/workout-schedule/{workout.Id}", workout);
    }

    [HttpDelete("{id:int:min(1)}")]
    public async Task<IActionResult> Delete(
        int id,
        [FromServices] WorkoutScheduleHandler handler,
        CancellationToken ct
    )
    {
        await handler.DeleteAsync(id, ct);
        return NoContent();
    }
}
