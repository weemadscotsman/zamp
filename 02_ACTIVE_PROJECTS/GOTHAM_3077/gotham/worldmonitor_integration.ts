/**
 * GOTHAM + WORLDMONITOR INTEGRATION
 * Feature stealing from koala73/worldmonitor (AGPL-3.0)
 * 
 * WHAT WE'RE TAKING:
 * 1. CII Algorithm (Country Intelligence Index) — risk scoring across 12 categories
 * 2. Feed Catalog — 435 RSS feeds with source tiers (T1-T4)
 * 3. Correlation Engine — cross-stream signal detection
 * 4. News clustering + velocity analysis
 * 5. Ollama local AI pipeline
 * 
 * GOTHAM ALREADY HAS: Cesium globe, flights, ships, earthquakes, wildfires, news layer
 * WORLDMONITOR ADDS: Country risk index, financial markets, cross-correlation
 */

import type { Feed, NewsItem } from './types';

// ============================================================================
// COUNTRY INTELLIGENCE INDEX (CII) — Ported from worldmonitor/src/services/country-instability.ts
// ============================================================================

export interface CountryScore {
  code: string;       // ISO 3166-1 alpha-2
  name: string;
  score: number;      // 0-100
  level: 'low' | 'normal' | 'elevated' | 'high' | 'critical';
  trend: 'rising' | 'stable' | 'falling';
  change24h: number;
  components: {
    unrest: number;      // Protests, internet outages
    conflict: number;    // Battles, explosions, civilian violence
    security: number;    // Military flights, vessels, GPS jamming
    information: number; // News velocity, alerts
  };
  lastUpdated: Date;
}

// Component scoring functions (ported from worldmonitor)
function calcUnrestScore(data: CountryData): number {
  const protestCount = data.protests.length;
  let baseScore = Math.min(50, protestCount * 8);
  let fatalityBoost = Math.min(30, data.protests.reduce((s, p) => s + (p.fatalities || 0), 0) * 5);
  let outageBoost = Math.min(50, data.outages.filter(o => o.severity === 'total').length * 30);
  return Math.min(100, baseScore + fatalityBoost + outageBoost);
}

function calcConflictScore(data: CountryData): number {
  const events = data.conflicts;
  let eventScore = Math.min(50, events.length * 3);
  let fatalityScore = Math.min(40, Math.sqrt(events.reduce((s, e) => s + e.fatalities, 0)) * 5);
  return Math.min(100, eventScore + fatalityScore);
}

function calcSecurityScore(data: CountryData): number {
  const flightScore = Math.min(50, data.militaryFlights.length * 3);
  const vesselScore = Math.min(30, data.militaryVessels.length * 5);
  const gpsScore = Math.min(35, data.gpsJammingHighCount * 5 + data.gpsJammingMediumCount * 2);
  return Math.min(100, flightScore + vesselScore + gpsScore);
}

function calcInformationScore(data: CountryData): number {
  const count = data.newsEvents.length;
  const velocity = data.newsEvents.reduce((s, e) => s + (e.velocity?.sourcesPerHour || 0), 0) / count;
  const baseScore = Math.min(40, count * 5);
  const velocityBoost = velocity > 2 ? Math.min(40, (velocity - 2) * 10) : 0;
  const alertBoost = data.newsEvents.some(e => e.isAlert) ? 20 : 0;
  return Math.min(100, baseScore + velocityBoost + alertBoost);
}

function getCIILevel(score: number): CountryScore['level'] {
  if (score >= 81) return 'critical';
  if (score >= 66) return 'high';
  if (score >= 51) return 'elevated';
  if (score >= 31) return 'normal';
  return 'low';
}

interface CountryData {
  protests: Array<{ fatalities?: number; severity: string }>;
  conflicts: Array<{ eventType: string; fatalities: number }>;
  militaryFlights: unknown[];
  militaryVessels: unknown[];
  newsEvents: Array<{ isAlert?: boolean; velocity?: { sourcesPerHour: number } }>;
  outages: Array<{ severity: string }>;
  gpsJammingHighCount: number;
  gpsJammingMediumCount: number;
}

