// src/app/rest-api.service.ts
import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class RestApiService {

  private http = inject(HttpClient);

  // 🔗 Base URL (qua Gateway)
  private baseUrl = 'https://100.96.225.65:5009/api';

  // -------------------------------
  //  Python Backend
  // -------------------------------
  declareExchange(name: string) {
    return this.http.post(`${this.baseUrl}/python-backend/declare-exchange`, {
      name
    });
  }

  declareQueue(name: string) {
    return this.http.post(`${this.baseUrl}/python-backend/declare-queue`, {
      name
    });
  }

  bindQueue(queue: string, exchange: string, routingKey: string) {
    return this.http.post(`${this.baseUrl}/python-backend/bind`, {
      queue,
      exchange,
      routing_key: routingKey
    });
  }

  publish(exchange: string, routingKey: string, message: string) {
    return this.http.post(`${this.baseUrl}/python-backend/publish`, {
      exchange,
      routing_key: routingKey,
      message
    });
  }

  consume(queue: string) {
    return this.http.get(`${this.baseUrl}/python-backend/consume?queue=${queue}`);
  }

  ack(tag: number) {
    return this.http.post(`${this.baseUrl}/python-backend/ack`, {
      delivery_tag: tag
    });
  }
}

