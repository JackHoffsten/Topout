using Topout.Application.Abstractions;
using Topout.Application.Common;
using Topout.Domain.Entities;

namespace Topout.Application.WorkoutSchedule;

public sealed record ScheduleWorkoutInput(DateOnly Date, int? TemplateId);
