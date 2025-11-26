# python-backend/app_docker.py
# DOCKER version – chạy bên trong docker-compose network

from flask import Flask, request, jsonify
from flask_cors import CORS
from amqp_raw import AmqpClient
import os
import requests

app = Flask(__name__)
CORS(app)

# RabbitMQ service name in Docker
RABBIT_HOST = os.getenv("RABBITMQ_HOST", "rabbitmq")
RABBIT_PORT = int(os.getenv("RABBITMQ_PORT", "5672"))

# SignalR Push URL inside Docker
SIGNALR_PUSH_URL = os.getenv(
    "SIGNALR_PUSH_URL",
    "http://signalr-node:6001/api/signalr-node/push-event"
)

amqp = AmqpClient(
    host=RABBIT_HOST,
    port=RABBIT_PORT,
    username=os.getenv("RABBITMQ_USER", "guest"),
    password=os.getenv("RABBITMQ_PASS", "guest")
)

@app.get("/api/python-backend/health")
def health():
    return jsonify(ok=True, mode="docker")

@app.post("/api/python-backend/declare-exchange")
def declare_exchange():
    data = request.json
    return jsonify(amqp.declare_exchange(
        name=data["name"],
        type=data.get("type", "direct")
    ))

@app.post("/api/python-backend/declare-queue")
def declare_queue():
    data = request.json
    return jsonify(amqp.declare_queue(data["name"]))

@app.post("/api/python-backend/bind")
def bind():
    data = request.json
    return jsonify(amqp.bind(
        queue=data["queue"],
        exchange=data["exchange"],
        routing_key=data.get("routing_key", "")
    ))

@app.post("/api/python-backend/publish")
def publish():
    data = request.json

    # AMQP publish
    result = amqp.publish(
        exchange=data["exchange"],
        routing_key=data.get("routing_key", ""),
        message=data["message"]
    )

    # Push realtime to SignalR Node
    try:
        requests.post(
            SIGNALR_PUSH_URL,
            json={"Event": "amqpMessage", "Payload": data},
            timeout=1
        )
    except:
        pass

    return jsonify(result)

@app.get("/api/python-backend/consume")
def consume():
    queue = request.args.get("queue")
    msg = amqp.consume_one(queue)
    return jsonify(msg or {})

@app.post("/api/python-backend/ack")
def ack():
    data = request.json
    return jsonify(amqp.ack(data["delivery_tag"]))


if __name__ == "__main__":
    print("🚀 Python backend DOCKER starting on port 8081 ...")
    app.run(host="0.0.0.0", port=8081)

