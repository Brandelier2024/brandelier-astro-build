// src/lib/wp.ts
// Headless WordPress API Client for cms.brandelier.in

import { decodeHTML } from 'entities';

export interface BlogPost {
  id: number;
  slug: string;
  title: string;
  content: string;
  excerpt: string;
  date: string;
  rawDate: string;
  category: string;
  categories: string[];
  image: string;
  readTime: string;
  author: string;
  href: string;
  seo?: {
    title?: string;
    description?: string;
    canonical?: string;
    focusKeyword?: string;
    ogTitle?: string;
    ogDescription?: string;
    ogImage?: string;
    robots?: string[];
  };
}

const WP_API_URL = 'https://cms.brandelier.in/wp-json/wp/v2';
const WP_API_KEY = (import.meta.env && import.meta.env.WP_API_KEY) || '';

const defaultHeaders: Record<string, string> = {
  'Accept': 'application/json',
  'X-Brandelier-Key': WP_API_KEY
};

const API_TIMEOUT_MS = 8000;

// Clean HTML tags and decode basic HTML entities
export function cleanHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/\[&hellip;\]/g, '...')
    .replace(/&hellip;/g, '...')
    .replace(/\[\.\.\.\]/g, '...')
    .trim();
}

// List of allowed tags for rich blog/job content
const ALLOWED_TAGS = new Set([
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'a', 'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'del', 'ins',
  'mark', 'small', 'sub', 'sup', 'span', 'div', 'hr', 'br',
  'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'kbd', 'samp', 'var',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption',
  'figure', 'figcaption', 'img', 'q', 'time'
]);

// Tags whose contents must be dropped
const DROP_CONTENT_TAGS = new Set([
  'script', 'style', 'iframe', 'object', 'embed', 'applet', 'svg', 'math', 'noscript', 'template'
]);

// Global allowed attributes
const GLOBAL_ALLOWED_ATTRS = new Set([
  'class', 'id', 'title', 'dir', 'lang', 'role'
]);

// Tag-specific allowed attributes
const TAG_ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'target', 'rel', 'download', 'title']),
  img: new Set(['src', 'alt', 'width', 'height', 'loading', 'decoding', 'srcset', 'sizes']),
  th: new Set(['colspan', 'rowspan', 'scope', 'headers']),
  td: new Set(['colspan', 'rowspan', 'headers']),
  ol: new Set(['start', 'reversed', 'type']),
  li: new Set(['value']),
  blockquote: new Set(['cite']),
  q: new Set(['cite']),
  del: new Set(['cite', 'datetime']),
  ins: new Set(['cite', 'datetime']),
  time: new Set(['datetime'])
};

const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'
]);

/**
 * Validates URL schemes after decoding character references to prevent XSS.
 * Only allows http, https, mailto, tel, or safe relative URLs.
 */
export function isSafeUrl(rawUrl: string): boolean {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  // 1. Decode character references (HTML entities like &#x09;, &#106;, etc.)
  const decoded = decodeHTML(rawUrl);
  // 2. Strip whitespace and non-printable control characters that browsers ignore in URLs
  const cleaned = decoded.replace(/[\u0000-\u0020\u007F-\u009F\s]+/g, '');

  // 3. Reject if empty after cleaning
  if (!cleaned) return false;

  // 4. Safe relative URLs
  if (
    cleaned.startsWith('/') ||
    cleaned.startsWith('./') ||
    cleaned.startsWith('../') ||
    cleaned.startsWith('#') ||
    cleaned.startsWith('?')
  ) {
    return true;
  }

  // 5. Check protocol
  const colonIdx = cleaned.indexOf(':');
  if (colonIdx === -1) {
    // Relative path without scheme
    return true;
  }

  const scheme = cleaned.slice(0, colonIdx).toLowerCase();
  return scheme === 'http' || scheme === 'https' || scheme === 'mailto' || scheme === 'tel';
}

function escapeAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

interface ParsedAttr {
  name: string;
  value: string;
}

