'use client';

import { useState } from 'react';

interface CodeInputProps {
  onDebug: (code: string) => void;
  isLoading: boolean;
}

/**
 * Code input component with textarea and debug button
 */
export default function CodeInput({ onDebug, isLoading }: CodeInputProps) {
  const [code, setCode] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim() && !isLoading) {
      onDebug(code);
    }
  };

  const placeholder = `// Enter your buggy JavaScript code here...
// Example:
function factorial(n) {
  if (n = 0) return 1;
  return n * factorial(n - 1);
}

console.log(factorial(5));`;

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="mb-4">
        <label htmlFor="code-input" className="block text-sm font-medium mb-2">
          JavaScript Code
        </label>
        <textarea
          id="code-input"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={placeholder}
          disabled={isLoading}
          className="w-full h-[400px] p-4 font-mono text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed resize-none"
          spellCheck={false}
        />
      </div>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={!code.trim() || isLoading}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <svg
                className="animate-spin h-5 w-5"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Debugging...
            </span>
          ) : (
            'Debug Code'
          )}
        </button>

        {code.trim() && !isLoading && (
          <button
            type="button"
            onClick={() => setCode('')}
            className="px-4 py-3 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 font-medium transition-colors"
          >
            Clear
          </button>
        )}

        <div className="ml-auto text-sm text-gray-500">
          {code.length} / 10000 characters
        </div>
      </div>
    </form>
  );
}
