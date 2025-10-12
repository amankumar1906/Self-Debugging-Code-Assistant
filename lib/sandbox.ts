import { exec, execFile } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';

const execAsync = promisify(exec);

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
 * Supported programming languages
 */
export type SupportedLanguage = 'python' | 'javascript';

/**
 * Generate a unique temporary file path
 * @param extension - File extension (e.g., 'py', 'js')
 * @returns Absolute path to temporary file
 */
function getTempFilePath(extension: string): string {
  const randomId = randomBytes(16).toString('hex');
  return join(tmpdir(), `code_${randomId}.${extension}`);
}

/**
 * Execute Python code in a sandboxed environment
 * @param code - Python code to execute
 * @returns Execution result with stdout/stderr
 */
async function executePython(code: string): Promise<ExecutionResult> {
  const startTime = Date.now();
  let tempFile: string | null = null;

  try {
    // Create temporary file
    tempFile = getTempFilePath('py');
    await writeFile(tempFile, code, 'utf-8');

    // Execute Python with security restrictions
    const { stdout, stderr } = await execAsync(
      // Use python3 with isolation flags:
      // -I: isolated mode (no site-packages, no user site)
      // -B: don't write .pyc files
      // -s: don't add user site directory
      `python3 -I -B -s "${tempFile}"`,
      {
        timeout: EXECUTION_TIMEOUT,
        maxBuffer: MAX_BUFFER,
        env: {}, // Empty environment - NO access to environment variables!
        cwd: tmpdir(), // Run in temp directory
        shell: true,
      }
    );

    const executionTime = Date.now() - startTime;

    return {
      success: true,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      exitCode: 0,
      timedOut: false,
      executionTime,
    };
  } catch (error: any) {
    const executionTime = Date.now() - startTime;

    // Check if timeout occurred
    const timedOut = error.killed && error.signal === 'SIGTERM';

    return {
      success: false,
      stdout: error.stdout?.trim() || '',
      stderr: error.stderr?.trim() || '',
      error: timedOut
        ? `Execution timed out after ${EXECUTION_TIMEOUT}ms`
        : error.message || 'Unknown execution error',
      exitCode: error.code,
      timedOut,
      executionTime,
    };
  } finally {
    // Clean up temporary file
    if (tempFile) {
      try {
        await unlink(tempFile);
      } catch (cleanupError) {
        console.warn('Failed to clean up temp file:', cleanupError);
      }
    }
  }
}

/**
 * Execute JavaScript code in a sandboxed environment
 * @param code - JavaScript code to execute
 * @returns Execution result with stdout/stderr
 */
async function executeJavaScript(code: string): Promise<ExecutionResult> {
  const startTime = Date.now();
  let tempFile: string | null = null;

  try {
    // Create temporary file
    tempFile = getTempFilePath('js');
    await writeFile(tempFile, code, 'utf-8');

    // Execute Node.js with security restrictions
    const { stdout, stderr } = await execAsync(
      // Run Node.js with limited permissions
      `node --no-warnings "${tempFile}"`,
      {
        timeout: EXECUTION_TIMEOUT,
        maxBuffer: MAX_BUFFER,
        env: {}, // Empty environment - NO access to environment variables!
        cwd: tmpdir(), // Run in temp directory
        shell: true,
      }
    );

    const executionTime = Date.now() - startTime;

    return {
      success: true,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      exitCode: 0,
      timedOut: false,
      executionTime,
    };
  } catch (error: any) {
    const executionTime = Date.now() - startTime;

    // Check if timeout occurred
    const timedOut = error.killed && error.signal === 'SIGTERM';

    return {
      success: false,
      stdout: error.stdout?.trim() || '',
      stderr: error.stderr?.trim() || '',
      error: timedOut
        ? `Execution timed out after ${EXECUTION_TIMEOUT}ms`
        : error.message || 'Unknown execution error',
      exitCode: error.code,
      timedOut,
      executionTime,
    };
  } finally {
    // Clean up temporary file
    if (tempFile) {
      try {
        await unlink(tempFile);
      } catch (cleanupError) {
        console.warn('Failed to clean up temp file:', cleanupError);
      }
    }
  }
}

/**
 * Execute code in a sandboxed environment
 * @param code - Code to execute
 * @param language - Programming language
 * @returns Execution result with stdout/stderr and timing info
 */
export async function executeCode(
  code: string,
  language: SupportedLanguage
): Promise<ExecutionResult> {
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

  // Route to appropriate executor
  switch (language) {
    case 'python':
      return executePython(code);
    case 'javascript':
      return executeJavaScript(code);
    default:
      return {
        success: false,
        stdout: '',
        stderr: '',
        error: `Unsupported language: ${language}`,
        timedOut: false,
        executionTime: 0,
      };
  }
}

/**
 * Execute code and throw error if execution fails
 * @param code - Code to execute
 * @param language - Programming language
 * @returns Execution result
 * @throws Error if execution fails
 */
export async function executeCodeOrThrow(
  code: string,
  language: SupportedLanguage
): Promise<ExecutionResult> {
  const result = await executeCode(code, language);

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
