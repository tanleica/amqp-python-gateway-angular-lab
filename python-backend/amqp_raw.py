import pika
import time
import json
import random
import traceback


class AmqpClient:
    def __init__(self,
                 host="amqp_rabbit",
                 port=5672,
                 username="guest",
                 password="guest",
                 use_quorum=False):
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.use_quorum = use_quorum

        # Internal metrics
        self.metrics = {
            "reconnects": 0,
            "channel_reopens": 0,
            "publish_retry": 0,
            "unrouteable": 0,
            "published_ok": 0
        }

        self.connection = None
        self.channel = None

        self._connect()

    # ============================================================
    # 1) SAFE WRAPPER with exponential jitter-backoff
    # ============================================================
    def _safe(self, fn):
        base = 0.15
        retries = 3

        for attempt in range(1, retries + 1):
            try:
                return fn()

            except pika.exceptions.ChannelClosedByBroker as e:
                print(f"[AMQP] ChannelClosedByBroker: {e}")
                print(traceback.format_exc())
                self.metrics["channel_reopens"] += 1
                self._open_channel()
                time.sleep(base * attempt)
                continue

            except pika.exceptions.StreamLostError as e:
                print(f"[AMQP] StreamLostError — reconnecting")
                print(traceback.format_exc())
                self._connect()
                time.sleep(base * attempt)
                continue

            except pika.exceptions.AMQPConnectionError as e:
                print(f"[AMQP] ConnectionError — reconnecting fully")
                print(traceback.format_exc())
                self._connect()
                time.sleep(base * attempt)
                continue

            except Exception as e:
                print(f"[AMQP] Unknown error: {e}")
                print(traceback.format_exc())
                self._connect()
                time.sleep(base * attempt)

        raise Exception("Operation failed after retries")

    # ============================================================
    # 2) CONNECT + CHANNEL
    # ============================================================
    def _connect(self):
        self.metrics["reconnects"] += 1
        print(f"[AMQP] Connecting to {self.host}:{self.port}")

        creds = pika.PlainCredentials(self.username, self.password)
        params = pika.ConnectionParameters(
            host=self.host,
            port=self.port,
            credentials=creds,
            heartbeat=30,                   # Level 5: tuned heartbeat
            blocked_connection_timeout=10,
            connection_attempts=3,
            retry_delay=2
        )

        self.connection = pika.BlockingConnection(params)
        self.channel = self.connection.channel()
        self.channel.confirm_delivery()     # Publisher confirms

        # Return callback: when mandatory=True & unroutable
        self.channel.add_on_return_callback(self._on_return)

        print("[AMQP] Connected")

    def _open_channel(self):
        try:
            self.metrics["channel_reopens"] += 1
            self.channel = self.connection.channel()
            self.channel.confirm_delivery()
            self.channel.add_on_return_callback(self._on_return)
            print("[AMQP] Channel reopened")
        except:
            print("[AMQP] Channel reopen failed – full reconnect")
            self._connect()

    # ============================================================
    # 3) PUBLISHER RETURN HANDLER (unrouteable messages)
    # ============================================================
    def _on_return(self, ch, method, props, body):
        print("[AMQP] ❌ Returned message (unrouteable):", body)
        self.metrics["unrouteable"] += 1

    # ============================================================
    # 4) EXCHANGE
    # ============================================================
    def declare_exchange(self, name, type="direct"):
        return self._safe(lambda: self._declare_exchange(name, type))

    def _declare_exchange(self, name, type):
        self.channel.exchange_declare(
            exchange=name,
            exchange_type=type,
            durable=True
        )

    # ============================================================
    # 5) QUEUE + DLQ + QUORUM (optional)
    # ============================================================
    def declare_queue(self, name):
        return self._safe(lambda: self._declare_queue(name))

    def _declare_queue(self, name):
        dlq = f"{name}.DLQ"
        dlx = f"{name}.DLX"

        # DLX exchange
        self.channel.exchange_declare(
            exchange=dlx,
            exchange_type="direct",
            durable=True
        )

        # DLQ queue
        self.channel.queue_declare(queue=dlq, durable=True)

        args = {
            "x-dead-letter-exchange": dlx,
            "x-dead-letter-routing-key": dlq
        }

        if self.use_quorum:
            args["x-queue-type"] = "quorum"

        self.channel.queue_declare(
            queue=name,
            durable=True,
            arguments=args
        )

        self.channel.queue_bind(
            exchange=dlx,
            queue=dlq,
            routing_key=dlq
        )

    # ============================================================
    # 6) BIND
    # ============================================================
    def bind(self, queue, exchange, routing_key):
        return self._safe(lambda: self._bind(queue, exchange, routing_key))

    def _bind(self, queue, exchange, routing_key):
        self._declare_exchange(exchange, "direct")
        self._declare_queue(queue)

        self.channel.queue_bind(
            exchange=exchange,
            queue=queue,
            routing_key=routing_key
        )

    # ============================================================
    # 7) PUBLISH (Confirm + Retry + DLX safe)
    # ============================================================
    def publish(self, exchange, routing_key, message):
        body = json.dumps({"message": message})
        return self._safe(lambda: self._publish(exchange, routing_key, body))

    def _publish(self, exchange, routing_key, body):
        self._declare_exchange(exchange, "direct")

        attempts = 3
        for attempt in range(1, attempts + 1):
            try:
                ok = self.channel.basic_publish(
                    exchange=exchange,
                    routing_key=routing_key,
                    body=body,
                    mandatory=True,
                    properties=pika.BasicProperties(delivery_mode=2)
                )
                if ok:
                    self.metrics["published_ok"] += 1
                    print("[AMQP] Publish OK")
                    return True

            except pika.exceptions.UnroutableError:
                self.metrics["unrouteable"] += 1
                print("[AMQP] ❌ Unrouteable")
                time.sleep(random.uniform(0.1, 0.4))
                continue

            except Exception as e:
                print("[AMQP] Publish error:", e)
                self.metrics["publish_retry"] += 1
                self._open_channel()
                time.sleep(random.uniform(0.1, 0.4))

        raise Exception("Publish failed after retries")

    # ============================================================
    # 8) CONSUME ONE
    # ============================================================
    def consume_one(self, queue):
        return self._safe(lambda: self._consume_one(queue))

    def _consume_one(self, queue):
        method, props, body = self.channel.basic_get(queue=queue, auto_ack=False)
        if method is None:
            return None

        tag = method.delivery_tag
        msg = json.loads(body)

        return {"tag": tag, "message": msg.get("message")}

    # ============================================================
    # 9) ACK
    # ============================================================
    def ack(self, tag):
        return self._safe(lambda: self._ack(tag))

    def _ack(self, tag):
        self.channel.basic_ack(tag)

    # ============================================================
    # 10) DLQ INSPECTOR — Level 5 bonus
    # ============================================================
    def peek_dlq(self, q):
        dlq = f"{q}.DLQ"
        method, props, body = self.channel.basic_get(queue=dlq, auto_ack=False)
        if method is None:
            return None

        return {
            "tag": method.delivery_tag,
            "body": body.decode("utf-8")
        }

