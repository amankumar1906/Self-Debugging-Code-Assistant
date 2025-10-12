import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Gemini API client configuration and utility functions
 */

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Model configuration
const MODEL_NAME = 'gemini-1.5-flash';

/**
 * Get Gemini model instance
 */
function getModel() {
  return genAI.getGenerativeModel({ model: MODEL_NAME });
}

/**
 * Interface for code analysis result with mandatory safety check
 */
export interface CodeAnalysisResult {
  is_safe: boolean;
  safety_issues?: string[];
  has_bugs: boolean;
  bug_description?: string;
  bug_location?: string;
  suggested_fix?: string;
  explanation?: string;
  test_case?: string;
}

/**
 * Interface for fix suggestion result
 */
export interface FixSuggestionResult {
  fixed_code: string;
  changes_made: string[];
  confidence: string;
}

/**
 * Analyze JavaScript code for safety and bugs (SECURITY-FIRST approach)
 * This function MUST be called before executing any user-submitted code.
 *
 * @param code - The JavaScript code to analyze
 * @returns Analysis result with safety validation and bug details
 * @throws Error if LLM call fails or response is invalid
 */
export async function analyzeCode(code: string): Promise<CodeAnalysisResult> {
  try {
    const model = getModel();

    const prompt = `You are a security-aware JavaScript debugging assistant. Your PRIMARY job is to validate code safety BEFORE analyzing bugs.

CODE TO ANALYZE:
\`\`\`javascript
${code}
\`\`\`

CRITICAL SECURITY CHECK (Step 1):
Check if this JavaScript code is SAFE to execute in an isolated-vm sandbox (no Node.js APIs available). Look for:
- Attempts to access Node.js APIs (require, import, Buffer, process, fs, etc.)
- Dangerous functions (eval, Function constructor, setTimeout, setInterval)
- Constructor tricks to escape sandbox (constructor.constructor, __proto__, prototype pollution)
- Obfuscation attempts (base64, hex encoding, string concatenation to hide dangerous calls)
- Resource exhaustion (infinite loops, memory bombs with large arrays/objects)
- Any other malicious patterns or sandbox escape attempts

BUG ANALYSIS (Step 2 - only if code is safe):
If the code is safe, analyze it for bugs and logic errors common in JavaScript:
- Syntax errors
- Type errors (undefined variables, wrong types)
- Logic errors (wrong conditions, off-by-one errors)
- Reference errors
- Runtime errors

Respond ONLY with valid JSON in this exact format (no markdown, no extra text):
{
  "is_safe": true/false,
  "safety_issues": ["issue1", "issue2"] (if unsafe, list all issues found),
  "has_bugs": true/false,
  "bug_description": "Clear description of the bug" (if has_bugs=true),
  "bug_location": "Line number or function where bug exists" (if has_bugs=true),
  "suggested_fix": "Specific fix recommendation" (if has_bugs=true),
  "explanation": "Why this is a bug and how the fix works" (if has_bugs=true),
  "test_case": "A simple test case to verify the fix" (optional)
}

IMPORTANT: If is_safe=false, you MUST NOT proceed with bug analysis. Set has_bugs=false and only fill safety_issues.`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    // Parse JSON response
    const cleanedText = text.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '');
    const analysis: CodeAnalysisResult = JSON.parse(cleanedText);

    // Validate required fields
    if (typeof analysis.is_safe !== 'boolean' || typeof analysis.has_bugs !== 'boolean') {
      throw new Error('Invalid LLM response: missing required safety/bug flags');
    }

    return analysis;
  } catch (error) {
    throw new Error(
      `Failed to analyze code: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Generate a fixed version of the buggy JavaScript code
 * @param code - The original buggy JavaScript code
 * @param analysisResult - Previous analysis result (optional)
 * @returns Fixed code with explanation
 */
export async function suggestFix(
  code: string,
  analysisResult?: CodeAnalysisResult
): Promise<FixSuggestionResult> {
  try {
    const model = getModel();

    let prompt = `You are a JavaScript debugging assistant. Fix the following buggy JavaScript code.

ORIGINAL CODE:
\`\`\`javascript
${code}
\`\`\`
`;

    if (analysisResult) {
      prompt += `
KNOWN ISSUE:
- Bug: ${analysisResult.bug_description}
- Location: ${analysisResult.bug_location}
- Suggested Fix: ${analysisResult.suggested_fix}
`;
    }

    prompt += `
Respond ONLY with valid JSON in this exact format (no markdown, no extra text):
{
  "fixed_code": "Complete corrected JavaScript code",
  "changes_made": ["Change 1", "Change 2"],
  "confidence": "high/medium/low"
}`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    // Parse JSON response
    const cleanedText = text.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '');
    const fixSuggestion: FixSuggestionResult = JSON.parse(cleanedText);

    return fixSuggestion;
  } catch (error) {
    throw new Error(
      `Failed to generate fix: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Validate if Gemini API is properly configured
 * @returns true if API key is set
 */
export function isGeminiConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

/**
 * Test Gemini connection
 * @returns true if connection is successful
 */
export async function testConnection(): Promise<boolean> {
  try {
    const model = getModel();
    const result = await model.generateContent('Hello');
    return !!result.response.text();
  } catch (error) {
    console.error('Gemini connection test failed:', error);
    return false;
  }
}
