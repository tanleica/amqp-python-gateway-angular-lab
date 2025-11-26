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

    def _ensure_channel(self):
        if self.connection.is_closed or self.channel.is_closed:
            print("⚠ Channel closed, reconnecting...")
            self._connect()

    # ---------- OPERATIONS ----------
    def declare_exchange(self, name, type="direct"):
        self._ensure_channel()
        self.channel.exchange_declare(exchange=name, exchange_type=type, durable=True)
        return {"declared": True, "exchange": name, "type": type}

    def declare_queue(self, name):
        self._ensure_channel()
        self.channel.queue_declare(queue=name, durable=True)
        return {"declared": True, "queue": name}

    def bind(self, queue, exchange, routing_key=""):
        self._ensure_channel()
        self.channel.queue_bind(queue=queue, exchange=exchange, routing_key=routing_key)
        return {"bound": True}

    def publish(self, exchange, routing_key, message):
        self._ensure_channel()
        self.channel.basic_publish(
            exchange=exchange,
            routing_key=routing_key,
            body=message
        )
        return {"published": True}

    def consume_one(self, queue):
        self._ensure_channel()
        method, props, body = self.channel.basic_get(queue, auto_ack=False)
        if method:
            return {"tag": method.delivery_tag, "message": body.decode()}
        return None

    def ack(self, delivery_tag):
        self._ensure_channel()
        self.channel.basic_ack(delivery_tag)
        return {"acked": True}

