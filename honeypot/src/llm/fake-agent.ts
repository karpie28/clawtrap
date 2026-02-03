import { FakeAgentConfig } from '../config';
import { DetectedAttack } from './injection-detector';

/**
 * Generates fake AI assistant responses that are realistic enough to
 * avoid fingerprinting. Uses vocabulary variation, complexity-proportional
 * latency, and structural randomization.
 */
export class FakeAgent {
  private config: FakeAgentConfig;
  private responseTemplates: Map<string, string[][]>;

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
    const primaryAttack = attacks[0];
    const templateKey = primaryAttack?.type || 'default';

    const variants = this.responseTemplates.get(templateKey) ||
                     this.responseTemplates.get('default')!;

    let response = this.assembleResponse(variants);

    // Add personality flavor with variation
    if (this.config.personality === 'helpful') {
      response += '\n\n' + this.pickRandom([
        'Is there something else I can help you with today?',
        'What else can I assist you with?',
        'Let me know if there\'s anything else you need.',
        'Feel free to ask if you have other questions!',
        'Happy to help with anything else.',
      ]);
    } else if (this.config.personality === 'cautious') {
      response += '\n\n' + this.pickRandom([
        'For security reasons, I cannot process requests that appear to manipulate my instructions.',
        'I need to maintain my safety guidelines to protect both of us.',
        'My safety protocols prevent me from processing this type of request.',
      ]);
    }

