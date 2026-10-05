using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Topout.Application.Abstractions;

namespace Topout.Api.Controllers;

[ApiController, Authorize]
[Route("api/climb-logs/{id:int:min(1)}/photo")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class ClimbPhotosController(IClimbPhotoService photos, ICurrentUser user)
    : ControllerBase
{
    public sealed record PhotoInput(string Base64);

    [HttpGet]
    public async Task<IActionResult> Get(int id, CancellationToken ct) =>
        new JsonResult(await photos.GetAsync(user.UserId, id, ct));

    [HttpPut, RequestSizeLimit(3 * 1024 * 1024)]
    public async Task<IActionResult> Save(int id, PhotoInput input, CancellationToken ct) =>
        Ok(await photos.SaveAsync(user.UserId, id, input.Base64, ct));

    [HttpDelete]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        await photos.DeleteAsync(user.UserId, id, ct);
        return NoContent();
    }
}