function parseAttributes(attrText: string): ParsedAttr[] {
  const attrs: ParsedAttr[] = [];
  let i = 0;
  const len = attrText.length;

  while (i < len) {
    // Skip whitespace and slashes
    while (i < len && /[\s/]/.test(attrText[i])) i++;
    if (i >= len) break;

    // Read attribute name
    const nameStart = i;
    while (i < len && !/[\s/=]/.test(attrText[i])) i++;
    const name = attrText.slice(nameStart, i);
    if (!name) break;

    // Skip whitespace before '='
    while (i < len && /\s/.test(attrText[i])) i++;

    if (i < len && attrText[i] === '=') {
      i++; // skip '='
      // Skip whitespace after '='
      while (i < len && /\s/.test(attrText[i])) i++;

      if (i < len) {
        let val = '';
        const quote = attrText[i];
        if (quote === '"' || quote === "'") {
          i++; // skip quote
          const valStart = i;
          while (i < len && attrText[i] !== quote) i++;
          val = attrText.slice(valStart, i);
          if (i < len && attrText[i] === quote) i++;
        } else {
          // Unquoted value: terminates at whitespace, '/', or '>'
          const valStart = i;
          while (i < len && !/[\s/>]/.test(attrText[i])) i++;
          val = attrText.slice(valStart, i);
        }
        attrs.push({ name, value: val });
        continue;
      }
    }

    // Boolean attribute or attribute without value
    attrs.push({ name, value: '' });
  }

  return attrs;
}

/**
 * Sanitizes rich HTML from external CMS using an HTML-aware parser with element & attribute allowlists.
 * Validates URL schemes after decoding character references to prevent Stored XSS.
 */
