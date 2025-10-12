import ivm from 'isolated-vm';

/**
 * Maximum execution time in milliseconds
 */
const EXECUTION_TIMEOUT = 5000; // 5 seconds

/**
 * Maximum output buffer size (100KB)
 */
const MAX_BUFFER = 100 * 1024;

/**
 * Result of code execution in sandbox
 */
export interface ExecutionResult {
  success: boolean;
  stdout: string;
  stderr: string;
  error?: string;
  exitCode?: number;
  timedOut: boolean;
  executionTime: number;
}

/**
 * Execute JavaScript code in an isolated VM sandbox
 * Uses isolated-vm for true V8 isolation with no access to Node.js APIs
 * @param code - JavaScript code to execute
 * @returns Execution result with stdout/stderr
 */
async function executeJavaScript(code: string): Promise<ExecutionResult> {
  const startTime = Date.now();
  const outputs: string[] = [];
  const errors: string[] = [];

  try {
    // Create isolated VM with memory limit (16MB)
    const isolate = new ivm.Isolate({ memoryLimit: 16 });
    const context = await isolate.createContext();

    // Inject a safe console.log implementation
    const jail = context.global;
    await jail.set('global', jail.derefInto());

    // Create console.log that captures output
    await jail.set('_captureOutput', new ivm.Reference((text: string) => {
      outputs.push(String(text));
    }));

    await jail.set('_captureError', new ivm.Reference((text: string) => {
      errors.push(String(text));
    }));

    // Setup console object
    await context.eval(`
      global.console = {
        log: (...args) => {
          const message = args.map(arg => {
            if (typeof arg === 'object') {
              try {
                return JSON.stringify(arg);
              } catch (e) {
                return String(arg);
              }
            }
            return String(arg);
          }).join(' ');
          _captureOutput.applySync(undefined, [message]);
        },
        error: (...args) => {
          const message = args.map(arg => String(arg)).join(' ');
          _captureError.applySync(undefined, [message]);
        }
      };
    `);

    // Wrap user code to catch errors
    const wrappedCode = `
      try {
        ${code}
      } catch (error) {
        _captureError.applySync(undefined, [error.message || String(error)]);
        throw error;
      }
    `;

    // Execute code with timeout
    const script = await isolate.compileScript(wrappedCode);
    await script.run(context, { timeout: EXECUTION_TIMEOUT });

    const executionTime = Date.now() - startTime;

    // Dispose of isolate
    isolate.dispose();

    return {
      success: true,
      stdout: outputs.join('\n'),
      stderr: errors.join('\n'),
      exitCode: 0,
      timedOut: false,
      executionTime,
    };
  } catch (error: any) {
    const executionTime = Date.now() - startTime;

    // Check if timeout occurred
    const timedOut = error.message?.includes('Script execution timed out');

    return {
      success: false,
      stdout: outputs.join('\n'),
      stderr: errors.join('\n'),
      error: timedOut
        ? `Execution timed out after ${EXECUTION_TIMEOUT}ms`
        : error.message || 'Unknown execution error',
      exitCode: 1,
      timedOut,
      executionTime,
    };
  }
}

/**
 * Execute JavaScript code in a sandboxed environment
 * @param code - JavaScript code to execute
 * @returns Execution result with stdout/stderr and timing info
 */
export async function executeCode(code: string): Promise<ExecutionResult> {
  // Validate inputs
  if (!code || code.trim().length === 0) {
    return {
      success: false,
      stdout: '',
      stderr: '',
      error: 'Code cannot be empty',
      timedOut: false,
      executionTime: 0,
    };
  }

  return executeJavaScript(code);
}

/**
 * Execute code and throw error if execution fails
 * @param code - JavaScript code to execute
 * @returns Execution result
 * @throws Error if execution fails
 */
export async function executeCodeOrThrow(code: string): Promise<ExecutionResult> {
  const result = await executeCode(code);

  if (!result.success) {
    throw new Error(
      `Code execution failed: ${result.error || result.stderr || 'Unknown error'}`
    );
  }

  return result;
}

/**
 * Get execution timeout in milliseconds
 * @returns Timeout value
 */
export function getExecutionTimeout(): number {
  return EXECUTION_TIMEOUT;
}

/**
 * Get maximum output buffer size in bytes
 * @returns Buffer size
 */
export function getMaxBufferSize(): number {
  return MAX_BUFFER;
}
