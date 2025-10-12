/**
 * Input sanitization and validation for code execution safety
 */

// Maximum code size limits
const MAX_CODE_LENGTH = 10000; // 10KB max
const MAX_LINES = 500;

/**
 * Dangerous JavaScript patterns that should be blocked
 * These can access Node.js APIs, execute arbitrary code, or cause issues
 */
const DANGEROUS_PATTERNS = [
  // Node.js module imports (shouldn't exist in isolated-vm but block anyway)
  'require(',
  'import(',
  'import ',
  'from ',

  // Dangerous functions
  'eval(',
  'Function(',
  'setTimeout(',
  'setInterval(',
  'setImmediate(',

  // Process/system access
  'process.',
  'global.',
  '__dirname',
  '__filename',

  // Constructor tricks to break sandbox
  'constructor.constructor',
  '.constructor(',
  'this.constructor',

  // Prototype pollution
  '__proto__',
  'prototype.constructor',

  // Common Node.js globals
  'Buffer',
  'module',
  'exports',
  'globalThis',
];

/**
 * Result of sanitization check
 */
export interface SanitizationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate that code appears to be JavaScript
 * @param code - The code to analyze
 * @returns true if code looks like JavaScript
 */
export function isJavaScript(code: string): boolean {
  const trimmedCode = code.trim();

  // Check for JavaScript indicators
  const hasJSPatterns =
    /function\s+\w+\s*\(/m.test(trimmedCode) ||
    /const\s+\w+\s*=/m.test(trimmedCode) ||
    /let\s+\w+\s*=/m.test(trimmedCode) ||
    /var\s+\w+\s*=/m.test(trimmedCode) ||
    /console\.log\s*\(/m.test(trimmedCode) ||
    /=>\s*[{(]/m.test(trimmedCode) ||
    /class\s+\w+/m.test(trimmedCode);

  // Check for non-JavaScript indicators (Python, etc.)
  const hasPythonPatterns =
    /def\s+\w+\s*\(/m.test(trimmedCode) ||
    /import\s+\w+/m.test(trimmedCode) ||
    /print\s*\(/m.test(trimmedCode);

  return hasJSPatterns || !hasPythonPatterns;
}

/**
 * Check if code contains dangerous JavaScript patterns
 * @param code - The code to check
 * @returns List of detected dangerous patterns
 */
function checkDangerousPatterns(code: string): string[] {
  const detected: string[] = [];

  for (const pattern of DANGEROUS_PATTERNS) {
    if (code.includes(pattern)) {
      detected.push(pattern);
    }
  }

  return detected;
}

/**
 * Validate code size limits
 * @param code - The code to check
 * @returns Error messages if limits exceeded
 */
function validateCodeSize(code: string): string[] {
  const errors: string[] = [];

  if (code.length > MAX_CODE_LENGTH) {
    errors.push(
      `Code exceeds maximum length of ${MAX_CODE_LENGTH} characters (got ${code.length})`
    );
  }

  const lineCount = code.split('\n').length;
  if (lineCount > MAX_LINES) {
    errors.push(`Code exceeds maximum of ${MAX_LINES} lines (got ${lineCount})`);
  }

  return errors;
}

/**
 * Check for suspicious patterns that might indicate malicious code
 * @param code - The code to check
 * @returns List of suspicious patterns found
 */
function checkSuspiciousPatterns(code: string): string[] {
  const warnings: string[] = [];

  // Check for very long lines (might be obfuscated)
  const lines = code.split('\n');
  const longLines = lines.filter((line) => line.length > 200);
  if (longLines.length > 0) {
    warnings.push(`Found ${longLines.length} unusually long lines (potential obfuscation)`);
  }

  // Check for base64-like strings (might be encoded payloads)
  if (/[A-Za-z0-9+/]{50,}={0,2}/.test(code)) {
    warnings.push('Found base64-like strings (potential encoded payload)');
  }

  // Check for hex strings (might be shellcode)
  if (/\\x[0-9a-fA-F]{2}/.test(code) || /0x[0-9a-fA-F]{8,}/.test(code)) {
    warnings.push('Found hex-encoded strings (potential shellcode)');
  }

  return warnings;
}

/**
 * Main sanitization function - validates JavaScript code for safety
 * @param code - The JavaScript code to sanitize
 * @returns Sanitization result with validation status and messages
 */
export function sanitizeCode(code: string): SanitizationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Basic validation
  if (!code || code.trim().length === 0) {
    errors.push('Code cannot be empty');
    return { isValid: false, errors, warnings };
  }

  // Check if code appears to be JavaScript
  if (!isJavaScript(code)) {
    errors.push('Code does not appear to be valid JavaScript. Only JavaScript is supported.');
  }

  // Check code size limits
  const sizeErrors = validateCodeSize(code);
  errors.push(...sizeErrors);

  // Check for dangerous patterns
  const dangerousPatterns = checkDangerousPatterns(code);
  if (dangerousPatterns.length > 0) {
    errors.push(
      `Code contains dangerous patterns: ${dangerousPatterns.slice(0, 3).join(', ')}${
        dangerousPatterns.length > 3 ? '...' : ''
      }`
    );
  }

  // Check for suspicious patterns
  const suspiciousPatterns = checkSuspiciousPatterns(code);
  warnings.push(...suspiciousPatterns);

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Sanitize code and throw error if invalid
 * @param code - The JavaScript code to sanitize
 * @throws Error if code is invalid
 */
export function sanitizeCodeOrThrow(code: string): void {
  const result = sanitizeCode(code);

  if (!result.isValid) {
    throw new Error(`Code validation failed:\n${result.errors.join('\n')}`);
  }

  if (result.warnings.length > 0) {
    console.warn('Code validation warnings:', result.warnings);
  }
}

/**
 * Get list of all blocked JavaScript patterns
 * @returns Array of dangerous patterns
 */
export function getDangerousPatterns(): string[] {
  return [...DANGEROUS_PATTERNS];
}

/**
 * Check if a specific pattern is dangerous
 * @param pattern - The pattern to check
 * @returns true if pattern is in the dangerous list
 */
export function isDangerousPattern(pattern: string): boolean {
  return DANGEROUS_PATTERNS.some((p) => pattern.includes(p));
}
