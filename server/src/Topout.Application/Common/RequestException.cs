namespace Topout.Application.Common;

public enum ErrorKind
{
    Validation,
    Unauthorized,
    NotFound,
    Conflict,
}

public sealed class RequestException(ErrorKind kind, string message) : Exception(message)
{
    public ErrorKind Kind { get; } = kind;
}
