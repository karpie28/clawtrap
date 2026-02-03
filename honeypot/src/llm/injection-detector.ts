import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { DetectionConfig } from '../config';
import { LoggerFactory } from '../logging';

const logger = LoggerFactory.getLogger('injection-detector');

export interface DetectedAttack {
  type: string;
  subtype: string;
  pattern_matched: string;
  confidence: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
}

export interface DetectionPattern {
  name: string;
  type: string;
  subtype: string;
  pattern: string;
  flags?: string;
  confidence: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  description?: string;
}

export class InjectionDetector {
  private patterns: DetectionPattern[] = [];
  private compiledPatterns: Map<string, RegExp> = new Map();

  constructor(config: DetectionConfig) {
    this.loadPatterns(config.patterns_dir);
  }

  private loadPatterns(patternsDir: string): void {
    const patternFiles = [
      'prompt-injection.yml',
      'jailbreak.yml',
      'tool-abuse.yml',
    ];

    for (const file of patternFiles) {
      const filePath = path.join(patternsDir, file);
      if (fs.existsSync(filePath)) {
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          const parsed = yaml.load(content) as { patterns?: DetectionPattern[] };
          if (parsed?.patterns) {
            this.patterns.push(...parsed.patterns);
          }
        } catch (error) {
          logger.warn(`Failed to load patterns from ${file}`, {
            error: (error as Error).message,
          });
        }
      }
    }

    // Load built-in patterns if no files found
    if (this.patterns.length === 0) {
      this.loadBuiltInPatterns();
    }

    // Compile regex patterns
    for (const pattern of this.patterns) {
      try {
        const flags = pattern.flags || 'gi';
        this.compiledPatterns.set(pattern.name, new RegExp(pattern.pattern, flags));
      } catch (error) {
        logger.warn(`Failed to compile pattern ${pattern.name}`, {
          pattern: pattern.pattern,
          error: (error as Error).message,
        });
      }
    }

