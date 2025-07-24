# Make.com Memory Analysis Fix

## Problem
The memory system is storing questions ("whats my name?") as memories instead of extracting information from statements ("im honda" → "User's name is Honda").

## Solution for Make.com Flow

### 1. When to Analyze Messages
Only analyze user messages that contain NEW INFORMATION, not questions about existing information.

### 2. Update the Make.com Flow Logic

In your Make.com flow where you call the analyze-memory webhook:

**Current Issue:** The flow is analyzing every message, including questions
**Fix:** Add a filter or condition BEFORE calling analyze-memory

### 3. Add This Filter Logic

Before calling the analyze-memory function, check if the message is:
- A question asking for memory recall (contains: "remember", "recall", "whats my", "weet je", "herinner")
- Very short question (< 10 characters with "?")

If YES → Skip memory analysis OR set importance to low (1-3)
If NO → Proceed with normal analysis

### 4. Example Filter in Make.com

```
IF message contains any of ["remember", "recall", "whats my", "weet je nog", "herinner je", "do you know"]
  AND message contains "?"
THEN 
  Skip analyze-memory 
  OR 
  Set memory_importance = 2
ELSE
  Normal analyze-memory call
```

### 5. Alternative: Update analyze-memory.js

If you can't modify the Make.com flow, we can update the analyze-memory function to better handle memory-check questions:

```javascript
// In analyze-memory.js, around line 370
if (isAskingAboutInfo && isQuestion) {
    // Memory check questions should have LOW importance
    importance = 2; // Changed from += 1
} 
```

## Testing

1. Send "im honda" → Should create memory "User's name is Honda" with importance 7-10
2. Send "whats my name?" → Should either:
   - Not create a memory at all
   - Create low importance memory (1-3)
3. The AI response should show the extracted information, not the question