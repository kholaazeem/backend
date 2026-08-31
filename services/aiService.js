import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Keyword Array Fallback Engine
 * Pre-defined rule arrays for instant categorization & urgency scoring
 */
const KEYWORD_RULES = [
  {
    category: 'Billing',
    keywords: ['charge', 'payment', 'refund', 'double', 'invoice', 'money', 'card', 'bank', 'cost', 'fee', 'price'],
    defaultUrgency: 'High'
  },
  {
    category: 'Technical',
    keywords: ['bug', 'crash', 'error', 'slow', 'loading', 'login', 'failed', 'code', 'server', 'down', 'broken', 'not working'],
    defaultUrgency: 'High'
  },
  {
    category: 'Appliance',
    keywords: ['ac', 'fridge', 'leaking', 'cooling', 'water', 'repair', 'fan', 'machine', 'heater', 'wire', 'pipe'],
    defaultUrgency: 'Medium'
  },
  {
    category: 'Account',
    keywords: ['password', 'otp', 'email', 'profile', 'security', 'hack', 'block', 'verify', 'account'],
    defaultUrgency: 'Medium'
  }
];

export const analyzeComplaintAI = async (description, subject = '') => {
  const fullText = `${subject} ${description}`.toLowerCase();
  
  // 1. TRY PRIMARY: Google Gemini API
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here') {
    try {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      
      const prompt = `Analyze this customer support complaint and return ONLY a valid JSON object with keys:
"predictedCategory" (must be one of: "Billing", "Technical", "Account", "Appliance", "General"),
"suggestedUrgency" (must be one of: "Low", "Medium", "High"),
"aiSummary" (a concise 1-sentence summary of the issue).

Complaint text: "${fullText}"`;

      const result = await model.generateContent(prompt);
      const textResponse = result.response.text();
      
      // Clean JSON markers if present
      const cleanJsonStr = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJsonStr);

      return {
        predictedCategory: parsed.predictedCategory || 'General',
        suggestedUrgency: parsed.suggestedUrgency || 'Medium',
        aiSummary: parsed.aiSummary || description.substring(0, 100) + '...',
        method: 'gemini'
      };
    } catch (geminiError) {
      console.log('⚠️ Gemini API unavailable/timed out. Switching to Keyword Fallback Engine:', geminiError.message);
    }
  }

  // 2. FALLBACK: Keyword Array Matching Engine
  console.log('🤖 Running Keyword Array Fallback Engine for AI Triage...');
  
  let matchedCategory = 'General';
  let matchedUrgency = 'Low';
  let matchedKeywords = [];

  for (const rule of KEYWORD_RULES) {
    const hits = rule.keywords.filter(kw => fullText.includes(kw));
    if (hits.length > 0) {
      matchedCategory = rule.category;
      matchedUrgency = rule.defaultUrgency;
      matchedKeywords = hits;
      break;
    }
  }

  // Generate intelligent fallback summary
  let aiSummary = `Customer reported issue regarding ${matchedCategory.toLowerCase()}`;
  if (matchedKeywords.length > 0) {
    aiSummary += ` (Keywords detected: ${matchedKeywords.join(', ')})`;
  } else {
    aiSummary += `: "${description.substring(0, 80)}..."`;
  }

  return {
    predictedCategory: matchedCategory,
    suggestedUrgency: matchedUrgency,
    aiSummary,
    method: 'keyword-fallback'
  };
};
