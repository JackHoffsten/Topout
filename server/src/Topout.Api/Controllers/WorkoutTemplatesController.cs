using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Topout.Application.WorkoutTemplates;

namespace Topout.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/workout-templates")]
public sealed class WorkoutTemplatesController : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(
        [FromServices] ListWorkoutTemplatesHandler handler,
        CancellationToken ct
    ) => Ok(await handler.HandleAsync(ct));

    [HttpGet("{id:int:min(1)}")]
    public async Task<IActionResult> Get(
        int id,
        [FromServices] GetWorkoutTemplateHandler handler,
        CancellationToken ct
    ) => Ok(await handler.HandleAsync(id, ct));

    [HttpPost]
    public async Task<IActionResult> Create(
        WorkoutTemplateInput input,
        [FromServices] SaveWorkoutTemplateHandler handler,
        CancellationToken ct
    )
    {
        var template = await handler.HandleAsync(null, input, ct);
        return Created($"/api/workout-templates/{template.Id}", template);
    }

    [HttpPut("{id:int:min(1)}")]
    public async Task<IActionResult> Update(
        int id,
        WorkoutTemplateInput input,
        [FromServices] SaveWorkoutTemplateHandler handler,
        CancellationToken ct
    ) => Ok(await handler.HandleAsync(id, input, ct));

    [HttpDelete("{id:int:min(1)}")]
    public async Task<IActionResult> Delete(
        int id,
        [FromServices] DeleteWorkoutTemplateHandler handler,
        CancellationToken ct
    )
    {
        await handler.HandleAsync(id, ct);
        return NoContent();
    }
}
