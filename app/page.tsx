'use client';

import { useState } from 'react';
import CodeInput from '@/components/CodeInput';
import DebugResults from '@/components/DebugResults';

interface DebugStep {
  step: string;
  status: 'pending' | 'success' | 'error' | 'skipped';
  message?: string;
  data?: any;
  timestamp: number;
}

interface DebugResponse {
  success: boolean;
  steps: DebugStep[];
  originalCode: string;
  fixedCode?: string;
  executionOutput?: string;
  error?: string;
  rateLimit?: {
    limit: number;
    remaining: number;
    resetAt: number;
  };
}

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<DebugResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDebug = async (code: string) => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/debug', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      });

      const data: DebugResponse = await response.json();
      setResult(data);

      if (!response.ok && response.status !== 429) {
        setError(data.error || 'An error occurred during debugging');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect to debug API');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Header */}
        <header className="mb-8 text-center">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Self-Debugging Assistant
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Paste your buggy JavaScript code and let AI fix it for you
          </p>
        </header>

        {/* Main Content */}
        <main className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-6 md:p-8">
          <CodeInput onDebug={handleDebug} isLoading={isLoading} />

          {/* Error Message */}
          {error && !result && (
            <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-start gap-3">
                <svg
                  className="w-6 h-6 text-red-500 flex-shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
                <div>
                  <h3 className="font-semibold text-red-700 dark:text-red-300">
                    Error
                  </h3>
                  <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                    {error}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Debug Results */}
          <DebugResults result={result} />
        </main>

        {/* Footer */}
        <footer className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>
            Powered by{' '}
            <a
              href="https://ai.google.dev/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              Gemini 2.0 Flash
            </a>
            {' • '}
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              View on GitHub
            </a>
          </p>
        </footer>
      </div>
    </div>
  );
}
