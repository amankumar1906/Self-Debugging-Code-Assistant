import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Gemini API client configuration and utility functions
 */

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Model configuration
const MODEL_NAME = 'gemini-2.0-flash-lite';

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
  is_malicious: boolean;
  malicious_reason?: string;
  reasoning: string[]; // Chain-of-thought steps
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Check if it's a rate limit error from Gemini
    if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('rate limit')) {
      throw new Error('Heavy server load, please retry in an hour');
    }

    throw new Error(`Failed to analyze code: ${errorMessage}`);
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

    // CACHE-OPTIMIZED PROMPT STRUCTURE
    // Static instructions first, dynamic content last
    const staticPrefix = `You are a JavaScript debugging assistant.

EXECUTION ENVIRONMENT:
The user's code will be executed in an isolated sandbox (isolated-vm) with:
- ✅ 10-second timeout
- ✅ 16MB memory limit
- ✅ No access to Node.js APIs (require, fs, process, etc. will return "not defined")
- ✅ Pure JavaScript execution (like browser environment)

TASK:
Your job is to fix bugs in the code. The sandbox is secure, so you can assume:
- Any Node.js API calls (require, fs, etc.) will simply fail with "X is not defined"
- setTimeout/eval/async won't work but aren't security threats
- Focus on fixing LOGIC bugs, not removing API calls

SECURITY POLICY:
ONLY set is_malicious=true if the code is deliberately obfuscated or attempting obvious exploits (base64 payloads, hex shellcode, etc.).
DO NOT flag code just because it uses require() or process - those will harmlessly fail in the sandbox.

OUTPUT FORMAT:
Respond ONLY with valid JSON in this exact format (no markdown, no extra text):
{
  "is_malicious": true/false,
  "malicious_reason": "Explanation if malicious" (only if is_malicious=true),
  "reasoning": [
    "Step 1: What I observed about the code",
    "Step 2: What the error message tells me",
    "Step 3: Root cause analysis",
    "Step 4: My solution approach"
  ],
  "fixed_code": "Complete corrected JavaScript code" (empty string if malicious),
  "changes_made": ["Change 1", "Change 2"] (empty array if malicious),
  "confidence": "high/medium/low"
}

IMPORTANT:
- Always include "reasoning" array with 3-5 step-by-step thoughts explaining your debugging process
- If is_malicious=true, leave fixed_code as empty string and reasoning as empty array
- Be conversational in reasoning - explain like teaching a student

---

USER SUBMISSION:`;

    // Dynamic content
    let dynamicSuffix = `

CODE TO DEBUG:
\`\`\`javascript
${code}
\`\`\``;

    if (analysisResult) {
      dynamicSuffix += `

KNOWN ISSUE:
- Bug: ${analysisResult.bug_description}
- Location: ${analysisResult.bug_location}
- Suggested Fix: ${analysisResult.suggested_fix}`;
    }

    const prompt = staticPrefix + dynamicSuffix;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    // Parse JSON response
    const cleanedText = text.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '');
    const fixSuggestion: FixSuggestionResult = JSON.parse(cleanedText);

    return fixSuggestion;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Check if it's a rate limit error from Gemini
    if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('rate limit')) {
      throw new Error('Heavy server load, please retry in an hour');
    }

    throw new Error(`Failed to generate fix: ${errorMessage}`);
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
 * Stream fix suggestion with Chain-of-Thought reasoning
 * @param code - The original buggy JavaScript code
 * @param errorMessage - The execution error message
 * @returns Async generator yielding reasoning chunks
 */
export async function* suggestFixStream(
  code: string,
  errorMessage: string
): AsyncGenerator<string, void, unknown> {
  try {
    const model = getModel();

    // CACHE-OPTIMIZED PROMPT STRUCTURE
    // Put static instructions first (cacheable), dynamic content last
    const staticPrefix = `You are a debugging assistant helping users fix JavaScript code errors.

DEBUGGING METHODOLOGY:
When analyzing code failures, follow this process:
1. Examine the error message to identify the error type and location
2. Analyze the code logic to find the root cause
3. Determine the minimal change needed to fix the issue

OUTPUT FORMAT (STRICT - DO NOT DEVIATE):
Write ONLY 2-3 sentences explaining the error and fix. DO NOT write any code, variable names, or code snippets in this part.

Then start a code block with the complete fixed code.

Example (FOLLOW EXACTLY):
The error indicates an assignment operator where a comparison is needed. The root cause is using a single equals sign in the conditional. I'll replace it with triple equals for strict comparison.

\`\`\`javascript
if (x === 5) {
  console.log("works");
}
\`\`\`

CRITICAL: Do NOT include ANY code before the code block. Only plain English explanation.

---

USER REQUEST:`;

    // Dynamic content appended at the end
    const dynamicSuffix = `

ERROR ENCOUNTERED:
${errorMessage}

CODE TO DEBUG:
\`\`\`javascript
${code}
\`\`\``;

    const prompt = staticPrefix + dynamicSuffix;

    const result = await model.generateContentStream(prompt);

    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        yield text;
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during fix generation';

    // Check if it's a rate limit error from Gemini
    if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('rate limit')) {
      yield 'Heavy server load, please retry in an hour';
    } else {
      yield `Error: ${errorMessage}`;
    }
  }
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
