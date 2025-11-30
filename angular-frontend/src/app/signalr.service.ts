import { Injectable, signal } from '@angular/core';
import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  HttpTransportType,
  LogLevel
} from '@microsoft/signalr';

@Injectable({ providedIn: 'root' })
export class SignalRService {

  private hub!: HubConnection;
  private retryTimer: any = null;

  // ==========================================================
  // Signals exposed to UI
  // ==========================================================
  $messages = signal<any[]>([]);
  $connected = signal(false);
  $connecting = signal(true); // start with connecting=true

  // NEW (EVOLUTION): Local event bus cho UI + RestApiService
  $local = signal<any | null>(null);

  constructor() {
    this.setupConnection();
  }

  // ==========================================================
  // Setup hub + events AND start connection automatically
  // ==========================================================
  private setupConnection() {

    this.hub = new HubConnectionBuilder()
      .withUrl('/hubs/signal', {
        transport:
          HttpTransportType.WebSockets |
          HttpTransportType.ServerSentEvents |
          HttpTransportType.LongPolling
      })
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: ctx => {
          if (ctx.previousRetryCount === 0) return 1000;
          if (ctx.previousRetryCount === 1) return 2000;
          if (ctx.previousRetryCount === 2) return 5000;
          return 10000;
        }
      })
      .configureLogging(LogLevel.Warning)
      .build();

    this.bindEvents();
    this.start();
  }

  // ==========================================================
  // Start with retry-loop
  // ==========================================================
  private start() {
    if (!this.hub) return;

    this.$connecting.set(true);

    this.hub.start()
      .then(() => {
        this.$connected.set(true);
        this.$connecting.set(false);
        console.log("SignalR connected");
      })
      .catch(err => {
        console.warn("Start failed — retry in 3s:", err);

        this.$connected.set(false);
        this.$connecting.set(false);

        clearTimeout(this.retryTimer);
        this.retryTimer = setTimeout(() => this.start(), 3000);
      });
  }

  // ==========================================================
  // Bind all hub events: message + reconnecting + reconnected
  // ==========================================================
  private bindEvents() {

    this.hub.on('amqpMessage', payload => {
      console.log('Hub amqpMessage', payload);
      this.$messages.update(list => [...list, payload]);
    });

    this.hub.onreconnecting(() => {
      this.$connected.set(false);
      this.$connecting.set(true);
      console.log("Reconnecting...");
    });

    this.hub.onreconnected(() => {
      this.$connected.set(true);
      this.$connecting.set(false);
      console.log("Reconnected");
    });

    this.hub.onclose(() => {
      this.$connected.set(false);
      this.$connecting.set(false);
      console.warn("Hub closed — restarting…");

      clearTimeout(this.retryTimer);
      this.retryTimer = setTimeout(() => this.start(), 2000);
    });
  }

  // ==========================================================
  // NEW (EVOLUTION): Local push system for UI & rest-api.service
  // ==========================================================
  pushLocal(type: string, payload: any) {
    console.log("📨 pushLocal →", { type, payload });
    this.$local.set({ type, payload });
  }
}