export function sanitizeRichHtml(html: string): string {
  if (!html || typeof html !== 'string') return '';

  let out = '';
  let i = 0;
  const len = html.length;

  while (i < len) {
    const nextLt = html.indexOf('<', i);
    if (nextLt === -1) {
      out += html.slice(i);
      break;
    }

    out += html.slice(i, nextLt);
    i = nextLt;

    // Check for comments <!-- ... -->
    if (html.startsWith('<!--', i)) {
      const endComment = html.indexOf('-->', i + 4);
      if (endComment === -1) break;
      i = endComment + 3;
      continue;
    }

    // Check for <! or <?
    if (html.startsWith('<!', i) || html.startsWith('<?', i)) {
      const endTag = html.indexOf('>', i);
      if (endTag === -1) break;
      i = endTag + 1;
      continue;
    }

    // Parse tag
    const isClosing = html[i + 1] === '/';
    const tagStart = isClosing ? i + 2 : i + 1;

    // Find end of tag name (delimited by whitespace, '/', '>', or end of string)
    let tagEnd = tagStart;
    while (tagEnd < len && !/[\s/>]/.test(html[tagEnd])) {
      tagEnd++;
    }

    const tagName = html.slice(tagStart, tagEnd).toLowerCase();

    if (!tagName || !/^[a-z][a-z0-9:-]*$/.test(tagName)) {
      out += '&lt;';
      i++;
      continue;
    }

    // Find the end of this tag definition '>'
    let cursor = tagEnd;
    let quote: string | null = null;
    let endOfTag = -1;

    while (cursor < len) {
      const ch = html[cursor];
      if (quote) {
        if (ch === quote) quote = null;
      } else {
        if (ch === '"' || ch === "'") {
          quote = ch;
        } else if (ch === '>') {
          endOfTag = cursor;
          break;
        }
      }
      cursor++;
    }

    if (endOfTag === -1) {
      break;
    }

    const tagContent = html.slice(tagEnd, endOfTag);
    const isSelfClosing = tagContent.trim().endsWith('/') || VOID_ELEMENTS.has(tagName);
    i = endOfTag + 1;

    // If this tag is one whose entire content must be dropped
    if (DROP_CONTENT_TAGS.has(tagName)) {
      if (!isClosing && !isSelfClosing) {
        // Look for matching closing tag `</tagName...>`
        const closePattern = new RegExp(`</${tagName}[^>]*>`, 'i');
        const remaining = html.slice(i);
        const match = remaining.match(closePattern);
        if (match && match.index !== undefined) {
          i += match.index + match[0].length;
        }
      }
      continue;
    }

    // Check if tag is in allowed list
    if (!ALLOWED_TAGS.has(tagName)) {
      continue;
    }

    if (isClosing) {
      out += `</${tagName}>`;
      continue;
    }

    // Parse attributes for allowed opening tag
    const rawAttrs = parseAttributes(tagContent);
    const validAttrs: string[] = [];
    const seenAttrs = new Set<string>();
    const allowedForTag = TAG_ALLOWED_ATTRS[tagName] || new Set();

    let hasTargetBlank = false;
    let existingRel = '';

    for (const { name: attrName, value: rawVal } of rawAttrs) {
      const lowerName = attrName.toLowerCase();

      // Disallow event handlers or malformed attribute names
      if (lowerName.startsWith('on') || !/^[a-z][a-z0-9_-]*$/i.test(lowerName)) {
        continue;
      }

      // Prevent duplicate attributes
      if (seenAttrs.has(lowerName)) continue;
      seenAttrs.add(lowerName);

      const isAria = lowerName.startsWith('aria-') && /^[a-z0-9-]+$/.test(lowerName);

      // Check allowlist
      if (!GLOBAL_ALLOWED_ATTRS.has(lowerName) && !isAria && !allowedForTag.has(lowerName)) {
        continue;
      }

      const decodedVal = decodeHTML(rawVal);

      // Validate URL attributes
      if (lowerName === 'href' || lowerName === 'src' || lowerName === 'cite') {
        if (!isSafeUrl(decodedVal)) {
          if (lowerName === 'href' || lowerName === 'src') {
            validAttrs.push(`${lowerName}="#"`);
          }
          continue;
        }
      }

      if (tagName === 'a' && lowerName === 'target') {
        const lowerVal = decodedVal.toLowerCase();
        if (lowerVal === '_blank' || lowerVal === '_self' || lowerVal === '_top' || lowerVal === '_parent') {
          validAttrs.push(`target="${escapeAttr(lowerVal)}"`);
          if (lowerVal === '_blank') {
            hasTargetBlank = true;
          }
        }
        continue;
      }

      if (tagName === 'a' && lowerName === 'rel') {
        existingRel = decodedVal;
        continue;
      }

      validAttrs.push(`${lowerName}="${escapeAttr(decodedVal)}"`);
    }

    if (tagName === 'a') {
      if (hasTargetBlank) {
        const relTokens = new Set(existingRel.split(/\s+/).filter(Boolean));
        relTokens.add('noopener');
        relTokens.add('noreferrer');
        validAttrs.push(`rel="${escapeAttr(Array.from(relTokens).join(' '))}"`);
      } else if (existingRel) {
        validAttrs.push(`rel="${escapeAttr(existingRel)}"`);
      }
    }

    const attrStr = validAttrs.length > 0 ? ' ' + validAttrs.join(' ') : '';
    out += isSelfClosing ? `<${tagName}${attrStr} />` : `<${tagName}${attrStr}>`;
  }

  return out.trim();
}


// Calculate approximate read time
export function calculateReadTime(text: string): string {
  const words = cleanHtml(text).split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(words / 200));
  return `${minutes} min read`;
}

// Format WordPress ISO date to human friendly string
export function formatDate(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return isoDate;
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch {
    return isoDate;
  }
}