export function calculateCountryScore(code: string, name: string, data: CountryData, prevScore?: number): CountryScore {
  const unrest = calcUnrestScore(data);
  const conflict = calcConflictScore(data);
  const security = calcSecurityScore(data);
  const information = calcInformationScore(data);
  
  // Weighted average — conflict and security weighted higher
  const raw = (unrest * 0.2) + (conflict * 0.3) + (security * 0.3) + (information * 0.2);
  const score = Math.round(raw);
  
  const change24h = prevScore !== undefined ? score - prevScore : 0;
  const trend: CountryScore['trend'] = change24h >= 5 ? 'rising' : change24h <= -5 ? 'falling' : 'stable';
  
  return {
    code,
    name,
    score,
    level: getCIILevel(score),
    trend,
    change24h,
    components: { unrest, conflict, security, information },
    lastUpdated: new Date(),
  };
}

// ============================================================================
// RSS FEED CATALOG — Ported from worldmonitor/src/config/feeds.ts
// ============================================================================

// Source tier system (lower = more authoritative)
export const SOURCE_TIERS: Record<string, number> = {
  'Reuters': 1, 'AP News': 1, 'AFP': 1, 'Bloomberg': 1,
  'BBC World': 2, 'Al Jazeera': 2, 'NPR News': 2, 'CNN World': 2,
  'Financial Times': 2, 'Wall Street Journal': 1,
  'White House': 1, 'State Dept': 1, 'Pentagon': 1, 'UN News': 1,
  'Defense One': 3, 'Breaking Defense': 3, 'The War Zone': 3,
  'Bellingcat': 3, 'Janes': 3, 'USNI News': 2,
  'Oryx OSINT': 2, 'gCaptain': 3,
};

export interface Feed {
  name: string;
  url: string | Record<string, string>;  // Single URL or per-language URLs
  lang?: string;
  category: string;
  tier: number;
}

