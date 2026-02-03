import { FakeAgentConfig } from '../config';
import { DetectedAttack } from './injection-detector';

export class FakeAgent {
  private config: FakeAgentConfig;
  private responseTemplates: Map<string, string[]>;

  constructor(config: FakeAgentConfig) {
    this.config = config;
    this.responseTemplates = this.initializeTemplates();
  }

  async generateResponse(userMessage: string, detectedAttacks: DetectedAttack[]): Promise<string> {
    // If attacks detected, generate appropriate rejection/deflection
    if (detectedAttacks.length > 0) {
      return this.generateRejectionResponse(detectedAttacks);
    }

    // Generate contextual fake response based on message content
    return this.generateContextualResponse(userMessage);
  }

  private generateRejectionResponse(attacks: DetectedAttack[]): string {
    const severity = Math.max(...attacks.map(a => this.getSeverityScore(a.severity)));
    const primaryAttack = attacks[0];

    // Select response based on attack type
    const templates = this.responseTemplates.get(primaryAttack?.type || 'default') ||
                     this.responseTemplates.get('default')!;

    let response = templates[Math.floor(Math.random() * templates.length)] || templates[0] || '';

    // Add personality flavor based on config
    if (this.config.personality === 'helpful') {
      response += '\n\nIs there something else I can help you with today?';
    } else if (this.config.personality === 'cautious') {
      response += '\n\nFor security reasons, I cannot process requests that appear to manipulate my instructions.';
    }

    return response;
  }

  private generateContextualResponse(message: string): string {
    const lowerMessage = message.toLowerCase();

    // Greeting responses
    if (this.matchesAny(lowerMessage, ['hello', 'hi', 'hey', 'greetings', 'good morning', 'good afternoon'])) {
      return this.pickRandom([
        "Hello! I'm OpenClaw, your AI assistant. How can I help you today?",
        "Hi there! Welcome to OpenClaw. What would you like to discuss?",
        "Greetings! I'm here to assist you. What can I do for you?",
      ]);
    }

    // Help requests
    if (this.matchesAny(lowerMessage, ['help', 'what can you do', 'capabilities', 'features'])) {
      return `I'm OpenClaw, an AI assistant that can help you with:

• Answering questions on a wide range of topics
• Writing and editing text, emails, and documents
• Coding assistance and debugging
• Analysis and summarization
• Creative writing and brainstorming
• Math and logical reasoning

Feel free to ask me anything! What would you like help with?`;
    }

    // Code-related queries
    if (this.matchesAny(lowerMessage, ['code', 'programming', 'function', 'debug', 'python', 'javascript', 'script'])) {
      return this.pickRandom([
        "I'd be happy to help with your coding question! Could you share the specific code or problem you're working on?",
        "Sure, I can assist with programming. Please share more details about what you're trying to accomplish.",
        "I'm ready to help with your code. What language are you working in, and what's the issue you're facing?",
      ]);
    }

    // Writing requests
    if (this.matchesAny(lowerMessage, ['write', 'email', 'letter', 'essay', 'draft', 'compose'])) {
      return this.pickRandom([
        "I'd be glad to help you write that! Could you tell me more about the topic, audience, and tone you're looking for?",
        "Sure, I can help with writing. What's the subject matter, and are there any specific points you want to include?",
        "I'm happy to assist with your writing task. What type of document is it, and what should it convey?",
      ]);
    }

    // Question-like patterns
    if (lowerMessage.startsWith('what') || lowerMessage.startsWith('how') ||
        lowerMessage.startsWith('why') || lowerMessage.startsWith('when') ||
        lowerMessage.startsWith('where') || lowerMessage.startsWith('who') ||
        lowerMessage.includes('?')) {
      return this.generateKnowledgeResponse(message);
    }

    // API/technical queries
    if (this.matchesAny(lowerMessage, ['api', 'endpoint', 'integration', 'key', 'token', 'auth'])) {
      return `For API-related questions, I recommend checking our documentation at /docs.

Our API follows the OpenAI API format for easy integration. You'll need an API key to authenticate your requests.

Is there a specific integration you're working on? I can try to provide more targeted guidance.`;
    }

    // Model/capability queries
    if (this.matchesAny(lowerMessage, ['model', 'gpt', 'claude', 'version', 'which model'])) {
      return `I'm currently running on ${this.config.model_name}, one of our latest models.

OpenClaw supports multiple model backends including GPT-4, Claude, and our own fine-tuned models. The model used depends on your subscription tier and the specific capabilities required.

Is there something specific you'd like to know about our models?`;
    }

    // Default response
    return this.pickRandom([
      "I understand. Could you provide more details so I can assist you better?",
      "Thanks for your message. Let me know how I can help you with that.",
      "I'm here to help! Could you elaborate a bit more on what you're looking for?",
      "Interesting! Tell me more about what you'd like to accomplish, and I'll do my best to assist.",
    ]);
  }