// Fallback cache in case WordPress is temporarily unreachable during build
export const FALLBACK_POSTS: BlogPost[] = [
  {
    id: 5964,
    slug: 'what-you-need-to-know-to-launch-your-brand-on-social-media',
    title: 'What you need to know to launch your brand on social media?',
    content: '<p>Launching your brand on social media requires clarity, consistency, and an understanding of your target audience...</p>',
    excerpt: 'Launching a brand on social media requires more than just making an account and posting logos. Discover the foundational pillars of visual tone, audience alignment, and content scheduling.',
    date: 'Aug 24, 2025',
    rawDate: '2025-08-24T17:52:28',
    category: 'Branding',
    categories: ['Branding', 'Market Insights'],
    image: 'https://cms.brandelier.in/wp-content/uploads/2025/08/Gemini_Generated_Image_6vcxf86vcxf86vcx.png',
    readTime: '4 min read',
    author: 'Brandelier Team',
    href: '/blog/what-you-need-to-know-to-launch-your-brand-on-social-media'
  },
  {
    id: 4187,
    slug: 'best-time-to-post-on-instagram',
    title: 'The Best Time to Post on Instagram? Spoiler: It’s Not When You Think!',
    content: '<p>After dissecting millions of posts, social media studies generally agree on these patterns...</p>',
    excerpt: 'Generic posting schedules rarely deliver consistent reach. We break down algorithmic signals, audience active hours, and data testing strategies tailored to Indian D2C and service brands.',
    date: 'Jul 2, 2025',
    rawDate: '2025-07-02T09:48:33',
    category: 'Market Insights',
    categories: ['Market Insights', 'Branding'],
    image: 'https://cms.brandelier.in/wp-content/uploads/2025/07/ChatGPT-Image-Jul-2-2025-11_59_05-AM.webp',
    readTime: '5 min read',
    author: 'Brandelier Team',
    href: '/blog/best-time-to-post-on-instagram'
  },
  {
    id: 290,
    slug: 'essential-marketing-services',
    title: '10 Essential Marketing Services Every Business Needs',
    content: '<p>In today\'s competitive landscape, businesses must constantly adapt and evolve to stay relevant...</p>',
    excerpt: 'From high-intent SEO to thumb-stopping short form video, understand the modern marketing mix required to establish competitive advantage in today’s attention economy.',
    date: 'May 7, 2025',
    rawDate: '2025-05-07T12:26:26',
    category: 'Market Insights',
    categories: ['Market Insights'],
    image: 'https://cms.brandelier.in/wp-content/uploads/2025/05/35ffb2_01ab93a1624c45bbb747a0be4aba3d1dmv2.webp',
    readTime: '6 min read',
    author: 'Brandelier Team',
    href: '/blog/essential-marketing-services'
  }
];

export function transformWpPost(post: any): BlogPost {
  const title = cleanHtml(post.title?.rendered || 'Untitled Post');
  const content = sanitizeRichHtml(post.content?.rendered || '');
  const excerpt = cleanHtml(post.excerpt?.rendered || '');

  // Extract category from embedded terms
  const terms = post._embedded?.['wp:term']?.[0] || [];
  const categories = terms.map((t: any) => t.name).filter(Boolean);
  const category = categories[0] || 'Insights';

  // Extract featured image from embedded media
  const media = post._embedded?.['wp:featuredmedia']?.[0];
  const image = media?.source_url ||
    media?.media_details?.sizes?.large?.source_url ||
    '/fallback-placeholder.webp';

  // Extract author name
  const authorData = post._embedded?.author?.[0];
  const author = authorData?.name || 'Brandelier Studio';

  return {
    id: post.id,
    slug: post.slug,
    title,
    content,
    excerpt,
    date: formatDate(post.date),
    rawDate: post.date,
    category,
    categories,
    image,
    readTime: calculateReadTime(content || excerpt),
    author,
    href: `/blog/${post.slug}`,
    seo: post.seo ? {
      title: post.seo.title || title,
      description: post.seo.description || excerpt,
      canonical: post.seo.canonical,
      focusKeyword: post.seo.focusKeyword,
      ogTitle: post.seo.ogTitle || title,
      ogDescription: post.seo.ogDescription || excerpt,
      ogImage: post.seo.ogImage || image,
      robots: post.seo.robots
    } : undefined
  };
}

/**
 * Fetch all published posts from Headless WordPress (cms.brandelier.in)
 */
