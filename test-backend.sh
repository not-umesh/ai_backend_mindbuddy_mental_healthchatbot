#!/bin/bash

echo "🧪 Testing MindBuddy Backend API"
echo "================================="
echo ""

# Test health endpoint
echo "1. Testing Health Check..."
curl -s "http://localhost:3000/health" | jq '.' 2>/dev/null || echo "❌ Health check failed (make sure server is running)"
echo ""

# Test API status
echo "2. Testing API Status..."
curl -s "http://localhost:3000/api/status" | jq '.' 2>/dev/null || echo "❌ API status check failed"
echo ""

# Test chat endpoint
echo "3. Testing Chat Endpoint..."
curl -s -X POST "http://localhost:3000/api/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello! This is a test message.",
    "chatHistory": [],
    "userId": "test123"
  }' | jq '.' 2>/dev/null || echo "❌ Chat test failed"
echo ""

echo "✅ Backend testing complete!"
echo ""
echo "📝 Notes:"
echo "- Make sure your server is running: npm start"
echo "- Update OPENAI_API_KEY in .env file"
echo "- Replace localhost:3000 with your Render URL for production testing"
