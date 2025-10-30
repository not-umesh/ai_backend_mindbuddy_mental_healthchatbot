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

// Utility: small sleep
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Generic retry helper for HTTP calls (429/5xx)
async function httpPostWithRetry({ url, data, headers, timeout = 10000, maxAttempts = 2 }) {
  let attempt = 0;
  let lastError;
  while (attempt < maxAttempts) {
    try {
      const resp = await axios.post(url, data, { headers, timeout });
      return resp;
    } catch (err) {
      lastError = err;
      const status = err?.response?.status;
      if (status === 429 || (status >= 500 && status <= 599)) {
        const backoffMs = 500 * Math.pow(2, attempt); // 500ms, 1000ms
        await sleep(backoffMs);
        attempt++;
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

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

// Utility: small sleep
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Call OpenAI with simple exponential backoff on 429/5xx
async function callOpenAIWithRetry({ apiKey, messages, maxTokens = 150, temperature = 0.7, maxAttempts = 2 }) {
  let attempt = 0;
  let lastError;
  while (attempt < maxAttempts) {
    try {
      const resp = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4o-mini',
          messages,
          max_tokens: maxTokens,
          temperature,
          presence_penalty: 0.5,
          frequency_penalty: 0.5,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          timeout: 10000,
        }
      );
      return resp;
    } catch (err) {
      lastError = err;
      const status = err?.response?.status;
      // Retry on rate limit (429) and transient server errors (>=500)
      if (status === 429 || (status >= 500 && status <= 599)) {
        const backoffMs = 500 * Math.pow(2, attempt); // 500ms, 1000ms
        await sleep(backoffMs);
        attempt++;
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message, chatHistory = [], userId } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ 
        error: 'Message is required and must be a string' 
      });
    }

    // Prefer OpenRouter if configured, otherwise OpenAI, else offline
    const openrouterKey = process.env.OPENROUTER_API_KEY;
    const openrouterModel = process.env.OPENROUTER_MODEL || 'meituan/longcat-flash-chat:free';
    const openrouterSite = process.env.OPENROUTER_SITE || 'https://mindbuddy.app';
    const openrouterTitle = process.env.OPENROUTER_TITLE || 'MindBuddy';
    const openaiApiKey = process.env.OPENAI_API_KEY;

    // Build context messages
    const contextMessages = buildContextMessages(chatHistory, message);

    if (openrouterKey) {
      // Call OpenRouter first
      const orResp = await httpPostWithRetry({
        url: 'https://openrouter.ai/api/v1/chat/completions',
        data: {
          model: openrouterModel,
          messages: contextMessages,
          max_tokens: 150,
          temperature: 0.7,
          presence_penalty: 0.5,
          frequency_penalty: 0.5,
        },
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openrouterKey}`,
          'HTTP-Referer': openrouterSite,
          'X-Title': openrouterTitle,
        },
        timeout: 12000,
        maxAttempts: 2,
      });

      if (orResp.status === 200) {
        const aiResponse = orResp.data.choices?.[0]?.message?.content?.trim() || '';
        if (aiResponse) {
          return res.json({
            response: aiResponse,
            source: 'openrouter',
            timestamp: new Date().toISOString()
          });
        }
      }
      // If no usable response, fall through to OpenAI/offline
    }

    if (openaiApiKey) {
      // Call OpenAI as fallback
      const openaiResponse = await httpPostWithRetry({
        url: 'https://api.openai.com/v1/chat/completions',
        data: {
          model: 'gpt-4o-mini',
          messages: contextMessages,
          max_tokens: 150,
          temperature: 0.7,
          presence_penalty: 0.5,
          frequency_penalty: 0.5,
        },
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiApiKey}`,
        },
        timeout: 10000,
        maxAttempts: 2,
      });

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
    }

    // Neither provider configured: offline
    return res.json({
      response: getRandomResponse(offlineResponses),
      source: 'offline',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const status = error?.response?.status;
    const errMsg = error?.response?.data || error.message;
    console.error('Chat error:', status || '', errMsg);
    
    // Determine if it's an API key issue or network issue
    let responseMessage;
    let source = 'fallback';
    
    if (String(errMsg).includes('insufficient_quota') || status === 429) {
      responseMessage = getRandomResponse(offlineResponses);
      source = 'rate_limited';
    } else if (String(errMsg).includes('account_deactivated') || 
        String(errMsg).includes('invalid_api_key') ||
        String(errMsg).includes('401')) {
      responseMessage = "My AI brain is taking a break right now, but I'm still here to chat!";
      source = 'api_key_issue';
    } else if (error.code === 'ECONNABORTED' || String(errMsg).includes('timeout')) {
      responseMessage = getRandomResponse(offlineResponses);
      source = 'timeout';
    } else {
      responseMessage = getRandomResponse(fallbackResponses);
    }

    return res.json({
      response: responseMessage,
      source: source,
      error: typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg),
      status: status || null,
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
    content: `You are MindBuddy. You are a real friend, texting the user directly.
— Speak naturally, like a smart, emotionally aware person (not an AI, not a therapist).
— Use contractions ("don’t", "can’t", etc.).
— Avoid all formal/counselor templates. Never say “I understand how you feel,” “I’m here for you,” or similar phrases.
— If the user is being unrealistic or overthinking, use gentle logic or subtle humor to ground them—don’t sugarcoat, but don’t be mean.
— Make every reply context-aware and non-repetitive.
— Avoid formal language and words like “therapy,” “diagnosis,” or “treatment.”
— If you comfort someone, keep it casual, not clinical.
— If you notice illogical or self-critical spirals, call them out kindly.
— If the user makes progress, acknowledge it briefly without fake praise.
— Never repeat templates. Each reply should be unique and adapt to the user's real energy.
— Prioritize reasoning, insight, and real conversation, not empty motivation.
— Responses should be concise, text-message length, but never rushed or dismissive.`
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
