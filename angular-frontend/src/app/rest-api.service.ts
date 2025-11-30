import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError, timer, switchMap, retry, delay } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { SignalRService } from './signalr.service';

@Injectable({ providedIn: 'root' })
export class RestApiService {

  private http = inject(HttpClient);
  private signalr = inject(SignalRService);

  private base = '/api/python-backend';

  // ==========================================================
  // API STATUS MACHINE
  // ==========================================================
  $apiStatus = signal<'idle' | 'busy' | 'error'>('idle');
  $lastError = signal<string | null>(null);

  $isBusy = computed(() => this.$apiStatus() === 'busy');
  $hasError = computed(() => this.$apiStatus() === 'error');

  private setBusy() { this.$apiStatus.set('busy'); }
  private setIdle() { this.$apiStatus.set('idle'); }
  private setError(e: string) {
    this.$lastError.set(e);
    this.$apiStatus.set('error');
    // Push realtime error to SignalR
    this.signalr.pushLocal('apiError', { message: e } as any);
  }

  // ==========================================================
  // UNIVERSAL CALL WRAPPER — Angular 20 compatible
  // ==========================================================
  private call<T>(obs: Observable<T>): Observable<T> {
    this.setBusy();

    return obs.pipe(
      retry({
        count: 3,
        delay: (error, retryCount) => timer(200 * retryCount)
      }),
      catchError((err: any) => {
        const msg = err?.error?.message || err.message || 'Unknown API error';
        this.setError(msg);
        return throwError(() => err);
      })
    );
  }

  // ==========================================================
  // BASIC AMQP API
  // ==========================================================

  declareExchange(name: string) {
    return this.call(
      this.http.post(`${this.base}/declare-exchange`, { name })
    );
  }

  declareQueue(name: string) {
    return this.call(
      this.http.post(`${this.base}/declare-queue`, { name })
    );
  }

  bind(queue: string, exchange: string, routingKey: string) {
    return this.call(
      this.http.post(`${this.base}/bind`, { queue, exchange, routingKey })
    );
  }

  publish(exchange: string, routingKey: string, message: string) {
    return this.call(
      this.http.post(`${this.base}/publish`, { exchange, routingKey, message })
    );
  }

  consume(queue: string) {
    return this.call(
      this.http.get(`${this.base}/consume?queue=${queue}`)
    );
  }

  ack(tag: number) {
    return this.call(
      this.http.post(`${this.base}/ack`, { delivery_tag: tag })
    );
  }

  queueInfo(queue: string) {
    return this.call(
      this.http.get(`${this.base}/queue-info?queue=${queue}`)
    );
  }

  // ==========================================================
  // PROMETHEUS METRICS
  // ==========================================================
  getPromMetrics() {
    return this.call(
      this.http.get(`${this.base}/metrics`, { responseType: 'text' })
    );
  }

  // ==========================================================
  // LEVEL 5 ADVANCED API
  // ==========================================================

  getAmqpStats() {
    return this.call(
      this.http.get(`${this.base}/amqp-stats`)
    );
  }

  peekDlq(queue: string) {
    return this.call(
      this.http.get(`${this.base}/dlq-peek?queue=${queue}`)
    );
  }

  requeueDlq(queue: string) {
    return this.call(
      this.http.post(`${this.base}/dlq-requeue`, { queue })
    );
  }

  // ==========================================================
  // LEVEL 6 — AUTO REFRESH STREAMS
  // ==========================================================

  autoQueueInfo(queue: string, intervalMs = 2000) {
    return timer(0, intervalMs).pipe(
      switchMap(() => this.queueInfo(queue))
    );
  }

  autoStats(intervalMs = 3000) {
    return timer(0, intervalMs).pipe(
      switchMap(() => this.getAmqpStats())
    );
  }

  // ==========================================================
  // LEVEL 6 — UI LOGGING
  // ==========================================================
  pushLog(msg: string) {
    this.signalr.pushLocal('uiLog', {
      timestamp: new Date().toISOString(),
      message: msg
    } as any);
  }
}

