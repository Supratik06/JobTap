import * as cheerio from 'cheerio';
import { z } from 'zod';
import { eventBus } from '../telemetry/eventBus.js';

// Strict canonical schema for ingested job postings
export const JobPostingSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(2),
  company: z.string().min(1),
  location: z.string().default('Remote / Unspecified'),
  url: z.string().url().or(z.string().min(1)),
  description: z.string().optional(),
  tags: z.array(z.string()).default([]),
  salary: z.string().optional().nullable(),
  postedAt: z.string().default(() => new Date().toISOString()),
  source: z.string(),
  extractionStrategy: z.enum(['JSON_LD', 'SEMANTIC_MICRODATA', 'CSS_CASCADE', 'REGEX_HEURISTIC', 'FALLBACK_CACHE']),
  confidenceScore: z.number().min(0).max(100),
  extractedAt: z.string().default(() => new Date().toISOString()),
});

export class SelfHealingParser {
  constructor() {
    this.knownDriftEvents = [];
  }

  /**
   * Resiliently parse raw HTML with multi-tier fallback cascade
   */
  parseJobHtml(html, sourceName = 'custom_source', fallbackUrl = '') {
    if (!html || typeof html !== 'string') {
      throw new Error('Invalid HTML payload provided to parser');
    }

    const $ = cheerio.load(html);
    const parsedJobs = [];

    // TIER 1: Structured JSON-LD Data (schema.org/JobPosting)
    const jsonLdJobs = this.extractJsonLd($, sourceName, fallbackUrl);
    if (jsonLdJobs.length > 0) {
      eventBus.log('resilience', 'PARSE', `[${sourceName}] Tier 1 Match: Extracted ${jsonLdJobs.length} jobs via schema.org JSON-LD`, {
        strategy: 'JSON_LD',
        count: jsonLdJobs.length,
      });
      return jsonLdJobs;
    }

    // TIER 2: Semantic Microdata / OpenGraph metadata
    const microdataJobs = this.extractMicrodata($, sourceName, fallbackUrl);
    if (microdataJobs.length > 0) {
      eventBus.log('resilience', 'PARSE', `[${sourceName}] Tier 2 Match: Extracted ${microdataJobs.length} jobs via Semantic Microdata`, {
        strategy: 'SEMANTIC_MICRODATA',
        count: microdataJobs.length,
      });
      return microdataJobs;
    }

    // TIER 3: Multi-Selector Cascading Fallback (Tolerates CSS/Tailwind class scrambling)
    const cascadeJobs = this.extractWithSelectorCascade($, sourceName, fallbackUrl);
    if (cascadeJobs.length > 0) {
      eventBus.log('resilience', 'PARSE', `[${sourceName}] Tier 3 Match: Extracted ${cascadeJobs.length} jobs via Selector Cascade Heuristics`, {
        strategy: 'CSS_CASCADE',
        count: cascadeJobs.length,
      });
      return cascadeJobs;
    }

    // TIER 4: Text Block / Heuristic Regex Extraction
    const heuristicJobs = this.extractRegexHeuristics($, sourceName, fallbackUrl);
    if (heuristicJobs.length > 0) {
      eventBus.log('warn', 'PARSE', `[${sourceName}] Tier 4 Fallback: Extracted ${heuristicJobs.length} jobs via Regex Heuristics (Markup drift suspected)`, {
        strategy: 'REGEX_HEURISTIC',
        count: heuristicJobs.length,
      });
      return heuristicJobs;
    }

    // If all strategies fail, record anomaly
    eventBus.log('error', 'PARSE', `[${sourceName}] All 4 parsing tiers failed to extract listings. Schema drift alert triggered!`, {
      htmlSnippet: html.slice(0, 300),
    });

    return [];
  }

