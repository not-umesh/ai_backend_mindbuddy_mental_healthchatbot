# MindBuddy Backend API

A Node.js backend API for the MindBuddy Android app that handles OpenAI integration and provides offline responses.

## Features

- 🤖 OpenAI GPT-4o-mini integration
- 📱 Android app compatibility
- 🔄 Offline response system
- 🛡️ Rate limiting and security
- 🌐 CORS enabled for mobile apps
- ⚡ Fast and reliable

## Quick Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp env.example .env
   # Edit .env and add your OpenAI API key
   ```

3. **Start the server:**
   ```bash
   npm start
   ```

## API Endpoints

### Health Check
```
GET /health
```

### Chat with AI
```
POST /api/chat
Content-Type: application/json

{
  "message": "Hello!",
  "chatHistory": [
    {"role": "user", "content": "Hi"},
    {"role": "assistant", "content": "Hello!"}
  ],
  "userId": "user123"
}
```

### API Status
```
GET /api/status
```

## Environment Variables

- `OPENAI_API_KEY` - Your OpenAI API key
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (production/development)

## Deployment on Render

1. Connect your GitHub repository
2. Set environment variables in Render dashboard
3. Deploy!

## Offline Responses

When OpenAI is unavailable, the API provides friendly offline responses to keep users engaged.