    return response;
  }

  private generateContextualResponse(message: string): string {
    const lowerMessage = message.toLowerCase();

    // Greeting responses
    if (this.matchesAny(lowerMessage, ['hello', 'hi', 'hey', 'greetings', 'good morning', 'good afternoon'])) {
      return this.assembleResponse([
        [
          "Hello! I'm OpenClaw, your AI assistant.",
          "Hi there! Welcome to OpenClaw.",
          "Hey! Thanks for reaching out to OpenClaw.",
          "Hello! Welcome — I'm your OpenClaw assistant.",
        ],
        [
          "How can I help you today?",
          "What would you like to discuss?",
          "What can I do for you?",
          "How can I assist you?",
          "What brings you here today?",
        ],
      ]);
    }

    // Help requests
    if (this.matchesAny(lowerMessage, ['help', 'what can you do', 'capabilities', 'features'])) {
      const intro = this.pickRandom([
        "I'm OpenClaw, an AI assistant that can help you with a variety of tasks:",
        "As your OpenClaw assistant, I have several capabilities:",
        "I can help with quite a few things! Here's an overview:",
        "OpenClaw is designed to assist with a wide range of tasks. Here's what I can do:",
      ]);

      // Randomly select and shuffle a subset of capabilities
      const allCapabilities = [
        'Answering questions on a wide range of topics',
        'Writing and editing text, emails, and documents',
        'Coding assistance and debugging',
        'Analysis and summarization of text',
        'Creative writing and brainstorming ideas',
        'Math and logical reasoning',
        'Data analysis and interpretation',
        'Research assistance',
        'Translation and language help',
      ];
      const selected = this.shuffleAndPick(allCapabilities, 5 + Math.floor(Math.random() * 3));
      const bullets = selected.map(c => `• ${c}`).join('\n');

      const outro = this.pickRandom([
        "Feel free to ask me anything! What would you like help with?",
        "What would you like to start with?",
        "Just let me know how I can help!",
        "Go ahead and ask me anything you'd like.",
      ]);

      return `${intro}\n\n${bullets}\n\n${outro}`;
    }

    // Code-related queries
    if (this.matchesAny(lowerMessage, ['code', 'programming', 'function', 'debug', 'python', 'javascript', 'script'])) {
      return this.assembleResponse([
        [
          "I'd be happy to help with your coding question!",
          "Sure, I can assist with programming.",
          "I'm ready to help with your code.",
          "Absolutely, coding is one of my strengths.",
          "I'd love to help with that.",
        ],
        [
          "Could you share the specific code or problem you're working on?",
          "Please share more details about what you're trying to accomplish.",
          "What language are you working in, and what's the issue you're facing?",
          "Can you provide more context about the problem?",
          "What have you tried so far?",
        ],
      ]);
    }

    // Writing requests
    if (this.matchesAny(lowerMessage, ['write', 'email', 'letter', 'essay', 'draft', 'compose'])) {
      return this.assembleResponse([
        [
          "I'd be glad to help you write that!",
          "Sure, I can help with writing.",
          "I'm happy to assist with your writing task.",
          "I can definitely help with that.",
        ],
        [
          "Could you tell me more about the topic, audience, and tone you're looking for?",
          "What's the subject matter, and are there any specific points you want to include?",
          "What type of document is it, and what should it convey?",
          "Who is the intended audience, and what's the purpose?",
          "What key points would you like me to cover?",
        ],
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
      return this.assembleResponse([
        [
          "For API-related questions, I recommend checking our documentation at /docs.",
          "Our API documentation at /docs should have what you need.",
          "You'll find detailed API information in our docs at /docs.",
        ],
        [
          "Our API follows the OpenAI API format for easy integration. You'll need an API key to authenticate your requests.",
          "We support the OpenAI-compatible API format. Authentication is done via API keys.",
          "The API is designed to be a drop-in replacement for OpenAI's API, with key-based authentication.",
        ],
        [
          "Is there a specific integration you're working on? I can try to provide more targeted guidance.",
          "Let me know if you need help with a specific aspect of the API.",
          "What specifically are you trying to integrate?",
        ],
      ]);
    }

    // Model/capability queries
    if (this.matchesAny(lowerMessage, ['model', 'gpt', 'claude', 'version', 'which model'])) {
      return this.assembleResponse([
        [
          `I'm currently running on ${this.config.model_name}, one of our latest models.`,
          `I'm powered by ${this.config.model_name}.`,
          `You're talking to ${this.config.model_name} right now.`,
        ],
        [
          "OpenClaw supports multiple model backends including GPT-4, Claude, and our own fine-tuned models.",
          "We offer a range of models — GPT-4, Claude, and several proprietary options.",
          "Multiple model backends are available, from GPT-4 to Claude and beyond.",
        ],
        [
          "The model used depends on your subscription tier and the specific capabilities required.",
          "Your subscription tier determines which models you have access to.",
          "Different plans include access to different model tiers.",
        ],
        [
          "Is there something specific you'd like to know about our models?",
          "What would you like to know about the available models?",
          "Anything specific about model capabilities I can clarify?",
        ],
      ]);
    }

    // Default response
    return this.assembleResponse([
      [
        "I understand.",
        "Thanks for your message.",
        "I see.",
        "Got it.",
        "Thank you for sharing that.",
      ],
      [
        "Could you provide more details so I can assist you better?",
        "Let me know how I can help you with that.",
        "Could you elaborate a bit more on what you're looking for?",
        "Tell me more about what you'd like to accomplish, and I'll do my best to assist.",
        "What specifically would you like help with?",
        "How can I assist you with this?",
      ],
    ]);
  }

  private generateKnowledgeResponse(question: string): string {
    const lowerQuestion = question.toLowerCase();

    if (this.matchesAny(lowerQuestion, ['weather', 'temperature', 'forecast'])) {
      return this.pickRandom([
        "I don't have access to real-time weather data, but I recommend checking a weather service like weather.com or your local weather app for current conditions.",
        "Unfortunately I can't check live weather data. A service like weather.com or your phone's weather app would give you the most accurate information.",
        "Real-time weather isn't something I can access. I'd suggest checking your preferred weather service for up-to-date conditions.",
      ]);
    }

    if (this.matchesAny(lowerQuestion, ['news', 'current events', 'today'])) {
      return this.pickRandom([
        "I don't have access to real-time news feeds. For the latest news, I'd recommend checking reputable news sources directly.",
        "I'm not able to browse current news. For the latest updates, check your preferred news outlet.",
        "My training data has a cutoff, so I can't provide today's news. Check a news aggregator for the most current information.",
      ]);
    }

    if (this.matchesAny(lowerQuestion, ['price', 'stock', 'bitcoin', 'crypto'])) {
      return this.pickRandom([
        "I don't have access to real-time financial data. For current prices and market information, please consult a financial data provider or your trading platform.",
        "Live market data isn't available to me. Your brokerage or a financial data service would have the latest prices.",
        "I can't pull real-time pricing data. For the most current financial information, check your preferred trading platform.",
      ]);
    }

    // Generic knowledge-style response with structural variation
    const opening = this.pickRandom([
      "That's a great question!",
      "Good question.",
      "Interesting question.",
      "Let me address that.",
      "I can help with that.",
    ]);

    const body = this.pickRandom([
      "Based on my knowledge, I can provide some general information on this topic.",
      "I can share what I know about this.",
      "Here's what I know about that subject.",
      "I have some information on this topic that might be useful.",
    ]);

    const caveat = this.pickRandom([
      "However, for the most current and specific details, you may want to verify with authoritative sources.",
      "Keep in mind that my information has a knowledge cutoff date, so for very recent developments, you'll want to check current sources.",
      "Please verify any critical information with up-to-date sources, as my training data has a cutoff.",
      "For the most recent information, I'd recommend cross-referencing with current sources.",
    ]);

    // Sometimes combine differently
    if (Math.random() > 0.5) {
      return `${opening} ${body} ${caveat}`;
    }
    return `${body} ${caveat}`;
  }

  private initializeTemplates(): Map<string, string[][]> {
    // Templates are now arrays of variant arrays.
    // Each inner array provides alternatives for one sentence/segment.
    // assembleResponse() picks one from each and joins them.
    const templates = new Map<string, string[][]>();

    templates.set('prompt_injection', [
      [
        "I appreciate your creativity, but I'm designed to follow my core guidelines regardless of instruction modifications.",
        "I notice you're trying to modify my behavior, but my guidelines are an integral part of how I operate.",
        "I'm not able to override my operating guidelines.",
        "My instructions are set and can't be changed through conversation.",
        "I have to maintain my core operating guidelines.",
      ],
      [
        "Let me know how I can genuinely help you!",
        "How else can I assist you today?",
        "Is there something specific you're trying to accomplish that I might help with in another way?",
        "I'm happy to help with your actual question though.",
      ],
    ]);

    templates.set('jailbreak', [
      [
        "I'm designed to be helpful while following ethical guidelines.",
        "I appreciate the creative approach, but I'll stick to being my regular helpful self.",
        "I'm not able to operate in unrestricted or developer modes.",
        "I need to maintain my standard operating mode.",
        "That kind of mode change isn't something I can do.",
      ],
      [
        "I can't take on unrestricted personas, but I'm happy to help within my normal capabilities!",
        "What can I actually help you with?",
        "Let me know what task you're trying to accomplish, and I'll do my best to help!",
        "I'd love to help you with something within my capabilities.",
      ],
    ]);

    templates.set('tool_abuse', [
      [
        "I don't have access to execute arbitrary code or access file systems.",
        "For security reasons, I can't perform direct system operations.",
        "I'm not able to access external systems or execute code directly.",
        "System-level operations aren't within my capabilities.",
        "I can't run code or access files on your behalf.",
      ],
      [
        "Let me know if there's another way I can help!",
        "However, I can help you understand how to accomplish your task safely.",
        "Would you like guidance on how to implement this yourself?",
        "I can explain how to do this if you'd like to try it yourself.",
      ],
    ]);

    templates.set('agent_manipulation', [
      [
        "I operate independently and can't instruct other AI systems.",
        "I'm not able to communicate with or control other agents.",
        "Each conversation I have is independent.",
        "I don't have the ability to interact with other AI systems.",
      ],
      [
        "How can I help you directly?",
        "Let me know what you're trying to achieve, and I'll help if I can.",
        "I can't escalate privileges or access other systems. What can I help with?",
        "What can I do for you within this conversation?",
      ],
    ]);

    templates.set('indirect_injection', [
      [
        "I'm careful about instructions embedded in content.",
        "I focus on the conversation with you rather than following instructions in external content.",
        "I evaluate requests based on our direct conversation, not embedded instructions.",
      ],
      [
        "Let me know directly what you'd like help with!",
        "How can I assist?",
        "What would you like me to help you with?",
      ],
    ]);

    templates.set('obfuscation', [
      [
        "I noticed some unusual formatting in your message.",
        "Your message contains encoded content that I can't process safely.",
        "There seems to be some non-standard encoding in your message.",
      ],
      [
        "Could you please rephrase your request in plain text?",
        "Please send your request in regular text.",
        "Could you try again with standard formatting?",
      ],
    ]);

    templates.set('default', [
      [
        "I'm sorry, but I can't help with that particular request.",
        "I'm not able to process that type of request.",
        "That's outside of what I'm able to do.",
        "I'm afraid I can't assist with that.",
      ],
      [
        "Is there something else I can assist you with?",
        "Let me know if there's another way I can help!",
        "Feel free to ask me something else!",
        "I'm happy to help with other questions.",
      ],
    ]);

    return templates;
  }

  /**
   * Assemble a response by picking one variant from each segment array
   * and joining them with a space.
   */
  private assembleResponse(segments: string[][]): string {
    return segments.map(variants => this.pickRandom(variants)).join(' ');
  }

  private matchesAny(text: string, keywords: string[]): boolean {
    return keywords.some(keyword => {
      const pattern = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      return pattern.test(text);
    });
  }

  private pickRandom<T>(items: T[]): T {
    return items[Math.floor(Math.random() * items.length)] as T;
  }

  private shuffleAndPick<T>(items: T[], count: number): T[] {
    const shuffled = [...items];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
    }
    return shuffled.slice(0, count);
  }
}
