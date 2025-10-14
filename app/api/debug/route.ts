import { NextRequest, NextResponse } from 'next/server';
import { analyzeCode, suggestFix } from '@/lib/gemini';
import { sanitizeCode } from '@/lib/sanitizer';
import { executeCode } from '@/lib/sandbox';
import { checkRateLimitOrThrow, RateLimitError } from '@/lib/ratelimit';

/**
 * Debug step for tracking execution flow
 */
interface DebugStep {
  step: string;
  status: 'pending' | 'success' | 'error' | 'skipped';
  message?: string;
  data?: any;
  timestamp: number;
}

/**
 * API Response structure
 */
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

/**
 * Get client IP address from request
 */
function getClientIP(request: NextRequest): string {
  // Try to get real IP from headers (Vercel sets these)
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

  // Fallback to a default (shouldn't happen on Vercel)
  return 'unknown';
}

/**
 * Add a step to the debug log
 */
function addStep(
  steps: DebugStep[],
  step: string,
  status: DebugStep['status'],
  message?: string,
  data?: any
): void {
  steps.push({
    step,
    status,
    message,
    data,
    timestamp: Date.now(),
  });
}

/**
 * POST /api/debug - Debug JavaScript code
 */
export async function POST(request: NextRequest) {
  const steps: DebugStep[] = [];
  let originalCode = '';

  try {
    // Step 1: Parse request body
    addStep(steps, 'Parse Request', 'pending');
    const body = await request.json();
    originalCode = body.code;

    if (!originalCode || typeof originalCode !== 'string') {
      addStep(steps, 'Parse Request', 'error', 'Missing or invalid code field');
      return NextResponse.json(
        {
          success: false,
          steps,
          originalCode: '',
          error: 'Request body must contain a "code" field with JavaScript code',
        } as DebugResponse,
        { status: 400 }
      );
    }

    addStep(steps, 'Parse Request', 'success', `Received ${originalCode.length} characters`);

    // Step 2: Check rate limit
    addStep(steps, 'Rate Limit Check', 'pending');
    const clientIP = getClientIP(request);

    let rateLimitResult;
    try {
      rateLimitResult = await checkRateLimitOrThrow(clientIP);
      addStep(
        steps,
        'Rate Limit Check',
        'success',
        `${rateLimitResult.remaining} requests remaining`
      );
    } catch (error) {
      if (error instanceof RateLimitError) {
        addStep(
          steps,
          'Rate Limit Check',
          'error',
          error.message,
          {
            limit: error.result.limit,
            remaining: error.result.remaining,
            resetAt: error.result.resetAt,
          }
        );

        return NextResponse.json(
          {
            success: false,
            steps,
            originalCode,
            error: error.message,
            rateLimit: {
              limit: error.result.limit,
              remaining: error.result.remaining,
              resetAt: error.result.resetAt,
            },
          } as DebugResponse,
          { status: 429 }
        );
      }
      throw error;
    }

    // Step 3: Validate code size
    addStep(steps, 'Validate Code Size', 'pending');
    const sanitizationResult = sanitizeCode(originalCode);

    if (!sanitizationResult.isValid) {
      addStep(
        steps,
        'Validate Code Size',
        'error',
        'Code exceeds size limits',
        { errors: sanitizationResult.errors }
      );

      return NextResponse.json(
        {
          success: false,
          steps,
          originalCode,
          error: `Code validation failed: ${sanitizationResult.errors.join(', ')}`,
          rateLimit: {
            limit: rateLimitResult.limit,
            remaining: rateLimitResult.remaining,
            resetAt: rateLimitResult.resetAt,
          },
        } as DebugResponse,
        { status: 400 }
      );
    }

    addStep(
      steps,
      'Validate Code Size',
      'success',
      `Code size OK (${originalCode.length} chars)`,
      { warnings: sanitizationResult.warnings }
    );

    // Step 4: Execute original code
    addStep(steps, 'Execute Original Code', 'pending');
    const originalExecution = await executeCode(originalCode);

    if (originalExecution.success) {
      addStep(
        steps,
        'Execute Original Code',
        'success',
        'Code executed successfully',
        {
          stdout: originalExecution.stdout,
          stderr: originalExecution.stderr,
          executionTime: originalExecution.executionTime,
        }
      );

      // Code runs successfully - no fixing needed
      return NextResponse.json(
        {
          success: true,
          steps,
          originalCode,
          executionOutput: originalExecution.stdout,
          rateLimit: {
            limit: rateLimitResult.limit,
            remaining: rateLimitResult.remaining,
            resetAt: rateLimitResult.resetAt,
          },
        } as DebugResponse,
        { status: 200 }
      );
    } else {
      addStep(
        steps,
        'Execute Original Code',
        'error',
        originalExecution.timedOut ? 'Execution timed out' : 'Execution failed',
        {
          error: originalExecution.error,
          stderr: originalExecution.stderr,
          stdout: originalExecution.stdout,
          executionTime: originalExecution.executionTime,
        }
      );
    }

    // Step 5: Generate fix (execution failed)
    addStep(steps, 'Generate Fix', 'pending');
    const fixSuggestion = await suggestFix(originalCode);

    // Check if LLM detected malicious code
    if (fixSuggestion.is_malicious) {
      addStep(
        steps,
        'Generate Fix',
        'error',
        'Malicious code detected',
        { reason: fixSuggestion.malicious_reason }
      );

      return NextResponse.json(
        {
          success: false,
          steps,
          originalCode,
          error: `Code appears to be malicious: ${fixSuggestion.malicious_reason}`,
          rateLimit: {
            limit: rateLimitResult.limit,
            remaining: rateLimitResult.remaining,
            resetAt: rateLimitResult.resetAt,
          },
        } as DebugResponse,
        { status: 400 }
      );
    }

    addStep(
      steps,
      'Generate Fix',
      'success',
      `Fix generated with ${fixSuggestion.confidence} confidence`,
      {
        changes_made: fixSuggestion.changes_made,
        confidence: fixSuggestion.confidence,
      }
    );

    // Step 6: Execute fixed code
    addStep(steps, 'Execute Fixed Code', 'pending');
    const fixedExecution = await executeCode(fixSuggestion.fixed_code);

    if (fixedExecution.success) {
      addStep(
        steps,
        'Execute Fixed Code',
        'success',
        'Fixed code executed successfully',
        {
          stdout: fixedExecution.stdout,
          stderr: fixedExecution.stderr,
          executionTime: fixedExecution.executionTime,
        }
      );

      return NextResponse.json(
        {
          success: true,
          steps,
          originalCode,
          fixedCode: fixSuggestion.fixed_code,
          executionOutput: fixedExecution.stdout,
          rateLimit: {
            limit: rateLimitResult.limit,
            remaining: rateLimitResult.remaining,
            resetAt: rateLimitResult.resetAt,
          },
        } as DebugResponse,
        { status: 200 }
      );
    }

    // Step 7: Retry fix if first attempt failed
    addStep(
      steps,
      'Execute Fixed Code',
      'error',
      'Fixed code still fails',
      {
        error: fixedExecution.error,
        stderr: fixedExecution.stderr,
        stdout: fixedExecution.stdout,
      }
    );

    addStep(steps, 'Retry Fix', 'pending');
    const retryFix = await suggestFix(fixSuggestion.fixed_code);

    // Check if retry detected malicious code
    if (retryFix.is_malicious) {
      addStep(
        steps,
        'Retry Fix',
        'error',
        'Malicious code detected on retry',
        { reason: retryFix.malicious_reason }
      );

      return NextResponse.json(
        {
          success: false,
          steps,
          originalCode,
          error: `Code appears to be malicious: ${retryFix.malicious_reason}`,
          rateLimit: {
            limit: rateLimitResult.limit,
            remaining: rateLimitResult.remaining,
            resetAt: rateLimitResult.resetAt,
          },
        } as DebugResponse,
        { status: 400 }
      );
    }

    addStep(steps, 'Retry Fix', 'success', 'Generated second fix attempt');

    // Step 8: Execute retry
    addStep(steps, 'Execute Retry Fix', 'pending');
    const retryExecution = await executeCode(retryFix.fixed_code);

    if (retryExecution.success) {
      addStep(
        steps,
        'Execute Retry Fix',
        'success',
        'Retry fix executed successfully',
        {
          stdout: retryExecution.stdout,
          executionTime: retryExecution.executionTime,
        }
      );

      return NextResponse.json(
        {
          success: true,
          steps,
          originalCode,
          fixedCode: retryFix.fixed_code,
          executionOutput: retryExecution.stdout,
          rateLimit: {
            limit: rateLimitResult.limit,
            remaining: rateLimitResult.remaining,
            resetAt: rateLimitResult.resetAt,
          },
        } as DebugResponse,
        { status: 200 }
      );
    }

    // Both attempts failed
    addStep(
      steps,
      'Execute Retry Fix',
      'error',
      'Retry fix also failed',
      {
        error: retryExecution.error,
        stderr: retryExecution.stderr,
      }
    );

    return NextResponse.json(
      {
        success: false,
        steps,
        originalCode,
        fixedCode: retryFix.fixed_code,
        error: 'Unable to fix code after 2 attempts',
        rateLimit: {
          limit: rateLimitResult.limit,
          remaining: rateLimitResult.remaining,
          resetAt: rateLimitResult.resetAt,
        },
      } as DebugResponse,
      { status: 200 }
    );
  } catch (error: any) {
    // Unexpected error
    addStep(steps, 'Error', 'error', error.message || 'Unknown error');

    return NextResponse.json(
      {
        success: false,
        steps,
        originalCode,
        error: `Internal error: ${error.message || 'Unknown error'}`,
      } as DebugResponse,
      { status: 500 }
    );
  }
}
