using System.Text;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Topout.Api.Authentication;
using Topout.Api.Errors;
using Topout.Application.Abstractions;
using Topout.Infrastructure.Identity;

namespace Topout.Api;

public static class DependencyInjection
{
    public static IServiceCollection AddApi(
        this IServiceCollection services,
        IConfiguration configuration
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
                            PermitLimit = 60,
                            Window = TimeSpan.FromMinutes(1),
                            QueueLimit = 0,
                        }
                    )
            );
        });
        return services;
    }
}