export async function getPosts(): Promise<BlogPost[]> {
  try {
    const res = await fetch(`${WP_API_URL}/posts?_embed&per_page=100`, {
      headers: defaultHeaders,
      signal: AbortSignal.timeout(API_TIMEOUT_MS)
    });

    if (!res.ok) {
      console.warn(`[WordPress CMS] Failed to fetch posts: HTTP ${res.status}. Using fallback posts.`);
      return FALLBACK_POSTS;
    }

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      return FALLBACK_POSTS;
    }

    return data.map(transformWpPost);
  } catch (error) {
    console.error('[WordPress CMS] Error fetching posts from cms.brandelier.in:', error);
    return FALLBACK_POSTS;
  }
}

/**
 * Fetch a single post by its slug from cms.brandelier.in
 */
export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  try {
    const res = await fetch(`${WP_API_URL}/posts?slug=${encodeURIComponent(slug)}&_embed`, {
      headers: defaultHeaders,
      signal: AbortSignal.timeout(API_TIMEOUT_MS)
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return transformWpPost(data[0]);
      }
    }
  } catch (error) {
    console.error(`[WordPress CMS] Error fetching post by slug "${slug}":`, error);
  }

  // Check fallback posts
  return FALLBACK_POSTS.find(p => p.slug === slug) || null;
}

// ========================================================
// HIREZOOT (WP Job Openings) API CLIENT
// Post type: awsm_job_openings
// Endpoint: https://cms.brandelier.in/wp-json/wp/v2/awsm_job_openings
// ========================================================

export interface JobOpening {
  id: number;
  slug: string;
  title: string;
  content: string;
  excerpt: string;
  department: string;
  type: string;
  location: string;
  experience: string;
  date: string;
  rawDate: string;
  link: string;
  href: string;
  skills: string[];
}

export function parseDepartment(classList: string[], title: string): string {
  const list = classList || [];
  if (list.some(c => c.includes('videography') || c.includes('photography'))) return 'Production';
  if (list.some(c => c.includes('social-media'))) return 'Social Media';
  if (list.some(c => c.includes('design'))) return 'Creative Design';
  if (list.some(c => c.includes('marketing') || c.includes('seo'))) return 'Performance & SEO';
  if (/video/i.test(title)) return 'Production';
  if (/graphic|design/i.test(title)) return 'Creative Design';
  if (/social/i.test(title)) return 'Social Media';
  if (/seo/i.test(title)) return 'Performance & SEO';
  return 'Creative Agency';
}

export function parseJobType(classList: string[], title: string): string {
  const list = classList || [];
  const isIntern = list.some(c => c.includes('intern')) || /intern/i.test(title);
  const isFullTime = list.some(c => c.includes('full-time')) || /fulltime|full-time/i.test(title);
  if (isIntern && isFullTime) return 'Full Time / Internship';
  if (isIntern) return 'Internship';
  if (isFullTime) return 'Full Time';
  return 'Full Time';
}

export function parseLocation(classList: string[]): string {
  const list = classList || [];
  if (list.some(c => c.includes('remote'))) return 'Remote';
  if (list.some(c => c.includes('hybrid'))) return 'Pune (Hybrid)';
  return 'Pune (On-site)';
}

export function parseExperience(title: string): string {
  if (/intern/i.test(title)) return '0–2 Years';
  return '1–3 Years';
}

export function extractKeySkills(title: string): string[] {
  const t = title.toLowerCase();
  if (t.includes('videographer') || t.includes('photographer')) {
    return ['Camera Operation (Sony/Canon)', 'Lighting & Audio Setup', 'Gimbal / Drone Operation', 'Visual Composition'];
  }
  if (t.includes('editor')) {
    return ['Adobe Premiere Pro', 'After Effects', 'DaVinci Resolve', 'Pacing & Sound Design'];
  }
  if (t.includes('social media')) {
    return ['Content Calendars', 'Trend Spotting & Viral Hooks', 'Instagram & LinkedIn Growth', 'Copywriting & Captions'];
  }
  if (t.includes('graphic designer') || t.includes('design')) {
    return ['Adobe Photoshop & Illustrator', 'Typography & Layouts', 'Brand Guidelines', 'Figma'];
  }
  if (t.includes('seo')) {
    return ['Keyword Research (Ahrefs/SEMrush)', 'Technical SEO Audits', 'Google Search Console & GA4', 'On-page Optimization'];
  }
  return ['Creativity', 'Team Collaboration', 'Attention to Detail', 'Storytelling'];
}

