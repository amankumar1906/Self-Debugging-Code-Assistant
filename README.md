# Self-Debugging Code Assistant

A web-based AI-powered tool that automatically analyzes, debugs, and fixes buggy code using Google's Gemini Flash API.

## Features

- **AI-Powered Analysis**: Uses Gemini Flash to identify bugs and suggest fixes
- **Safe Code Execution**: Runs code in a sandboxed environment with timeouts
- **Step-by-Step Debugging**: Shows analysis → execution → fixes → validation
- **Rate Limiting**: Built-in protection against abuse
- **100% Free**: Deployed on Vercel with free Gemini API tier

## Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **AI**: Google Gemini Flash API
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 18+
- Google Gemini API key (get it free at https://makersuite.google.com/app/apikey)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/amankumar1906/Self-Debugging-Code-Assistant.git
cd self-debugging-assistant
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
# Create .env.local and add your Gemini API key
GEMINI_API_KEY=your_api_key_here
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
self-debugging-assistant/
├── app/
│   ├── page.tsx              # Main UI
│   ├── layout.tsx            # Root layout
│   └── api/
│       └── debug/
│           └── route.ts      # API endpoint
├── components/               # React components
├── lib/                      # Utility functions
│   ├── gemini.ts            # Gemini API wrapper
│   ├── sandbox.ts           # Safe code execution
│   ├── sanitizer.ts         # Input validation
│   └── ratelimit.ts         # Rate limiting
└── public/                  # Static assets
```

## How It Works

1. User pastes buggy code in the textarea
2. Frontend sends POST request to `/api/debug`
3. API sanitizes input and checks rate limits
4. Gemini analyzes code and suggests fixes
5. Code runs in isolated sandbox with timeout
6. Results displayed with step-by-step logs

## Security

- Input sanitization (blocks dangerous imports)
- Sandboxed code execution
- 5-second timeout on execution
- IP-based rate limiting
- Environment variable protection

## Deploy on Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/amankumar1906/Self-Debugging-Code-Assistant)

## License

MIT
