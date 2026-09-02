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
    method: 'smart-engine'
  };
};

// Intelligent Support Agent Chatbot Function
export const chatWithSupportAI = async (message, chatHistory = []) => {
  if (!message || message.trim().length === 0) {
    return "Please enter a question or concern so I can assist you!";
  }

  // 1. If Gemini API Key exists, use Gemini model
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here') {
    try {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

      const prompt = `You are SupportFlow's friendly, smart AI Customer Support Assistant.
You assist customers with technical issues, billing questions, worker bookings, ticket statuses, and general inquiries.
Be polite, professional, and concise (maximum 2-3 sentences).
Customer says: "${message}"
Support Agent response:`;

      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (err) {
      console.log('Gemini Chat error:', err.message);
    }
  }

  // 2. Intelligent Support Agent Assistant (Instant response)
  const lower = message.toLowerCase();
  if (lower.includes('status') || lower.includes('ticket') || lower.includes('track')) {
    return "You can view all your created tickets and their live status directly on your dashboard. Once a worker accepts or completes your task, you will receive an instant notification and can rate their service!";
  }
  if (lower.includes('book') || lower.includes('worker') || lower.includes('assign') || lower.includes('hire')) {
    return "To book a worker, click '+ Generate Ticket' at the top right. You can either select a specific registered worker from the list or let our AI auto-assign the best specialist for you!";
  }
  if (lower.includes('ac') || lower.includes('leak') || lower.includes('fridge') || lower.includes('appliance') || lower.includes('repair')) {
    return "For appliance repairs like air conditioning or refrigerators, create an 'Appliance' ticket. An appliance repair technician will be assigned to visit and resolve the problem.";
  }
  if (lower.includes('bill') || lower.includes('charge') || lower.includes('refund') || lower.includes('payment') || lower.includes('invoice')) {
    return "If you noticed an unexpected charge or billing problem, please generate a 'Billing' ticket with your invoice details. Our billing team will review and process corrections promptly.";
  }
  if (lower.includes('rate') || lower.includes('review') || lower.includes('star')) {
    return "Once a worker marks your task as completed, a 5-Star rating popup will automatically appear on your screen so you can rate your experience and provide feedback!";
  }
  if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey') || lower.includes('salam') || lower.includes('help')) {
    return "Hello! 👋 I am your SupportFlow AI Support Assistant. How can I help you today? You can ask me about creating tickets, booking workers, or tracking task status!";
  }
  return "I understand your concern! You can easily report this by clicking '+ Generate Ticket' at the top right. Our AI will classify the urgency and connect you with the right specialist right away.";
};

