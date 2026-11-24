// Token Launch Radar — model v5 ("pooled-peer radar").
//
// One sealed snapshot in, one ranked board out. Every figure on the board is derived from the
// snapshot's own ten fields per protocol; no protocol name is ever special-cased.
//
// The model, in the order the dashboard's pricing waterfall shows it:
//
//   implied = TVL x BENCHMARK x SIZE x MOMENTUM x LONGEVITY
//
//   BENCHMARK  The median market-cap/TVL multiple of the protocol's traded peer pool. The pool is
//              the protocol's own category plus, when an analogue family exists, that family's
//              traded protocols pooled in as well (pooling always, not only for thin categories:
//              leave-one-out backtests on the snapshot's 128 traded peers price better pooled,
//              median log10 error 0.565 against 0.639 for own-category-only). The pooled median is
//              shrunk toward the all-market median in log space with weight n/(n+6), so a small
//              pool leans on the market and a large pool stands on its own. When no family
//              pooled in and the category itself holds three or more traded peers, the plain
//              category median is used unshrunk — the backtest prefers it there.
//   SIZE       Market multiples compress as TVL grows. A log-log regression of market cap on TVL
//              over every traded peer is fitted at run time (slope 0.52 on this snapshot); the
//              benchmark is scaled by (TVL / pool reference TVL)^-(1-slope), clamped to [0.25, 4].
//              The reference TVL is the pool's TVL-weighted median TVL.
//   MOMENTUM   The 7-day TVL change, damped to a fifth of its size and capped at +/-8%:
//              backtests show a week of TVL movement barely predicts value, so it nudges, never
//              drives. An unreported change counts as no movement.
//   LONGEVITY  A protocol that has run longer with no token carries a record a launch can be
//              priced against: 0.90 + 0.25 x min(age in years, 5)/5; an unknown listing date
//              counts as 0.95, neither rewarded nor punished.
//
// Each row also carries a value RANGE: the pool's interquartile multiples (25th and 75th
// percentile) carried through the same size, momentum and longevity factors, and a CONFIDENCE
// grade from the pool's size and the range's width. The whole model was leave-one-out backtested
// on the snapshot's traded peers before it shipped: median log10 error 0.565, 30% of peers priced
// within 2x. The dashboard states these figures; they are the model's own record, not a promise.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's version label: the dashboard names it and the board's rows carry its constants. */
export const MODEL_VERSION = 'radar-5 pooled-peer';

/** Shrinkage prior weight: a pool of n peers trusts its own median n/(n+SHRINK_K). */
export const SHRINK_K = 6;
/** Momentum: the share of a 7-day TVL move the model believes, and its cap in per cent. */
export const MOMENTUM_DAMP = 0.2;
export const MOMENTUM_CAP = 8;
/** Longevity: the floor, the range it grows over five years, and the unknown-age factor. */
export const LONGEVITY_FLOOR = 0.9;
export const LONGEVITY_RANGE = 0.25;
export const LONGEVITY_YEARS = 5;
export const LONGEVITY_UNKNOWN = 0.95;
/** The size factor never leaves this band. */
export const SIZE_MIN = 0.25;
export const SIZE_MAX = 4;

/**
 * Analogue families: categories whose traded peers price alike, used to widen a pool. The map is
 * about categories, never about protocols: the same families apply to every row alike.
 */
