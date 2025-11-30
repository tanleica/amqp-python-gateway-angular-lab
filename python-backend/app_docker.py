from flask import Flask, request, jsonify
from flask_cors import CORS
from amqp_raw import AmqpClient
from signalr_push import push_event
import requests
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

#amqp = AmqpClient(
#    host=RABBIT_HOST,
#    port=RABBIT_PORT,
#    username=RABBIT_USER,
#    password=RABBIT_PASS
#)

# Level 2 version no longer requires host
amqp = AmqpClient(use_quorum=False)

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

    # 🔥 Push realtime message qua Gateway → SignalR Node
    push_event("amqpMessage", {
        "message": "Exchange declared",
        "name": name
    })

    return jsonify({"status": "ok", "exchange": name})


@app.route("/api/python-backend/declare-queue", methods=["POST"])
def declare_queue():
    data = request.get_json()
    name = data.get("name")
    amqp.declare_queue(name)

    # 🔥 Push realtime message qua Gateway → SignalR Node
    push_event("amqpMessage", {
        "message": "Queue declared",
        "name": name
    })

    return jsonify({"status": "ok", "queue": name})


@app.route("/api/python-backend/bind", methods=["POST"])
def bind():
    data = request.get_json()
    queue = data["queue"]
    exchange = data["exchange"]
    routing_key = data["routingKey"]
    amqp.bind(queue, exchange, routing_key)

    # 🔥 Push realtime message qua Gateway → SignalR Node
    push_event("amqpMessage", {
        "message": "Routing key bound",
        "exchange": exchange,
        "queue": queue,
        "routing_key": routing_key
    })

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
    msg = amqp.consume_one(queue)

    if msg:
        return jsonify({
            "status": "ok",
            "message": msg["message"],
            "delivery_tag": msg["tag"]
        })

    # 🔥 Push realtime message qua Gateway → SignalR Node
    push_event("amqpMessage", {
        "message": "Message consume (one) processed",
        "queue": queue,
        "msg": msg
    })
    
    return jsonify({"status": "empty"})


@app.route("/api/python-backend/ack", methods=["POST"])
def ack():
    data = request.get_json()
    tag = data.get("delivery_tag")
    amqp.ack(tag)

    # 🔥 Push realtime message qua Gateway → SignalR Node
    push_event("amqpMessage", {
        "message": "Ack",
        "data": data,
        "tag": tag
    })

    return jsonify({"status": "ok", "ack": tag})

@app.route("/api/python-backend/metrics", methods=["GET"])
def prom_metrics():
    resp = requests.get("http://amqp_rabbit:15692/metrics")
    return resp.text, 200, {"Content-Type": "text/plain"}

@app.route("/api/python-backend/queue-info", methods=["GET"])
def queue_info():
    q = request.args.get("queue")
    url = f"http://amqp_rabbit:15672/api/queues/%2f/{q}"
    r = requests.get(url, auth=("guest", "guest"))
    return r.json()

@app.route("/api/python-backend/amqp-stats")
def amqp_stats():
    return jsonify(amqp.metrics)


@app.route("/api/python-backend/dlq-peek", methods=["GET"])
def dlq_peek():
    q = request.args.get("queue")
    return jsonify(amqp.peek_dlq(q))


@app.route("/api/python-backend/dlq-requeue", methods=["POST"])
def dlq_requeue():
    data = request.get_json()
    q = data["queue"]
    dlq_name = f"{q}.DLQ"

    method, props, body = amqp.channel.basic_get(queue=dlq_name, auto_ack=True)
    if method is None:
        return jsonify({"status": "empty"})

    amqp.publish(exchange=q, routing_key=q, message=body.decode("utf-8"))
    return jsonify({"status": "requeued"})

@app.route("/api/python-backend/amqp-stats")
def amqp_stats():
    return jsonify(amqp.metrics)


@app.route("/api/python-backend/dlq-peek", methods=["GET"])
def dlq_peek():
    q = request.args.get("queue")
    return jsonify(amqp.peek_dlq(q))


@app.route("/api/python-backend/dlq-requeue", methods=["POST"])
def dlq_requeue():
    data = request.get_json()
    q = data["queue"]
    dlq_name = f"{q}.DLQ"

    method, props, body = amqp.channel.basic_get(queue=dlq_name, auto_ack=True)
    if method is None:
        return jsonify({"status": "empty"})

    amqp.publish(exchange=q, routing_key=q, message=body.decode("utf-8"))
    return jsonify({"status": "requeued"})


# ===============================
# 3) START SERVER
# ===============================

if __name__ == "__main__":
    print("🔥 Python Backend (Docker Mode) started on 0.0.0.0:8081")
    app.run(host="0.0.0.0", port=8081)

