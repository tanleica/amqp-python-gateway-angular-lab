// rest-api.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class RestApiService {
  private http = inject(HttpClient);

  // ✔ API luôn proxy qua Nginx → Gateway → Python Backend
  private base = '/api/python-backend';

  declareExchange(name: string) {
    return this.http.post(`${this.base}/declare-exchange`, { name });
  }

  declareQueue(name: string) {
    return this.http.post(`${this.base}/declare-queue`, { name });
  }

  bind(queue: string, exchange: string, routingKey: string) {
    return this.http.post(`${this.base}/bind`, { queue, exchange, routingKey });
  }

  publish(exchange: string, routingKey: string, message: string) {
    return this.http.post(`${this.base}/publish`, { exchange, routingKey, message });
  }

  consume(queue: string) {
    return this.http.get(`${this.base}/consume?queue=${queue}`);
  }

  ack(tag: number) {
    return this.http.post(`${this.base}/ack`, { delivery_tag: tag });
  }
}

