using Topout.Application.Common;

namespace Topout.Application.WorkoutLogging;

public static class WorkoutMutation
{
    public static void Apply(Action mutation)
    {
        try
        {
            mutation();
        }
        catch (InvalidOperationException e)
        {
            throw new RequestException(ErrorKind.Conflict, e.Message);
        }
        catch (ArgumentException e)
        {
            throw new RequestException(ErrorKind.Validation, e.Message);
        }
    }
}
