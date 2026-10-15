// src/lib/campaign-analytics-data.ts
// Single source of truth for Section 04 dynamic performance metrics (Last 30 Days)

export interface MetricCardData {
  num: string;
  growth: string;
  sub: string;
}

export interface MetricRateData {
  num: string;
  benchmark: string;
  fill: string;
  tier: string;
}

export interface ReelData {
  title: string;
  handle: string;
  desc: string;
  audio: string;
  views: string;
  watch: string;
  shares: string;
  viralScore: string;
  imgSrc: string;
}

export interface PostData {
  title: string;
  handle: string;
  desc: string;
  likes: string;
  comments: string;
  saves: string;
  saveRate: string;
  tags: string[];
  imgSrc: string;
}

export interface StreamItem {
  views: MetricCardData;
  interactions: MetricCardData;
  rate: MetricRateData;
  audience: MetricCardData;
  reel: ReelData;
  post: PostData;
}

export type StreamKey = 'all' | 'video' | 'design';

export const STREAM_DATA: Record<StreamKey, StreamItem> = {
  all: {
    views: { num: "28.6M", growth: "+44.8% vs last month", sub: "Across all Reels, Shorts, and Brand Films" },
    interactions: { num: "2.84M", growth: "+51.2% surge", sub: "Shares, Saves, Comments & Inquiries" },
    rate: { num: "10.8%", benchmark: "vs 1.8% Industry Benchmark", fill: "88%", tier: "Top 1% Tier" },
    audience: { num: "48 Drops", growth: "100% On-Time", sub: "Produced, Color-Graded & Published" },
    reel: {
      title: "Cinematic Macro Lighting & Foley Extraction",
      handle: "@brandelier.in",
      desc: "Shot on anamorphic cinema lenses with custom studio Foley sound design. Generated over 6.4M organic views in under 3 weeks.",
      audio: "Original Audio — Brandelier Soundworks",
      views: "6.42M",
      watch: "92.8%",
      shares: "248.5K",
      viralScore: "★ 99.8 VIRAL INDEX",
      imgSrc: "/assets/images/hero/WhatsApp Image 2026-10-11 at 3.03.19 AM.webp"
    },
    post: {
      title: "Behind The Frame: Lighting & Art Direction",
      handle: "@brandelier.in",
      desc: "10-slide visual masterclass breaking down studio set architecture, color grading palettes, and high-contrast photography.",
      likes: "418.6K",
      comments: "22.4K",
      saves: "118.2K",
      saveRate: "32.6% SAVE RATE",
      tags: ["#BrandelierCraft", "#VisualIdentity", "#ArtDirection", "#ProductionDesign"],
      imgSrc: "/assets/images/hero/WhatsApp Image 2026-10-11 at 3.04.52 AM.webp"
    }
  },
  video: {
    views: { num: "22.4M", growth: "+58.2% vs last month", sub: "Dedicated 4K Short-Form & Reel Series" },
    interactions: { num: "2.15M", growth: "+62.4% video shares", sub: "Viral Audio Re-Shares & Watch Loops" },
    rate: { num: "12.4%", benchmark: "vs 2.2% Video Benchmark", fill: "95%", tier: "Viral Tier" },
    audience: { num: "28 Reels", growth: "100% Native 4K", sub: "Mastered in DaVinci Resolve Studio" },
    reel: {
      title: "Anamorphic Flare Test & High-Torque Motion Capture",
      handle: "@brandelier.in",
      desc: "Chase vehicle gimbal setup capturing high-speed optical flares during twilight. 94.6% average completion rate.",
      audio: "Synthesizer Atmosphere — Brandelier Studio",
      views: "8.15M",
      watch: "94.6%",
      shares: "312.0K",
      viralScore: "★ 99.9 VIRAL INDEX",
      imgSrc: "/assets/images/hero/WhatsApp Image 2026-10-11 at 3.05.28 AM.webp"
    },
    post: {
      title: "Rig Anatomy: Building the Zero-Vibration Cinema Rig",
      handle: "@brandelier.in",
      desc: "Multi-angle breakdowns of custom matte boxes, follow focus wireless motors, and field monitor calibration.",
      likes: "364.2K",
      comments: "19.8K",
      saves: "104.5K",
      saveRate: "29.8% SAVE RATE",
      tags: ["#CameraRig", "#Cinematography", "#FilmmakingGear", "#BehindTheScenes"],
      imgSrc: "/assets/images/hero/WhatsApp Image 2026-10-11 at 3.07.31 AM.webp"
    }
  },
  design: {
    views: { num: "6.2M", growth: "+24.1% vs last month", sub: "Editorial Carousels & Visual Identity Drops" },
    interactions: { num: "690K", growth: "+31.8% bookmark surge", sub: "Saves & High-Intent Professional Shares" },
    rate: { num: "8.9%", benchmark: "vs 1.4% Graphic Benchmark", fill: "76%", tier: "Elite Tier" },
    audience: { num: "20 Grids", growth: "Bespoke Typography", sub: "Vector Assets & Print-Ready Identity" },
    reel: {
      title: "Speed Art: Vector Lettering from Sketch to Final Identity",
      handle: "@brandelier.in",
      desc: "Time-lapse screen recording illustrating bespoke font kerning and custom monogram creation in Illustrator.",
      audio: "Lo-Fi Beats for Design — Brandelier Lab",
      views: "3.28M",
      watch: "89.4%",
      shares: "124.6K",
      viralScore: "★ 98.4 VIRAL INDEX",
      imgSrc: "/assets/images/hero/WhatsApp Image 2026-10-11 at 3.03.19 AM.webp"
    },
    post: {
      title: "Color Psychology: How Midnight Navy Drives Luxury Conversion",
      handle: "@brandelier.in",
      desc: "8-slide case study examining color palette choices across high-growth lifestyle brands.",
      likes: "284.1K",
      comments: "14.6K",
      saves: "98.2K",
      saveRate: "34.5% SAVE RATE",
      tags: ["#BrandDesign", "#ColorTheory", "#VisualStrategy", "#StudioPortfolio"],
      imgSrc: "/assets/images/hero/WhatsApp Image 2026-10-11 at 3.05.28 AM.webp"
    }
  }
};

/**
 * Get stream data safely by key with fallback to 'all'
 */
export function getStreamData(streamKey: string): StreamItem {
  if (streamKey in STREAM_DATA) {
    return STREAM_DATA[streamKey as StreamKey];
  }
  return STREAM_DATA.all;
}

/**
 * Check if any forbidden client or agency names are present in any content string
 */
export const DEFAULT_FORBIDDEN_NAMES = ['beanery', 'velocita', 'aura', 'the beanery'];

export function containsForbiddenClientNames(text: string, forbiddenNames: string[] = DEFAULT_FORBIDDEN_NAMES): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return forbiddenNames.some(name => lower.includes(name.toLowerCase()));
}

/**
 * Parse human formatted metric strings like "28.6M", "690K", "10.8%" into raw numbers
 */
export function parseMetricToNumber(metricStr: string): number {
  if (!metricStr) return 0;
  const cleaned = metricStr.trim().replace(/,/g, '');
  if (cleaned.endsWith('M')) {
    return parseFloat(cleaned.slice(0, -1)) * 1_000_000;
  }
  if (cleaned.endsWith('K')) {
    return parseFloat(cleaned.slice(0, -1)) * 1_000;
  }
  if (cleaned.endsWith('%')) {
    return parseFloat(cleaned.slice(0, -1));
  }
  return parseFloat(cleaned) || 0;
}
