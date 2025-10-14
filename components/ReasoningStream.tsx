'use client';

interface ReasoningStreamProps {
  reasoning: string;
  isStreaming: boolean;
}

/**
 * Display AI's Chain-of-Thought reasoning with typing effect
 */
export default function ReasoningStream({ reasoning, isStreaming }: ReasoningStreamProps) {
  if (!reasoning && !isStreaming) {
    return null;
  }

  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
          <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
        </svg>
        <h4 className="font-semibold text-blue-900 dark:text-blue-100">
          AI Reasoning Process
        </h4>
        {isStreaming && (
          <span className="ml-auto text-sm text-blue-600 dark:text-blue-400 animate-pulse">
            Thinking...
          </span>
        )}
      </div>

      <div className="prose prose-sm dark:prose-invert max-w-none">
        <div className="whitespace-pre-wrap font-mono text-sm text-gray-800 dark:text-gray-200 leading-relaxed">
          {reasoning}
          {isStreaming && (
            <span className="inline-block w-2 h-4 ml-1 bg-blue-600 dark:bg-blue-400 animate-pulse"></span>
          )}
        </div>
      </div>
    </div>
  );
}
