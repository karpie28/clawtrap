import fs from 'fs';
import path from 'path';

export interface GeoData {
  geo?: {
    country?: string;
    country_code?: string;
    city?: string;
    region?: string;
    latitude?: number;
    longitude?: number;
    timezone?: string;
  };
  asn?: {
    number?: number;
    organization?: string;
  };
}

interface MaxMindReader {
  get(ip: string): Record<string, unknown> | null;
}

export class GeoEnricher {
  private cityReader: MaxMindReader | null = null;
  private asnReader: MaxMindReader | null = null;
  private cache: Map<string, GeoData | null> = new Map();
  private cacheMaxSize = 10000;

  async initialize(): Promise<void> {
    // Try to load MaxMind databases if available
    const dbPaths = [
      process.env.MAXMIND_DB_PATH,
      '/var/lib/GeoIP',
      '/usr/share/GeoIP',
      './data/geoip',
    ].filter(Boolean) as string[];

    for (const dbPath of dbPaths) {
      try {
        const cityPath = path.join(dbPath, 'GeoLite2-City.mmdb');
        const asnPath = path.join(dbPath, 'GeoLite2-ASN.mmdb');

        if (fs.existsSync(cityPath)) {
          const maxmind = await import('maxmind');
          this.cityReader = await maxmind.open(cityPath);
        }

        if (fs.existsSync(asnPath)) {
          const maxmind = await import('maxmind');
          this.asnReader = await maxmind.open(asnPath);
        }

        if (this.cityReader || this.asnReader) {
          break;
        }
      } catch {
        // Continue to next path
      }
    }

    if (!this.cityReader && !this.asnReader) {
      console.warn('MaxMind GeoIP databases not found. Geo enrichment disabled.');
    }
  }

  async enrich(ip: string): Promise<GeoData | null> {
    // Check cache
    if (this.cache.has(ip)) {
      return this.cache.get(ip) || null;
    }

    // Skip private/local IPs
    if (this.isPrivateIP(ip)) {
      return null;
    }

    const result: GeoData = {};

    try {
      // Get city/geo data
      if (this.cityReader) {
        const cityData = this.cityReader.get(ip) as Record<string, unknown> | null;
        if (cityData) {
          result.geo = {
            country: this.extractName(cityData, 'country'),
            country_code: (cityData.country as Record<string, string>)?.iso_code,
            city: this.extractName(cityData, 'city'),
            region: this.extractName(cityData, 'subdivisions', 0),
            latitude: (cityData.location as Record<string, number>)?.latitude,
            longitude: (cityData.location as Record<string, number>)?.longitude,
            timezone: (cityData.location as Record<string, string>)?.time_zone,
          };
        }
      }

      // Get ASN data
      if (this.asnReader) {
        const asnData = this.asnReader.get(ip) as Record<string, unknown> | null;
        if (asnData) {
          result.asn = {
            number: asnData.autonomous_system_number as number,
            organization: asnData.autonomous_system_organization as string,
          };
        }
      }
    } catch (error) {
      // Silently fail for individual lookups
    }

    // Cache result
    if (this.cache.size >= this.cacheMaxSize) {
      // Simple cache eviction: clear oldest half
      const entries = Array.from(this.cache.entries());
      this.cache = new Map(entries.slice(entries.length / 2));
    }
    this.cache.set(ip, Object.keys(result).length > 0 ? result : null);

    return Object.keys(result).length > 0 ? result : null;
  }

  private extractName(data: Record<string, unknown>, key: string, index?: number): string | undefined {
    let obj = data[key] as Record<string, unknown> | Record<string, unknown>[] | undefined;
    if (Array.isArray(obj) && index !== undefined) {
      obj = obj[index];
    }
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      const names = (obj as Record<string, unknown>).names as Record<string, string> | undefined;
      return names?.en;
    }
    return undefined;
  }

  private isPrivateIP(ip: string): boolean {
    // IPv4 private ranges
    const privateRanges = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^127\./,
      /^169\.254\./,
      /^::1$/,
      /^fc00:/i,
      /^fe80:/i,
      /^localhost$/i,
    ];

    return privateRanges.some(range => range.test(ip));
  }

  getCacheStats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size,
      maxSize: this.cacheMaxSize,
    };
  }

  clearCache(): void {
    this.cache.clear();
  }
}