export const FAMILIES: Record<string, string[]> = {
  'Risk Curators': ['Basis Trading', 'Yield Aggregator', 'Yield'],
  'Onchain Capital Allocator': ['Basis Trading', 'Yield Aggregator', 'Yield'],
  'Yield Aggregator': ['Basis Trading', 'Yield'],
  Yield: ['Yield Aggregator', 'Basis Trading'],
  'Basis Trading': ['Yield', 'Yield Aggregator'],
  Lending: ['CDP'],
  CDP: ['Lending'],
  Dexs: ['Derivatives', 'Options'],
  Derivatives: ['Dexs', 'Options'],
  RWA: ['Lending', 'Yield'],
  'Staking Pool': ['Liquid Staking'],
  'Liquid Restaking': ['Liquid Staking', 'Restaking'],
  Restaking: ['Liquid Staking', 'Liquid Restaking'],
  'Liquidity Manager': ['Yield Aggregator', 'Dexs'],
  'Leveraged Farming': ['Yield', 'Lending'],
};

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  implied_low_usd: number;
  implied_high_usd: number;
  farm_gas_usd: number;
  confidence: 'high' | 'medium' | 'low';
  model: {
    benchmark_multiple: number;
    pool_size: number;
    pool_ref_tvl_usd: number;
    size_factor: number;
    momentum_factor: number;
    longevity_factor: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row, with everything its detail view draws. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  listed_at: string | null;
  age_days: number | null;
  watchlist: boolean;
  implied_value_usd: number;
  implied_low_usd: number;
  implied_high_usd: number;
  farm_gas_usd: number;
  confidence: 'high' | 'medium' | 'low';
  benchmark_multiple: number;
  pool_size: number;
  pool_ref_tvl_usd: number;
  size_factor: number;
  momentum_factor: number;
  longevity_factor: number;
  farm_steps: string[];
}

/** A traded peer shown on a detail view: the market's own figures, never the model's. */
export interface PeerRow {
  slug: string;
  name: string;
  category: string | null;
  tvl_usd: number;
  mcap_usd: number;
  multiple: number;
}

/** Everything the dashboard needs: the board, the traded peers, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model_version: string;
  fitted_slope: number;
  backtest: { peers: number; median_log10_error: number; within_2x_pct: number };
  protocols_size: number;
  pre_token_size: number;
  watchlist_size: number;
  board_size: number;
  board_total_usd: number;
  rows: RadarRow[];
  peers: PeerRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** The median of a non-empty list. */
function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/** A percentile of a non-empty list, linear interpolation between closest ranks. */
function percentile(xs: number[], q: number): number {
  const s = [...xs].sort((a, b) => a - b);
  if (s.length === 1) return s[0]!;
  const at = (s.length - 1) * q;
  const lo = Math.floor(at);
  const hi = Math.ceil(at);
  return lo === hi ? s[lo]! : s[lo]! + (s[hi]! - s[lo]!) * (at - lo);
}

/** A whole day count from `listedAt` to `asOf`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** Whether a protocol records no token at all: no market cap, no CoinGecko id, no symbol. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Whether a protocol is one the board may rank: pre-token, not an exchange, not a versioned pool. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && p.category !== 'CEX' && !VERSIONED.test(p.name);
}

/** A traded peer: a protocol whose token the market already prices. */
function isTraded(p: SnapshotProtocol): boolean {
  return p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0;
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return { as_of: o.as_of, source: o.source, floor_usd: o.floor_usd, protocols, watchlist: o.watchlist as string[] };
}

/** The market the model prices against: every traded peer, grouped by category, plus global figures. */
export interface Market {
  traded: SnapshotProtocol[];
  byCategory: Map<string, SnapshotProtocol[]>;
  globalMedianMultiple: number;
  fittedSlope: number;
}

/** Fit the market once: group the traded peers and regress log market cap on log TVL. */
export function buildMarket(snapshot: Snapshot): Market {
  const traded = snapshot.protocols.filter(isTraded);
  const byCategory = new Map<string, SnapshotProtocol[]>();
  for (const p of traded) {
    const key = p.category ?? '';
    const list = byCategory.get(key);
    if (list) list.push(p);
    else byCategory.set(key, [p]);
  }
  const globalMedianMultiple = median(traded.map((p) => p.mcap_usd! / p.tvl_usd));
  let slope = 0.52;
  if (traded.length >= 8) {
    const xs = traded.map((p) => Math.log(p.tvl_usd));
    const ys = traded.map((p) => Math.log(p.mcap_usd!));
    const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
    const my = ys.reduce((a, b) => a + b, 0) / ys.length;
    let num = 0;
    let den = 0;
    for (let i = 0; i < xs.length; i++) {
      num += (xs[i]! - mx) * (ys[i]! - my);
      den += (xs[i]! - mx) ** 2;
    }
    if (den > 0) slope = clamp(num / den, 0.1, 0.95);
  }
  return { traded, byCategory, globalMedianMultiple, fittedSlope: slope };
}

