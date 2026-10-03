using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Topout.Application.WorkoutLogging;
using Topout.Domain.Enums;

namespace Topout.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/workout-schedule/{scheduleId:int:min(1)}/log")]
public sealed class WorkoutLoggingController : ControllerBase
{
    [HttpDelete]
    public async Task<IActionResult> Delete(
        int scheduleId,
        [FromServices] WorkoutLoggingHandler handler,
        CancellationToken ct
    )
    {
        await handler.DeleteAsync(scheduleId, ct);
        return NoContent();
    }

    [HttpGet]
    public async Task<IActionResult> Get(
        int scheduleId,
        [FromServices] WorkoutLoggingHandler handler,
        CancellationToken ct
    ) => Ok(await handler.GetAsync(scheduleId, ct));

    [HttpPost]
    public async Task<IActionResult> Complete(
        int scheduleId,
        CompleteWorkoutInput input,
        [FromServices] WorkoutLoggingHandler handler,
        CancellationToken ct
    ) => Ok(await handler.CompleteAsync(scheduleId, input, ct));

    [HttpPut]
    public async Task<IActionResult> Edit(
        int scheduleId,
        CompleteWorkoutInput input,
        [FromServices] WorkoutLoggingHandler handler,
        CancellationToken ct
    ) => Ok(await handler.CompleteAsync(scheduleId, input, ct, editing: true));

    [HttpPut("sets")]
    public async Task<IActionResult> RecordSet(
        int scheduleId,
        RecordSetInput input,
        [FromServices] WorkoutLoggingHandler handler,
        CancellationToken ct
    ) => Ok(await handler.RecordSetAsync(scheduleId, input, ct));

    [HttpDelete("sets/{exerciseId:int:min(1)}/{order:int:min(1)}")]
    public async Task<IActionResult> RemoveSet(
        int scheduleId,
        int exerciseId,
        int order,
        [FromServices] WorkoutLoggingHandler handler,
        CancellationToken ct,
        [FromQuery] SetSide side = SetSide.Both
    ) => Ok(await handler.RemoveSetAsync(scheduleId, exerciseId, order, ct, side));
}
