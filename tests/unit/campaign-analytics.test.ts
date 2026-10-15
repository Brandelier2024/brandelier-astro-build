import { describe, it, expect } from 'vitest';
import {
  STREAM_DATA,
  getStreamData,
  containsForbiddenClientNames,
  parseMetricToNumber,
  type StreamKey,
  type StreamItem
} from '../../src/lib/campaign-analytics-data';

describe('Studio Performance Engine (src/lib/campaign-analytics-data.ts)', () => {
  const streamKeys: StreamKey[] = ['all', 'video', 'design'];

  describe('Stream Data Structure & Schema', () => {
    it('should have all 3 production streams defined', () => {
      expect(Object.keys(STREAM_DATA)).toEqual(['all', 'video', 'design']);
    });

    it.each(streamKeys)('stream "%s" should have complete KPI and media definitions', (key) => {
      const stream: StreamItem = STREAM_DATA[key];
      expect(stream).toBeDefined();

      // Views KPI
      expect(stream.views.num).toBeTruthy();
      expect(stream.views.growth).toBeTruthy();
      expect(stream.views.sub).toBeTruthy();

      // Interactions KPI
      expect(stream.interactions.num).toBeTruthy();
      expect(stream.interactions.growth).toBeTruthy();
      expect(stream.interactions.sub).toBeTruthy();

      // Rate KPI
      expect(stream.rate.num).toMatch(/%/);
      expect(stream.rate.benchmark).toBeTruthy();
      expect(stream.rate.fill).toMatch(/%/);
      expect(stream.rate.tier).toBeTruthy();

      // Content Delivered KPI
      expect(stream.audience.num).toBeTruthy();
      expect(stream.audience.growth).toBeTruthy();
      expect(stream.audience.sub).toBeTruthy();

      // Reel Spotlight
      expect(stream.reel.title).toBeTruthy();
      expect(stream.reel.handle).toBe('@brandelier.in');
      expect(stream.reel.desc).toBeTruthy();
      expect(stream.reel.audio).toMatch(/Brandelier/);
      expect(stream.reel.views).toBeTruthy();
      expect(stream.reel.watch).toMatch(/%/);
      expect(stream.reel.shares).toBeTruthy();
      expect(stream.reel.viralScore).toMatch(/VIRAL INDEX/);

      // Post Spotlight
      expect(stream.post.title).toBeTruthy();
      expect(stream.post.handle).toBe('@brandelier.in');
      expect(stream.post.desc).toBeTruthy();
      expect(stream.post.likes).toBeTruthy();
      expect(stream.post.comments).toBeTruthy();
      expect(stream.post.saves).toBeTruthy();
      expect(stream.post.saveRate).toMatch(/%/);
      expect(stream.post.tags.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Zero Client Leakage Verification (Strict Anonymity Rule)', () => {
    it('should contain NO mentions of third-party clients across any stream data', () => {
      const forbiddenList = ['beanery', 'the beanery', 'velocita', 'aura'];
      const serializedData = JSON.stringify(STREAM_DATA).toLowerCase();

      for (const forbidden of forbiddenList) {
        expect(serializedData.includes(forbidden)).toBe(false);
      }
    });

    it('containsForbiddenClientNames() should correctly detect forbidden names', () => {
      expect(containsForbiddenClientNames('Beanery coffee shoot')).toBe(true);
      expect(containsForbiddenClientNames('The Velocita brand reel')).toBe(true);
      expect(containsForbiddenClientNames('Aura skincare visual')).toBe(true);
      expect(containsForbiddenClientNames('Brandelier studio cinematography')).toBe(false);
    });
  });

  describe('getStreamData()', () => {
    it('should return the correct stream item for known keys', () => {
      expect(getStreamData('all')).toBe(STREAM_DATA.all);
      expect(getStreamData('video')).toBe(STREAM_DATA.video);
      expect(getStreamData('design')).toBe(STREAM_DATA.design);
    });

    it('should fallback safely to "all" stream for invalid or unknown keys', () => {
      expect(getStreamData('non_existent')).toBe(STREAM_DATA.all);
      expect(getStreamData('')).toBe(STREAM_DATA.all);
    });
  });

  describe('parseMetricToNumber()', () => {
    it('should parse millions correctly', () => {
      expect(parseMetricToNumber('28.6M')).toBe(28_600_000);
      expect(parseMetricToNumber('6.42M')).toBe(6_420_000);
    });

    it('should parse thousands correctly', () => {
      expect(parseMetricToNumber('690K')).toBe(690_000);
      expect(parseMetricToNumber('248.5K')).toBe(248_500);
    });

    it('should parse percentages correctly', () => {
      expect(parseMetricToNumber('10.8%')).toBe(10.8);
      expect(parseMetricToNumber('92.8%')).toBe(92.8);
    });

    it('should handle raw numbers and fallbacks', () => {
      expect(parseMetricToNumber('48')).toBe(48);
      expect(parseMetricToNumber('')).toBe(0);
      expect(parseMetricToNumber('invalid')).toBe(0);
    });
  });

  describe('Quantitative Thresholds (Monthly Velocity Check)', () => {
    it('combined monthly views should exceed 20 Million', () => {
      const totalViews = parseMetricToNumber(STREAM_DATA.all.views.num);
      expect(totalViews).toBeGreaterThanOrEqual(20_000_000);
    });

    it('combined monthly interactions should exceed 2 Million', () => {
      const totalInteractions = parseMetricToNumber(STREAM_DATA.all.interactions.num);
      expect(totalInteractions).toBeGreaterThanOrEqual(2_000_000);
    });

    it('combined engagement rate should exceed the 5% high-performance benchmark', () => {
      const rate = parseMetricToNumber(STREAM_DATA.all.rate.num);
      expect(rate).toBeGreaterThan(5.0);
    });
  });
});
