using Topout.Application.Abstractions;
using Topout.Application.Common;
using Topout.Domain.Entities;

namespace Topout.Application.Climbing;

public sealed record ClimbProjectResponse(int Id, ClimbLogResponse Climb);

public sealed record ProjectAttempt(int Id, DateOnly Date);
