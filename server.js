const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: '*', // Allow all origins for Android app
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Offline responses for when OpenAI is down
const offlineResponses = [
  "Hey! I'm having some connection issues right now, but I'm still here to chat!",
  "Network's acting up, but don't worry - I'm listening!",
  "Having trouble connecting to my brain, but your messages are reaching me!",
  "Tech glitch moment! What else is on your mind?",
  "Connection's a bit wonky, but I'm totally here for you!",
  "My servers are taking a coffee break, but I'm still ready to chat!",
  "Having some internet hiccups, but your thoughts matter to me!",
  "Network's being moody, but I'm not going anywhere!",
  "Tech troubles, but our conversation continues!",
  "Connection issues, but I'm still your MindBuddy!"
];

// Fallback responses for API errors
const fallbackResponses = [
  "Oops, having trouble! Try messaging again.",
  "Network acting funny. What else is up?",
  "Not able to reply properly—slow internet?",
  "Let's chat, don't mind the tech glitch. Your turn!",
  "Servers are a bit busy. Ask me anything!",
  "Having some technical difficulties, but I'm here!",
  "Connection's being stubborn, but I'm listening!",
  "Tech hiccup moment! What's your story?",
  "Network's having a mood, but our chat continues!",
  "Some server drama, but I'm still your buddy!"
];

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'MindBuddy Backend is running!',
    timestamp: new Date().toISOString()
  });
});

// Root endpoint (helpful landing response)
app.get('/', (req, res) => {
  res.json({
    name: 'MindBuddy Backend',
    status: 'OK',
    message: 'Welcome! Use the endpoints below.',
    endpoints: {
      health: '/health',
      status: '/api/status',
      chat: '/api/chat'
    },
    timestamp: new Date().toISOString()
  });
});

// API base endpoint
app.get('/api', (req, res) => {
  res.json({
    message: 'MindBuddy API base. Try /api/status or POST /api/chat',
    endpoints: {
      status: '/api/status',
      chat: '/api/chat'
    },
    timestamp: new Date().toISOString()
  });
});

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message, chatHistory = [], userId } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ 
        error: 'Message is required and must be a string' 
      });
    }

    // Check if OpenAI API key is configured
    const openaiApiKey = process.env.OPENAI_API_KEY;
    
    if (!openaiApiKey || openaiApiKey === 'your-openai-api-key-here') {
      console.log('OpenAI API key not configured, using offline response');
      return res.json({
        response: getRandomResponse(offlineResponses),
        source: 'offline',
        timestamp: new Date().toISOString()
      });
    }

    // Build context messages
    const contextMessages = buildContextMessages(chatHistory, message);

    // Call OpenAI API
    const openaiResponse = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: contextMessages,
        max_tokens: 150,
        temperature: 0.7,
        presence_penalty: 0.5,
        frequency_penalty: 0.5,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiApiKey}`,
        },
        timeout: 10000, // 10 second timeout
      }
    );

    if (openaiResponse.status === 200) {
      const aiResponse = openaiResponse.data.choices[0].message.content.trim();
      return res.json({
        response: aiResponse,
        source: 'openai',
        timestamp: new Date().toISOString()
      });
    } else {
      throw new Error(`OpenAI API error: ${openaiResponse.status}`);
    }

  } catch (error) {
    console.error('Chat error:', error.message);
    
    // Determine if it's an API key issue or network issue
    let responseMessage;
    let source = 'fallback';
    
    if (error.message.includes('account_deactivated') || 
        error.message.includes('invalid_api_key') ||
        error.message.includes('401')) {
      responseMessage = "My AI brain is taking a break right now, but I'm still here to chat!";
      source = 'api_key_issue';
    } else if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      responseMessage = getRandomResponse(offlineResponses);
      source = 'timeout';
    } else {
      responseMessage = getRandomResponse(fallbackResponses);
    }

    return res.json({
      response: responseMessage,
      source: source,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// API key status endpoint
app.get('/api/status', (req, res) => {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const hasValidKey = openaiApiKey && 
                     openaiApiKey !== 'your-openai-api-key-here' && 
                     openaiApiKey.length > 20;

  res.json({
    openai_configured: hasValidKey,
    offline_responses_available: true,
    timestamp: new Date().toISOString()
  });
});

// Helper function to build context messages
function buildContextMessages(chatHistory, userMessage) {
  const messages = [];

  // System prompt for English-first, India-focused responses
  messages.push({
    role: 'system',
    content: `You are MindBuddy, an English-first AI companion for Indian youth.
Always reply in simple, clear English unless the user types in Hindi—then you can use friendly Hinglish back.
Never use pure Hindi unless the user clearly does.
Keep responses SHORT (2-3 sentences max).
Don't mention anything you CAN'T do (calling, sending files, meeting physically).
If the user seems stressed, give brief, practical advice that Indian young people relate to.
Use Hindi words sparingly for flavor only (yaar, bhai, dost, chill, scene).
Stay casual, friendly, and never preachy or robotic.
Reference past chats naturally when relevant.`
  });

  // Add recent chat history (last 10 messages)
  const recentHistory = chatHistory.slice(-10);
  for (const message of recentHistory) {
    messages.push({
      role: message.role,
      content: message.content
    });
  }

  // Add current user message
  messages.push({
    role: 'user',
    content: userMessage
  });

  return messages;
}

// Helper function to get random response
function getRandomResponse(responses) {
  return responses[Math.floor(Math.random() * responses.length)];
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: 'Something went wrong on our end'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: 'The requested endpoint does not exist'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 MindBuddy Backend running on port ${PORT}`);
  console.log(`📱 Ready to serve your Android app!`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`💬 Chat endpoint: http://localhost:${PORT}/api/chat`);
});

module.exports = app;
