/**
 * Input sanitization and validation for code execution safety
 */

// Maximum code size limits
const MAX_CODE_LENGTH = 10000; // 10KB max
const MAX_LINES = 500;

/**
 * Dangerous imports/modules that should be blocked
 * These can access filesystem, network, or system resources
 */
const DANGEROUS_PATTERNS = {
  python: [
    'import os',
    'from os',
    'import sys',
    'from sys',
    'import subprocess',
    'from subprocess',
    'import socket',
    'from socket',
    'import requests',
    'from requests',
    'import urllib',
    'from urllib',
    'import shutil',
    'from shutil',
    'import pathlib',
    'from pathlib',
    '__import__',
    'eval(',
    'exec(',
    'compile(',
    'open(',
    'file(',
    'input(',
    'raw_input(',
  ],
  javascript: [
    'require(',
    'import(',
    'eval(',
    'Function(',
    'require("fs")',
    'require("child_process")',
    'require("net")',
    'require("http")',
    'require("https")',
    'require("os")',
    'require("process")',
    'process.exit',
    'process.env',
    'require(\'fs\')',
    'require(\'child_process\')',
    'require(\'net\')',
    'require(\'http\')',
    'require(\'https\')',
    'require(\'os\')',
    'require(\'process\')',
  ],
};

/**
 * Result of sanitization check
 */
export interface SanitizationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Detect programming language from code content
 * @param code - The code to analyze
 * @returns Detected language or 'unknown'
 */
export function detectLanguage(code: string): 'python' | 'javascript' | 'unknown' {
  const trimmedCode = code.trim();

  // Python indicators
  if (
    /def\s+\w+\s*\(/m.test(trimmedCode) ||
    /import\s+\w+/m.test(trimmedCode) ||
    /print\s*\(/m.test(trimmedCode) ||
    /:\s*$/m.test(trimmedCode)
  ) {
    return 'python';
  }

  // JavaScript indicators
  if (
    /function\s+\w+\s*\(/m.test(trimmedCode) ||
    /const\s+\w+\s*=/m.test(trimmedCode) ||
    /let\s+\w+\s*=/m.test(trimmedCode) ||
    /console\.log\s*\(/m.test(trimmedCode) ||
    /=>\s*{/m.test(trimmedCode)
  ) {
    return 'javascript';
  }

  return 'unknown';
}

/**
 * Check if code contains dangerous patterns
 * @param code - The code to check
 * @param language - Programming language
 * @returns List of detected dangerous patterns
 */
function checkDangerousPatterns(code: string, language: string): string[] {
  const patterns = DANGEROUS_PATTERNS[language as keyof typeof DANGEROUS_PATTERNS] || [];
  const detected: string[] = [];

  for (const pattern of patterns) {
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
 * Main sanitization function - validates and checks code for safety
 * @param code - The code to sanitize
 * @param language - Optional language hint ('python' or 'javascript')
 * @returns Sanitization result with validation status and messages
 */
export function sanitizeCode(code: string, language?: string): SanitizationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Basic validation
  if (!code || code.trim().length === 0) {
    errors.push('Code cannot be empty');
    return { isValid: false, errors, warnings };
  }

  // Detect language if not provided
  const detectedLanguage = language || detectLanguage(code);
  if (detectedLanguage === 'unknown' && !language) {
    warnings.push('Could not detect programming language - limited validation applied');
  }

  // Check code size limits
  const sizeErrors = validateCodeSize(code);
  errors.push(...sizeErrors);

  // Check for dangerous patterns
  const dangerousPatterns = checkDangerousPatterns(code, detectedLanguage);
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
 * @param code - The code to sanitize
 * @param language - Optional language hint
 * @throws Error if code is invalid
 */
export function sanitizeCodeOrThrow(code: string, language?: string): void {
  const result = sanitizeCode(code, language);

  if (!result.isValid) {
    throw new Error(`Code validation failed:\n${result.errors.join('\n')}`);
  }

  if (result.warnings.length > 0) {
    console.warn('Code validation warnings:', result.warnings);
  }
}

/**
 * Get list of blocked patterns for a language
 * @param language - Programming language
 * @returns Array of dangerous patterns
 */
export function getDangerousPatterns(language: string): string[] {
  return DANGEROUS_PATTERNS[language as keyof typeof DANGEROUS_PATTERNS] || [];
}

/**
 * Check if a specific pattern is dangerous
 * @param pattern - The pattern to check
 * @param language - Programming language
 * @returns true if pattern is in the dangerous list
 */
export function isDangerousPattern(pattern: string, language: string): boolean {
  const patterns = DANGEROUS_PATTERNS[language as keyof typeof DANGEROUS_PATTERNS] || [];
  return patterns.some((p) => pattern.includes(p));
}
