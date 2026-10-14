using Topout.Domain.Enums;

namespace Topout.Domain.ValueObjects;

public sealed record WorkoutReplacementSet(int Order, SetSide Side, bool IsWarmup);
