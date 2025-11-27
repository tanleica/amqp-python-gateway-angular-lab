// gateway-dotnet/Program.cs

using Ocelot.DependencyInjection;
using Ocelot.Middleware;

var builder = WebApplication.CreateBuilder(args);

string configName = "ocelot.docker.json";
builder.Configuration.AddJsonFile(configName, optional: false, reloadOnChange: true);

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAngular", policy =>
    {
        policy.AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials()
              .SetIsOriginAllowed(_ => true);
    });
});

builder.WebHost.ConfigureKestrel(options =>
{
    options.ListenAnyIP(5009); // HTTP ONLY
});

builder.Services.AddOcelot();

var app = builder.Build();

// ❗ PHẢI LUÔN LUÔN đứng TRƯỚC mọi middleware khác
app.UseWebSockets();

app.UseCors("AllowAngular");
app.UseRouting();

// 🔥 Tích hợp Ocelot vào pipeline chính — không MapWhen nữa
await app.UseOcelot();

app.MapGet("/", () => "Gateway OK");

app.Run();




/*
using Ocelot.DependencyInjection;
using Ocelot.Middleware;

var builder = WebApplication.CreateBuilder(args);

string configName = "ocelot.docker.json";

builder.Configuration.AddJsonFile(configName, optional: false, reloadOnChange: true);

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAngular", policy =>
    {
        policy.AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials()
              .SetIsOriginAllowed(_ => true);
    });
});

// ✅ HTTPS cert
builder.WebHost.ConfigureKestrel(options =>
{
    var certPath = "/etc/ssl/localcerts/gateway.pfx";
    var certPassword = "ALPHA";
    options.ListenAnyIP(5009, listen =>
    {
        listen.UseHttps(certPath, certPassword);
    });
});

builder.Services.AddOcelot();

var app = builder.Build();

app.UseCors("AllowAngular");

// 🚪 Allow Ocelot for REST (/api/*) and WS (/hubs/signal*)
app.MapWhen(
    ctx => ctx.Request.Path.StartsWithSegments("/api")
        || ctx.Request.Path.StartsWithSegments("/hubs/signal"),
    subApp => { subApp.UseOcelot().Wait(); }
);

app.MapGet("/", () => Results.Text("Gateway OK"));

app.MapGet("/healthz", () => Results.Ok(new { status = "ok" }));

app.Run();
*/
