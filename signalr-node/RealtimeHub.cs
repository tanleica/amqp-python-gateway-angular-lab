// signalr-node/RealtimeHub.cs

using Microsoft.AspNetCore.SignalR;

public class RealtimeHub : Hub
{
    // Không cần method nào trong hub.
    // Python sẽ push event.
    // Angular sẽ chỉ subscribe.
}
