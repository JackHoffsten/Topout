using System.ComponentModel.DataAnnotations;

namespace Topout.Api.Contracts;

public sealed record RegisterRequest(
    [Required, EmailAddress, StringLength(256)] string Email,
    [Required, StringLength(128, MinimumLength = 8)] string Password,
    [Required, StringLength(100)] string DisplayName
);