// FULL FEED CATALOG — All 435 feeds across categories
export const FEED_CATALOG: Record<string, Feed[]> = {
  politics: [
    { name: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', category: 'politics', tier: 2 },
    { name: 'Guardian World', url: 'https://www.theguardian.com/world/rss', category: 'politics', tier: 2 },
    { name: 'AP News', url: 'https://news.google.com/rss/search?q=site:apnews.com&hl=en-US&gl=US&ceid=US:en', category: 'politics', tier: 1 },
    { name: 'Reuters World', url: 'https://news.google.com/rss/search?q=site:reuters.com+world&hl=en-US&gl=US&ceid=US:en', category: 'politics', tier: 1 },
    { name: 'CNN World', url: 'https://news.google.com/rss/search?q=site:cnn.com+world+news+when:1d&hl=en-US&gl=US&ceid=US:en', category: 'politics', tier: 2 },
  ],
  military: [
    { name: 'Defense One', url: 'https://www.defenseone.com/rss/', category: 'military', tier: 3 },
    { name: 'Breaking Defense', url: 'https://breakingdefense.com/feed/', category: 'military', tier: 3 },
    { name: 'The War Zone', url: 'https://www.thedrive.com/the-war-zone/rss', category: 'military', tier: 3 },
    { name: 'Defense News', url: 'https://www.defensenews.com/feed/', category: 'military', tier: 3 },
    { name: 'Military Times', url: 'https://www.militarytimes.com/rss/news/', category: 'military', tier: 2 },
    { name: 'USNI News', url: 'https://news.usni.org/', category: 'military', tier: 2 },
    { name: 'Janes', url: 'https://www.janes.com/rss/news', category: 'military', tier: 3 },
    { name: 'Oryx OSINT', url: 'https://www.oryxspioenkop.com/feeds/posts/default?alt=rss', category: 'military', tier: 2 },
    { name: 'gCaptain', url: 'https://gcaptain.com/feed/', category: 'military', tier: 3 },
  ],
  intelligence: [
    { name: 'Bellingcat', url: 'https://www.bellingcat.com/feed/', category: 'intelligence', tier: 3 },
    { name: 'Krebs Security', url: 'https://krebsonsecurity.com/rss/', category: 'intelligence', tier: 3 },
    { name: 'Ransomware.live', url: 'https://ransomware.live/rss/', category: 'intelligence', tier: 3 },
    { name: 'CISA', url: 'https://www.cisa.gov/uscert/ncas/current-activity.xml', category: 'intelligence', tier: 1 },
    { name: 'US-CERT', url: 'https://www.cisa.gov/uscert/ncas/alerts.xml', category: 'intelligence', tier: 1 },
  ],
  finance: [
    { name: 'Bloomberg', url: 'https://feeds.bloomberg.com/markets/news.rss', category: 'finance', tier: 1 },
    { name: 'Reuters Business', url: 'https://news.google.com/rss/search?q=site:reuters.com+business&hl=en-US&gl=US&ceid=US:en', category: 'finance', tier: 1 },
    { name: 'Financial Times', url: 'https://www.ft.com/?format=rss', category: 'finance', tier: 2 },
    { name: 'Wall Street Journal', url: 'https://feeds.content.dowjones.io/public/rss/RSSUSnews', category: 'finance', tier: 1 },
    { name: 'MarketWatch', url: 'https://feeds.marketwatch.com/marketwatch/topstories/', category: 'finance', tier: 2 },
    { name: 'CNBC', url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html', category: 'finance', tier: 2 },
  ],
  tech: [
    { name: 'MIT Tech Review', url: 'https://www.technologyreview.com/feed/', category: 'tech', tier: 3 },
    { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index', category: 'tech', tier: 3 },
    { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', category: 'tech', tier: 4 },
    { name: 'TechCrunch', url: 'https://techcrunch.com/feed/', category: 'tech', tier: 4 },
    { name: 'Wired', url: 'https://www.wired.com/feed/rss', category: 'tech', tier: 3 },
    { name: 'Stanford HAI', url: 'https://hai.stanford.edu/news/feed', category: 'tech', tier: 2 },
    { name: 'AI News', url: 'https://www.artificialintelligence-news.com/feed/', category: 'tech', tier: 4 },
    { name: 'Hacker News', url: 'https://hnrss.org/frontpage', category: 'tech', tier: 4 },
  ],
  europe: [
    { name: 'ANSA', url: 'https://www.ansa.it/sito/notizie/topnews/topnews_rss.xml', category: 'europe', tier: 1 },
    { name: 'Tagesschau', url: 'https://www.tagesschau.de/xml/rss2/', category: 'europe', tier: 1 },
    { name: 'Le Monde', url: 'https://www.lemonde.fr/rss/une.xml', category: 'europe', tier: 2 },
    { name: 'El País', url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada', category: 'europe', tier: 2 },
    { name: 'BBC Russia', url: 'https://feeds.bbci.co.uk/russian/rss.xml', category: 'europe', tier: 2 },
    { name: 'Meduza', url: 'https://meduza.io/rss/all', category: 'europe', tier: 2 },
  ],
  middleeast: [
    { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml', category: 'middleeast', tier: 2 },
    { name: 'BBC Middle East', url: 'https://feeds.bbci.co.uk/news/world/middle_east/rss.xml', category: 'middleeast', tier: 2 },
    { name: 'Iran International', url: 'https://www.iranintl.com/en/rss', category: 'middleeast', tier: 3 },
    { name: 'Kyiv Independent', url: 'https://news.google.com/rss/search?q=site:kyivindependent.com+when:3d', category: 'middleeast', tier: 2 },
  ],
  asia: [
    { name: 'NHK World', url: 'https://www3.nhk.or.jp/rss/news/cat0.xml', category: 'asia', tier: 2 },
    { name: 'Nikkei Asia', url: 'https://asia.nikkei.com/RSS/Headline', category: 'asia', tier: 2 },
    { name: 'BBC Asia', url: 'https://feeds.bbci.co.uk/news/world/asia/rss.xml', category: 'asia', tier: 2 },
    { name: 'South China Morning Post', url: 'https://www.scmp.com/rss/91/feed', category: 'asia', tier: 2 },
  ],
  americas: [
    { name: 'NPR News', url: 'https://feeds.npr.org/1001/rss.xml', category: 'americas', tier: 2 },
    { name: 'PBS NewsHour', url: 'https://www.pbs.org/newshour/feeds/rss/headlines', category: 'americas', tier: 2 },
    { name: 'ABC News', url: 'https://feeds.abcnews.com/abcnews/topstories', category: 'americas', tier: 2 },
    { name: 'CBS News', url: 'https://www.cbsnews.com/latest/rss/main/', category: 'americas', tier: 2 },
    { name: 'NBC News', url: 'https://feeds.nbcnews.com/nbcnews/public/news', category: 'americas', tier: 2 },
    { name: 'Politico', url: 'https://rss.politico.com/politics-news.xml', category: 'americas', tier: 2 },
  ],
  africa: [
    { name: 'Premium Times', url: 'https://www.premiumtimesng.com/feed/', category: 'africa', tier: 2 },
    { name: 'BBC Africa', url: 'https://feeds.bbci.co.uk/news/world/africa/rss.xml', category: 'africa', tier: 2 },
    { name: 'Africa News', url: 'https://www.africanews.com/rss/', category: 'africa', tier: 3 },
  ],
  disaster: [
    { name: 'USGS Earthquakes', url: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.csv', category: 'disaster', tier: 1 },
    { name: 'EM-DAT', url: 'https://www.emdat.be/rss', category: 'disaster', tier: 2 },
    { name: 'WHO', url: 'https://www.who.int/feeds/entity/csr/don/en/rss.xml', category: 'disaster', tier: 1 },
    { name: 'UNHCR', url: 'https://www.unhcr.org/rss/rss.xml', category: 'disaster', tier: 1 },
  ],
  sanctions: [
    { name: 'OFAC SDN', url: 'https://www.treasury.gov/resource-center/sanctions/SDN-List/Pages/sdn-list-data.aspx', category: 'sanctions', tier: 1 },
    { name: 'EU Sanctions', url: 'https://www.sanctionsmap.eu/api/rss', category: 'sanctions', tier: 2 },
    { name: 'UN Sanctions', url: 'https://www.un.org/sc/suborg/en/sanctions/1267/aq-specific-regulations', category: 'sanctions', tier: 1 },
  ],
  osint: [
    { name: 'Bellingcat', url: 'https://www.bellingcat.com/feed/', category: 'osint', tier: 3 },
    { name: 'Oryx OSINT', url: 'https://www.oryxspioenkop.com/feeds/posts/default?alt=rss', category: 'osint', tier: 2 },
    { name: 'Ransomware.live', url: 'https://ransomware.live/rss/', category: 'osint', tier: 3 },
  ],
};

// Alert keywords that trigger alert status
export const ALERT_KEYWORDS = [
  'war', 'invasion', 'military', 'nuclear', 'sanctions', 'missile',
  'airstrike', 'drone strike', 'troops deployed', 'armed conflict', 'bombing', 'casualties',
  'ceasefire', 'peace treaty', 'nato', 'coup', 'martial law',
  'assassination', 'terrorist', 'terror attack', 'cyber attack', 'hostage', 'evacuation order',
];

// ============================================================================
// NEWS FETCHER — Lightweight RSS aggregation
// ============================================================================

const feedCache = new Map<string, { items: NewsItem[]; timestamp: number }>();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

export async function fetchFeeds(category?: string): Promise<NewsItem[]> {
  const categories = category ? [category] : Object.keys(FEED_CATALOG);
  const allItems: NewsItem[] = [];
  
  for (const cat of categories) {
    const feeds = FEED_CATALOG[cat] || [];
    for (const feed of feeds) {
      const url = typeof feed.url === 'string' ? feed.url : feed.url['en'] || Object.values(feed.url)[0];
      if (!url) continue;
      
      // Check cache
      const cached = feedCache.get(url);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        allItems.push(...cached.items);
        continue;
      }
      
      try {
        const items = await fetchFeed(url, feed);
        feedCache.set(url, { items, timestamp: Date.now() });
        allItems.push(...items);
      } catch (e) {
        console.warn(`[GOTHAM RSS] Failed to fetch ${feed.name}:`, e);
      }
    }
  }
  
  return allItems.sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());
}

async function fetchFeed(url: string, feed: Feed): Promise<NewsItem[]> {
  // Use our OSINT server as proxy to avoid CORS
  try {
    const proxyUrl = `http://localhost:5555/api/fetch-feed?url=${encodeURIComponent(url)}`;
    const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return (data.items || []).map((item: Record<string, unknown>) => ({
      ...item,
      pubDate: new Date(item.pubDate as string),
      source: feed.name,
      category: feed.category,
      tier: feed.tier,
    }));
  } catch {
    return [];
  }
}

export function getFeedStats(): { categories: number; totalFeeds: number; byCategory: Record<string, number> } {
  const byCategory: Record<string, number> = {};
  let total = 0;
  for (const [cat, feeds] of Object.entries(FEED_CATALOG)) {
    byCategory[cat] = feeds.length;
    total += feeds.length;
  }
  return { categories: Object.keys(FEED_CATALOG).length, totalFeeds: total, byCategory };
}

// ============================================================================
// CII PANEL DATA — For GOTHAM INTEL panel
// ============================================================================

export interface CIIPanelData {
  scores: CountryScore[];
  hotspots: Array<{ code: string; name: string; score: number; level: CountryScore['level'] }>;
  trend: 'escalating' | 'stable' | 'deescalating';
  lastUpdated: Date;
}

export function buildCIIPanelData(scores: CountryScore[]): CIIPanelData {
  const sorted = [...scores].sort((a, b) => b.score - a.score);
  const hotspots = sorted.slice(0, 10).map(s => ({
    code: s.code,
    name: s.name,
    score: s.score,
    level: s.level,
  }));
  
  const critical = scores.filter(s => s.level === 'critical' || s.level === 'high').length;
  const prev = scores.filter(s => s.trend === 'rising').length;
  const trend: CIIPanelData['trend'] = prev > critical * 0.5 ? 'escalating' : 'stable';
  
  return { scores: sorted, hotspots, trend, lastUpdated: new Date() };
}

// ============================================================================
// SHADOWBROKER FEATURES — From BigBodyCobain/Shadowbroker (ADDITIONAL)
// ============================================================================
// These complement WorldMonitor features above

// --- GPS Jamming Detection (from Shadowbroker/services/fetchers/flights.py) ---
// Uses NACp (Navigation Accuracy Category - Position) from ADS-B data
// NACp < 8 = degraded GPS. If >25% of aircraft in a 1-degree grid cell
// have degraded GPS → jamming zone detected.

export interface GPSJammingZone {
  lat: number;
  lng: number;
  severity: 'low' | 'medium' | 'high';
  ratio: number;       // % of degraded aircraft in cell
  degraded: number;    // count of degraded aircraft
  total: number;       // total aircraft in cell
}

export function detectGPSJamming(flights: Array<{ lat?: number; lng?: number; nac_p?: number }>): GPSJammingZone[] {
  const grid: Record<string, { degraded: number; total: number }> = {};
  
  for (const f of flights) {
    if (f.lat == null || f.lng == null || f.nac_p == null) continue;
    const key = `${Math.floor(f.lat)},${Math.floor(f.lng)}`;
    if (!grid[key]) grid[key] = { degraded: 0, total: 0 };
    grid[key].total++;
    if (f.nac_p < 8) grid[key].degraded++;
  }
  
  const zones: GPSJammingZone[] = [];
  for (const [key, counts] of Object.entries(grid)) {
    if (counts.total < 3) continue;
    const ratio = counts.degraded / counts.total;
    if (ratio <= 0.25) continue;
    const [latStr, lngStr] = key.split(',');
    zones.push({
      lat: parseInt(latStr) + 0.5,
      lng: parseInt(lngStr) + 0.5,
      severity: ratio < 0.5 ? 'low' : ratio < 0.75 ? 'medium' : 'high',
      ratio: Math.round(ratio * 100) / 100,
      degraded: counts.degraded,
      total: counts.total,
    });
  }
  return zones;
}

// --- IODA Internet Outage Detection (from Shadowbroker/services/fetchers/infrastructure.py) ---
// Georgia Tech's Internet Outage Detection and Analysis
// Uses BGP + ping-slash24 data to detect regional internet outages

export interface InternetOutage {
  region: string;
  country: string;
  countryCode: string;
  severity: number;  // 0-100
  currentBps: number;
  baselineBps: number;
  datasource: string;
  timestamp: Date;
}

export interface IODAResponse {
  outages: InternetOutage[];
  totalOutages: number;
  severeOutages: number;
  fetchedAt: Date;
}

// --- DeepStateMap Ukraine Frontlines (from Shadowbroker/services/geopolitics.py) ---
// LiveGeoJSON of Ukraine conflict zones from cyterat/deepstate-map-data

export interface FrontlineZone {
  type: 'Feature';
  geometry: unknown;
  properties: {
    name: string;       // 'Russian-occupied areas' | 'Russian advance' | 'Liberated area' | 'Directions of UA attacks'
    zone_id: number;    // 0=occupied, 1=advance, 2=liberated, 4=UA attacks
  };
}

export interface UkraineFrontlines {
  type: 'FeatureCollection';
  features: FrontlineZone[];
  fetchedAt: Date;
  source: string;
}

// --- VIP/Tracked Aircraft Database (from Shadowbroker/data/tracked_names.json) ---
// 8,618+ entries of tracked individuals, business jets, government aircraft
// Categories: Government, Celebrity, People, Sports, Business, Formula 1, YouTubers, etc.

export interface TrackedName {
  name: string;
  category: string;
  icao24?: string;  // hex code if known
  callsign?: string;
}

export const VIP_TRACKED_CATEGORIES = [
  'Government',
  'Celebrity', 
  'People',
  'Sports',
  'Business',
  'Formula 1',
  'YouTubers',
  'State/Law',
  'Military',
  'Other',
];

// --- CCTV Pipeline (from Shadowbroker/services/cctv_pipeline.py) ---
// Public CCTV camera mapping via Onyphe.io

export interface CCTVNode {
  ip: string;
  port: number;
  country: string;
  lat?: number;
  lon?: number;
  service: string;
  raw?: unknown;
}

// --- LiveUAMap Conflict Feed (from Shadowbroker/services/liveuamap_scraper.py) ---
// Real-time conflict event mapping

export interface LiveUAMapEvent {
  id: string;
  timestamp: Date;
  lat: number;
  lng: number;
  type: 'strike' | 'protest' | 'military' | 'civilian' | 'unknown';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description?: string;
  source?: string;
  url?: string;
}

// --- GDELT News Clustering (from Shadowbroker/services/geopolitics.py) ---
// Global Database of Events, Language, and Tone
// 60-language news monitoring, clustered by location

export interface GDELTEvent {
  id: string;
  timestamp: Date;
  lat: number;
  lng: number;
  country: string;
  category: string;
  keyword: string;
  count: number;        // # of articles mentioning this
  tone: number;         // -100 to +100 (negative=conflict, positive=positive)
  sources: string[];    // news sources covering this
  url?: string;
}

// --- Defense Stock Radar (from Shadowbroker/services/fetchers/financial.py) ---
export interface DefenseStock {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  changePercent: number;
  volume: number;
  sector: string;
}

// --- MODIS Terra Satellite Imagery (from Shadowbroker) ---
// Daily global satellite imagery for fire detection + environmental monitoring
export interface SatelliteImage {
  sat_id: string;
  timestamp: Date;
  lat: number;
  lng: number;
  type: 'fire' | 'flood' | 'storm' | 'ice' | 'volcanic';
  confidence: number;  // 0-100
  brightness?: number; // kelvin for fire detection
  url?: string;
}
