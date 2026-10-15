import { describe, it, expect } from 'vitest';
import {
  cleanHtml,
  calculateReadTime,
  formatDate,
  parseDepartment,
  parseJobType,
  parseLocation,
  parseExperience,
  extractKeySkills,
  transformWpPost,
  transformWpJob,
  FALLBACK_POSTS,
  FALLBACK_JOBS
} from '../../src/lib/wp';

describe('WordPress CMS Utilities (src/lib/wp.ts)', () => {
  describe('cleanHtml()', () => {
    it('should strip standard HTML tags', () => {
      const input = '<p>Hello <strong>World</strong>, this is an <a href="#">anchor</a>.</p>';
      expect(cleanHtml(input)).toBe('Hello World, this is an anchor.');
    });

    it('should decode common HTML entities', () => {
      const input = '&quot;Brandelier&#8217;s&quot; &amp; &lt;Digital&gt; &#8220;Agency&#8221; &hellip;';
      expect(cleanHtml(input)).toBe('"Brandelier\'s" & <Digital> "Agency" ...');
    });

    it('should replace [&hellip;] with ...', () => {
      const input = 'Read more about marketing [&hellip;]';
      expect(cleanHtml(input)).toBe('Read more about marketing ...');
    });

    it('should handle empty strings and whitespace safely', () => {
      expect(cleanHtml('')).toBe('');
      expect(cleanHtml('   ')).toBe('');
      // @ts-expect-error test undefined input
      expect(cleanHtml(undefined)).toBe('');
    });
  });

  describe('calculateReadTime()', () => {
    it('should return minimum 1 min read for short text', () => {
      expect(calculateReadTime('Short sentence.')).toBe('1 min read');
    });

    it('should calculate read time based on ~200 words per minute', () => {
      const words250 = new Array(250).fill('creative').join(' ');
      expect(calculateReadTime(words250)).toBe('2 min read');

      const words450 = new Array(450).fill('branding').join(' ');
      expect(calculateReadTime(words450)).toBe('3 min read');
    });

    it('should strip HTML tags before counting words', () => {
      const htmlWords = '<p>' + new Array(400).fill('<strong>brand</strong>').join(' ') + '</p>';
      expect(calculateReadTime(htmlWords)).toBe('2 min read');
    });
  });

  describe('formatDate()', () => {
    it('should format ISO date strings into readable Month Day, Year format', () => {
      const formatted = formatDate('2025-08-24T17:52:28');
      expect(formatted).toBe('Aug 24, 2025');
    });

    it('should return raw string when given an invalid date', () => {
      const invalid = 'not-a-date';
      expect(formatDate(invalid)).toBe(invalid);
    });
  });

  describe('parseDepartment()', () => {
    it('should identify Production department from video / photo classes or titles', () => {
      expect(parseDepartment(['videography-tag'], 'Shooter')).toBe('Production');
      expect(parseDepartment([], 'Lead Videographer')).toBe('Production');
    });

    it('should identify Social Media department', () => {
      expect(parseDepartment(['social-media-team'], 'Strategist')).toBe('Social Media');
      expect(parseDepartment([], 'Social Media Intern')).toBe('Social Media');
    });

    it('should identify Creative Design department', () => {
      expect(parseDepartment(['design-team'], 'Visual Lead')).toBe('Creative Design');
      expect(parseDepartment([], 'Senior Graphic Designer')).toBe('Creative Design');
    });

    it('should identify Performance & SEO department', () => {
      expect(parseDepartment(['marketing-seo'], 'Analyst')).toBe('Performance & SEO');
      expect(parseDepartment([], 'Technical SEO Specialist')).toBe('Performance & SEO');
    });

    it('should fallback to Creative Agency for unclassified roles', () => {
      expect(parseDepartment([], 'Executive Assistant')).toBe('Creative Agency');
    });
  });

  describe('parseJobType()', () => {
    it('should identify Full Time / Internship when both flags are present', () => {
      expect(parseJobType(['intern', 'full-time'], 'Creative Trainee')).toBe('Full Time / Internship');
      expect(parseJobType([], 'Social Media Fulltime / Intern')).toBe('Full Time / Internship');
    });

    it('should identify pure Internship', () => {
      expect(parseJobType(['intern'], 'Marketing Assistant')).toBe('Internship');
      expect(parseJobType([], 'Video Editing Intern')).toBe('Internship');
    });

    it('should default to Full Time', () => {
      expect(parseJobType([], 'Art Director')).toBe('Full Time');
    });
  });

  describe('parseLocation()', () => {
    it('should detect remote positions', () => {
      expect(parseLocation(['role-remote'])).toBe('Remote');
    });

    it('should detect hybrid positions', () => {
      expect(parseLocation(['hybrid-work'])).toBe('Pune (Hybrid)');
    });

    it('should default to Pune (On-site)', () => {
      expect(parseLocation([])).toBe('Pune (On-site)');
    });
  });

  describe('parseExperience()', () => {
    it('should return 0–2 Years for intern roles', () => {
      expect(parseExperience('Copywriting Intern')).toBe('0–2 Years');
    });

    it('should return 1–3 Years for standard roles', () => {
      expect(parseExperience('Motion Graphics Designer')).toBe('1–3 Years');
    });
  });

  describe('extractKeySkills()', () => {
    it('should return camera & lighting skills for videographers', () => {
      const skills = extractKeySkills('Senior Videographer / Photographer');
      expect(skills).toContain('Camera Operation (Sony/Canon)');
      expect(skills).toContain('Lighting & Audio Setup');
    });

    it('should return NLE software for video editors', () => {
      const skills = extractKeySkills('Lead Video Editor');
      expect(skills).toContain('Adobe Premiere Pro');
      expect(skills).toContain('DaVinci Resolve');
    });

    it('should return trend & growth skills for social media roles', () => {
      const skills = extractKeySkills('Social Media Manager');
      expect(skills).toContain('Content Calendars');
      expect(skills).toContain('Trend Spotting & Viral Hooks');
    });

    it('should return Adobe & Figma skills for graphic designers', () => {
      const skills = extractKeySkills('Graphic Designer');
      expect(skills).toContain('Adobe Photoshop & Illustrator');
      expect(skills).toContain('Figma');
    });

    it('should return SEO tools for SEO roles', () => {
      const skills = extractKeySkills('Technical SEO Executive');
      expect(skills).toContain('Keyword Research (Ahrefs/SEMrush)');
      expect(skills).toContain('Google Search Console & GA4');
    });
  });

  describe('FALLBACK_POSTS schema integrity', () => {
    it('should contain valid fallback blog posts', () => {
      expect(FALLBACK_POSTS.length).toBeGreaterThan(0);
      for (const post of FALLBACK_POSTS) {
        expect(post.id).toBeTypeOf('number');
        expect(post.slug).toBeTypeOf('string');
        expect(post.title).toBeTruthy();
        expect(post.content).toBeTruthy();
        expect(post.excerpt).toBeTruthy();
        expect(post.date).toBeTruthy();
        expect(post.category).toBeTruthy();
        expect(post.href).toMatch(/^\/blog\//);
        expect(post.readTime).toMatch(/min read/);
        expect(post.image).toBeTruthy();
      }
    });
  });

  describe('FALLBACK_JOBS schema integrity', () => {
    it('should contain valid fallback job openings', () => {
      expect(FALLBACK_JOBS.length).toBeGreaterThan(0);
      for (const job of FALLBACK_JOBS) {
        expect(job.id).toBeTypeOf('number');
        expect(job.slug).toBeTypeOf('string');
        expect(job.title).toBeTruthy();
        expect(job.content).toBeTruthy();
        expect(job.department).toBeTruthy();
        expect(job.location).toMatch(/Pune|Remote/);
        expect(job.href).toMatch(/^\/careers\//);
        expect(job.skills.length).toBeGreaterThan(0);
      }
    });
  });

  describe('transformWpPost()', () => {
    it('should correctly transform raw WordPress API post payload', () => {
      const rawPost = {
        id: 999,
        slug: 'ai-creative-direction',
        title: { rendered: 'AI Creative Direction &amp; Film' },
        content: { rendered: '<p>Exploring modern production pipelines.</p>' },
        excerpt: { rendered: '<p>A quick summary &hellip;</p>' },
        date: '2026-03-10T12:00:00',
        _embedded: {
          'wp:term': [[{ name: 'Branding' }, { name: 'AI' }]],
          author: [{ name: 'Studio Lead' }],
          'wp:featuredmedia': [{ source_url: 'https://example.com/image.webp' }]
        }
      };

      const result = transformWpPost(rawPost);

      expect(result.id).toBe(999);
      expect(result.slug).toBe('ai-creative-direction');
      expect(result.title).toBe('AI Creative Direction & Film');
      expect(result.excerpt).toBe('A quick summary ...');
      expect(result.category).toBe('Branding');
      expect(result.categories).toEqual(['Branding', 'AI']);
      expect(result.author).toBe('Studio Lead');
      expect(result.image).toBe('https://example.com/image.webp');
      expect(result.href).toBe('/blog/ai-creative-direction');
      expect(result.readTime).toBe('1 min read');
    });
  });

  describe('transformWpJob()', () => {
    it('should correctly transform raw WordPress job opening payload', () => {
      const rawJob = {
        id: 1001,
        slug: 'motion-designer',
        title: { rendered: 'Lead Motion Designer' },
        content: { rendered: '<p>Create 3D and 2D motion graphics.</p>' },
        excerpt: { rendered: '<p>Join our motion team.</p>' },
        class_list: ['role-design', 'hybrid'],
        date: '2026-02-15T10:00:00',
        link: 'https://cms.brandelier.in/jobs/motion-designer/'
      };

      const result = transformWpJob(rawJob);

      expect(result.id).toBe(1001);
      expect(result.slug).toBe('motion-designer');
      expect(result.title).toBe('Lead Motion Designer');
      expect(result.department).toBe('Creative Design');
      expect(result.location).toBe('Pune (Hybrid)');
      expect(result.href).toBe('/careers/motion-designer');
    });
  });
});