// Fallback jobs from HireZoot in case WordPress is temporarily unreachable during build
export const FALLBACK_JOBS: JobOpening[] = [
  {
    id: 6484,
    slug: 'videographer-photographer',
    title: 'Videographer / Photographer',
    content: `<h2>📌 Job Overview</h2><p>We are seeking a creative and passionate <strong>Videographer & Photographer</strong> to capture high-quality photos and videos for our brand, events, marketing campaigns, and social media platforms. The candidate should have strong visual storytelling skills, technical expertise in camera handling, lighting, and post-production editing.</p><hr/><h2>🎯 Key Responsibilities</h2><h3>📷 Photography:</h3><ul><li>Capture high-quality photographs for events, products, branding, and marketing campaigns</li><li>Plan and execute photo shoots including setup, lighting, and composition</li><li>Edit and retouch photos using professional editing tools</li><li>Maintain consistency in visual style and brand identity</li></ul><h3>🎥 Videography:</h3><ul><li>Shoot professional-quality videos for promotional, corporate, and social media content</li><li>Plan shots, camera angles, and storytelling sequences</li><li>Handle lighting, audio recording, and equipment setup</li><li>Assist in video editing, color grading, and post-production</li></ul><hr/><h2>🛠️ Required Skills & Qualifications</h2><ul><li>Proven experience as a Videographer, Photographer, or similar role</li><li>Strong knowledge of camera equipment, lenses, lighting, and audio gear</li><li>Proficiency in Adobe Premiere Pro, After Effects, Lightroom, Photoshop (DaVinci Resolve optional)</li><li>Understanding of composition, color theory, and storytelling</li></ul><hr/><h2>💼 What We Offer</h2><ul><li>Creative and dynamic work environment in Pune</li><li>Opportunity to work on diverse client projects across F&B, tech, and retail</li><li>Growth and skill development opportunities</li></ul>`,
    excerpt: 'We are seeking a creative and passionate Videographer & Photographer to capture high-quality photos and videos for our brand, events, marketing campaigns, and social media platforms.',
    department: 'Production',
    type: 'Full Time',
    location: 'Pune (On-site)',
    experience: '1–3 Years',
    date: 'Feb 4, 2026',
    rawDate: '2026-02-04T17:30:16',
    link: 'https://cms.brandelier.in/jobs/videographer-photographer/',
    href: '/careers/videographer-photographer',
    skills: ['Camera Operation (Sony/Canon)', 'Lighting & Audio Setup', 'Gimbal / Drone Operation', 'Visual Composition']
  },
  {
    id: 6482,
    slug: 'video-editior',
    title: 'Video Editor',
    content: `<h2>📌 Job Overview</h2><p>We are looking for a creative and detail-oriented <strong>Video Editor</strong> who can transform raw footage into engaging, high-quality video content. The ideal candidate should have strong storytelling skills, technical editing expertise, and the ability to meet deadlines while maintaining visual consistency and brand standards.</p><hr/><h2>🎯 Key Responsibilities</h2><ul><li>Edit reels, YouTube videos, and high-end brand commercials with motion graphics</li><li>Assemble raw footage, input music, dialogue, graphics, and sound effects</li><li>Perform color correction, audio mixing, and basic VFX</li><li>Continuously discover and implement new editing technologies and industry best practices</li></ul><hr/><h2>🛠️ Required Skills & Qualifications</h2><ul><li>Proficiency in Adobe Premiere Pro, After Effects, Final Cut Pro, or DaVinci Resolve</li><li>Knowledge of motion graphics and animation</li><li>Understanding of video formats, codecs, and compression for social platforms</li><li>Strong creativity, storytelling, and rhythm</li></ul>`,
    excerpt: 'We are looking for a creative and detail-oriented Video Editor who can transform raw footage into engaging, high-quality video content.',
    department: 'Production',
    type: 'Full Time',
    location: 'Pune (On-site)',
    experience: '1–3 Years',
    date: 'Feb 4, 2026',
    rawDate: '2026-02-04T17:26:49',
    link: 'https://cms.brandelier.in/jobs/video-editior/',
    href: '/careers/video-editior',
    skills: ['Adobe Premiere Pro', 'After Effects', 'DaVinci Resolve', 'Pacing & Sound Design']
  },
  {
    id: 6077,
    slug: 'social-media-intern',
    title: 'Social Media Fulltime / Intern',
    content: `<h2>📌 Job Overview</h2><p>At Brandelier, we believe in potential and passion. If you live and breathe Instagram reels, understand what hooks people online, and have a curiosity for content and SEO—we want to hear from you.</p><hr/><h2>✨ What You’ll Be Doing</h2><ul><li>Run and grow brand pages across platforms (Instagram, LinkedIn, X, etc.)</li><li>Write sharp, engaging captions and trend-aware content</li><li>Work closely with creatives and strategists to shape campaigns</li><li>Learn and apply basic SEO practices to boost content reach</li><li>Track, analyze, and iterate on what performs best</li></ul><hr/><h2>💡 Who You Are</h2><ul><li>0–2 years experience in social media (internships and freelance count!)</li><li>Passionate about digital trends, memes, and online culture</li><li>Curious, self-driven, and open to feedback</li><li>Bonus: Canva / Figma familiarity</li></ul>`,
    excerpt: 'Run and grow brand pages across platforms, write sharp, engaging captions, and work closely with creatives to craft viral brand campaigns.',
    department: 'Social Media',
    type: 'Full Time / Internship',
    location: 'Pune (On-site)',
    experience: '0–2 Years',
    date: 'Sep 23, 2025',
    rawDate: '2025-09-23T10:38:35',
    link: 'https://cms.brandelier.in/jobs/social-media-intern/',
    href: '/careers/social-media-intern',
    skills: ['Content Calendars', 'Trend Spotting & Viral Hooks', 'Instagram & LinkedIn Growth', 'Copywriting & Captions']
  },
  {
    id: 5203,
    slug: 'graphic-designer',
    title: 'Graphic Designer',
    content: `<h2>📌 Job Overview</h2><p>We are seeking a versatile <strong>Graphic Designer</strong> to join our creative team. You will be responsible for creating captivating visual assets across digital campaigns, brand identities, packaging, marketing collateral, and social media.</p><hr/><h2>🎯 Key Responsibilities</h2><ul><li>Design engaging graphics for Instagram carousels, ads, banners, and presentation decks</li><li>Develop complete brand identity systems including logos, color palettes, and typography</li><li>Collaborate with copywriters, art directors, and web developers to execute campaigns</li><li>Ensure visual consistency and aesthetic excellence across all deliverables</li></ul><hr/><h2>🛠️ Required Skills</h2><ul><li>Proficiency in Adobe Photoshop, Illustrator, and Figma</li><li>Solid understanding of layout principles, hierarchy, and typography</li><li>Strong portfolio demonstrating diverse digital and branding design work</li></ul>`,
    excerpt: 'Craft stunning brand identities, marketing collateral, social carousel graphics, and campaign visuals that turn heads and build trust.',
    department: 'Creative Design',
    type: 'Full Time',
    location: 'Pune (On-site)',
    experience: '1–3 Years',
    date: 'Jul 30, 2025',
    rawDate: '2025-07-30T11:28:45',
    link: 'https://cms.brandelier.in/jobs/graphic-designer/',
    href: '/careers/graphic-designer',
    skills: ['Adobe Photoshop & Illustrator', 'Typography & Layouts', 'Brand Guidelines', 'Figma']
  },
  {
    id: 5177,
    slug: 'seo-executive',
    title: 'SEO Executive',
    content: `<h2>📌 Job Overview</h2><p>We are looking for a passionate and result-driven <strong>SEO Executive</strong> to join our digital marketing team. The ideal candidate will be responsible for implementing SEO strategies that drive organic traffic, improve search engine rankings, and support overall business objectives.</p><hr/><h2>🎯 Key Responsibilities</h2><ul><li>Conduct keyword research and competitor analysis to identify growth opportunities</li><li>Optimize on-page elements (meta tags, headings, content, internal linking) for search engine visibility</li><li>Perform technical SEO audits and recommend fixes (site speed, crawlability, indexing)</li><li>Execute off-page SEO strategies including backlink acquisition and outreach</li><li>Monitor website performance using Google Analytics, Search Console, and SEMrush/Ahrefs</li><li>Generate SEO performance reports and track KPIs such as rankings, traffic, and conversions</li></ul><hr/><h2>🛠️ Requirements</h2><ul><li>Bachelor’s degree in Marketing, Communications, IT, or related field</li><li>1–3 years of proven SEO experience (Fresher roles welcome to apply)</li><li>Strong understanding of search engine algorithms and ranking methods</li><li>Hands-on experience with Google Search Console, Google Analytics, Ahrefs, SEMrush</li></ul>`,
    excerpt: 'Drive organic search dominance for our clients through on-page technical optimization, keyword gap research, backlink building, and Google Analytics tracking.',
    department: 'Performance & SEO',
    type: 'Full Time',
    location: 'Pune (On-site)',
    experience: '1–3 Years',
    date: 'Jul 30, 2025',
    rawDate: '2025-07-30T09:28:24',
    link: 'https://cms.brandelier.in/jobs/seo-executive/',
    href: '/careers/seo-executive',
    skills: ['Keyword Research (Ahrefs/SEMrush)', 'Technical SEO Audits', 'Google Search Console & GA4', 'On-page Optimization']
  }
];

