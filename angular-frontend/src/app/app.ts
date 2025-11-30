import { Component, signal, inject, OnInit } from '@angular/core';
import { RestApiService } from './rest-api.service';
import { SignalRService } from './signalr.service';
import { JsonPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface PrometheusMetrics {
  rabbitmqConnections: number;
  rabbitmqQueues: number;
  messagesReady: number;
  messagesUnacked: number;
  messagesTotal: number;
}

@Component({
  selector: 'app-root',
  imports: [JsonPipe, FormsModule],
  templateUrl: './app.html',
  styleUrls: ['./app.scss']
})
export class App implements OnInit {

  // ======================================================
  // SIGNALS
  // ======================================================
  $exchange = signal<string>('');
  $queue = signal<string>('');
  $routingKey = signal<string>('');
  $message = signal<string>('');
  $consumeResult = signal<any | null>(null);
  $logs = signal<string[]>([]);

  $metrics = signal<PrometheusMetrics | null>(null);
  $queueCount = signal<number | null>(null);

  // FIXED: prom → metrics
  $selectedTab = signal<'lab' | 'metrics' | 'advanced'>('lab');

  $stats = signal<any>({});
  $dlq = signal<any>({});

  dlqQueue = '';

  api = inject(RestApiService);
  signalr = inject(SignalRService);

  // ======================================================
  // INIT
  // ======================================================
  ngOnInit() {
    setInterval(() => this.refreshMetrics(), 3000);
    setInterval(() => this.loadStats(), 3000);

    // FIX: listen to local events FROM SignalRService
    this.signalr.local.subscribe((evt: any) => {
      if (!evt) return;
      if (evt.type === 'apiError') this.log("API Error: " + evt.message);
      if (evt.type === 'uiLog') this.log(evt.message);
    });
  }

  // ======================================================
  // LEVEL 6 — ADVANCED API
  // ======================================================
  loadStats() {
    this.api.getAmqpStats().subscribe(res => this.$stats.set(res));
  }

  peekDlq() {
    this.api.peekDlq(this.dlqQueue).subscribe(res => this.$dlq.set(res));
  }

  requeueDlq() {
    this.api.requeueDlq(this.dlqQueue).subscribe(() => this.log("DLQ → Main requeued!"));
  }

  // ======================================================
  // PROMETHEUS
  // ======================================================
  refreshMetrics() {
    this.api.getPromMetrics().subscribe(raw => {
      this.$metrics.set(this.parseMetrics(raw));
    });
  }

  parseMetrics(raw: string): PrometheusMetrics {
    const lines = raw.split('\n');
    const get = (key: string): number => {
      const row = lines.find(l => l.startsWith(key));
      if (!row) return 0;
      const val = Number(row.split(' ').pop());
      return isNaN(val) ? 0 : val;
    };
    return {
      rabbitmqConnections: get('rabbitmq_connections_opened_total'),
      rabbitmqQueues: get('rabbitmq_queues_declared_total'),
      messagesReady: get('rabbitmq_queue_messages_ready'),
      messagesUnacked: get('rabbitmq_queue_messages_unacked'),
      messagesTotal: get('rabbitmq_queue_messages'),
    };
  }

  // ======================================================
  // QUEUE INFO
  // ======================================================
  checkQueue(q: string) {
    this.api.queueInfo(q).subscribe((info: any) => {
      this.$queueCount.set(info.messages_ready ?? 0);
    });
  }

  // ======================================================
  // SETTERS
  // ======================================================
  setExchange(v: string) { this.$exchange.set(v); }
  setQueue(v: string) { this.$queue.set(v); }
  setRoutingKey(v: string) { this.$routingKey.set(v); }
  setMessage(v: string) { this.$message.set(v); }

  // ======================================================
  // LOGGING
  // ======================================================
  log(message: string) {
    this.$logs.update(arr => [...arr, message]);
  }

  // ======================================================
  // BASIC ACTIONS
  // ======================================================
  declareExchange() {
    this.api.declareExchange(this.$exchange())
      .subscribe({
        next: res => this.log(`Exchange created: ${JSON.stringify(res)}`),
        error: err => this.log(`Error: ${err.error?.message || err.message}`)
      });
  }

  declareQueue() {
    this.api.declareQueue(this.$queue())
      .subscribe({
        next: res => this.log(`Queue created: ${JSON.stringify(res)}`),
        error: err => this.log(`Error: ${err.error?.message || err.message}`)
      });
  }

  bind() {
    this.api.bind(this.$queue(), this.$exchange(), this.$routingKey())
      .subscribe({
        next: res => this.log(`Bind OK: ${JSON.stringify(res)}`),
        error: err => this.log(`Error: ${err.error?.message || err.message}`)
      });
  }

  publish() {
    this.api.publish(this.$exchange(), this.$routingKey(), this.$message())
      .subscribe({
        next: res => this.log(`Published: ${JSON.stringify(res)}`),
        error: err => this.log(`Error: ${err.error?.message || err.message}`)
      });
  }

  consume() {
    this.api.consume(this.$queue())
      .subscribe({
        next: res => {
          this.$consumeResult.set(res);
          this.log(`Consumed: ${JSON.stringify(res)}`);
        },
        error: err => this.log(`Error: ${err.error?.message || err.message}`)
      });
  }
}
