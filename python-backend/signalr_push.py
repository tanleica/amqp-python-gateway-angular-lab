# python-backend/signalr_push.py
import os
import requests

SIGNALR_PUSH_URL = os.environ.get(
    "SIGNALR_PUSH_URL",
    "http://signalr-node:6001/push-event"  # fallback DEV mode only
)

def push_event(event_name: str, payload: dict):
    try:
        requests.post(
            SIGNALR_PUSH_URL,
            json={
                "Event": event_name,
                "Payload": payload
            },
            timeout=2
        )
    except Exception as e:
        print(f"[WARN] SignalR push failed: {e}")
