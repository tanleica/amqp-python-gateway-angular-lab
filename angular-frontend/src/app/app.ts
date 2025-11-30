import { Component, OnInit, signal, inject, effect } from '@angular/core';
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
  standalone: true,
  imports: [JsonPipe, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {

  // Signals
  $exchange = signal('');
  $queue = signal('');
  $routingKey = signal('');
  $message = signal('');
  $consumeResult = signal<any | null>(null);
  $logs = signal<string[]>([]);

  $metrics = signal<PrometheusMetrics | null>(null);
  $queueCount = signal<number | null>(null);

  // Tabs: giữ nguyên như cũ (lab, metrics, advanced)
  $selectedTab = signal<'lab' | 'metrics' | 'advanced'>('lab');

  // Advanced signals
  $stats = signal<any>({});
  $dlq = signal<any>({});
  dlqQueue = '';

  api = inject(RestApiService);
  public signalr = inject(SignalRService);


  ngOnInit() {
    this.refreshMetrics();
    setInterval(() => this.loadStats(), 3000);

    // Lắng nghe $local (signal)
    effect(() => {
      const evt = this.signalr.$local();
      if (!evt) return;

      if (evt.type === 'uiLog') {
        this.log(evt.payload?.message || evt.message || 'uiLog');
      }

      if (evt.type === 'apiError') {
        this.log('API Error: ' + (evt.payload?.message || evt.message));
      }
    });
  }

  loadStats() {
    this.api.get('/api/python-backend/amqp-stats')
      .subscribe((res: any) => this.$stats.set(res));
  }

  peekDlq() {
    this.api.get(`/api/python-backend/dlq-peek?queue=${this.dlqQueue}`)
      .subscribe((res: any) => this.$dlq.set(res));
  }

  requeueDlq() {
    this.api.post('/api/python-backend/dlq-requeue', { queue: this.dlqQueue })
      .subscribe(() => this.log("Requeued!"));
  }

  refreshMetrics() {
    this.api.getPromMetrics().subscribe((raw: string) => {
      const parsed = this.parseMetrics(raw);
      this.$metrics.set(parsed);
    });
  }

  parseMetrics(raw: string): PrometheusMetrics {
    const lines = raw.split('\n');
    const get = (key: string) => {
      const l = lines.find(x => x.startsWith(key));
      if (!l) return 0;
      return Number(l.split(' ').pop());
    };

    return {
      rabbitmqConnections: get('rabbitmq_connections_opened_total'),
      rabbitmqQueues: get('rabbitmq_queues_declared_total'),
      messagesReady: get('rabbitmq_queue_messages_ready'),
      messagesUnacked: get('rabbitmq_queue_messages_unacked'),
      messagesTotal: get('rabbitmq_queue_messages')
    };
  }

  checkQueue(q: string) {
    this.api.getQueueInfo(q).subscribe((info: any) => {
      this.$queueCount.set(info.messages_ready ?? 0);
    });
  }

  // Setters
  setExchange(v: string) { this.$exchange.set(v); }
  setQueue(v: string) { this.$queue.set(v); }
  setRoutingKey(v: string) { this.$routingKey.set(v); }
  setMessage(v: string) { this.$message.set(v); }

  log(message: string) {
    this.$logs.update(arr => [...arr, message]);
  }

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
        next: res => this.log(`Bind ok: ${JSON.stringify(res)}`),
        error: err => this.log(`Error: ${err.error?.message || err.message}`)
      });
  }

  publish() {
    this.api.publish(
      this.$exchange(),
      this.$routingKey(),
      this.$message()
    ).subscribe({
      next: res => this.log(`Published! ${JSON.stringify(res)}`),
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

