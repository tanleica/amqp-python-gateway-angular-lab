# signalr_push.py
import requests

SIGNALR_PUSH_URL = "http://gateway:5009/api/signalr-node/push-event"

def push_event(event_name: str, data):
    payload = {
        "event": event_name,
        "data": data
    }

    try:
        r = requests.post(SIGNALR_PUSH_URL, json=payload)
        r.raise_for_status()
        return True
    except Exception as e:
        print("[SignalRPush] Error:", e)
        return False

