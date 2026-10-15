import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Project Structure & Static Assets Validation', () => {
  const rootDir = process.cwd();

  describe('Core Pages Existence', () => {
    const requiredPages = [
      'src/pages/index.astro',
      'src/pages/about-us.astro',
      'src/pages/portfolio.astro',
      'src/pages/careers.astro',
      'src/pages/contact-us.astro',
      'src/pages/blog.astro',
      'src/pages/services/index.astro',
      'src/pages/services/brand-design.astro',
      'src/pages/services/social-media-marketing.astro',
      'src/pages/services/videography-photography.astro',
      'src/pages/services/web-development.astro',
      'src/pages/services/seo-optimization.astro',
      'src/pages/services/content-marketing.astro'
    ];

    it.each(requiredPages)('page %s should exist in repository', (relPath) => {
      const fullPath = path.join(rootDir, relPath);
      expect(fs.existsSync(fullPath)).toBe(true);
    });
  });

  describe('Public Favicon Assets', () => {
    it('public/favicon.ico and public/favicon.png must exist', () => {
      const faviconIco = path.join(rootDir, 'public', 'favicon.ico');
      const faviconPng = path.join(rootDir, 'public', 'favicon.png');
      expect(fs.existsSync(faviconIco)).toBe(true);
      expect(fs.existsSync(faviconPng)).toBe(true);
    });
  });

  describe('Section 04 Component Integrity (CampaignAnalytics.astro)', () => {
    it('should NOT contain the removed Production Editorial Queue or countdown elements', () => {
      const compPath = path.join(rootDir, 'src/components/CampaignAnalytics.astro');
      const content = fs.readFileSync(compPath, 'utf-8');

      expect(content.toLowerCase()).not.toContain('production editorial queue');
      expect(content.toLowerCase()).not.toContain('scheduled-pipeline-column');
      expect(content.toLowerCase()).not.toContain('pipeline-items-container');
      expect(content.toLowerCase()).not.toContain('queue');
    });

    it('should contain the balanced hall of fame dual grid and KPIs', () => {
      const compPath = path.join(rootDir, 'src/components/CampaignAnalytics.astro');
      const content = fs.readFileSync(compPath, 'utf-8');

      expect(content).toContain('hall-of-fame-wrapper');
      expect(content).toContain('media-duo-grid');
      expect(content).toContain('#1 MOST VIEWED REEL');
      expect(content).toContain('#1 MOST LIKED POST');
      expect(content).toContain('kpi-cards-grid');
      expect(content).toContain('studio-bottom-action-bar');
    });

    it('should NOT leak any forbidden client names in CampaignAnalytics.astro', () => {
      const compPath = path.join(rootDir, 'src/components/CampaignAnalytics.astro');
      const content = fs.readFileSync(compPath, 'utf-8').toLowerCase();

      const forbidden = ['beanery', 'velocita', 'aura'];
      for (const name of forbidden) {
        expect(content.includes(name)).toBe(false);
      }
    });
  });
});