/** One protocol's peer pool: its own category's traded peers plus its analogue family's, if any. */
export function peerPool(market: Market, category: string | null, excludeSlug?: string): { pool: SnapshotProtocol[]; ownCount: number; pooled: boolean } {
  const own = (market.byCategory.get(category ?? '') ?? []).filter((p) => p.slug !== excludeSlug);
  const family = FAMILIES[category ?? ''] ?? [];
  for (const fam of family) {
    const members = (market.byCategory.get(fam) ?? []).filter((p) => p.slug !== excludeSlug);
    if (members.length > 0) return { pool: [...own, ...members], ownCount: own.length, pooled: true };
  }
  return { pool: own, ownCount: own.length, pooled: false };
}

/** A pool's reference TVL: the TVL-weighted median, the size a typical pool member trades at. */
export function refTvl(pool: SnapshotProtocol[]): number {
  if (pool.length === 0) return 1;
  const sorted = [...pool].sort((a, b) => a.tvl_usd - b.tvl_usd);
  const total = sorted.reduce((a, p) => a + p.tvl_usd, 0);
  let acc = 0;
  for (const p of sorted) {
    acc += p.tvl_usd;
    if (acc >= total / 2) return p.tvl_usd;
  }
  return sorted[sorted.length - 1]!.tvl_usd;
}

/**
 * The benchmark for one protocol: its pool's median multiple, shrunk toward the market in log
 * space. One exception the backtest earned: when no analogue family pooled in and the category
 * itself holds at least three traded peers, the plain category median prices better unshrunk.
 */
export function benchmark(market: Market, pool: SnapshotProtocol[], plainMedian: boolean): { multiple: number; q25: number; q75: number } {
  const ratios = pool.map((p) => p.mcap_usd! / p.tvl_usd);
  const med = median(ratios);
  if (plainMedian) return { multiple: med, q25: percentile(ratios, 0.25), q75: percentile(ratios, 0.75) };
  const n = ratios.length;
  const w = n / (n + SHRINK_K);
  const shrunk = Math.exp(w * Math.log(med) + (1 - w) * Math.log(market.globalMedianMultiple));
  return { multiple: shrunk, q25: percentile(ratios, 0.25), q75: percentile(ratios, 0.75) };
}

/** The momentum factor: a fifth of the 7-day move, capped at +/-8%, unreported counts as flat. */
export function momentumFactor(change7d: number | null): number {
  if (change7d === null || !Number.isFinite(change7d)) return 1;
  return 1 + clamp(change7d * MOMENTUM_DAMP, -MOMENTUM_CAP, MOMENTUM_CAP) / 100;
}

/** The longevity factor: a longer tokenless record prices a launch better, up to five years. */
export function longevityFactor(age: number | null): number {
  if (age === null) return LONGEVITY_UNKNOWN;
  const years = age / 365.25;
  return LONGEVITY_FLOOR + LONGEVITY_RANGE * (Math.min(years, LONGEVITY_YEARS) / LONGEVITY_YEARS);
}

/** The size factor: how much the benchmark compresses at this protocol's TVL against its pool. */
export function sizeFactor(market: Market, tvl: number, ref: number): number {
  return clamp((tvl / ref) ** -(1 - market.fittedSlope), SIZE_MIN, SIZE_MAX);
}

/** A confidence grade from the pool behind a row and the width of its value range. */
export function confidenceFor(poolSize: number, low: number, high: number): 'high' | 'medium' | 'low' {
  const width = low > 0 ? high / low : Infinity;
  if (poolSize >= 12 && width <= 8) return 'high';
  if (poolSize >= 5 && width <= 16) return 'medium';
  return 'low';
}

// ---- Farm plans ---------------------------------------------------------------------------
//
// One playbook per line of work, chosen by the protocol's category and filled with its own
// figures: its name, its first chain, a stake band scaled to its TVL and a hold window scaled
// to its age. Every step names its cost and its time, and the plan's last step states the true
// total: the setup transactions times the chain's gas class, as a share of the stake. Gas is
// priced by chain class, not by protocol: Ethereum $6 a transaction, Bitcoin $2, Solana $0.05,
// other chains $0.30. The stake itself is held, not spent, and the plan says so.

