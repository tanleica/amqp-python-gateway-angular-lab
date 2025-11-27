// signalr.service.ts
import { Injectable, signal } from '@angular/core';
import { HubConnection, HubConnectionBuilder, LogLevel } from '@microsoft/signalr';

@Injectable({ providedIn: 'root' })
export class SignalRService {
  private hub!: HubConnection;

  $messages = signal<any[]>([]);
  $connected = signal(false);

  start() {
    this.hub = new HubConnectionBuilder()
      .withUrl('/hubs/signal')   // ✔ Correct: đi qua NGINX → Gateway
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Information)
      .build();

    this.hub.start()
      .then(() => this.$connected.set(true))
      .catch(err => console.error('SignalR connect error:', err));

    this.hub.onclose(() => this.$connected.set(false));

    this.hub.on('amqpMessage', (payload) => {
      this.$messages.update(arr => [...arr, payload]);
    });
  }
}

