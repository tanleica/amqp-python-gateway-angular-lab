import { Component, signal, inject } from '@angular/core';
import { RestApiService } from './rest-api.service';
import { SignalRService } from './signalr.service';
import { JsonPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-root',
  imports: [JsonPipe, FormsModule],
  templateUrl: './app.html',
  styleUrls: ['./app.scss']
})
export class App {

  // Signals (prefix $)
  $exchange = signal('');
  $queue = signal('');
  $routingKey = signal('');
  $message = signal('');
  $consumeResult = signal<any | null>(null);
  $logs = signal<string[]>([]);

  api = inject(RestApiService);
  public signalr = inject(SignalRService);

  // Setter helpers
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