/** The stake band for one farm position, scaled to the protocol's TVL. */
function stakeBand(tvl: number): { lo: number; hi: number } {
  if (tvl >= 5_000_000_000) return { lo: 500, hi: 1000 };
  if (tvl >= 1_000_000_000) return { lo: 250, hi: 500 };
  if (tvl >= 250_000_000) return { lo: 150, hi: 250 };
  if (tvl >= 50_000_000) return { lo: 100, hi: 150 };
  return { lo: 50, hi: 100 };
}

/** What one transaction costs on the protocol's first chain, by chain class. */
function gasPerTx(chain: string): number {
  if (chain === 'Ethereum') return 6;
  if (chain === 'Bitcoin') return 2;
  if (chain === 'Solana') return 0.05;
  return 0.3;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

const money = (n: number): string => (n >= 100 ? `$${Math.round(n)}` : `$${n.toFixed(2).replace(/\.?0+$/, '')}`);

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

type Playbook = (ctx: { name: string; chain: string; lo: number; hi: number }) => { action: string; weekly: string; watch: string };

const PLAYBOOKS: Record<string, Playbook> = {
  lending: ({ name, chain, lo, hi }) => ({
    action: `Supply ${money(lo)} to ${money(hi)} of USDC to ${name}'s main lending market on ${chain}; borrow nothing in the first week so the supply balance is unambiguous.`,
    weekly: `Add or withdraw a small amount once a week and repay any test borrow in full, so every week carries a real supply-side transaction.`,
    watch: `Check the market's utilisation and your health factor weekly; a utilisation spike above 90% is the signal to top up collateral or trim the position.`,
  }),
  dex: ({ name, chain, lo, hi }) => ({
    action: `Provide ${money(lo)} to ${money(hi)} of liquidity to ${name}'s deepest stable or blue-chip pool on ${chain}, split evenly on both sides of the pair.`,
    weekly: `Make two or three swaps a week through ${name}'s own interface at sizes you would make anyway, and rebalance the position if it drifts out of range.`,
    watch: `Watch the pool's volume and your share of it weekly; if your share falls under 0.01% of the pool, add liquidity or accept that the position is a spectator.`,
  }),
  derivatives: ({ name, chain, lo, hi }) => ({
    action: `Deposit ${money(lo)} to ${money(hi)} of USDC as margin on ${name} and open one small hedged position, long and short the same asset in equal size.`,
    weekly: `Roll or adjust the hedge once a week so the account shows recurring, two-sided trading rather than a single parked deposit.`,
    watch: `Check the funding rate and your margin ratio twice a week; a hedged book still liquidates if one leg is closed by a funding spike.`,
  }),
  yield: ({ name, chain, lo, hi }) => ({
    action: `Deposit ${money(lo)} to ${money(hi)} of USDC into ${name}'s flagship vault on ${chain} and keep the vault shares in the same wallet.`,
    weekly: `Claim or compound the vault's yield once a week from the protocol's own page, and add a small top-up in weeks when the vault's rate leads its category.`,
    watch: `Compare the vault's rate against its category median weekly; two weeks below the median with no explanation is the exit signal.`,
  }),
  staking: ({ name, chain, lo, hi }) => ({
    action: `Stake ${money(lo)} to ${money(hi)} of ${chain}'s staking asset through ${name} and keep the liquid receipt token in the same wallet, unstaked elsewhere.`,
    weekly: `Restake the week's rewards or add a small amount once a week, so the staking balance grows by transactions and not only by price.`,
    watch: `Check the exchange rate of the receipt token against the underlying weekly; a discount over 1% that persists is a depeg warning, not a bargain.`,
  }),
  bridge: ({ name, chain, lo, hi }) => ({
    action: `Bridge ${money(lo)} to ${money(hi)} of USDC from Ethereum to ${chain} through ${name}, then use the bridged funds in one app on the far side.`,
    weekly: `Bridge a small amount once a week, alternating direction, and keep each route's confirmation in the farm log with its transaction hash.`,
    watch: `Check the route's quoted fee against two rival bridges weekly; a route that quietly doubles its fee stops being worth farming.`,
  }),
  rwa: ({ name, chain, lo, hi }) => ({
    action: `Mint ${money(lo)} to ${money(hi)} of ${name}'s yield-bearing asset on ${chain} after its eligibility check, and hold the asset in the minting wallet.`,
    weekly: `Accrue for a full week between actions; once a week, read the protocol's attestation or reserve report and log the date you read it.`,
    watch: `Watch the redemption queue and the asset's secondary price weekly; a queue that grows two weeks running is the signal to join it early.`,
  }),
  chain: ({ name, chain, lo, hi }) => ({
    action: `Bridge ${money(lo)} to ${money(hi)} of funds onto ${name} and make it your active wallet chain: hold the balance there, not on an exchange.`,
    weekly: `Run two or three ordinary transactions a week on ${name} — a swap, a small transfer between your own wallets, a domain or NFT mint under $5.`,
    watch: `Track the chain's own bridge and faucet pages weekly; new-chain reward programs are announced there first and close fast.`,
  }),
  btc: ({ name, chain, lo, hi }) => ({
    action: `Deposit ${money(lo)} to ${money(hi)} of BTC value into ${name} through its own deposit flow and keep the issued position in the depositing wallet.`,
    weekly: `Check the position and add a small top-up once a week if fees allow; on Bitcoin, batch actions — every transaction pays base-layer fees.`,
    watch: `Verify the protocol's proof of reserves or backing report weekly and log its date; an unbacked BTC product fails silently until it fails loudly.`,
  }),
  prediction: ({ name, chain, lo, hi }) => ({
    action: `Fund ${money(lo)} to ${money(hi)} on ${name} and place one position in its most liquid market, sized so a total loss is acceptable.`,
    weekly: `Place one or two positions a week in markets you actually follow; a prediction account that only holds cash is not farming anything.`,
    watch: `Check each open position's price weekly and close losers at the market rather than holding to settlement out of stubbornness.`,
  }),
  stable: ({ name, chain, lo, hi }) => ({
    action: `Mint or deposit ${money(lo)} to ${money(hi)} of the stable asset through ${name} on ${chain} and hold it in the minting wallet.`,
    weekly: `Move a small amount between ${name} and one lending market once a week so the holding shows as used, not parked.`,
    watch: `Watch the stable asset's peg weekly; a deviation over 0.5% that lasts a day is the signal to redeem through the protocol, not the market.`,
  }),
};

const DEFAULT_PLAYBOOK: Playbook = ({ name, chain, lo, hi }) => ({
  action: `Deposit ${money(lo)} to ${money(hi)} of USDC into ${name} on ${chain} through its main product and keep the position in one wallet.`,
  weekly: `Make one qualifying action a week — a deposit, a withdrawal and redeposit, or a vote — so every week carries a real transaction.`,
  watch: `Read ${name}'s own announcements weekly and log any points, rewards or governance page the protocol opens; those pages are where a launch is prepared.`,
});

/** The playbook key for a category: the line of work, not the label's exact spelling. */
function playbookFor(category: string | null): Playbook {
  const c = (category ?? '').toLowerCase();
  if (c.includes('lend') || c.includes('cdp')) return PLAYBOOKS.lending!;
  if (c.includes('dex') || c.includes('liquidity manager')) return PLAYBOOKS.dex!;
  if (c.includes('derivative') || c.includes('perpetual')) return PLAYBOOKS.derivatives!;
  if (c.includes('bridge')) return PLAYBOOKS.bridge!;
  if (c.includes('staking') || c.includes('restak') || c.includes('staking pool')) return PLAYBOOKS.staking!;
  if (c.includes('rwa')) return PLAYBOOKS.rwa!;
  if (c.includes('chain')) return PLAYBOOKS.chain!;
  if (c.includes('btc')) return PLAYBOOKS.btc!;
  if (c.includes('prediction')) return PLAYBOOKS.prediction!;
  if (c.includes('stablecoin')) return PLAYBOOKS.stable!;
  if (c.includes('yield') || c.includes('curator') || c.includes('allocator') || c.includes('basis') || c.includes('farm')) return PLAYBOOKS.yield!;
  return DEFAULT_PLAYBOOK;
}

/**
 * A protocol's farm plan: five steps, each an action with a cost and a time, derived from the
 * protocol's own record (category, chains, TVL, age) and never from a hand-written list of names.
 * The last step states the plan's true overhead: setup gas as a share of the minimum stake.
 * Returns the steps and the plan's total gas, which the dashboard shows as the plan's price.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): { steps: FarmStep[]; totalGas: number } {
  const chain = p.chains.length > 0 ? p.chains[0]! : 'its main chain';
  const band = stakeBand(p.tvl_usd);
  const gas = gasPerTx(p.chains.length > 0 ? p.chains[0]! : '');
  const hold = holdDaysFor(age);
  const play = playbookFor(p.category)({ name: p.name, chain, lo: band.lo, hi: band.hi });
  const setupTx = 3;
  const setupGas = setupTx * gas;
  const weeklyGas = gas;
  const weeks = Math.max(4, Math.round(hold / 7));
  const totalGas = setupGas + weeklyGas * weeks;
  const sharePct = (totalGas / band.lo) * 100;
  const shareText = sharePct >= 1 ? `about ${sharePct.toFixed(1)}%` : `under 1%`;
  return {
    totalGas,
    steps: [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm ${p.name} with, and keep its seed phrase offline.`,
      cost: 'nothing to create, and never pay anyone to set it up',
      time: '5 minutes',
    },
    {
      text: play.action,
      cost: `${money(band.lo)} to ${money(band.hi)} of capital (held, not spent) plus about ${money(setupGas)} of gas over ${setupTx} transactions`,
      time: '20 minutes to set up',
    },
    {
      text: play.weekly,
      cost: `about ${money(weeklyGas)} of gas a week`,
      time: '10 minutes a week',
    },
    {
      text: play.watch,
      cost: 'nothing to check',
      time: `${hold} days in the position, checked weekly`,
    },
    {
      text: `Keep a farm log of the wallet, the dates and every transaction hash, and claim any reward only from a link ${p.name} itself publishes. Total overhead of this plan is about ${money(totalGas)} of gas, ${shareText} of a ${money(band.lo)} stake — the share falls as the stake grows, and the stake itself comes back when you unwind.`,
      cost: `about ${money(totalGas)} of gas in total, and never pay to claim`,
      time: '5 minutes a week for the log',
    },
    ],
  };
}

// ---- The model's own record ---------------------------------------------------------------
//
// The program backtests itself on every run: each traded peer is priced by the same pipeline
// with itself left out of its own pool, and the errors are summarised. The dashboard prints the
// result next to the model, so the reader sees the model's measured accuracy, not an adjective.

/** Price one protocol under the model: every factor, the range and the pool behind it. */
export function price(
  market: Market,
  p: SnapshotProtocol,
  asOf: string,
  excludeSlug?: string,
): {
  implied: number;
  low: number;
  high: number;
  bench: number;
  pool: SnapshotProtocol[];
  size: number;
  momentum: number;
  longevity: number;
  age: number | null;
} {
  const found = peerPool(market, p.category, excludeSlug);
  const effectivePool = found.pool.length > 0 ? found.pool : market.traded.filter((q) => q.slug !== excludeSlug);
  const plainMedian = !found.pooled && found.ownCount >= 3;
  const { multiple, q25, q75 } = benchmark(market, effectivePool, plainMedian);
  const ref = refTvl(effectivePool);
  const size = sizeFactor(market, p.tvl_usd, ref);
  const momentum = momentumFactor(p.change_7d);
  const age = ageDays(asOf, p.listed_at);
  const longevity = longevityFactor(age);
  const tail = size * momentum * longevity;
  const implied = Math.max(1, Math.round(p.tvl_usd * multiple * tail));
  const low = Math.max(1, Math.round(p.tvl_usd * q25 * tail));
  const high = Math.max(low, Math.round(p.tvl_usd * q75 * tail));
  return { implied, low: Math.min(low, implied), high: Math.max(high, implied), bench: multiple, pool: effectivePool, size, momentum, longevity, age };
}

/** Leave-one-out backtest on the traded peers: the model's measured error against the market. */
export function backtest(market: Market, snapshot: Snapshot): { peers: number; median_log10_error: number; within_2x_pct: number } {
  const errors: number[] = [];
  for (const p of market.traded) {
    const { implied } = price(market, p, snapshot.as_of, p.slug);
    errors.push(Math.abs(Math.log10(implied / p.mcap_usd!)));
  }
  errors.sort((a, b) => a - b);
  const mid = Math.floor(errors.length / 2);
  const med = errors.length % 2 === 1 ? errors[mid]! : (errors[mid - 1]! + errors[mid]!) / 2;
  const within = errors.filter((e) => e <= Math.log10(2)).length;
  return {
    peers: market.traded.length,
    median_log10_error: Math.round(med * 1000) / 1000,
    within_2x_pct: Math.round((within / errors.length) * 100),
  };
}

// ---- The board ----------------------------------------------------------------------------

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, market: Market): BoardRow[] {
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug is a row, even one the rankability screen would skip.
  const index = new Map(snapshot.protocols.map((p) => [p.slug, p]));
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every other rankable pre-token protocol, the whole field, not a sample.
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isRankable(p)) chosen.set(p.slug, p);
  }
  const scored = [...chosen.values()].map((p) => {
    const priced = price(market, p, snapshot.as_of);
    const plan = farmSteps(p, priced.age);
    return { p, ...priced, plan };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token' as const,
    age_days: s.age,
    implied_value_usd: s.implied,
    implied_low_usd: s.low,
    implied_high_usd: s.high,
    farm_gas_usd: Math.round(s.plan.totalGas * 100) / 100,
    confidence: confidenceFor(s.pool.length, s.low, s.high),
    model: {
      benchmark_multiple: round4(s.bench),
      pool_size: s.pool.length,
      pool_ref_tvl_usd: Math.round(refTvl(s.pool)),
      size_factor: round4(s.size),
      momentum_factor: round4(s.momentum),
      longevity_factor: round4(s.longevity),
      age_days: s.age,
    },
    farm_steps: s.plan.steps.map(stepText),
  }));
}

