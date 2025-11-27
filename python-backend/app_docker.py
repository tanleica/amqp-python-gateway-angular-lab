from flask import Flask, request, jsonify
from flask_cors import CORS
from amqp_raw import AmqpRaw
from signalr_push import push_event
import os

app = Flask(__name__)
CORS(app)

# ===============================
# 1) AMQP CONNECTION
# ===============================
RABBIT_HOST = os.getenv("RABBIT_HOST", "rabbitmq")
RABBIT_PORT = int(os.getenv("RABBIT_PORT", "5672"))
RABBIT_USER = os.getenv("RABBIT_USER", "guest")
RABBIT_PASS = os.getenv("RABBIT_PASS", "guest")

amqp = AmqpRaw(
    host=RABBIT_HOST,
    port=RABBIT_PORT,
    username=RABBIT_USER,
    password=RABBIT_PASS
)

# ===============================
# 2) API ROUTES
# ===============================

@app.route("/api/python-backend/health")
def health():
    return jsonify({"status": "ok"})

@app.route("/api/python-backend/declare-exchange", methods=["POST"])
def declare_exchange():
    data = request.get_json()
    name = data.get("name")
    amqp.declare_exchange(name)
    return jsonify({"status": "ok", "exchange": name})


@app.route("/api/python-backend/declare-queue", methods=["POST"])
def declare_queue():
    data = request.get_json()
    name = data.get("name")
    amqp.declare_queue(name)
    return jsonify({"status": "ok", "queue": name})


@app.route("/api/python-backend/bind", methods=["POST"])
def bind():
    data = request.get_json()
    queue = data["queue"]
    exchange = data["exchange"]
    routing_key = data["routingKey"]
    amqp.bind(queue, exchange, routing_key)
    return jsonify({"status": "ok", "binding": data})


@app.route("/api/python-backend/publish", methods=["POST"])
def publish():
    data = request.get_json()
    exchange = data["exchange"]
    routing_key = data["routingKey"]
    message = data["message"]

    amqp.publish(exchange, routing_key, message)

    # 🔥 Push realtime message qua Gateway → SignalR Node
    push_event("amqpMessage", {
        "exchange": exchange,
        "routing_key": routing_key,
        "message": message
    })

    return jsonify({
        "status": "ok",
        "published": data
    })


@app.route("/api/python-backend/consume", methods=["GET"])
def consume():
    queue = request.args.get("queue")
    msg = amqp.consume(queue)

    if msg:
        return jsonify({
            "status": "ok",
            "message": msg["body"].decode(),
            "delivery_tag": msg["delivery_tag"]
        })
    
    return jsonify({"status": "empty"})


@app.route("/api/python-backend/ack", methods=["POST"])
def ack():
    data = request.get_json()
    tag = data.get("delivery_tag")
    amqp.ack(tag)
    return jsonify({"status": "ok", "ack": tag})


# ===============================
# 3) START SERVER
# ===============================

if __name__ == "__main__":
    print("🔥 Python Backend (Docker Mode) started on 0.0.0.0:8081")
    app.run(host="0.0.0.0", port=8081)

