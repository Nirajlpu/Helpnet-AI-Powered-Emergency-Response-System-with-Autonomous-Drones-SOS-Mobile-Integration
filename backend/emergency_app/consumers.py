import json
from channels.generic.websocket import AsyncWebsocketConsumer

class DashboardConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_group_name = "dashboard_updates"
        
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        await self.accept()
    
    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )
    
    async def receive(self, text_data):
        data = json.loads(text_data)
        await self.send(text_data=json.dumps({
            'message': data
        }))
    
    async def dispatch_notification(self, event):
        payload = event['message']
        payload['type'] = 'drone_dispatched'
        await self.send(text_data=json.dumps(payload))

    async def new_incident(self, event):
        await self.send(text_data=json.dumps({
            'type': 'new_incident',
            'incident': event['incident']
        }))

    async def incident_update(self, event):
        await self.send(text_data=json.dumps({
            'type': 'incident_update',
            'incident': event['incident']
        }))

class IncidentConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.incident_id = self.scope['url_route']['kwargs']['incident_id']
        self.room_group_name = f"incident_{self.incident_id}"
        
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        await self.accept()
    
    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )
    
    async def drone_dispatched(self, event):
        await self.send(text_data=json.dumps({
            'type': 'drone_dispatched',
            'drone_id': event['drone_id']
        }))

class AudioStreamConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.incident_id = self.scope['url_route']['kwargs']['incident_id']
        self.room_group_name = f"audio_{self.incident_id}"

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    async def audio_chunk(self, event):
        """Forward audio chunk (base64-encoded PCM) to the WebSocket client."""
        await self.send(text_data=json.dumps({
            'type': 'audio',
            'data': event['data'],
        }))


class VideoSignalingConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.incident_id = self.scope['url_route']['kwargs']['incident_id']
        self.room_group_name = f"video_{self.incident_id}"
        
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        await self.accept()

        # Notify existing clients (phone) that a new viewer joined
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'signaling_message',
                'data': {'type': 'viewer-joined'},
                'sender_channel_name': self.channel_name
            }
        )

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    # Receive message from WebSocket
    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            
            # Broadcast signaling data (offer, answer, icecandidate) to others in the room
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'signaling_message',
                    'data': data,
                    'sender_channel_name': self.channel_name
                }
            )
        except json.JSONDecodeError:
            pass
            
    # Receive message from room group
    async def signaling_message(self, event):
        # Don't send the message back to the sender
        if self.channel_name != event.get('sender_channel_name'):
            await self.send(text_data=json.dumps(event['data']))