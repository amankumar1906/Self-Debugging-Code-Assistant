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
 * Interface for code analysis result
 */
export interface CodeAnalysisResult {
  bug_description: string;
  bug_location: string;
  suggested_fix: string;
  explanation: string;
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
 * Analyze buggy code and identify issues
 * @param code - The buggy code to analyze
 * @param language - Programming language (e.g., 'python', 'javascript')
 * @returns Analysis result with bug details and suggestions
 */
export async function analyzeCode(
  code: string,
  language: string = 'python'
): Promise<CodeAnalysisResult> {
  try {
    const model = getModel();

    const prompt = `You are a code debugging assistant. Analyze the following ${language} code and identify bugs.

CODE:
\`\`\`${language}
${code}
\`\`\`

Respond ONLY with valid JSON in this exact format (no markdown, no extra text):
{
  "bug_description": "Clear description of the bug",
  "bug_location": "Line number or function where bug exists",
  "suggested_fix": "Specific fix recommendation",
  "explanation": "Why this is a bug and how the fix works",
  "test_case": "A simple test case to verify the fix (optional)"
}`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    // Parse JSON response
    const cleanedText = text.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '');
    const analysis: CodeAnalysisResult = JSON.parse(cleanedText);

    return analysis;
  } catch (error) {
    throw new Error(
      `Failed to analyze code: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Generate a fixed version of the buggy code
 * @param code - The original buggy code
 * @param analysisResult - Previous analysis result (optional)
 * @param language - Programming language
 * @returns Fixed code with explanation
 */
export async function suggestFix(
  code: string,
  analysisResult?: CodeAnalysisResult,
  language: string = 'python'
): Promise<FixSuggestionResult> {
  try {
    const model = getModel();

    let prompt = `You are a code debugging assistant. Fix the following buggy ${language} code.

ORIGINAL CODE:
\`\`\`${language}
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
  "fixed_code": "Complete corrected code",
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
