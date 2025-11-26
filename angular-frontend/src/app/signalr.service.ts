// src/app/signalr.service.ts
import { Injectable, signal } from '@angular/core';
import * as signalR from '@microsoft/signalr';

@Injectable({ providedIn: 'root' })
export class SignalRService {

  private baseUrl = 'https://100.96.225.65:5009/hubs/signal';

  $messages = signal<any[]>([]);
  $connected = signal(false);
  hub!: signalR.HubConnection;

  init() {
    this.hub = new signalR.HubConnectionBuilder()
      .withUrl(this.baseUrl, {
        transport:
          signalR.HttpTransportType.WebSockets |
          signalR.HttpTransportType.ServerSentEvents |
          signalR.HttpTransportType.LongPolling
      })
      .withAutomaticReconnect([1000, 2000, 5000])
      .configureLogging(signalR.LogLevel.Information)
      .build();

    this.hub.on("amqpMessage", msg => {
      this.$messages.update(m => [...m, msg]);
    });

    this.hub
      .start()
      .then(() => this.$connected.set(true))
      .catch(err => console.error("SignalR connect failed:", err));
  }
}

