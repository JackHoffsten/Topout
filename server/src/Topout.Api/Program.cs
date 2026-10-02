using System.Net;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using Topout.Api;
using Topout.Application;
using Topout.Infrastructure;
using Topout.Infrastructure.Persistence;

var migrate = args.Contains("--migrate");
var builder = WebApplication.CreateBuilder(args.Where(a => a != "--migrate").ToArray());
var secretsFile = Environment.GetEnvironmentVariable("TOPOUT_SECRETS_FILE");
if (!string.IsNullOrWhiteSpace(secretsFile))
    builder.Configuration.AddJsonFile(secretsFile, optional: false, reloadOnChange: false);

builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);
if (migrate)
{
    await using var migrationApp = builder.Build();
    using var scope = migrationApp.Services.CreateScope();
    await scope.ServiceProvider.GetRequiredService<AppDbContext>().Database.MigrateAsync();
    return;
}
builder.Services.AddApi(builder.Configuration, builder.Environment);

var app = builder.Build();

var forwarding = new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedProto | ForwardedHeaders.XForwardedFor,
};
foreach (
    var proxy in builder.Configuration.GetSection("ReverseProxy:KnownProxies").Get<string[]>() ?? []
)
    forwarding.KnownProxies.Add(IPAddress.Parse(proxy));
app.UseForwardedHeaders(forwarding);
app.UseExceptionHandler();
app.UseStatusCodePages(async context =>
    await Results
        .Problem(statusCode: context.HttpContext.Response.StatusCode)
        .ExecuteAsync(context.HttpContext)
);
app.UseHttpsRedirection();
app.UseRouting();
app.UseCors("web");
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapGet(
    "/health",
    async (AppDbContext db, CancellationToken ct) =>
        await db.Database.CanConnectAsync(ct)
            ? Results.Ok(new { status = "Healthy" })
            : Results.StatusCode(503)
);
app.Run();

public partial class Program { }
