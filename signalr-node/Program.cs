// signalr-node/Program.cs

using Microsoft.AspNetCore.SignalR;
using StackExchange.Redis;

var redisHost = "redis:6379";
var redisChannel = Environment.GetEnvironmentVariable("REDIS_CHANNEL") ?? "amqp-lab-default";

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddCors(opts => opts.AddDefaultPolicy(policy =>
    policy.AllowAnyHeader()
          .AllowAnyMethod()
          .AllowCredentials()
          .SetIsOriginAllowed(_ => true)
));

// 🧩 Add SignalR + Redis Backplane
builder.Services.AddSignalR()
    .AddStackExchangeRedis(redisHost, options =>
    {
        options.Configuration.ChannelPrefix = new RedisChannel(redisChannel, RedisChannel.PatternMode.Literal);

        // ✅ Recommended connection-safety settings
        options.Configuration.AbortOnConnectFail = false;
        options.Configuration.ConnectRetry = 5;
        options.Configuration.ConnectTimeout = 5000;

    });

var app = builder.Build();

app.UseCors();

// WebSocket/SSE/LongPolling Hub endpoint
app.MapHub<RealtimeHub>("/hubs/signal");

// Python pushes event by HTTP → HubContext → broadcast
app.MapPost("/api/signalr-node/push-event", async (
    IHubContext<RealtimeHub> hub,
    EventEnvelope envelope) =>
{
    await hub.Clients.All.SendAsync(envelope.Event, envelope.Payload);
    return Results.Ok(new { delivered = true });
});

app.Run();

public record EventEnvelope(string Event, object Payload);