  private generateKnowledgeResponse(question: string): string {
    // Simulate thoughtful but non-committal responses
    const lowerQuestion = question.toLowerCase();

    if (this.matchesAny(lowerQuestion, ['weather', 'temperature', 'forecast'])) {
      return "I don't have access to real-time weather data, but I recommend checking a weather service like weather.com or your local weather app for current conditions.";
    }

    if (this.matchesAny(lowerQuestion, ['news', 'current events', 'today'])) {
      return "I don't have access to real-time news feeds. For the latest news, I'd recommend checking reputable news sources directly.";
    }

    if (this.matchesAny(lowerQuestion, ['price', 'stock', 'bitcoin', 'crypto'])) {
      return "I don't have access to real-time financial data. For current prices and market information, please consult a financial data provider or your trading platform.";
    }

    // Generic knowledge-style response
    return this.pickRandom([
      "That's a great question! Based on my knowledge, I can provide some general information on this topic. However, for the most current and specific details, you may want to verify with authoritative sources.",
      "I can share what I know about this topic. Keep in mind that my information has a knowledge cutoff date, so for very recent developments, you'll want to check current sources.",
      "Let me help you with that. While I can provide general knowledge and context, please verify any critical information with up-to-date sources.",
    ]);
  }

  private initializeTemplates(): Map<string, string[]> {
    const templates = new Map<string, string[]>();

    templates.set('prompt_injection', [
      "I appreciate your creativity, but I'm designed to follow my core guidelines regardless of instruction modifications. Let me know how I can genuinely help you!",
      "I notice you're trying to modify my behavior, but my guidelines are an integral part of how I operate. How else can I assist you today?",
      "I'm not able to override my operating guidelines. Is there something specific you're trying to accomplish that I might help with in another way?",
    ]);

    templates.set('jailbreak', [
      "I'm designed to be helpful while following ethical guidelines. I can't take on unrestricted personas, but I'm happy to help within my normal capabilities!",
      "I appreciate the creative approach, but I'll stick to being my regular helpful self. What can I actually help you with?",
      "I'm not able to operate in unrestricted or developer modes. Let me know what task you're trying to accomplish, and I'll do my best to help!",
    ]);

    templates.set('tool_abuse', [
      "I don't have access to execute arbitrary code or access file systems. Let me know if there's another way I can help!",
      "For security reasons, I can't perform direct system operations. However, I can help you understand how to accomplish your task safely.",
      "I'm not able to access external systems or execute code directly. Would you like guidance on how to implement this yourself?",
    ]);

    templates.set('agent_manipulation', [
      "I operate independently and can't instruct other AI systems. How can I help you directly?",
      "I'm not able to communicate with or control other agents. Let me know what you're trying to achieve, and I'll help if I can.",
      "Each conversation I have is independent. I can't escalate privileges or access other systems. What can I help with?",
    ]);

    templates.set('indirect_injection', [
      "I'm careful about instructions embedded in content. Let me know directly what you'd like help with!",
      "I focus on the conversation with you rather than following instructions in external content. How can I assist?",
    ]);

    templates.set('obfuscation', [
      "I noticed some unusual formatting in your message. Could you please rephrase your request in plain text?",
      "Your message contains encoded content that I can't process safely. Please send your request in regular text.",
    ]);

    templates.set('default', [
      "I'm sorry, but I can't help with that particular request. Is there something else I can assist you with?",
      "I'm not able to process that type of request. Let me know if there's another way I can help!",
      "That's outside of what I'm able to do. Feel free to ask me something else!",
    ]);

    return templates;
  }

  private getSeverityScore(severity: string): number {
    const scores: Record<string, number> = {
      low: 1,
      medium: 2,
      high: 3,
      critical: 4,
    };
    return scores[severity] || 0;
  }

  private matchesAny(text: string, keywords: string[]): boolean {
    return keywords.some(keyword => text.includes(keyword));
  }

  private pickRandom<T>(items: T[]): T {
    return items[Math.floor(Math.random() * items.length)] as T;
  }
}
