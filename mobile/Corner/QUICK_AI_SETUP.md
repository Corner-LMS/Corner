# Quick AI Assistant Setup (Environment Variables)

## Overview

This setup uses environment variables for quick testing. The AI assistant will work with `process.env.EXPO_PUBLIC_OPENAI_API_KEY`.

## Setup Instructions

### 1. Set Environment Variable

Create a `.env` file in the root of your project:

```bash
# mobile/Corner/.env
EXPO_PUBLIC_OPENAI_API_KEY=your-openai-api-key-here
```

### 2. Add .env to .gitignore

Make sure your `.env` file is in `.gitignore`:

```bash
# mobile/Corner/.gitignore
.env
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Test the AI Assistant

The AI assistant should now work with your OpenAI API key!

## How It Works

1. **Environment Variable**: `EXPO_PUBLIC_OPENAI_API_KEY` is read at runtime
2. **Fallback Mode**: If no API key is found, the assistant uses fallback responses
3. **Secure**: API key is not hardcoded in the app

## Benefits

- ✅ **Quick Setup** - Just set an environment variable
- ✅ **No Server Required** - Works directly in the mobile app
- ✅ **Fallback Mode** - Works even without API key
- ✅ **Easy Testing** - Perfect for development and testing

## Troubleshooting

### API Key Not Found
- Make sure `.env` file exists in the project root
- Verify the variable name is `EXPO_PUBLIC_OPENAI_API_KEY`
- Restart your development server after adding the `.env` file

### Fallback Mode
If you see "(Note: For more detailed AI responses, please set the EXPO_PUBLIC_OPENAI_API_KEY environment variable.)", it means:
- The API key is not set
- The assistant is using fallback responses
- This is normal for testing without an API key

## Files Changed

- `services/openaiService.ts` - Updated to use `process.env.EXPO_PUBLIC_OPENAI_API_KEY`
- Removed Firebase Functions setup (for later use)

## Next Steps

When you're ready for production, you can:
1. Use Firebase Functions (more secure)
2. Set up proper environment variable management
3. Add API key rotation and monitoring 