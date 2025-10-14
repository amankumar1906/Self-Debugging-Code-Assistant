/**
 * Input sanitization and validation for code execution safety
 * Focus: Size limits and resource protection, not keyword blocking
 * Security is handled by isolated-vm sandbox
 */

// Maximum code size limits
const MAX_CODE_LENGTH = 10000; // 10KB max
const MAX_LINES = 500;

/**
 * Result of sanitization check
 */
export interface SanitizationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
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
 * Check for suspicious patterns that might indicate resource abuse
 * @param code - The code to check
 * @returns List of suspicious patterns found
 */
function checkSuspiciousPatterns(code: string): string[] {
  const warnings: string[] = [];

  // Check for very long lines (might be obfuscated or minified)
  const lines = code.split('\n');
  const longLines = lines.filter((line) => line.length > 500);
  if (longLines.length > 0) {
    warnings.push(`Found ${longLines.length} very long lines (potential obfuscation/minified code)`);
  }

  // Check for large base64-like strings (might be data bombs)
  if (/[A-Za-z0-9+/]{500,}={0,2}/.test(code)) {
    warnings.push('Found very large base64-like strings');
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

  // Check code size limits (prevent resource abuse)
  const sizeErrors = validateCodeSize(code);
  errors.push(...sizeErrors);

  // Check for suspicious patterns (warnings only)
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
