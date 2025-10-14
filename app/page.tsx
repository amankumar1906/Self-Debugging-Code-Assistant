'use client';

import { useState } from 'react';
import CodeInput from '@/components/CodeInput';
import DebugResults from '@/components/DebugResults';
import { useDebugStream } from '@/hooks/useDebugStream';
import ReasoningStream from '@/components/ReasoningStream';

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
  const [showReasoning, setShowReasoning] = useState(false);

  // Non-streaming mode state
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<DebugResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Streaming mode state
  const streamState = useDebugStream();

  const handleDebug = async (code: string) => {
    if (showReasoning) {
      // Use streaming mode
      streamState.startDebug(code);
    } else {
      // Use non-streaming mode
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
    }
  };

  const currentIsLoading = showReasoning ? streamState.isStreaming : isLoading;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <header className="mb-8 text-center">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Self-Debugging Assistant
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Paste your buggy JavaScript code and let AI fix it for you
          </p>

          {/* Show Reasoning Toggle */}
          <div className="mt-4 flex items-center justify-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showReasoning}
                onChange={(e) => setShowReasoning(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Show Reasoning (streaming)
              </span>
            </label>
          </div>
        </header>

        {/* Main Content - Side by side layout */}
        <main className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Code Input */}
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-6">
            <CodeInput onDebug={handleDebug} isLoading={currentIsLoading} />

            {/* Error Message */}
            {((error && !result && !showReasoning) || (showReasoning && streamState.error)) && (
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
                      {showReasoning ? streamState.error : error}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right: Debug Results */}
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-6 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 250px)' }}>
            {showReasoning ? (
              // Streaming mode
              <>
                {streamState.reasoning || streamState.isStreaming ? (
                  <div className="space-y-4">
                    <ReasoningStream reasoning={streamState.reasoning} isStreaming={streamState.isStreaming} />

                    {streamState.fixedCode && (
                      <div>
                        <h4 className="font-semibold mb-2 text-sm text-gray-600 dark:text-gray-400">
                          Fixed Code:
                        </h4>
                        <pre className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm font-mono overflow-x-auto">
                          {streamState.fixedCode}
                        </pre>
                      </div>
                    )}

                    {streamState.output && (
                      <div>
                        <h4 className="font-semibold mb-2 text-sm text-gray-600 dark:text-gray-400">
                          Output:
                        </h4>
                        <pre className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm font-mono whitespace-pre-wrap">
                          {streamState.output}
                        </pre>
                      </div>
                    )}

                    {streamState.success !== null && (
                      <div
                        className={`p-4 rounded-lg ${
                          streamState.success
                            ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                            : 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
                        }`}
                      >
                        <p className={`font-semibold ${streamState.success ? 'text-green-700 dark:text-green-300' : 'text-yellow-700 dark:text-yellow-300'}`}>
                          {streamState.success ? '✓ Code Fixed!' : '⚠ Could not fix automatically'}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-400 dark:text-gray-600">
                    <div className="text-center">
                      <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="text-lg font-medium">Results will appear here</p>
                      <p className="text-sm mt-2">Enter code and click "Debug Code"</p>
                    </div>
                  </div>
                )}
              </>
            ) : (
              // Non-streaming mode
              <>
                {result ? (
                  <DebugResults result={result} />
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-400 dark:text-gray-600">
                    <div className="text-center">
                      <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="text-lg font-medium">Results will appear here</p>
                      <p className="text-sm mt-2">Enter code and click "Debug Code"</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
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
