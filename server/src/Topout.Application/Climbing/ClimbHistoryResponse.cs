using Topout.Application.Abstractions;
using Topout.Application.Common;
using Topout.Domain.Entities;

namespace Topout.Application.Climbing;

public sealed record ClimbHistoryResponse(
    IReadOnlyList<ClimbLogResponse> Items,
    int? NextPage,
    int TotalCount
);
