import { NextRequest } from 'next/server';
import { suggestFixStream } from '@/lib/gemini';
import { sanitizeCode } from '@/lib/sanitizer';
import { executeCode } from '@/lib/sandbox';
import { checkRateLimitOrThrow, RateLimitError } from '@/lib/ratelimit';

/**
 * Get client IP address from request
 */
function getClientIP(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

  return 'unknown';
}

/**
 * POST /api/debug-stream - Streaming Chain-of-Thought debugging
 */
export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  // Create ReadableStream for SSE
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Helper to send SSE message
        const sendMessage = (type: string, data: any) => {
          const message = `data: ${JSON.stringify({ type, ...data })}\n\n`;
          controller.enqueue(encoder.encode(message));
        };

        // Step 1: Parse request
        sendMessage('step', { message: 'Parsing request...' });
        const body = await request.json();
        const code = body.code;

        if (!code || typeof code !== 'string') {
          sendMessage('error', { message: 'Missing or invalid code field' });
          controller.close();
          return;
        }

        // Step 2: Rate limit check
        sendMessage('step', { message: 'Checking rate limit...' });
        const clientIP = getClientIP(request);

        try {
          const rateLimitResult = await checkRateLimitOrThrow(clientIP);
          sendMessage('step', {
            message: `Rate limit OK (${rateLimitResult.remaining} requests remaining)`
          });
        } catch (error) {
          if (error instanceof RateLimitError) {
            sendMessage('error', {
              message: error.message,
              rateLimit: {
                limit: error.result.limit,
                remaining: error.result.remaining,
                resetAt: error.result.resetAt,
              }
            });
            controller.close();
            return;
          }
          throw error;
        }

        // Step 3: Validate code size
        sendMessage('step', { message: 'Validating code size...' });
        const sanitizationResult = sanitizeCode(code);

        if (!sanitizationResult.isValid) {
          sendMessage('error', {
            message: `Code validation failed: ${sanitizationResult.errors.join(', ')}`
          });
          controller.close();
          return;
        }

        sendMessage('step', { message: `Code size OK (${code.length} characters)` });

        // Step 4: Execute original code
        sendMessage('step', { message: 'Executing original code...' });
        const originalExecution = await executeCode(code);

        if (originalExecution.success) {
          sendMessage('step', { message: 'Code executed successfully!' });
          sendMessage('output', {
            stdout: originalExecution.stdout,
            executionTime: originalExecution.executionTime
          });
          sendMessage('complete', { success: true, alreadyWorking: true });
          controller.close();
          return;
        }

        // Code failed - send error details
        const errorMsg = originalExecution.timedOut
          ? 'Execution timed out'
          : originalExecution.error || 'Unknown error';

        sendMessage('step', { message: `Execution failed: ${errorMsg}` });

        // Step 5: Stream AI reasoning
        sendMessage('reasoning-start', { message: 'AI is analyzing your code...' });

        let fullReasoning = '';
        for await (const chunk of suggestFixStream(code, errorMsg)) {
          fullReasoning += chunk;
          sendMessage('reasoning-chunk', { text: chunk });
        }

        sendMessage('reasoning-complete', { fullText: fullReasoning });

        // Extract fixed code from reasoning (look for code blocks)
        const codeBlockMatch = fullReasoning.match(/```(?:javascript)?\n([\s\S]*?)```/);
        const fixedCode = codeBlockMatch ? codeBlockMatch[1].trim() : '';

        if (!fixedCode || fixedCode === code) {
          sendMessage('complete', { success: false, message: 'Could not extract fixed code from AI response' });
          controller.close();
          return;
        }

        // Guard rail: Basic malicious pattern check on AI-generated code
        const maliciousPatterns = [
          /eval\s*\(/i,
          /Function\s*\(/i,
          /constructor\s*\.\s*constructor/i,
          /__proto__/i,
          /require\s*\(/i,
          /import\s+/i,
        ];

        const hasMaliciousPattern = maliciousPatterns.some(pattern => pattern.test(fixedCode));
        if (hasMaliciousPattern) {
          sendMessage('error', {
            message: 'AI generated code contains potentially unsafe patterns. Please review the code manually.'
          });
          sendMessage('fixed-code', { code: fixedCode });
          sendMessage('complete', { success: false });
          controller.close();
          return;
        }

        // Step 6: Execute fixed code
        sendMessage('step', { message: 'Testing fixed code...' });
        const fixedExecution = await executeCode(fixedCode);

        if (fixedExecution.success) {
          sendMessage('step', { message: 'Fixed code works!' });
          sendMessage('output', {
            stdout: fixedExecution.stdout,
            executionTime: fixedExecution.executionTime
          });
          sendMessage('fixed-code', { code: fixedCode });
          sendMessage('complete', { success: true });
        } else {
          sendMessage('step', { message: 'Fixed code still has issues' });
          sendMessage('error', { message: fixedExecution.error });
          sendMessage('fixed-code', { code: fixedCode });
          sendMessage('complete', { success: false });
        }

        controller.close();
      } catch (error: any) {
        const errorMessage = `data: ${JSON.stringify({
          type: 'error',
          message: error.message || 'Unknown error'
        })}\n\n`;
        controller.enqueue(encoder.encode(errorMessage));
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
