using System.Globalization;
using Topout.Application.Abstractions;
using Topout.Application.Common;

namespace Topout.Api.Authentication;

internal sealed class HttpCurrentUser(IHttpContextAccessor accessor) : ICurrentUser
{
    public int UserId
    {
        get
        {
            var principal = accessor.HttpContext?.User;
            if (
                principal?.Identity?.IsAuthenticated == true
                && int.TryParse(
                    principal.FindFirst("sub")?.Value,
                    NumberStyles.None,
                    CultureInfo.InvariantCulture,
                    out var id
                )
                && id > 0
            )
                return id;
            throw new RequestException(ErrorKind.Unauthorized, "Authentication is required.");
        }
    }
}
