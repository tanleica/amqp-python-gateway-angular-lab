from flask import Flask, request, jsonify
from flask_cors import CORS
from amqp_raw import AmqpRaw
from signalr_push import push_event
import os

app = Flask(__name__)
CORS(app)

# ===============================
# 1) AMQP CONFIG (local dev)
# ===============================
RABBIT_HOST = os.getenv("RABBIT_HOST", "localhost")
RABBIT_PORT = int(os.getenv("RABBIT_PORT", "5672"))
RABBIT_USER = os.getenv("RABBIT_USER", "guest")
RABBIT_PASS = os.getenv("RABBIT_PASS", "guest")

# For local testing: connect to local RabbitMQ or Docker RabbitMQ
amqp = AmqpRaw(
    host=RABBIT_HOST,
    port=RABBIT_PORT,
    username=RABBIT_USER,
    password=RABBIT_PASS
)

# ===============================
# 2) API ROUTES (prefix unified)
# ===============================

@app.route("/api/python-backend/declare-exchange", methods=["POST"])
def declare_exchange():
    req = request.get_json()
    name = req["name"]
    amqp.declare_exchange(name)
    return jsonify({"status": "ok", "exchange": name})


@app.route("/api/python-backend/declare-queue", methods=["POST"])
def declare_queue():
    req = request.get_json()
    name = req["name"]
    amqp.declare_queue(name)
    return jsonify({"status": "ok", "queue": name})


@app.route("/api/python-backend/bind", methods=["POST"])
def bind():
    req = request.get_json()
    queue = req["queue"]
    exchange = req["exchange"]
    routing_key = req["routingKey"]

    amqp.bind(queue, exchange, routing_key)
    return jsonify({"status": "ok", "binding": req})


@app.route("/api/python-backend/publish", methods=["POST"])
def publish():
    req = request.get_json()

    ex = req["exchange"]
    rk = req["routingKey"]
    msg = req["message"]

    # Publish AMQP message
    amqp.publish(ex, rk, msg)

    # 🔥 Send realtime notification via Gateway
    push_event("amqpMessage", {
        "exchange": ex,
        "routing_key": rk,
        "message": msg,
        "source": "python-dev"
    })

    return jsonify({"status": "ok", "published": req})


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
    req = request.get_json()
    tag = req.get("delivery_tag")
    amqp.ack(tag)
    return jsonify({"status": "ok", "ack": tag})


# ===============================
# 3) DEV SERVER
# ===============================
if __name__ == "__main__":
    print("🐍 Python Backend (DEV MODE) running on http://127.0.0.1:8081")
    app.run(host="0.0.0.0", port=8081, debug=True)

