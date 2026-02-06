"""
Redis Manager for Pub/Sub and Cross-Server Communication
Enables scaling across multiple server instances
"""
import redis.asyncio as aioredis
from typing import Optional
import logging
import json

logger = logging.getLogger(__name__)


class RedisManager:
    """Singleton Redis Manager for pub/sub"""
    _instance: Optional['RedisManager'] = None
    _redis: Optional[aioredis.Redis] = None
    _pubsub: Optional[aioredis.client.PubSub] = None
    
    def __init__(self):
        self.redis_url = "redis://localhost:6379"
    
    @classmethod
    async def get_instance(cls) -> 'RedisManager':
        """Get or create singleton instance"""
        if cls._instance is None:
            cls._instance = cls()
            await cls._instance.connect()
        return cls._instance
    
    async def connect(self):
        """Connect to Redis"""
        try:
            self._redis = await aioredis.from_url(
                self.redis_url,
                encoding="utf-8",
                decode_responses=True
            )
            self._pubsub = self._redis.pubsub()
            logger.info("✅ [Redis] Connected successfully")
        except Exception as e:
            logger.error(f"❌ [Redis] Connection failed: {e}")
            self._redis = None
    
    async def ping(self) -> bool:
        """Check if Redis is alive"""
        if not self._redis:
            return False
        try:
            await self._redis.ping()
            return True
        except:
            return False
    
    async def publish(self, channel: str, message: dict):
        """Publish message to channel"""
        if not self._redis:
            logger.warning("[Redis] Not connected, cannot publish")
            return
        
        try:
            await self._redis.publish(channel, json.dumps(message))
            logger.debug(f"📤 [Redis] Published to {channel}")
        except Exception as e:
            logger.error(f"❌ [Redis] Publish error: {e}")
    
    async def subscribe(self, channel: str):
        """Subscribe to a channel"""
        if not self._pubsub:
            logger.warning("[Redis] PubSub not initialized")
            return
        
        try:
            await self._pubsub.subscribe(channel)
            logger.info(f"📥 [Redis] Subscribed to {channel}")
        except Exception as e:
            logger.error(f"❌ [Redis] Subscribe error: {e}")
    
    async def unsubscribe(self, channel: str):
        """Unsubscribe from a channel"""
        if not self._pubsub:
            return
        
        try:
            await self._pubsub.unsubscribe(channel)
            logger.info(f"🔕 [Redis] Unsubscribed from {channel}")
        except Exception as e:
            logger.error(f"❌ [Redis] Unsubscribe error: {e}")
    
    async def listen(self):
        """Listen for messages (async generator)"""
        if not self._pubsub:
            return
        
        async for message in self._pubsub.listen():
            if message['type'] == 'message':
                try:
                    data = json.loads(message['data'])
                    yield data
                except:
                    yield message['data']
    
    async def close(self):
        """Close Redis connection"""
        if self._pubsub:
            await self._pubsub.close()
        if self._redis:
            await self._redis.close()
        logger.info("👋 [Redis] Connection closed")
