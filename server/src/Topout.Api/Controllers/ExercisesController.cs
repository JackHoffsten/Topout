using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Topout.Api.Contracts;
using Topout.Application.Exercises;

namespace Topout.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/exercises")]
public sealed class ExercisesController : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ExerciseResponse>>> List(
        [FromServices] ListExercisesHandler handler,
        CancellationToken ct
    ) => Ok(await handler.HandleAsync(ct));

    [HttpPost]
    public async Task<ActionResult<ExerciseResponse>> Create(
        ExerciseRequest request,
        [FromServices] CreateExerciseHandler handler,
        CancellationToken ct
    )
    {
        var exercise = await handler.HandleAsync(request.Name, request.MuscleGroups, ct);
        return Created($"/api/exercises/{exercise.Id}", exercise);
    }

    [HttpPut("{id:int:min(1)}")]
    public async Task<ActionResult<ExerciseResponse>> Update(
        int id,
        ExerciseRequest request,
        [FromServices] UpdateExerciseHandler handler,
        CancellationToken ct
    ) => Ok(await handler.HandleAsync(id, request.Name, request.MuscleGroups, ct));

    [HttpDelete("{id:int:min(1)}")]
    public async Task<IActionResult> Delete(
        int id,
        [FromServices] DeleteExerciseHandler handler,
        CancellationToken ct
    )
    {
        await handler.HandleAsync(id, ct);
        return NoContent();
    }
}
