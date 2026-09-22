using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Topout.Application.Authentication;

namespace Topout.IntegrationTests;

[CollectionDefinition("web-api")]
public sealed class WebApiCollection : ICollectionFixture<ApiFixture> { }

[Collection("web-api")]
public class WebAuthTests(ApiFixture fixture)
{
    private WebApplicationFactory<Program> Factory() =>
        fixture.WithWebHostBuilder(builder =>
            builder.ConfigureAppConfiguration(
                (_, configuration) =>
                    configuration.AddInMemoryCollection(
                        new Dictionary<string, string?>
                        {
                            ["Web:AllowedOrigins:0"] = "https://client.example.test",
                        }
                    )
            )
        );

    [Fact]
    public async Task Cookies_are_secure_and_web_json_never_contains_refresh_tokens()
    {
        using var factory = Factory();
        using var client = factory.CreateClient(
            new() { BaseAddress = new Uri("https://localhost"), HandleCookies = false }
        );
        var browser = new Browser(client);
        await browser.Csrf();
        var register = await browser.Post(
            "register",
            new
            {
                email = $"{Guid.NewGuid():N}@example.com",
                password = "StrongPassword123!",
                displayName = "Web",
            }
        );
        Assert.Equal(HttpStatusCode.Created, register.StatusCode);
        var body = await register.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(body.TryGetProperty("accessToken", out _));
        Assert.False(body.TryGetProperty("refreshToken", out _));
        var cookie = Assert.Single(
            register.Headers.GetValues("Set-Cookie"),
            value => value.StartsWith("__Secure-topout-refresh=")
        );
        Assert.Contains("secure", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("httponly", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("samesite=lax", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("path=/api/auth/web", cookie);
        Assert.DoesNotContain("domain=", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.Equal(HttpStatusCode.OK, (await browser.Post("refresh")).StatusCode);
        var revoke = await browser.Post("revoke");
        Assert.Equal(HttpStatusCode.NoContent, revoke.StatusCode);
        Assert.Contains(
            revoke.Headers.GetValues("Set-Cookie"),
            value => value.StartsWith("__Secure-topout-refresh=;")
        );
        await browser.Csrf();
        Assert.Equal(HttpStatusCode.Unauthorized, (await browser.Post("refresh")).StatusCode);
    }

    [Fact]
    public async Task Development_allows_the_local_http_expo_origin()
    {
        using var factory = fixture.WithWebHostBuilder(builder =>
            builder.UseEnvironment("Development")
        );
        using var client = factory.CreateClient(
            new() { BaseAddress = new Uri("http://localhost"), HandleCookies = false }
        );
        var browser = new Browser(client, "topout-dev-csrf")
        {
            Origin = "http://localhost:8081",
        };
        await browser.Csrf();
        var register = await browser.Post(
            "register",
            new
            {
                email = $"{Guid.NewGuid():N}@example.com",
                password = "StrongPassword123!",
                displayName = "Local development",
            }
        );
        Assert.Equal(HttpStatusCode.Created, register.StatusCode);
        var cookie = Assert.Single(
            register.Headers.GetValues("Set-Cookie"),
            value => value.StartsWith("topout-dev-refresh=")
        );
        Assert.DoesNotContain("secure", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("httponly", cookie, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Csrf_and_origin_are_required_on_all_cookie_writes()
    {
        using var factory = Factory();
        using var client = factory.CreateClient(
            new() { BaseAddress = new Uri("https://localhost"), HandleCookies = false }
        );
        var browser = new Browser(client);
        await browser.Csrf();
        var validToken = browser.Token;
        browser.Token = "invalid";
        Assert.Equal(HttpStatusCode.Forbidden, (await browser.Post("refresh")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await browser.Post("revoke")).StatusCode);
        Assert.Equal(
            HttpStatusCode.Forbidden,
            (
                await browser.Post(
                    "login",
                    new { email = "a@example.com", password = "Password123!" }
                )
            ).StatusCode
        );
        browser.Token = validToken;
        browser.Origin = "https://evil.example.test";
        Assert.Equal(HttpStatusCode.Forbidden, (await browser.Post("refresh")).StatusCode);
        browser.Origin = null;
        Assert.Equal(HttpStatusCode.Forbidden, (await browser.Post("refresh")).StatusCode);
    }

    [Fact]
    public async Task Replaying_a_web_token_on_native_revokes_its_successor()
    {
        using var factory = Factory();
        using var client = factory.CreateClient(
            new() { BaseAddress = new Uri("https://localhost"), HandleCookies = false }
        );
        var browser = new Browser(client);
        await browser.Csrf();
        Assert.Equal(
            HttpStatusCode.Created,
            (
                await browser.Post(
                    "register",
                    new
                    {
                        email = $"{Guid.NewGuid():N}@example.com",
                        password = "StrongPassword123!",
                        displayName = "Replay",
                    }
                )
            ).StatusCode
        );
        var oldToken = Uri.UnescapeDataString(browser.Cookies["__Secure-topout-refresh"]);
        Assert.Equal(HttpStatusCode.OK, (await browser.Post("refresh")).StatusCode);
        Assert.Equal(
            HttpStatusCode.Unauthorized,
            (
                await client.PostAsJsonAsync("/api/auth/refresh", new { refreshToken = oldToken })
            ).StatusCode
        );
        Assert.Equal(HttpStatusCode.Unauthorized, (await browser.Post("refresh")).StatusCode);
    }

    [Theory]
    [InlineData("https://client.example.test", true)]
    [InlineData("https://evil.example.test", false)]
    public async Task Cors_allows_only_configured_credentialed_origins(string origin, bool allowed)
    {
        using var factory = Factory();
        using var client = factory.CreateClient(
            new() { BaseAddress = new Uri("https://localhost") }
        );
        using var request = new HttpRequestMessage(HttpMethod.Options, "/api/auth/web/refresh");
        request.Headers.Add("Origin", origin);
        request.Headers.Add("Access-Control-Request-Method", "POST");
        request.Headers.Add("Access-Control-Request-Headers", "X-CSRF-Token,Content-Type");
        var response = await client.SendAsync(request);
        Assert.Equal(allowed, response.Headers.Contains("Access-Control-Allow-Origin"));
        if (allowed)
        {
            Assert.Equal(
                origin,
                Assert.Single(response.Headers.GetValues("Access-Control-Allow-Origin"))
            );
            Assert.Equal(
                "true",
                Assert.Single(response.Headers.GetValues("Access-Control-Allow-Credentials"))
            );
        }
    }

    private sealed class Browser(
        HttpClient client,
        string csrfCookieName = "__Host-topout-csrf"
    )
    {
        public Dictionary<string, string> Cookies { get; } = [];
        public string Token { get; set; } = "";
        public string? Origin { get; set; } = "https://client.example.test";

        public async Task Csrf()
        {
            var response = await Send(HttpMethod.Get, "csrf", null);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Token = (await response.Content.ReadFromJsonAsync<JsonElement>())
                .GetProperty("csrfToken")
                .GetString()!;
            Assert.Contains(
                response.Headers.GetValues("Set-Cookie"),
                cookie =>
                    cookie.StartsWith(csrfCookieName + "=")
                    && !cookie.Contains("httponly", StringComparison.OrdinalIgnoreCase)
            );
        }

        public Task<HttpResponseMessage> Post(string action, object? body = null) =>
            Send(HttpMethod.Post, action, body);

        private async Task<HttpResponseMessage> Send(HttpMethod method, string action, object? body)
        {
            using var request = new HttpRequestMessage(method, "/api/auth/web/" + action);
            if (Origin is not null)
                request.Headers.Add("Origin", Origin);
            if (Cookies.Count > 0)
                request.Headers.Add(
                    "Cookie",
                    string.Join("; ", Cookies.Select(x => x.Key + "=" + x.Value))
                );
            if (method != HttpMethod.Get)
                request.Headers.Add("X-CSRF-Token", Token);
            if (body is not null)
                request.Content = JsonContent.Create(body);
            var response = await client.SendAsync(request);
            if (response.Headers.TryGetValues("Set-Cookie", out var cookies))
                foreach (var cookie in cookies)
                {
                    var pair = cookie.Split(';')[0].Split('=', 2);
                    Cookies[pair[0]] = pair[1];
                }
            return response;
        }
    }
}
