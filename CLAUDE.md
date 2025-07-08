# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Narrin AI is a web-based AI character chat platform allowing users to converse with 1000+ AI-powered characters. The project uses static HTML/CSS/JavaScript frontend with Netlify Functions backend and Airtable as the database.

## Development Commands

This is a static website project without Node.js dependencies. Development involves:

- **Local Development**: Open HTML files directly in browser or use a local server (e.g., `python -m http.server`)
- **Deploy**: Push to Git - Netlify auto-deploys from main branch
- **Functions Testing**: Use Netlify CLI: `netlify dev` (requires installation)

## Architecture

### Frontend Structure
- Static HTML pages with embedded JavaScript
- No build process or framework - vanilla JS
- Key pages: `index.html` (home), `chat.html` (chat interface), `profile.html` (user management)
- CSS uses custom properties for theming

### Backend (Netlify Functions)
All backend logic in `netlify/functions/`:
- `characters.js` - Fetches character data from Airtable
- `memory.js` - Manages character memory retrieval
- `save-chat-message.js` - Persists chat messages
- `get-chat-history.js` - Retrieves conversation history
- `analyze-memory.js` - Extracts important memories
- `update-memory.js` - Updates memory data

### Data Storage
- **Airtable** stores all data (characters, users, chats, memories)
- Environment variables required:
  - `AIRTABLE_BASE_ID`
  - `AIRTABLE_TOKEN` or `AIRTABLE_API_KEY`

### External Integrations
- **Make.com webhooks** for user registration and character creation
- **OpenAI API** for chat responses
- **Netlify Identity** for authentication
- **Stripe** for Pro subscriptions

## Key Patterns

### Error Logging
Use `console.error()` with emoji prefixes:
```javascript
console.error('❌ Memory function error:', error);
```

### API Response Format
All Netlify functions return consistent structure:
```javascript
return {
  statusCode: 200,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ success: true, data: {...} })
};
```

### Character Memory System
- Memories have importance scores (1-10)
- Retrieved based on user_id, character_id, and importance threshold
- Includes emotional state and context tracking

## Common Tasks

### Adding a New Character
1. Add entry to Airtable Characters table
2. Include required fields: Name, Slug, Title, Description, Category, Avatar
3. Avatar images stored in `/avatars/` directory

### Modifying Chat Behavior
- Chat logic primarily in `chat.html`
- Memory context added via `memory.js` function
- Responses generated through Make.com webhook

### Updating Netlify Functions
- Functions auto-deploy on Git push
- Test locally with `netlify dev`
- Check logs in Netlify dashboard

## Important Notes

- No package.json or npm scripts - this is a static site
- All JavaScript is embedded in HTML files or Netlify functions
- Character avatars use Airtable attachment URLs
- Authentication state stored in localStorage
- Free tier users limited to 10 messages, Pro tier unlimited