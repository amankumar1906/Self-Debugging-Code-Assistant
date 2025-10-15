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
          <div className="mt-6 flex items-center justify-center gap-3">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Quick Fix
            </span>
            <button
              onClick={() => setShowReasoning(!showReasoning)}
              className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                showReasoning ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
              }`}
              role="switch"
              aria-checked={showReasoning}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                  showReasoning ? 'translate-x-8' : 'translate-x-1'
                }`}
              />
            </button>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Show Reasoning
            </span>
          </div>
        </header>

        {/* Main Content - Side by side layout */}
        <main className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Code Input */}
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-6">
            <CodeInput onDebug={handleDebug} isLoading={currentIsLoading} />

            {/* Error Message - Only show in Quick Fix mode */}
            {error && !result && !showReasoning && (
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
          </div>

          {/* Right: Debug Results */}
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-6 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 250px)' }}>
            {showReasoning ? (
              // Streaming mode
              <>
                {streamState.reasoning || streamState.isStreaming || streamState.success !== null || streamState.output || streamState.error ? (
                  <div className="space-y-6">
                    {/* Overall Status */}
                    {streamState.success !== null && (
                      <div
                        className={`p-4 rounded-lg border-l-4 ${
                          streamState.success
                            ? 'bg-green-50 dark:bg-green-900/20 border-green-500'
                            : 'bg-red-50 dark:bg-red-900/20 border-red-500'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {streamState.success ? (
                            <svg className="w-6 h-6 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path
                                fillRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                clipRule="evenodd"
                              />
                            </svg>
                          ) : (
                            <svg className="w-6 h-6 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path
                                fillRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                clipRule="evenodd"
                              />
                            </svg>
                          )}
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg">
                              {streamState.success
                                ? (streamState.alreadyWorking ? 'Your Code Works!' : streamState.fixedCode ? 'Code Fixed Successfully!' : 'Your Code Works!')
                                : 'Debugging Failed'}
                            </h3>
                            {streamState.error && <p className="text-sm mt-1 text-red-700 dark:text-red-300">{streamState.error}</p>}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Error when no success state */}
                    {streamState.error && streamState.success === null && (
                      <div className="p-4 rounded-lg border-l-4 bg-red-50 dark:bg-red-900/20 border-red-500">
                        <div className="flex items-start gap-3">
                          <svg className="w-6 h-6 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg text-red-700 dark:text-red-300">Error</h3>
                            <p className="text-sm mt-1 text-red-700 dark:text-red-300">{streamState.error}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Fixed Code */}
                    {streamState.fixedCode && (
                      <div className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg p-4">
                        <h4 className="font-semibold mb-3">Fixed Code</h4>
                        <pre className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm font-mono overflow-x-auto">
                          {streamState.fixedCode}
                        </pre>
                      </div>
                    )}

                    {/* Execution Output */}
                    {streamState.output && (
                      <div className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg p-4">
                        <h4 className="font-semibold mb-3">Output</h4>
                        <pre className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm font-mono whitespace-pre-wrap">
                          {streamState.output}
                        </pre>
                      </div>
                    )}

                    {/* AI Reasoning */}
                    {(streamState.reasoning || streamState.isStreaming) && (
                      <div className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg p-4">
                        <h4 className="font-semibold mb-3">AI Reasoning</h4>
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <div className="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200 leading-relaxed">
                            {streamState.reasoning}
                            {streamState.isStreaming && (
                              <span className="inline-block w-2 h-4 ml-1 bg-blue-600 dark:bg-blue-400 animate-pulse"></span>
                            )}
                          </div>
                        </div>
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
