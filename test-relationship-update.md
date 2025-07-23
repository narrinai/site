# Test Plan for Character Relationship Fix

## Issue
The CharacterRelationships table was saving all entries with user_id '42' regardless of the actual user.

## Root Cause
In `chat.html`, the `updateRelationship` function was using a fallback value:
```javascript
const effective_user_id = user_id || localStorage.getItem("test_user_id") || "42";
```

## Fix Applied
Modified the `updateRelationship` function in `chat.html` to:
1. Use email as fallback instead of '42'
2. Skip relationship updates if no valid user identifier exists
3. Prevent saving test user data to production table

## Testing Steps
1. Clear browser localStorage
2. Login with a real user account
3. Chat with any character
4. Check Airtable CharacterRelationships table
5. Verify new entries show correct user_id (not '42')

## Expected Result
- New relationship entries should show the actual user's ID or email
- No new entries with user_id '42' should be created
- Existing functionality should remain intact