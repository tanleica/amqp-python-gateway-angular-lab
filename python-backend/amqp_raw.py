# python-backend/amqp_raw.py
import pika
import time

class AmqpClient:
    def __init__(self, host, port, username, password):
        self.params = pika.ConnectionParameters(
            host=host,
            port=port,
            credentials=pika.PlainCredentials(username, password),
            heartbeat=30,
            blocked_connection_timeout=5
        )
        self._connect()

    def _connect(self):
        for i in range(1, 30):
            try:
                print(f"🐇 Connecting to RabbitMQ ({self.params.host}:{self.params.port}) attempt {i}/30 ...")
                self.connection = pika.BlockingConnection(self.params)
                self.channel = self.connection.channel()
                print("🐇 RabbitMQ connected successfully!")
                return
            except Exception as e:
                print(f"⚠ Connect failed: {e}")
                time.sleep(2)
        raise Exception("❌ RabbitMQ unreachable after 30 attempts")

    def _safe(self, fn):
        """Retry-safe wrapper to handle StreamLostError."""
        try:
            return fn()
        except pika.exceptions.StreamLostError:
            print("⚠ Stream lost! Reconnecting...")
            self._connect()
            return fn()

    # ----------------- OPERATIONS -----------------
    def declare_exchange(self, name, type="direct"):
        return self._safe(lambda: self._declare_exchange(name, type))

    def _declare_exchange(self, name, type):
        self.channel.exchange_declare(exchange=name, exchange_type=type, durable=True)
        return {"declared": True, "exchange": name, "type": type}

    def declare_queue(self, name):
        return self._safe(lambda: self._declare_queue(name))

    def _declare_queue(self, name):
        self.channel.queue_declare(queue=name, durable=True)
        return {"declared": True, "queue": name}

    def bind(self, queue, exchange, routing_key=""):
        return self._safe(lambda: self._bind(queue, exchange, routing_key))

    def _bind(self, queue, exchange, routing_key):
        self.channel.queue_bind(queue=queue, exchange=exchange, routing_key=routing_key)
        return {"bound": True}

    def publish(self, exchange, routing_key, message):
        return self._safe(lambda: self._publish(exchange, routing_key, message))

    def _publish(self, exchange, routing_key, message):
        self.channel.basic_publish(exchange=exchange, routing_key=routing_key, body=message)
        return {"published": True}

    def consume_one(self, queue):
        return self._safe(lambda: self._consume_one(queue))

    def _consume_one(self, queue):
        method, props, body = self.channel.basic_get(queue, auto_ack=False)
        if method:
            return {"tag": method.delivery_tag, "message": body.decode()}
        return None

    def ack(self, delivery_tag):
        return self._safe(lambda: self._ack(delivery_tag))

    def _ack(self, delivery_tag):
        self.channel.basic_ack(delivery_tag)
        return {"acked": True}
