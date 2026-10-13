using Topout.Application.Abstractions;
using Topout.Application.Common;
using Topout.Domain.Entities;
using Topout.Domain.ValueObjects;

namespace Topout.Application.WorkoutTemplates;

public sealed class DeleteWorkoutTemplateHandler(
    IWorkoutTemplateRepository templates,
    ICurrentUser user
)
{
    public Task HandleAsync(int id, CancellationToken ct) =>
        templates.DeleteAsync(user.UserId, id, ct);
}