  /**
   * Tier 1: JSON-LD Schema.org extractor
   */
  extractJsonLd($, sourceName, fallbackUrl) {
    const jobs = [];
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const rawContent = $(el).html();
        if (!rawContent) return;
        const data = JSON.parse(rawContent.trim());

        const items = Array.isArray(data) ? data : (data['@graph'] || [data]);
        for (const item of items) {
          if (item && (item['@type'] === 'JobPosting' || item.title || item.hiringOrganization)) {
            const company = typeof item.hiringOrganization === 'string'
              ? item.hiringOrganization
              : (item.hiringOrganization?.name || 'Company');
            
            const location = typeof item.jobLocation === 'string'
              ? item.jobLocation
              : (item.jobLocation?.address?.addressLocality || (item.applicantLocationRequirements ? 'Remote' : 'Remote / Flexible'));

            const jobObj = {
              id: `${sourceName}-${item.identifier?.value || item.id || Math.random().toString(36).substr(2, 9)}`,
              title: item.title || item.name || 'Software Engineer',
              company: company,
              location: location,
              url: item.url || fallbackUrl || 'https://example.com',
              description: item.description ? $(item.description).text().slice(0, 300) : '',
              tags: item.employmentType ? [item.employmentType] : ['Full-Time'],
              salary: item.baseSalary ? `${item.baseSalary.currency || '$'}${item.baseSalary.value?.value || item.baseSalary.value || ''}` : null,
              postedAt: item.datePosted || new Date().toISOString(),
              source: sourceName,
              extractionStrategy: 'JSON_LD',
              confidenceScore: 98,
              extractedAt: new Date().toISOString(),
            };

            const validated = JobPostingSchema.safeParse(jobObj);
            if (validated.success) jobs.push(validated.data);
          }
        }
      } catch (err) {
        // Continue to next tag
      }
    });
    return jobs;
  }

  /**
   * Tier 2: OpenGraph & Microdata extractor
   */
  extractMicrodata($, sourceName, fallbackUrl) {
    const jobs = [];
    $('[itemtype*="JobPosting"]').each((idx, el) => {
      const title = $(el).find('[itemprop="title"]').text().trim();
      const company = $(el).find('[itemprop="hiringOrganization"], [itemprop="name"]').text().trim();
      if (title && company) {
        const jobObj = {
          id: `${sourceName}-micro-${idx}-${Date.now()}`,
          title,
          company,
          location: $(el).find('[itemprop="jobLocation"]').text().trim() || 'Remote',
          url: $(el).find('a[href]').attr('href') || fallbackUrl,
          description: $(el).find('[itemprop="description"]').text().trim().slice(0, 200),
          tags: ['Full-Time'],
          salary: null,
          postedAt: new Date().toISOString(),
          source: sourceName,
          extractionStrategy: 'SEMANTIC_MICRODATA',
          confidenceScore: 90,
          extractedAt: new Date().toISOString(),
        };
        const validated = JobPostingSchema.safeParse(jobObj);
        if (validated.success) jobs.push(validated.data);
      }
    });
    return jobs;
  }

  /**
   * Tier 3: Resilient CSS Selector Cascade with Fuzzy Class Matchers
   */
  extractWithSelectorCascade($, sourceName, fallbackUrl) {
    const jobs = [];

    // Candidate card containers
    const cardSelectors = [
      'article.job-card', '.job-listing', '.job-item', 'li.feature', 'li[class*="job"]',
      'div[class*="job-card"]', 'div[class*="listing"]', 'div[data-job-id]',
      'tr[class*="job"]', 'article'
    ];

    let $cards = $(cardSelectors.join(', '));

    // If standard container selectors miss, search for common repeating parents of links
    if ($cards.length === 0) {
      $cards = $('a[href*="/job"], a[href*="/career"], a[href*="/position"]').parent();
    }

    $cards.each((idx, el) => {
      const $el = $(el);

      // Title extraction cascade
      const title = $el.find('h2, h3, h4, .title, [class*="title"], [class*="position"], strong').first().text().trim();
      
      // Company extraction cascade
      const company = $el.find('.company, [class*="company"], [class*="employer"], .company-name, [class*="org"], span:not([class*="badge"])').first().text().trim();

      // Location extraction cascade
      const location = $el.find('.location, [class*="location"], [class*="region"], [class*="geo"], .badge-location').first().text().trim() || 'Remote';

      // Link extraction
      let link = $el.is('a') ? $el.attr('href') : $el.find('a').first().attr('href');
      if (link && !link.startsWith('http')) {
        link = fallbackUrl ? new URL(link, fallbackUrl).toString() : link;
      }

      // Salary regex scan within card text
      const cardText = $el.text();
      const salaryMatch = cardText.match(/\$[0-9]{2,3}(?:,[0-9]{3})*(?:\s*(?:k|K|–|-|\/yr|\/hr))?/);
      const salary = salaryMatch ? salaryMatch[0] : null;

      // Extract tags/badges
      const tags = [];
      $el.find('.tag, .badge, [class*="tag"], [class*="pill"], [class*="skill"]').each((_, tagEl) => {
        const tagText = $(tagEl).text().trim();
        if (tagText && tagText.length < 25) tags.push(tagText);
      });

      if (title && title.length > 2 && (company || title.includes('Engineer') || title.includes('Developer'))) {
        const jobObj = {
          id: `${sourceName}-cascade-${idx}-${Date.now().toString(36)}`,
          title: title.replace(/\s+/g, ' ').slice(0, 100),
          company: company || 'Tech Company',
          location: location.replace(/\s+/g, ' ').slice(0, 80),
          url: link || fallbackUrl || 'https://example.com',
          description: $el.find('p, [class*="snippet"], [class*="desc"]').first().text().trim().slice(0, 200),
          tags: tags.length > 0 ? tags.slice(0, 4) : ['Engineering', 'Remote'],
          salary: salary,
          postedAt: new Date().toISOString(),
          source: sourceName,
          extractionStrategy: 'CSS_CASCADE',
          confidenceScore: 78,
          extractedAt: new Date().toISOString(),
        };

        const validated = JobPostingSchema.safeParse(jobObj);
        if (validated.success) jobs.push(validated.data);
      }
    });

    return jobs;
  }

  /**
   * Tier 4: Heuristic regex pattern extractor for heavily scrambled or minimal markup
   */
  extractRegexHeuristics($, sourceName, fallbackUrl) {
    const jobs = [];
    const fullText = $('body').text();
    const jobRegex = /(?:Senior|Lead|Junior|Staff|Principal|Full Stack|Frontend|Backend|DevOps|Data|Product|AI|ML)\s+(?:Software\s+)?(?:Engineer|Developer|Architect|Manager|Designer)\b/gi;
    
    let match;
    let count = 0;
    while ((match = jobRegex.exec(fullText)) !== null && count < 8) {
      count++;
      const title = match[0];
      const jobObj = {
        id: `${sourceName}-heuristic-${count}-${Date.now().toString(36)}`,
        title: title,
        company: 'Confidential / Fast-Growing Startup',
        location: 'Remote',
        url: fallbackUrl || 'https://example.com',
        description: 'Extracted via zero-shot heuristic pattern scanner due to upstream DOM mutation.',
        tags: ['Engineering', 'Full-Time'],
        salary: null,
        postedAt: new Date().toISOString(),
        source: sourceName,
        extractionStrategy: 'REGEX_HEURISTIC',
        confidenceScore: 52,
        extractedAt: new Date().toISOString(),
      };

      const validated = JobPostingSchema.safeParse(jobObj);
      if (validated.success) jobs.push(validated.data);
    }
    return jobs;
  }
}

export const parserEngine = new SelfHealingParser();