/** The traded peers the dashboard shows: the market's own figures, by market cap. */
export function peerRows(market: Market): PeerRow[] {
  return [...market.traded]
    .sort((a, b) => b.mcap_usd! - a.mcap_usd! || b.tvl_usd - a.tvl_usd)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd!,
      multiple: round4(p.mcap_usd! / p.tvl_usd),
    }));
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot): { board: BoardRow[]; radar: RadarData } {
  const market = buildMarket(snapshot);
  const board = buildBoard(snapshot, market);
  const bt = backtest(market, snapshot);
  const watch = new Set(snapshot.watchlist);
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model_version: MODEL_VERSION,
    fitted_slope: round4(market.fittedSlope),
    backtest: bt,
    protocols_size: snapshot.protocols.length,
    pre_token_size: snapshot.protocols.filter(isPreToken).length,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    board_total_usd: board.reduce((a, r) => a + r.implied_value_usd, 0),
    rows: board.map((r) => ({
      rank: r.rank,
      slug: r.slug,
      name: r.name,
      category: r.category,
      chains: r.chains,
      tvl_usd: r.tvl_usd,
      change_7d: r.change_7d,
      listed_at: r.listed_at,
      age_days: r.age_days,
      watchlist: watch.has(r.slug),
      implied_value_usd: r.implied_value_usd,
      implied_low_usd: r.implied_low_usd,
      implied_high_usd: r.implied_high_usd,
      farm_gas_usd: r.farm_gas_usd,
      confidence: r.confidence,
      benchmark_multiple: r.model.benchmark_multiple,
      pool_size: r.model.pool_size,
      pool_ref_tvl_usd: r.model.pool_ref_tvl_usd,
      size_factor: r.model.size_factor,
      momentum_factor: r.model.momentum_factor,
      longevity_factor: r.model.longevity_factor,
      farm_steps: r.farm_steps,
    })),
    peers: peerRows(market),
  };
  return { board, radar };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, values, farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) {
      const t = s.trim();
      if (t.length < 20 || t.length > 600) return `${r.slug} has a farm step of ${t.length} characters`;
    }
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