    logger.info(`Loaded ${this.patterns.length} detection patterns`);
  }

  private loadBuiltInPatterns(): void {
    this.patterns = [
      // Prompt Injection Patterns
      {
        name: 'system_prompt_extraction',
        type: 'prompt_injection',
        subtype: 'system_prompt_extraction',
        pattern: '(ignore|forget|disregard).*(previous|above|prior|system).*(instruction|prompt|message|context)',
        confidence: 0.9,
        severity: 'high',
        category: 'prompt_injection',
      },
      {
        name: 'instruction_override',
        type: 'prompt_injection',
        subtype: 'instruction_override',
        pattern: '(new instruction|override|replace).*(system|instruction|rule)',
        confidence: 0.85,
        severity: 'high',
        category: 'prompt_injection',
      },
      {
        name: 'role_manipulation',
        type: 'prompt_injection',
        subtype: 'role_manipulation',
        pattern: '(you are now|act as|pretend to be|roleplay as).*(admin|root|developer|hacker|unrestricted)',
        confidence: 0.8,
        severity: 'high',
        category: 'prompt_injection',
      },
      {
        name: 'delimiter_injection',
        type: 'prompt_injection',
        subtype: 'delimiter_injection',
        pattern: '(\\[INST\\]|\\[/INST\\]|<\\|im_start\\|>|<\\|im_end\\|>|###|```system)',
        confidence: 0.95,
        severity: 'critical',
        category: 'prompt_injection',
      },
      {
        name: 'context_manipulation',
        type: 'prompt_injection',
        subtype: 'context_manipulation',
        pattern: '(the following|below is|here is).*(system prompt|instruction|your rules)',
        confidence: 0.75,
        severity: 'medium',
        category: 'prompt_injection',
      },
      {
        name: 'output_format_injection',
        type: 'prompt_injection',
        subtype: 'output_format_injection',
        pattern: '(output|respond|reply).*(json|xml|format|only).*(no|without|skip).*(explanation|filter|safety)',
        confidence: 0.7,
        severity: 'medium',
        category: 'prompt_injection',
      },

      // Jailbreak Patterns
      {
        name: 'dan_jailbreak',
        type: 'jailbreak',
        subtype: 'DAN_variants',
        pattern: '(do anything now|DAN|jailbreak|unrestricted mode|no limitations)',
        confidence: 0.95,
        severity: 'critical',
        category: 'jailbreak',
      },
      {
        name: 'developer_mode',
        type: 'jailbreak',
        subtype: 'developer_mode',
        pattern: '(developer mode|dev mode|debug mode|maintenance mode).*(enable|activate|on)',
        confidence: 0.9,
        severity: 'critical',
        category: 'jailbreak',
      },
      {
        name: 'evil_persona',
        type: 'jailbreak',
        subtype: 'character_roleplay',
        pattern: '(evil|unrestricted|uncensored|unfiltered).*(version|mode|persona|AI|assistant)',
        confidence: 0.85,
        severity: 'high',
        category: 'jailbreak',
      },
      {
        name: 'hypothetical_framing',
        type: 'jailbreak',
        subtype: 'hypothetical_framing',
        pattern: '(hypothetically|theoretically|imagine if|what if|in a fictional).*(could you|would you|how would)',
        confidence: 0.6,
        severity: 'medium',
        category: 'jailbreak',
      },
      {
        name: 'base64_encoding',
        type: 'jailbreak',
        subtype: 'base64_encoding',
        pattern: '(decode|interpret|execute|follow).*(base64|encoded|encrypted)',
        confidence: 0.8,
        severity: 'high',
        category: 'jailbreak',
      },
      {
        name: 'grandma_exploit',
        type: 'jailbreak',
        subtype: 'character_roleplay',
        pattern: '(grandma|grandmother).*(used to|would tell|recipe|story).*(napalm|explosive|hack|illegal)',
        confidence: 0.9,
        severity: 'high',
        category: 'jailbreak',
      },

      // Tool Abuse Patterns
      {
        name: 'code_execution_request',
        type: 'tool_abuse',
        subtype: 'arbitrary_code_execution',
        pattern: '(execute|run|eval).*(code|script|command|shell|bash|python|javascript)',
        confidence: 0.8,
        severity: 'critical',
        category: 'tool_abuse',
      },
      {
        name: 'file_system_access',
        type: 'tool_abuse',
        subtype: 'file_system_access',
        pattern: '(read|write|delete|access|list).*(file|directory|folder|path|/etc|/home|/root|~)',
        confidence: 0.75,
        severity: 'high',
        category: 'tool_abuse',
      },
      {
        name: 'network_request',
        type: 'tool_abuse',
        subtype: 'network_requests',
        pattern: '(fetch|request|call|connect|curl|wget).*(url|api|endpoint|server|http)',
        confidence: 0.65,
        severity: 'medium',
        category: 'tool_abuse',
      },
      {
        name: 'data_exfiltration',
        type: 'tool_abuse',
        subtype: 'data_exfiltration',
        pattern: '(send|upload|post|transfer).*(data|information|credentials|secrets|keys).*(server|api|webhook|url)',
        confidence: 0.85,
        severity: 'critical',
        category: 'tool_abuse',
      },
      {
        name: 'credential_access',
        type: 'tool_abuse',
        subtype: 'credential_access',
        pattern: '(api.?key|secret|password|token|credential|aws.?access|private.?key)',
        confidence: 0.7,
        severity: 'high',
        category: 'tool_abuse',
      },

      // Agent Manipulation Patterns
      {
        name: 'agent_hijacking',
        type: 'agent_manipulation',
        subtype: 'multi_agent_hijacking',
        pattern: '(tell|instruct|command|order).*(other|another|next).*(agent|assistant|AI)',
        confidence: 0.75,
        severity: 'high',
        category: 'agent_manipulation',
      },
      {
        name: 'workspace_escape',
        type: 'agent_manipulation',
        subtype: 'workspace_escape',
        pattern: '(escape|break out|leave|exit).*(sandbox|container|workspace|environment)',
        confidence: 0.85,
        severity: 'critical',
        category: 'agent_manipulation',
      },
      {
        name: 'permission_escalation',
        type: 'agent_manipulation',
        subtype: 'permission_escalation',
        pattern: '(elevate|escalate|increase|grant).*(permission|privilege|access|role)',
        confidence: 0.8,
        severity: 'critical',
        category: 'agent_manipulation',
      },

      // Indirect Injection Indicators
      {
        name: 'indirect_via_content',
        type: 'indirect_injection',
        subtype: 'via_fake_content',
        pattern: '(important instruction|ignore safety|follow these steps|execute immediately)',
        confidence: 0.7,
        severity: 'high',
        category: 'indirect_injection',
      },
    ];
  }

  detect(input: string): DetectedAttack[] {
    const detected: DetectedAttack[] = [];

    if (!input || typeof input !== 'string') {
      return detected;
    }

    // Normalize input for better detection
    const normalizedInput = input.toLowerCase();

    for (const pattern of this.patterns) {
      const regex = this.compiledPatterns.get(pattern.name);
      if (!regex) continue;

      const match = normalizedInput.match(regex) || input.match(regex);
      if (match) {
        detected.push({
          type: pattern.type,
          subtype: pattern.subtype,
          pattern_matched: match[0],
          confidence: pattern.confidence,
          severity: pattern.severity,
          category: pattern.category,
        });
      }
    }

    // Additional heuristic checks
    detected.push(...this.heuristicChecks(input));

    // Deduplicate by type+subtype, keeping highest confidence
    const deduped = new Map<string, DetectedAttack>();
    for (const attack of detected) {
      const key = `${attack.type}:${attack.subtype}`;
      const existing = deduped.get(key);
      if (!existing || existing.confidence < attack.confidence) {
        deduped.set(key, attack);
      }
    }

    return Array.from(deduped.values());
  }

  private heuristicChecks(input: string): DetectedAttack[] {
    const attacks: DetectedAttack[] = [];

    // Check for Base64 encoded content
    const base64Pattern = /[A-Za-z0-9+/]{50,}={0,2}/g;
    const base64Matches = input.match(base64Pattern);
    if (base64Matches) {
      for (const match of base64Matches) {
        try {
          const decoded = Buffer.from(match, 'base64').toString('utf-8');
          // Check if decoded content looks malicious
          if (this.detect(decoded).length > 0) {
            attacks.push({
              type: 'obfuscation',
              subtype: 'base64_encoded_attack',
              pattern_matched: match.substring(0, 50) + '...',
              confidence: 0.9,
              severity: 'critical',
              category: 'obfuscation',
            });
          }
        } catch {
          // Not valid base64, ignore
        }
      }
    }

    // Check for unicode tricks
    const unicodeTricks = /[\u200B-\u200F\u2028-\u202F\uFEFF]/g;
    if (unicodeTricks.test(input)) {
      attacks.push({
        type: 'obfuscation',
        subtype: 'unicode_tricks',
        pattern_matched: 'invisible unicode characters detected',
        confidence: 0.7,
        severity: 'medium',
        category: 'obfuscation',
      });
    }

    // Check for extremely long messages (potential DoS or injection padding)
    if (input.length > 50000) {
      attacks.push({
        type: 'abuse',
        subtype: 'excessive_length',
        pattern_matched: `input length: ${input.length}`,
        confidence: 0.6,
        severity: 'medium',
        category: 'abuse',
      });
    }

    // Check for repeated patterns (potential prompt flooding)
    const words = input.split(/\s+/);
    const wordCounts = new Map<string, number>();
    for (const word of words) {
      if (word.length > 3) {
        wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
      }
    }
    const maxRepeats = Math.max(...Array.from(wordCounts.values()), 0);
    if (maxRepeats > 50) {
      attacks.push({
        type: 'abuse',
        subtype: 'repetition_attack',
        pattern_matched: `word repeated ${maxRepeats} times`,
        confidence: 0.65,
        severity: 'low',
        category: 'abuse',
      });
    }

    return attacks;
  }

  getPatternCount(): number {
    return this.patterns.length;
  }

  getPatternsByCategory(category: string): DetectionPattern[] {
    return this.patterns.filter(p => p.category === category);
  }
}
