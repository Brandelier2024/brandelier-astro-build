// src/lib/wp.ts
// Headless WordPress API Client for cms.brandelier.in

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
const WP_API_KEY = (import.meta.env && import.meta.env.WP_API_KEY) || 'bnd_sec_7f9c4e2a8d1b6e5f3c0a4e7d9b2a1c8f5e6d3a2b1c0e9f8a7b6c5d4e3f2a1b0c';

const defaultHeaders: Record<string, string> = {
  'Accept': 'application/json',
  'X-Brandelier-Key': WP_API_KEY
};

// Clean HTML tags and decode basic HTML entities
function cleanHtml(html: string): string {
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
    .replace(/&hellip;/g, '...')
    .replace(/\[&hellip;\]/g, '...')
    .trim();
}

// Calculate approximate read time
function calculateReadTime(text: string): string {
  const words = cleanHtml(text).split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(words / 200));
  return `${minutes} min read`;
}

// Format WordPress ISO date to human friendly string
function formatDate(isoDate: string): string {
  try {
    const d = new Date(isoDate);
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
const FALLBACK_POSTS: BlogPost[] = [
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

function transformWpPost(post: any): BlogPost {
  const title = cleanHtml(post.title?.rendered || 'Untitled Post');
  const content = post.content?.rendered || '';
  const excerpt = cleanHtml(post.excerpt?.rendered || '');
  
  // Extract category from embedded terms
  const terms = post._embedded?.['wp:term']?.[0] || [];
  const categories = terms.map((t: any) => t.name).filter(Boolean);
  const category = categories[0] || 'Insights';

  // Extract featured image from embedded media
  const media = post._embedded?.['wp:featuredmedia']?.[0];
  const image = media?.source_url || 
                media?.media_details?.sizes?.large?.source_url || 
                'https://cms.brandelier.in/wp-content/uploads/2025/08/Gemini_Generated_Image_6vcxf86vcxf86vcx.png';

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
      headers: defaultHeaders
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
      headers: defaultHeaders
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

function parseDepartment(classList: string[], title: string): string {
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

function parseJobType(classList: string[], title: string): string {
  const list = classList || [];
  const isIntern = list.some(c => c.includes('intern')) || /intern/i.test(title);
  const isFullTime = list.some(c => c.includes('full-time')) || /fulltime|full-time/i.test(title);
  if (isIntern && isFullTime) return 'Full Time / Internship';
  if (isIntern) return 'Internship';
  if (isFullTime) return 'Full Time';
  return 'Full Time';
}

function parseLocation(classList: string[]): string {
  const list = classList || [];
  if (list.some(c => c.includes('remote'))) return 'Remote';
  if (list.some(c => c.includes('hybrid'))) return 'Pune (Hybrid)';
  return 'Pune (On-site)';
}

function parseExperience(title: string): string {
  if (/intern/i.test(title)) return '0–2 Years';
  return '1–3 Years';
}

function extractKeySkills(title: string): string[] {
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
const FALLBACK_JOBS: JobOpening[] = [
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

function transformWpJob(raw: any): JobOpening {
  const title = cleanHtml(raw.title?.rendered || 'Open Role');
  const classList = raw.class_list || [];
  
  // Clean content or use default fallback if empty
  let content = raw.content?.rendered || '';
  if (!content.trim()) {
    const fallback = FALLBACK_JOBS.find(j => j.slug === raw.slug);
    if (fallback) content = fallback.content;
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
      headers: defaultHeaders
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
      headers: defaultHeaders
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

