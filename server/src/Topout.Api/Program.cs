using Microsoft.AspNetCore.HttpOverrides;
using Topout.Api;
using Topout.Application;
using Topout.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddApi(builder.Configuration, builder.Environment);

var app = builder.Build();

// Default known proxies are loopback only. Configure trusted proxies explicitly for deployment.
app.UseForwardedHeaders(
    new ForwardedHeadersOptions { ForwardedHeaders = ForwardedHeaders.XForwardedProto }
);
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
app.Run();

public partial class Program { }
