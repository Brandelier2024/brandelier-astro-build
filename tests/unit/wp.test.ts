import { describe, it, expect } from 'vitest';
import {
  cleanHtml,
  sanitizeRichHtml,
  isSafeUrl,
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
  describe('sanitizeRichHtml()', () => {
    it('should strip script tags and their contents', () => {
      const malicious = '<p>Normal text</p><script>alert("XSS")</script><span>More text</span>';
      expect(sanitizeRichHtml(malicious)).toBe('<p>Normal text</p><span>More text</span>');
    });

    it('should strip iframes, objects, and embeds', () => {
      const malicious = '<p>Video</p><iframe src="https://evil.com"></iframe><object data="test.swf"></object><embed src="test.mov">';
      expect(sanitizeRichHtml(malicious)).toBe('<p>Video</p>');
    });

    it('should strip inline event handlers', () => {
      const malicious = '<img src="valid.jpg" onload="alert(1)" onerror="alert(2)" /><div onclick="doEvil()">Click</div>';
      expect(sanitizeRichHtml(malicious)).toBe('<img src="valid.jpg" /><div>Click</div>');
    });

    it('should neutralize javascript: and vbscript: pseudo-protocols', () => {
      const malicious = '<a href="javascript:alert(1)">Link</a><img src="javascript:evil()" />';
      const sanitized = sanitizeRichHtml(malicious);
      expect(sanitized).not.toContain('javascript:');
      expect(sanitized).toContain('href="#"');
      expect(sanitized).toContain('src="#"');
    });

    it('should strip SVG event handlers without preceding whitespace', () => {
      // SVG tag separated from onload by slash without whitespace
      const maliciousWithGroup = '<svg/onload=alert(1)><g onload="alert(2)">test</g></svg>safe text';
      expect(sanitizeRichHtml(maliciousWithGroup)).toBe('safe text');

      // Standalone unclosed SVG with slash-delimited onload
      const standaloneSvg = '<svg/onload=alert(1)>safe text';
      expect(sanitizeRichHtml(standaloneSvg)).toBe('safe text');

      // Self-closing SVG with onload
      const selfClosingSvg = '<svg/onload=alert(1)/>safe text';
      expect(sanitizeRichHtml(selfClosingSvg)).toBe('safe text');

      // Img tag with slash-delimited onerror
      const slashImg = '<img/onerror=alert(1) src="https://example.com/pic.jpg" />';
      expect(sanitizeRichHtml(slashImg)).toBe('<img src="https://example.com/pic.jpg" />');
    });

    it('should neutralize character-reference-obfuscated javascript URLs', () => {
      // Hex numeric entity for horizontal tab inside javascript scheme
      const tabObfuscated = '<a href="jav&#x09;ascript:alert(1)">click</a>';
      expect(sanitizeRichHtml(tabObfuscated)).toBe('<a href="#">click</a>');

      // Decimal numeric entities for all letters of javascript:
      const fullEntityEncoded = '<a href="&#106;&#97;&#118;&#97;&#115;&#99;&#114;&#105;&#112;&#116;:alert(1)">click</a>';
      expect(sanitizeRichHtml(fullEntityEncoded)).toBe('<a href="#">click</a>');

      // Entity-encoded colon &#58;
      const entityColon = '<a href="javascript&#58;alert(1)">click</a>';
      expect(sanitizeRichHtml(entityColon)).toBe('<a href="#">click</a>');

      // Named entities &Tab; and &NewLine;
      const namedTab = '<a href="jav&Tab;ascript:alert(1)">click</a>';
      expect(sanitizeRichHtml(namedTab)).toBe('<a href="#">click</a>');

      const namedNewline = '<a href="jav&NewLine;ascript:alert(1)">click</a>';
      expect(sanitizeRichHtml(namedNewline)).toBe('<a href="#">click</a>');
    });

    it('should preserve safe HTML tags and formatting', () => {
      const safe = '<h2>Title</h2><p>Paragraph with <strong>bold</strong> and <em>italic</em>.</p><ul><li>Item 1</li></ul>';
      expect(sanitizeRichHtml(safe)).toBe(safe);
    });

    it('should enforce rel="noopener noreferrer" on target="_blank" links', () => {
      const link = '<a href="https://brandelier.in" target="_blank">Brand</a>';
      expect(sanitizeRichHtml(link)).toBe('<a href="https://brandelier.in" target="_blank" rel="noopener noreferrer">Brand</a>');

      const existingRel = '<a href="https://brandelier.in" target="_blank" rel="nofollow">Brand</a>';
      expect(sanitizeRichHtml(existingRel)).toBe('<a href="https://brandelier.in" target="_blank" rel="nofollow noopener noreferrer">Brand</a>');
    });

    it('should handle empty and whitespace strings safely', () => {
      expect(sanitizeRichHtml('')).toBe('');
      // @ts-expect-error test undefined
      expect(sanitizeRichHtml(undefined)).toBe('');
    });
  });

  describe('isSafeUrl()', () => {
    it('should allow valid http and https URLs', () => {
      expect(isSafeUrl('https://brandelier.in')).toBe(true);
      expect(isSafeUrl('http://example.com/test?param=1')).toBe(true);
    });

    it('should allow mailto and tel links', () => {
      expect(isSafeUrl('mailto:hello@brandelier.in')).toBe(true);
      expect(isSafeUrl('tel:+919876543210')).toBe(true);
    });

    it('should allow safe relative URLs', () => {
      expect(isSafeUrl('/careers/seo-executive')).toBe(true);
      expect(isSafeUrl('./image.png')).toBe(true);
      expect(isSafeUrl('../blog')).toBe(true);
      expect(isSafeUrl('#section')).toBe(true);
      expect(isSafeUrl('?tab=details')).toBe(true);
    });

    it('should reject dangerous pseudo-protocols even with leading whitespace or mixed case', () => {
      expect(isSafeUrl('javascript:alert(1)')).toBe(false);
      expect(isSafeUrl('   JaVaScRiPt:alert(1)')).toBe(false);
      expect(isSafeUrl('vbscript:msgbox(1)')).toBe(false);
      expect(isSafeUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
      expect(isSafeUrl('file:///etc/passwd')).toBe(false);
    });

    it('should reject URLs with obfuscated control characters and character references', () => {
      expect(isSafeUrl('jav\0ascript:alert(1)')).toBe(false);
      expect(isSafeUrl('jav&#x09;ascript:alert(1)')).toBe(false);
      expect(isSafeUrl('&#106;&#97;&#118;&#97;&#115;&#99;&#114;&#105;&#112;&#116;:alert(1)')).toBe(false);
      expect(isSafeUrl('javascript&#58;alert(1)')).toBe(false);
      expect(isSafeUrl('jav&Tab;ascript:alert(1)')).toBe(false);
    });
  });

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
