#!/bin/bash

# Test webhook for Make.com chat flow
# User: goticapastelecia@gmail.com
# Netlify UID: 5085b9eb-db58-48bb-ad5f-b3d3fee74fba

curl -X POST https://hook.eu2.make.com/pjqmmvmj24epgb46mxgcvb2mmi96r1f3 \
  -H "Content-Type: application/json" \
  -d '{
    "user_message": "Hello Abraham Lincoln, how are you today?",
    "slug": "abraham-lincoln",
    "user_id": "112",
    "user_token": "test-token-for-gotica",
    "netlify_uid": "5085b9eb-db58-48bb-ad5f-b3d3fee74fba",
    "user_record_id": "recTestUser123",
    "current_chat_id": "test_chat_' + date +%s + '",
    "test_mode": true
  }'

echo -e "\n\n✅ Webhook sent!"
echo "Expected response: Chat reply from Abraham Lincoln"