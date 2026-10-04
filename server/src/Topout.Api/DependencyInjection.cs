using System.Text;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Topout.Api.Authentication;
using Topout.Api.Errors;
using Topout.Application.Abstractions;
using Topout.Infrastructure.Identity;
using Topout.Infrastructure.Persistence;

namespace Topout.Api;

public static class DependencyInjection
{
    public static IServiceCollection AddApi(
        this IServiceCollection services,
        IConfiguration configuration,
        IWebHostEnvironment environment
    )
    {
        services
            .AddControllers()
            .AddJsonOptions(options =>
                options.JsonSerializerOptions.Converters.Add(
                    new JsonStringEnumConverter(allowIntegerValues: false)
                )
            );
        services.AddHttpContextAccessor();
        services.AddAntiforgery(options =>
        {
            var development = environment.IsDevelopment();
            options.HeaderName = "X-CSRF-Token";
            options.Cookie.Name = development
                ? "topout-dev-antiforgery"
                : "__Host-topout-antiforgery";
            options.Cookie.Path = "/";
            options.Cookie.HttpOnly = true;
            options.Cookie.SecurePolicy = development
                ? CookieSecurePolicy.None
                : CookieSecurePolicy.Always;
            options.Cookie.SameSite = SameSiteMode.Lax;
        });
        services.AddCors(options =>
            options.AddPolicy(
                "web",
                policy =>
                    policy
                        .WithOrigins(
                            configuration.GetSection("Web:AllowedOrigins").Get<string[]>() ?? []
                        )
                        .WithMethods("GET", "POST", "PUT", "DELETE")
                        .WithHeaders("Content-Type", "Authorization", "X-CSRF-Token")
                        .AllowCredentials()
            )
        );
        services.AddScoped<ICurrentUser, HttpCurrentUser>();
        services.AddProblemDetails();
        services.AddExceptionHandler<ApiExceptionHandler>();
        services
            .AddOptions<JwtOptions>()
            .Bind(configuration.GetSection("Jwt"))
            .Validate(o => !string.IsNullOrWhiteSpace(o.Issuer), "Jwt:Issuer is required.")
            .Validate(o => !string.IsNullOrWhiteSpace(o.Audience), "Jwt:Audience is required.")
            .Validate(
                o => Encoding.UTF8.GetByteCount(o.SigningKey) >= 32,
                "Jwt:SigningKey must contain at least 32 bytes."
            )
            .Validate(
                o => o.AccessTokenMinutes is >= 1 and <= 60 && o.RefreshTokenDays is >= 1 and <= 90,
                "JWT lifetimes must be within the supported bounds."
            )
            .ValidateOnStart();
        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer();
        services
            .AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme)
            .Configure<IOptions<JwtOptions>>(
                (bearer, configured) =>
                {
                    var jwt = configured.Value;
                    bearer.MapInboundClaims = false;
                    bearer.Events = new JwtBearerEvents
                    {
                        OnTokenValidated = async context =>
                        {
                            var db =
                                context.HttpContext.RequestServices.GetRequiredService<AppDbContext>();
                            if (
                                !int.TryParse(
                                    context.Principal?.FindFirst("sub")?.Value,
                                    out var userId
                                )
                                || !await db.Users.AnyAsync(
                                    x => x.Id == userId,
                                    context.HttpContext.RequestAborted
                                )
                            )
                                context.Fail("This account is no longer available.");
                        },
                    };
                    bearer.TokenValidationParameters = new TokenValidationParameters
                    {
                        ValidateIssuer = true,
                        ValidIssuer = jwt.Issuer,
                        ValidateAudience = true,
                        ValidAudience = jwt.Audience,
                        ValidateIssuerSigningKey = true,
                        IssuerSigningKey = new SymmetricSecurityKey(
                            Encoding.UTF8.GetBytes(jwt.SigningKey)
                        ),
                        ValidateLifetime = true,
                        RequireExpirationTime = true,
                        RequireSignedTokens = true,
                        ValidAlgorithms = [SecurityAlgorithms.HmacSha256],
                        ClockSkew = TimeSpan.FromSeconds(30),
                        NameClaimType = "sub",
                    };
                }
            );
        services.AddAuthorization();
        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.AddPolicy(
                "auth",
                context =>
                    RateLimitPartition.GetFixedWindowLimiter(
                        context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                        _ => new FixedWindowRateLimiterOptions
                        {
                            // Browser suites share one loopback IP across many accounts.
                            // The override is opt-in and unavailable outside Testing.
                            PermitLimit =
                                environment.IsEnvironment("Testing")
                                && configuration.GetValue<bool>("Testing:ExpandedAuthRateLimit")
                                    ? 600
                                    : 60,
                            Window = TimeSpan.FromMinutes(1),
                            QueueLimit = 0,
                        }
                    )
            );
        });
        return services;
    }
}
