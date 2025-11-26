import { Component, inject, signal, OnInit } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { RestApiService } from './rest-api.service';
import { SignalRService } from './signalr.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [JsonPipe],
  templateUrl: './app.html',
  styleUrls: ['./app.scss']
})
export class App implements OnInit {

  api = inject(RestApiService);
  signalr = inject(SignalRService);

  // input signals
  $exchange = signal('');
  $queue = signal('');
  $routingKey = signal('');
  $message = signal('');

  $logs = signal<string[]>([]);
  $consumeResult = signal<any>({});

  ngOnInit() {
    this.signalr.init();
  }

  log(msg: string) {
    this.$logs.update(l => [...l, msg]);
  }

  declareExchange() {
    const name = this.$exchange().trim();
    if (!name) return;
    this.api.declareExchange(name).subscribe({
      next: res => this.log(`Exchange declared: ${name}`),
      error: err => this.log(`Error: ${err.message}`)
    });
  }

  declareQueue() {
    const q = this.$queue().trim();
    if (!q) return;
    this.api.declareQueue(q).subscribe({
      next: res => this.log(`Queue declared: ${q}`),
      error: err => this.log(`Error: ${err.message}`)
    });
  }

  bind() {
    this.api.bindQueue(
      this.$queue().trim(),
      this.$exchange().trim(),
      this.$routingKey().trim()
    ).subscribe({
      next: res => this.log(`Bound OK`),
      error: err => this.log(`Error: ${err.message}`)
    });
  }

  publish() {
    this.api.publish(
      this.$exchange().trim(),
      this.$routingKey().trim(),
      this.$message().trim()
    ).subscribe({
      next: res => this.log(`Message published.`),
      error: err => this.log(`Error: ${err.message}`)
    });
  }

  consume() {
    const q = this.$queue().trim();
    if (!q) return;
    this.api.consume(q).subscribe({
      next: res => {
        this.$consumeResult.set(res);
        this.log(`Consumed.`);
      },
      error: err => this.log(`Error: ${err.message}`)
    });
  }
}

