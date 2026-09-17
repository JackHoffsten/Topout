using Microsoft.AspNetCore.Identity;
using Topout.Domain.Enums;

namespace Topout.Infrastructure.Identity;

public class ApplicationUser : IdentityUser<int>
{
    public string DisplayName { get; set; } = string.Empty;
    public UnitSystem PreferredUnits { get; set; } = UnitSystem.Metric;
    public DateTime? LastLoginAt { get; set; }
}