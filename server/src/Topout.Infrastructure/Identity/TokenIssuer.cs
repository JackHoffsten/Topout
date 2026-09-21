using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Topout.Application.Authentication;

namespace Topout.Infrastructure.Identity;

internal sealed class TokenIssuer(IOptions<JwtOptions> options, TimeProvider clock)
{
    public (TokenResponse Response, RefreshToken Token) Issue(int userId, RefreshSession session)
    {
        var settings = options.Value;
        var now = clock.GetUtcNow().UtcDateTime;
        var expiresAt = now.AddMinutes(settings.AccessTokenMinutes);
        var raw = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));
        var token = new RefreshToken
        {
            SessionId = session.Id,
            TokenHash = Hash(raw),
            CreatedAt = now,
            ExpiresAt = session.ExpiresAt,
        };
        var jwt = new JwtSecurityToken(
            issuer: settings.Issuer,
            audience: settings.Audience,
            claims:
            [
                new Claim(
                    JwtRegisteredClaimNames.Sub,
                    userId.ToString(System.Globalization.CultureInfo.InvariantCulture)
                ),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
                new Claim(
                    JwtRegisteredClaimNames.Iat,
                    new DateTimeOffset(now)
                        .ToUnixTimeSeconds()
                        .ToString(System.Globalization.CultureInfo.InvariantCulture),
                    ClaimValueTypes.Integer64
                ),
            ],
            notBefore: now,
            expires: expiresAt,
            signingCredentials: new SigningCredentials(
                new SymmetricSecurityKey(Encoding.UTF8.GetBytes(settings.SigningKey)),
                SecurityAlgorithms.HmacSha256
            )
        );
        return (
            new TokenResponse(
                new JwtSecurityTokenHandler().WriteToken(jwt),
                expiresAt,
                raw,
                token.ExpiresAt
            ),
            token
        );
    }

    public static string Hash(string raw) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(raw)));
}
