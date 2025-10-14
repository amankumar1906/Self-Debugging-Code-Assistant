'use client';

import { useState } from 'react';
import { useDebugStream } from '@/hooks/useDebugStream';
import ReasoningStream from '@/components/ReasoningStream';

export default function StreamTestPage() {
  const [code, setCode] = useState(`function factorial(n) {
  if (n = 0) return 1;
  return n * factorial(n - 1);
}

console.log(factorial(5));`);

  const {
    steps,
    reasoning,
    isStreaming,
    output,
    fixedCode,
    error,
    success,
    startDebug,
  } = useDebugStream();

  const handleDebug = () => {
    startDebug(code);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-center">
          Streaming Chain-of-Thought Test
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Code Input */}
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Code Input</h2>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full h-64 p-4 font-mono text-sm bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter JavaScript code..."
            />
            <button
              onClick={handleDebug}
              disabled={isStreaming}
              className="mt-4 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors w-full"
            >
              {isStreaming ? 'Debugging...' : 'Debug Code'}
            </button>
          </div>

          {/* Right: Results */}
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-6 overflow-y-auto" style={{ maxHeight: '600px' }}>
            <h2 className="text-xl font-semibold mb-4">Debug Output</h2>

            {/* Steps */}
            {steps.length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold mb-2 text-sm text-gray-600 dark:text-gray-400">
                  Execution Steps:
                </h3>
                <div className="space-y-2">
                  {steps.map((step, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-green-500 mt-0.5">✓</span>
                      <span className="text-gray-700 dark:text-gray-300">{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reasoning */}
            {(reasoning || isStreaming) && (
              <div className="mb-6">
                <ReasoningStream reasoning={reasoning} isStreaming={isStreaming} />
              </div>
            )}

            {/* Fixed Code */}
            {fixedCode && (
              <div className="mb-6">
                <h3 className="font-semibold mb-2 text-sm text-gray-600 dark:text-gray-400">
                  Fixed Code:
                </h3>
                <pre className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm font-mono overflow-x-auto">
                  {fixedCode}
                </pre>
              </div>
            )}

            {/* Output */}
            {output && (
              <div className="mb-6">
                <h3 className="font-semibold mb-2 text-sm text-gray-600 dark:text-gray-400">
                  Output:
                </h3>
                <pre className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm font-mono whitespace-pre-wrap">
                  {output}
                </pre>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <h3 className="font-semibold text-red-700 dark:text-red-300">Error</h3>
                <p className="text-sm text-red-600 dark:text-red-400 mt-1">{error}</p>
              </div>
            )}

            {/* Success Status */}
            {success !== null && (
              <div
                className={`p-4 rounded-lg ${
                  success
                    ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                    : 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
                }`}
              >
                <p className={`font-semibold ${success ? 'text-green-700 dark:text-green-300' : 'text-yellow-700 dark:text-yellow-300'}`}>
                  {success ? '✓ Debugging Complete!' : '⚠ Debugging completed with issues'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
