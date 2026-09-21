using Microsoft.AspNetCore.Diagnostics;
using Topout.Application.Common;

namespace Topout.Api.Errors;

internal sealed class ApiExceptionHandler(
    IProblemDetailsService problems,
    ILogger<ApiExceptionHandler> logger
) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext context,
        Exception exception,
        CancellationToken ct
    )
    {
        var status = exception switch
        {
            RequestException request => request.Kind switch
            {
                ErrorKind.Validation => 400,
                ErrorKind.Unauthorized => 401,
                ErrorKind.NotFound => 404,
                ErrorKind.Conflict => 409,
                _ => 500,
            },
            ArgumentException => 400,
            _ => 500,
        };
        context.Response.StatusCode = status;
        if (status == 500)
            logger.LogError(exception, "Unhandled API failure for {Path}", context.Request.Path);
        return await problems.TryWriteAsync(
            new ProblemDetailsContext
            {
                HttpContext = context,
                ProblemDetails = new()
                {
                    Status = status,
                    Title = status == 500 ? "An unexpected error occurred." : exception.Message,
                },
            }
        );
    }
}
