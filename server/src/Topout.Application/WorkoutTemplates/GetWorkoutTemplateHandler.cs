using Topout.Application.Abstractions;
using Topout.Application.Common;
using Topout.Domain.Entities;
using Topout.Domain.ValueObjects;

namespace Topout.Application.WorkoutTemplates;

public sealed class GetWorkoutTemplateHandler(
    IWorkoutTemplateRepository templates,
    ICurrentUser user
)
{
    public async Task<WorkoutTemplateResponse> HandleAsync(int id, CancellationToken ct) =>
        WorkoutTemplateResponse.From(
            await templates.FindAsync(user.UserId, id, ct)
                ?? throw new RequestException(ErrorKind.NotFound, "Workout template not found.")
        );
}
