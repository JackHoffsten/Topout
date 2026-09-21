using System.ComponentModel.DataAnnotations;

namespace Topout.Api.Contracts;

public sealed record RefreshTokenRequest(
    [Required, StringLength(128, MinimumLength = 64)] string RefreshToken
);
