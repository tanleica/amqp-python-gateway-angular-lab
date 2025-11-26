# python-backend/app.py
from flask import Flask, request, jsonify
from flask_cors import CORS
from amqp_raw import AmqpClient
import threading
import time

app = Flask(__name__)
CORS(app)

# Init AMQP
amqp = AmqpClient(
    host="rabbitmq",
    port=5672,
    username="guest",
    password="guest"
)

@app.post("/declare-exchange")
def declare_exchange():
    data = request.json
    return jsonify(amqp.declare_exchange(
        name=data["name"],
        type=data.get("type", "direct")
    ))

@app.post("/declare-queue")
def declare_queue():
    data = request.json
    return jsonify(amqp.declare_queue(data["name"]))

@app.post("/bind")
def bind():
    data = request.json
    return jsonify(amqp.bind(
        queue=data["queue"],
        exchange=data["exchange"],
        routing_key=data.get("routing_key", "")
    ))

@app.post("/publish")
def publish():
    data = request.json
    return jsonify(amqp.publish(
        exchange=data["exchange"],
        routing_key=data.get("routing_key", ""),
        message=data["message"]
    ))

@app.get("/consume")
def consume():
    queue = request.args.get("queue")
    msg = amqp.consume_one(queue)
    return jsonify(msg or {})

@app.post("/ack")
def ack():
    data = request.json
    return jsonify(amqp.ack(data["delivery_tag"]))
