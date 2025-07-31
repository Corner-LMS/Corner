# AI Assistant Setup Guide

## Overview

The AI assistant now uses Firebase Cloud Functions to process OpenAI API calls server-side, eliminating the need for API keys in the mobile app. This allows the app to work in preview builds without exposing sensitive API keys.

## What Changed

1. **Removed client-side OpenAI configuration** - No more API keys in the mobile app
2. **Added Firebase Cloud Functions** - Server-side processing of AI requests
3. **Updated mobile service** - Now calls Firebase Functions instead of OpenAI directly

## Setup Instructions

### 1. Deploy Firebase Functions

Navigate to the functions directory and run the deployment script:

```bash
cd functions
./deploy.sh
```

This script will:
- Install dependencies
- Build the functions
- Configure your OpenAI API key
- Deploy to Firebase

### 2. Install Mobile App Dependencies

Install the new Firebase Functions package:

```bash
npm install
```

### 3. Test the AI Assistant

The AI assistant should now work without any API keys in the mobile app. The OpenAI API key is securely stored in Firebase Functions configuration.

## Benefits

- ✅ **Secure** - API keys are stored server-side
- ✅ **Preview Builds** - Works in Expo preview builds
- ✅ **No Git Issues** - No need to gitignore API keys
- ✅ **Scalable** - Firebase handles the infrastructure
- ✅ **Authenticated** - Only authenticated users can access AI features

## Troubleshooting

### Function Not Found
- Make sure you've deployed the functions: `firebase deploy --only functions`
- Check that your mobile app is using the correct Firebase project

### Authentication Errors
- Ensure users are logged in to Firebase Auth before using the AI assistant
- The functions require authentication to work

### API Key Errors
- Verify the OpenAI API key is set: `firebase functions:config:get openai.api_key`
- Set it if missing: `firebase functions:config:set openai.api_key="your-key"`

## Files Changed

- `services/openaiService.ts` - Updated to use Firebase Functions
- `functions/` - New Firebase Cloud Functions directory
- `config/openai.config.ts` - Removed (no longer needed)
- `package.json` - Added `@react-native-firebase/functions` dependency

## Security

- OpenAI API keys are stored securely in Firebase Functions configuration
- Functions require Firebase Authentication
- No sensitive data is exposed to the client
- All AI processing happens server-side 