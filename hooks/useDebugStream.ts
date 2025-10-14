import { useState, useCallback, useRef } from 'react';

interface StreamMessage {
  type: string;
  message?: string;
  text?: string;
  stdout?: string;
  code?: string;
  fullText?: string;
  success?: boolean;
  [key: string]: any;
}

interface DebugStreamState {
  steps: string[];
  reasoning: string;
  isStreaming: boolean;
  output: string | null;
  fixedCode: string | null;
  error: string | null;
  success: boolean | null;
}

export function useDebugStream() {
  const [state, setState] = useState<DebugStreamState>({
    steps: [],
    reasoning: '',
    isStreaming: false,
    output: null,
    fixedCode: null,
    error: null,
    success: null,
  });

  const eventSourceRef = useRef<EventSource | null>(null);

  const startDebug = useCallback(async (code: string) => {
    // Reset state
    setState({
      steps: [],
      reasoning: '',
      isStreaming: true,
      output: null,
      fixedCode: null,
      error: null,
      success: null,
    });

    try {
      // Send POST request to start streaming
      const response = await fetch('/api/debug-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      // Read stream
      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        // Decode chunk
        const chunk = decoder.decode(value, { stream: true });

        // Parse SSE messages (format: data: {...}\n\n)
        const messages = chunk.split('\n\n').filter(Boolean);

        for (const msg of messages) {
          if (msg.startsWith('data: ')) {
            try {
              const data: StreamMessage = JSON.parse(msg.slice(6));

              // Handle different message types
              switch (data.type) {
                case 'step':
                  if (data.message) {
                    setState(prev => ({
                      ...prev,
                      steps: [...prev.steps, data.message!],
                    }));
                  }
                  break;

                case 'reasoning-start':
                  setState(prev => ({
                    ...prev,
                    steps: [...prev.steps, data.message || 'AI is thinking...'],
                  }));
                  break;

                case 'reasoning-chunk':
                  if (data.text) {
                    setState(prev => {
                      const newReasoning = prev.reasoning + data.text;

                      // Stop adding to reasoning once we hit a code block
                      if (newReasoning.includes('```')) {
                        // Extract only text before the code block
                        const textBeforeCode = newReasoning.split('```')[0].trim();
                        return {
                          ...prev,
                          reasoning: textBeforeCode,
                        };
                      }

                      return {
                        ...prev,
                        reasoning: newReasoning,
                      };
                    });
                  }
                  break;

                case 'reasoning-complete':
                  // Already have full reasoning from chunks
                  break;

                case 'output':
                  if (data.stdout !== undefined) {
                    setState(prev => ({
                      ...prev,
                      output: data.stdout!,
                    }));
                  }
                  break;

                case 'fixed-code':
                  if (data.code) {
                    setState(prev => ({
                      ...prev,
                      fixedCode: data.code!,
                    }));
                  }
                  break;

                case 'error':
                  setState(prev => ({
                    ...prev,
                    error: data.message || 'Unknown error',
                  }));
                  break;

                case 'complete':
                  setState(prev => ({
                    ...prev,
                    success: data.success ?? false,
                    isStreaming: false,
                  }));
                  break;
              }
            } catch (e) {
              console.error('Failed to parse SSE message:', e);
            }
          }
        }
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unknown error',
        isStreaming: false,
      }));
    }
  }, []);

  const stopDebug = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setState(prev => ({ ...prev, isStreaming: false }));
  }, []);

  return {
    ...state,
    startDebug,
    stopDebug,
  };
}