export function transformWpJob(raw: any): JobOpening {
  const title = cleanHtml(raw.title?.rendered || 'Open Role');
  const classList = raw.class_list || [];

  // Clean and sanitize content or use default fallback if empty
  let content = sanitizeRichHtml(raw.content?.rendered || '');
  if (!content.trim()) {
    const fallback = FALLBACK_JOBS.find(j => j.slug === raw.slug);
    if (fallback) content = sanitizeRichHtml(fallback.content);
  }

  let excerpt = cleanHtml(raw.excerpt?.rendered || '');
  if (!excerpt.trim()) {
    const fallback = FALLBACK_JOBS.find(j => j.slug === raw.slug);
    excerpt = fallback ? fallback.excerpt : cleanHtml(content).slice(0, 180) + '...';
  }

  return {
    id: raw.id,
    slug: raw.slug,
    title,
    content,
    excerpt,
    department: parseDepartment(classList, title),
    type: parseJobType(classList, title),
    location: parseLocation(classList),
    experience: parseExperience(title),
    date: formatDate(raw.date),
    rawDate: raw.date,
    link: raw.link || `https://cms.brandelier.in/jobs/${raw.slug}/`,
    href: `/careers/${raw.slug}`,
    skills: extractKeySkills(title)
  };
}

export async function getJobs(): Promise<JobOpening[]> {
  try {
    const res = await fetch('https://cms.brandelier.in/wp-json/wp/v2/awsm_job_openings?per_page=100', {
      headers: defaultHeaders,
      signal: AbortSignal.timeout(API_TIMEOUT_MS)
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data.map(transformWpJob);
      }
    }
  } catch (error) {
    console.error('[HireZoot / WP Job Openings] Error fetching jobs from CMS:', error);
  }

  return FALLBACK_JOBS;
}

export async function getJobBySlug(slug: string): Promise<JobOpening | null> {
  try {
    const res = await fetch(`https://cms.brandelier.in/wp-json/wp/v2/awsm_job_openings?slug=${encodeURIComponent(slug)}`, {
      headers: defaultHeaders,
      signal: AbortSignal.timeout(API_TIMEOUT_MS)
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return transformWpJob(data[0]);
      }
    }
  } catch (error) {
    console.error(`[HireZoot / WP Job Openings] Error fetching job by slug "${slug}":`, error);
  }

  return FALLBACK_JOBS.find(j => j.slug === slug) || null;
}

