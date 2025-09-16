# apps/dashboard/consumers.py
from __future__ import annotations
import json
from typing import Any, Dict

from channels.generic.websocket import AsyncJsonWebsocketConsumer


class NotificationsConsumer(AsyncJsonWebsocketConsumer):
    """
    Authenticated users subscribe to the shared 'notifications' group to receive
    real-time ActivityLog events. This consumer is additive; no changes to
    existing HTTP endpoints or business logic.
    """

    group_name: str = "notifications"

    async def connect(self):
        user = self.scope.get("user")
        if not user or not user.is_authenticated:
            await self.close()
            return
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, code):
        try:
            await self.channel_layer.group_discard(self.group_name, self.channel_name)
        except Exception:
            # Best-effort cleanup
            pass

    async def receive(self, text_data: str | None = None, bytes_data: bytes | None = None):
        # This channel is server-push only; ignore any client messages.
        return

    async def notify(self, event: Dict[str, Any]):
        """Receive a broadcast from channel layer and forward to the client."""
        payload = event.get("payload")
        # Ensure JSON serializable
        try:
            await self.send(text_data=json.dumps({
                "type": "activity_log",
                "data": payload,
            }))
        except Exception:
            # Silently ignore serialization errors to keep WS robust
            pass
