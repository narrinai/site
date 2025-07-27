#!/bin/bash

# Test CreateCharacter webhook met user_uid
curl -X POST https://hook.eu2.make.com/c36jubkn9rbbgq0ovqfbx2gaqjc0dqv5 \
  -H "Content-Type: application/json" \
  -d '{
    "action": "create_character",
    "user_email": "test@example.com",
    "user_token": "test-token-123",
    "user_uid": "dd09c85b-d8cd-47f5-959e-114c7301e989",
    "name": "Test Character",
    "slug": "test-character-$(date +%s)",
    "character_id": "test-character-$(date +%s)",
    "title": "Test Character Title",
    "description": "Test character description",
    "prompt": "You are a test character",
    "category": "business",
    "tags": ["general"],
    "visibility": "private",
    "avatar_url": "https://narrin.ai/avatars/default.png",
    "character_url": "https://narrin.ai/chat.html?char=test-character",
    "voice_id": "none",
    "voice_type": "none",
    "needs_ai_avatar": false,
    "transfer_history": false,
    "source_character_id": "",
    "source_character_slug": ""
  }'