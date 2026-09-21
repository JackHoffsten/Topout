using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace Topout.IntegrationTests;

[Collection("api")]
public class AccessTokenTests(ApiFixture fixture)
{
    [Theory]
    [InlineData("expired")]
    [InlineData("wrong-issuer")]
    [InlineData("wrong-audience")]
    [InlineData("wrong-key")]
    [InlineData("invalid-subject")]
    public async Task Untrusted_or_expired_jwts_cannot_access_exercises(string scenario)
    {
        using var client = fixture.Client();
        var jwt = new JwtSecurityToken(
            issuer: scenario == "wrong-issuer" ? "Other" : "Topout.Tests",
            audience: scenario == "wrong-audience" ? "Other" : "Topout.Tests.Client",
            claims: [new Claim("sub", scenario == "invalid-subject" ? "not-a-user-id" : "1")],
            notBefore: DateTime.UtcNow.AddMinutes(-30),
            expires: scenario == "expired"
                ? DateTime.UtcNow.AddMinutes(-10)
                : DateTime.UtcNow.AddMinutes(10),
            signingCredentials: new SigningCredentials(
                new SymmetricSecurityKey(
                    Encoding.UTF8.GetBytes(
                        scenario == "wrong-key"
                            ? "other-signing-key-at-least-32-bytes-long"
                            : "integration-test-only-key-at-least-32-bytes-long"
                    )
                ),
                SecurityAlgorithms.HmacSha256
            )
        );
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Bearer",
            new JwtSecurityTokenHandler().WriteToken(jwt)
        );
        Assert.Equal(
            HttpStatusCode.Unauthorized,
            (await client.GetAsync("/api/exercises")).StatusCode
        );
    }
}
