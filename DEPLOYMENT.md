# MindBuddy Backend - Render Deployment Guide

## 🚀 Deploy to Render (Free Tier)

### Step 1: Prepare Your Code
1. Create a GitHub repository
2. Upload the `backend` folder contents to your repo
3. Make sure you have these files:
   - `package.json`
   - `server.js`
   - `README.md`
   - `env.example`

### Step 2: Deploy on Render
1. Go to [render.com](https://render.com)
2. Sign up/Login with GitHub
3. Click "New +" → "Web Service"
4. Connect your GitHub repository
5. Select the repository with your backend code

### Step 3: Configure Render Settings
- **Name**: `mindbuddy-backend` (or any name you like)
- **Runtime**: `Node`
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Plan**: `Free`

### Step 4: Set Environment Variables
In Render dashboard, go to "Environment" tab and add:
```
OPENAI_API_KEY=your-actual-openai-api-key-here
NODE_ENV=production
```

### Step 5: Deploy!
Click "Create Web Service" and wait for deployment.

### Step 6: Get Your API URL
Once deployed, you'll get a URL like:
`https://mindbuddy-backend.onrender.com`

## 🔧 Testing Your Backend

### Health Check
```
GET https://your-app-name.onrender.com/health
```

### Test Chat
```bash
curl -X POST "https://your-app-name.onrender.com/api/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello!",
    "chatHistory": [],
    "userId": "test123"
  }'
```

## 📱 Update Your Android App

You'll need to update your Android app to use this backend instead of calling OpenAI directly.

### Backend URL
Replace the OpenAI API calls in your Android app with calls to:
`https://your-app-name.onrender.com/api/chat`

## 🔄 Changing API Keys

To change your OpenAI API key:
1. Go to Render dashboard
2. Click on your service
3. Go to "Environment" tab
4. Update `OPENAI_API_KEY` value
5. Click "Save Changes"
6. Render will automatically restart your service

## 💡 Benefits

- ✅ **Free hosting** on Render
- ✅ **Easy API key management** through dashboard
- ✅ **Offline responses** when OpenAI is down
- ✅ **Rate limiting** to prevent abuse
- ✅ **CORS enabled** for Android apps
- ✅ **Automatic restarts** when you update code

## 🆘 Troubleshooting

### Service Won't Start
- Check that `OPENAI_API_KEY` is set correctly
- Verify your `package.json` has correct start script

### API Not Responding
- Check Render logs in dashboard
- Verify your API key is valid
- Test with health check endpoint

### Android App Can't Connect
- Make sure backend URL is correct
- Check CORS settings
- Verify network permissions in Android app
