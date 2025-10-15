'use client';

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

interface DebugResultsProps {
  result: DebugResponse | null;
}

/**
 * Display debug results with step-by-step logs, fixed code, and output
 */
export default function DebugResults({ result }: DebugResultsProps) {
  if (!result) {
    return null;
  }

  const getStatusIcon = (status: DebugStep['status']) => {
    switch (status) {
      case 'success':
        return (
          <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
        );
      case 'error':
        return (
          <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
        );
      case 'pending':
        return (
          <svg
            className="w-5 h-5 text-blue-500 animate-spin"
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
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        );
      case 'skipped':
        return (
          <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z"
              clipRule="evenodd"
            />
          </svg>
        );
    }
  };

  const formatResetTime = (resetAt: number) => {
    const now = Date.now();
    const diff = resetAt - now;
    const minutes = Math.ceil(diff / 60000);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  // Deduplicate steps - keep only the latest status for each step name
  const deduplicatedSteps = result.steps.reduce((acc, step) => {
    const existingIndex = acc.findIndex(s => s.step === step.step);
    if (existingIndex >= 0) {
      // Replace with newer step (later timestamp)
      if (step.timestamp >= acc[existingIndex].timestamp) {
        acc[existingIndex] = step;
      }
    } else {
      acc.push(step);
    }
    return acc;
  }, [] as DebugStep[]);

  return (
    <div className="w-full space-y-6">
      {/* Overall Status */}
      <div
        className={`p-4 rounded-lg border-l-4 ${
          result.success
            ? 'bg-green-50 dark:bg-green-900/20 border-green-500'
            : 'bg-red-50 dark:bg-red-900/20 border-red-500'
        }`}
      >
        <div className="flex items-start gap-3">
          {result.success ? (
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
              {result.success
                ? (result.fixedCode ? 'Code Fixed Successfully!' : 'Your Code Works!')
                : 'Debugging Failed'}
            </h3>
            {result.error && <p className="text-sm mt-1 text-red-700 dark:text-red-300">{result.error}</p>}
          </div>
        </div>
      </div>

      {/* Rate Limit Info */}
      {result.rateLimit && (
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm">
          <div className="flex items-center justify-between">
            <span className="text-blue-700 dark:text-blue-300">
              Requests remaining: <strong>{result.rateLimit.remaining}/{result.rateLimit.limit}</strong>
            </span>
            {result.rateLimit.remaining === 0 && (
              <span className="text-blue-600 dark:text-blue-400">
                Resets in: {formatResetTime(result.rateLimit.resetAt)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Fixed Code */}
      {result.fixedCode && (
        <div className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg p-4">
          <h4 className="font-semibold mb-3">Fixed Code</h4>
          <pre className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm font-mono overflow-x-auto">
            {result.fixedCode}
          </pre>
        </div>
      )}

      {/* Execution Output */}
      {result.executionOutput && (
        <div className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg p-4">
          <h4 className="font-semibold mb-3">Output</h4>
          <pre className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm font-mono whitespace-pre-wrap">
            {result.executionOutput}
          </pre>
        </div>
      )}

    </div>
  );
}
