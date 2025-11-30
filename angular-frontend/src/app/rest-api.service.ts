import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, timer, delay } from 'rxjs';
import { SignalRService } from './signalr.service';

@Injectable({ providedIn: 'root' })
export class RestApiService {

  private http = inject(HttpClient);
  private signalr = inject(SignalRService);

  private handleError(e: unknown) {
    this.signalr.pushLocal('apiError', { message: e + '' });
    throw e;
  }

  get(url: string) {
    return this.http.get(url).pipe(
      catchError(e => { this.handleError(e); throw e; })
    );
  }

  post(url: string, body: any) {
    return this.http.post(url, body).pipe(
      catchError(e => { this.handleError(e); throw e; })
    );
  }

  declareExchange(name: string) {
    return this.post('/api/python-backend/declare-exchange', { name });
  }

  declareQueue(name: string) {
    return this.post('/api/python-backend/declare-queue', { name });
  }

  bind(queue: string, exchange: string, routingKey: string) {
    return this.post('/api/python-backend/bind',
      { queue, exchange, routingKey });
  }

  publish(exchange: string, routingKey: string, message: string) {
    return this.post('/api/python-backend/publish',
      { exchange, routingKey, message });
  }

  consume(queue: string) {
    return this.get(`/api/python-backend/consume?queue=${queue}`);
  }

  getQueueInfo(queue: string) {
    return this.get(`/api/python-backend/queue-info?queue=${queue}`);
  }

  // PROMETHEUS
  getPromMetrics() {
    return this.http.get('/api/python-backend/metrics', { responseType: 'text' });
  }

  // ADVANCED
  getAmqpStats() {
    return this.get('/api/python-backend/amqp-stats');
  }

  dlqPeek(queue: string) {
    return this.get(`/api/python-backend/dlq-peek?queue=${queue}`);
  }

  dlqRequeue(queue: string) {
    return this.post('/api/python-backend/dlq-requeue', { queue });
  }

  getQueueLength(queue: string) {
    return this.get(`/api/python-backend/queue-length?queue=${queue}`);
  }


}

