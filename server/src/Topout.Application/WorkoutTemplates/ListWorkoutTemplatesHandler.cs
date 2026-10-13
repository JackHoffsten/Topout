using Topout.Application.Abstractions;
using Topout.Application.Common;
using Topout.Domain.Entities;
using Topout.Domain.ValueObjects;

namespace Topout.Application.WorkoutTemplates;

public sealed class ListWorkoutTemplatesHandler(
    IWorkoutTemplateRepository templates,
    ICurrentUser user
)
{
    public async Task<IReadOnlyList<WorkoutTemplateResponse>> HandleAsync(CancellationToken ct) =>
        (await templates.ListAsync(user.UserId, ct)).Select(WorkoutTemplateResponse.From).ToArray();
}
