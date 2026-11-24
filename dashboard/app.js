// Token Launch Radar — the scope face. It reads window.RADAR (written beside dashboard/ by
// main.ts) and renders the ranked board, its filters, and a per-protocol detail view with the
// pricing waterfall, the farm plan and the nearest traded peers the price leans on.
// No network: every byte it shows is in data.js.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var state = { q: '', category: 'all', chain: 'all', watch: false, early: false, cheap: false, sort: 'implied', dir: -1 };

  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd.format(n);
  }
  function fmtGas(n) { return n >= 100 ? '$' + Math.round(n) : '$' + (Math.round(n * 100) / 100); }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(1) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function esc(s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var rows = DATA.rows;
  var bySlug = {};
  rows.forEach(function (r) { bySlug[r.slug] = r; });
  var logMin = Math.log10(Math.min.apply(null, rows.map(function (r) { return r.implied_low_usd; })));
  var logMax = Math.log10(Math.max.apply(null, rows.map(function (r) { return r.implied_high_usd; })));
  function barPct(v) { return ((Math.log10(Math.max(1, v)) - logMin) / (logMax - logMin)) * 100; }

  function hero() {
    var bt = DATA.backtest;
    return '<header class="hero"><div class="kicker">Token Launch Radar &middot; model ' + esc(DATA.model_version) + ' &middot; snapshot ' + esc(DATA.as_of) + '</div>' +
      '<h1>Pre-token protocols, ranked by what a token could be worth.</h1>' +
      '<p class="lede">Every protocol in the snapshot that records no token yet, priced off the market multiples of its traded peers — pooled across its category and its analogue family, adjusted for size, a week of momentum and its tokenless age. Each price carries the peer range it came from.</p>' +
      '<div class="stats">' +
      '<div class="stat"><b>' + DATA.protocols_size + '</b><span>protocols scanned</span></div>' +
      '<div class="stat"><b>' + DATA.board_size + '</b><span>pre-token ranked</span></div>' +
      '<div class="stat"><b>' + DATA.watchlist_size + '/' + DATA.watchlist_size + '</b><span>watchlist covered</span></div>' +
      '<div class="stat"><b>' + fmtUsd(DATA.board_total_usd) + '</b><span>board implied total</span></div>' +
      '<div class="stat"><b>' + bt.median_log10_error + '</b><span>backtest median log error</span></div>' +
      '<div class="stat"><b>' + bt.within_2x_pct + '%</b><span>peers priced within 2x</span></div>' +
      '</div>' +
      '<p class="modelcard">The model backtests itself on every run: each of the <b>' + bt.peers + ' traded peers</b> is priced with itself left out of its pool. Median log10 error <b>' + bt.median_log10_error + '</b>, <b>' + bt.within_2x_pct + '%</b> within 2x of the market. Size slope fitted on this snapshot: <b>' + DATA.fitted_slope + '</b>. Those are the model&rsquo;s measured figures, printed beside its prices.</p>' +
      '</header>';
  }

  function categories() {
    var seen = {};
    rows.forEach(function (r) { if (r.category) seen[r.category] = 1; });
    return Object.keys(seen).sort();
  }
  function chains() {
    var seen = {};
    rows.forEach(function (r) { r.chains.forEach(function (c) { seen[c] = 1; }); });
    return Object.keys(seen).sort();
  }

  function controls() {
    var catOpts = '<option value="all">All categories</option>' + categories().map(function (c) {
      return '<option value="' + esc(c) + '"' + (state.category === c ? ' selected' : '') + '>' + esc(c) + '</option>';
    }).join('');
    var chainOpts = '<option value="all">All chains</option>' + chains().map(function (c) {
      return '<option value="' + esc(c) + '"' + (state.chain === c ? ' selected' : '') + '>' + esc(c) + '</option>';
    }).join('');
    return '<div class="controls">' +
      '<input type="search" id="q" placeholder="Search name or slug" value="' + esc(state.q) + '" aria-label="Search protocols">' +
      '<select id="cat" aria-label="Filter by category">' + catOpts + '</select>' +
      '<select id="chain" aria-label="Filter by chain">' + chainOpts + '</select>' +
      '<button class="chip" id="watch" aria-pressed="' + state.watch + '">Watchlist only</button>' +
      '<button class="chip" id="early" aria-pressed="' + state.early + '">Early: below the $' + (DATA.floor_usd / 1e6) + 'M floor</button>' +
      '<button class="chip" id="cheap" aria-pressed="' + state.cheap + '">Plan gas under $25</button>' +
      '<span class="count" id="count"></span></div>';
  }

  function visible() {
    var q = state.q.trim().toLowerCase();
    var out = rows.filter(function (r) {
      if (state.category !== 'all' && r.category !== state.category) return false;
      if (state.chain !== 'all' && r.chains.indexOf(state.chain) === -1) return false;
      if (state.watch && !r.watchlist) return false;
      if (state.early && r.tvl_usd >= DATA.floor_usd) return false;
      if (state.cheap && r.farm_gas_usd >= 25) return false;
      if (q && r.name.toLowerCase().indexOf(q) === -1 && r.slug.indexOf(q) === -1) return false;
      return true;
    });
    var key = { implied: 'implied_value_usd', tvl: 'tvl_usd', change: 'change_7d', age: 'age_days', gas: 'farm_gas_usd', rank: 'rank' }[state.sort];
    out.sort(function (a, b) {
      var av = a[key] === null ? -Infinity : a[key];
      var bv = b[key] === null ? -Infinity : b[key];
      return (av - bv) * state.dir;
    });
    return out;
  }

  function th(label, key) {
    var arrow = state.sort === key ? (state.dir === -1 ? ' &#9660;' : ' &#9650;') : '';
    return '<th><button data-sort="' + key + '">' + label + arrow + '</button></th>';
  }

  function boardHtml() {
    var list = visible();
    var body = list.map(function (r) {
      var lo = barPct(r.implied_low_usd), hi = barPct(r.implied_high_usd), mid = barPct(r.implied_value_usd);
      return '<tr data-slug="' + esc(r.slug) + '">' +
        '<td class="rank">' + r.rank + '</td>' +
        '<td><span class="name">' + esc(r.name) + '</span>' + (r.watchlist ? '<span class="badge">WATCHLIST</span>' : '') +
        '<span class="sub">' + esc(r.slug) + '</span></td>' +
        '<td>' + esc(r.category || '—') + '<span class="sub">' + esc(r.chains.slice(0, 2).join(', ')) + '</span></td>' +
        '<td class="num">' + fmtUsd(r.tvl_usd) + '</td>' +
        '<td class="num ' + (r.change_7d === null ? '' : r.change_7d >= 0 ? 'up' : 'down') + '">' + fmtPct(r.change_7d) + '</td>' +
        '<td class="num">' + fmtAge(r.age_days) + '</td>' +
        '<td class="num"><b>' + fmtUsd(r.implied_value_usd) + '</b></td>' +
        '<td><div class="rangebar"><i style="left:' + lo.toFixed(1) + '%;width:' + Math.max(1.5, hi - lo).toFixed(1) + '%"></i><b style="left:' + mid.toFixed(1) + '%"></b></div>' +
        '<span class="rangeval">' + fmtUsd(r.implied_low_usd) + ' – ' + fmtUsd(r.implied_high_usd) + '</span></td>' +
        '<td><span class="conf ' + r.confidence + '">' + r.confidence + '</span></td>' +
        '<td class="num">' + fmtGas(r.farm_gas_usd) + '</td></tr>';
    }).join('');
    return hero() + controls() +
      '<div class="tablewrap"><table><thead><tr>' +
      th('#', 'rank') + '<th>Protocol</th><th>Category / chains</th>' + th('TVL', 'tvl') + th('7d', 'change') + th('Age', 'age') +
      th('Implied value', 'implied') + '<th>Peer range</th><th>Confidence</th>' + th('Plan gas', 'gas') +
      '</tr></thead><tbody>' + (body || '<tr><td colspan="10"><div class="empty">No protocol matches these filters.</div></td></tr>') + '</tbody></table></div>' +
      '<p class="foot"><b>How to read this board.</b> Implied value = TVL &times; the median market-cap/TVL multiple of the protocol&rsquo;s traded peer pool (its category plus its analogue family), shrunk toward the market median, then adjusted for size, a damped week of momentum and tokenless age. The range is the pool&rsquo;s interquartile multiples carried through the same adjustments. Plan gas is the farm plan&rsquo;s total transaction cost at the chain&rsquo;s gas class. Source: ' + esc(DATA.source) + ', snapshot of ' + esc(DATA.as_of) + '. A model&rsquo;s estimate, not a promise: the backtest figures in the header are what this method earned on protocols the market already prices.</p>';
  }

  function splitStep(s) {
    var m = /^(.*?) Cost: (.*?). Time: (.*?).?$/.exec(s);
    if (!m) return { text: s, line: '' };
    return { text: m[1], line: 'Cost: ' + m[2] + ' &middot; Time: ' + m[3] };
  }

  function detailHtml(r) {
    var steps = r.farm_steps.map(function (s) {
      var p = splitStep(s);
      return '<li>' + esc(p.text) + (p.line ? '<span class="sc">' + p.line + '</span>' : '') + '</li>';
    }).join('');
    var v0 = r.tvl_usd;
    var v1 = v0 * r.benchmark_multiple;
    var v2 = v1 * r.size_factor;
    var v3 = v2 * r.momentum_factor;
    var wf = '<table class="wfall"><thead><tr><th>Step</th><th>Factor</th><th>Running value</th></tr></thead><tbody>' +
      '<tr><td>TVL (snapshot)</td><td>—</td><td class="num">' + fmtUsd(v0) + '</td></tr>' +
      '<tr><td>Peer benchmark — median multiple of ' + r.pool_size + ' traded peers (pool reference TVL ' + fmtUsd(r.pool_ref_tvl_usd) + ')</td><td class="num">&times;' + r.benchmark_multiple.toFixed(3) + '</td><td class="num">' + fmtUsd(Math.round(v1)) + '</td></tr>' +
      '<tr><td>Size adjustment — multiples compress as TVL grows</td><td class="num">&times;' + r.size_factor.toFixed(3) + '</td><td class="num">' + fmtUsd(Math.round(v2)) + '</td></tr>' +
      '<tr><td>Momentum — 7d TVL change, damped and capped</td><td class="num">&times;' + r.momentum_factor.toFixed(3) + '</td><td class="num">' + fmtUsd(Math.round(v3)) + '</td></tr>' +
      '<tr><td>Longevity — tokenless record</td><td class="num">&times;' + r.longevity_factor.toFixed(3) + '</td><td class="num"><b>' + fmtUsd(r.implied_value_usd) + '</b></td></tr>' +
      '</tbody></table>' +
      '<p class="meta">Peer range: <b>' + fmtUsd(r.implied_low_usd) + ' – ' + fmtUsd(r.implied_high_usd) + '</b> (the pool&rsquo;s interquartile multiples through the same adjustments) &middot; confidence <b>' + r.confidence + '</b> &middot; plan gas <b>' + fmtGas(r.farm_gas_usd) + '</b></p>';
    var FAM = { 'Risk Curators': ['Basis Trading', 'Yield Aggregator', 'Yield'], 'Onchain Capital Allocator': ['Basis Trading', 'Yield Aggregator', 'Yield'], 'Yield Aggregator': ['Basis Trading', 'Yield'], 'Yield': ['Yield Aggregator', 'Basis Trading'], 'Basis Trading': ['Yield', 'Yield Aggregator'], 'Lending': ['CDP'], 'CDP': ['Lending'], 'Dexs': ['Derivatives', 'Options'], 'Derivatives': ['Dexs', 'Options'], 'RWA': ['Lending', 'Yield'], 'Staking Pool': ['Liquid Staking'], 'Liquid Restaking': ['Liquid Staking', 'Restaking'], 'Restaking': ['Liquid Staking', 'Liquid Restaking'], 'Liquidity Manager': ['Yield Aggregator', 'Dexs'], 'Leveraged Farming': ['Yield', 'Lending'] };
    var poolCats = [r.category].concat(FAM[r.category] || []);
    var peers = DATA.peers.filter(function (p) { return poolCats.indexOf(p.category) !== -1; })
      .sort(function (a, b) { return Math.abs(Math.log10(a.tvl_usd / r.tvl_usd)) - Math.abs(Math.log10(b.tvl_usd / r.tvl_usd)); })
      .slice(0, 6);
    var peerHtml = peers.length ? '<table class="peers"><thead><tr><th>Traded peer</th><th>TVL</th><th>Market cap</th><th>Multiple</th></tr></thead><tbody>' +
      peers.map(function (p) {
        return '<tr><td>' + esc(p.name) + '<span class="sub">' + esc(p.category || '') + '</span></td><td class="num">' + fmtUsd(p.tvl_usd) + '</td><td class="num">' + fmtUsd(p.mcap_usd) + '</td><td class="num">&times;' + p.multiple.toFixed(2) + '</td></tr>';
      }).join('') + '</tbody></table>' : '<p class="meta">No traded peer shares this category; the price leans on the pooled analogue family and the market median.</p>';
    return '<a class="back" href="#/">&larr; back to the board</a>' +
      '<section class="detail"><div class="kicker">Rank ' + r.rank + ' of ' + DATA.board_size + (r.watchlist ? ' &middot; watchlist' : '') + '</div>' +
      '<h2>' + esc(r.name) + (r.watchlist ? '<span class="badge">WATCHLIST</span>' : '') + '</h2>' +
      '<p class="meta">' + esc(r.category || 'Uncategorised') + ' &middot; ' + esc(r.chains.join(', ') || 'no chain recorded') + ' &middot; TVL ' + fmtUsd(r.tvl_usd) +
      ' &middot; 7d ' + fmtPct(r.change_7d) + ' &middot; tokenless for ' + fmtAge(r.age_days) + (r.listed_at ? ' (listed ' + esc(r.listed_at) + ')' : '') + '</p>' +
      '<div class="grid"><div><h3>How the price is built</h3>' + wf + '</div>' +
      '<div><h3>Farm plan — total gas ' + fmtGas(r.farm_gas_usd) + '</h3><ol class="steps">' + steps + '</ol></div></div>' +
      '<div class="grid"><div><h3>Nearest traded anchors in its peer pool</h3>' + peerHtml + '</div>' +
      '<div><h3>What would change this price</h3><p class="meta">The benchmark moves when its peer pool&rsquo;s market multiples move; the size factor moves with its TVL against the pool&rsquo;s reference TVL of ' + fmtUsd(r.pool_ref_tvl_usd) + '; momentum fades after a week by construction. Nothing on this page is typed in by hand — reopen the board after a new snapshot and every figure is recomputed.</p></div></div>' +
      '</section>';
  }

  function render() {
    var hash = location.hash || '#/';
    var pm = /^#\/p\/(.+)$/.exec(hash);
    var fm = /^#\/f\/(.+)$/.exec(hash);
    if (pm && bySlug[decodeURIComponent(pm[1])]) {
      app.innerHTML = detailHtml(bySlug[decodeURIComponent(pm[1])]);
    } else {
      if (fm) state.category = decodeURIComponent(fm[1]);
      app.innerHTML = boardHtml();
      var count = document.getElementById('count');
      if (count) count.textContent = visible().length + ' of ' + rows.length + ' shown';
      bind();
    }
    app.setAttribute('aria-busy', 'false');
    window.scrollTo(0, 0);
  }

  function bind() {
    var q = document.getElementById('q');
    if (q) q.addEventListener('input', function () { state.q = q.value; refresh(); });
    var cat = document.getElementById('cat');
    if (cat) cat.addEventListener('change', function () { state.category = cat.value; refresh(); });
    var ch = document.getElementById('chain');
    if (ch) ch.addEventListener('change', function () { state.chain = ch.value; refresh(); });
    [['watch', 'watch'], ['early', 'early'], ['cheap', 'cheap']].forEach(function (pair) {
      var el = document.getElementById(pair[0]);
      if (el) el.addEventListener('click', function () { state[pair[1]] = !state[pair[1]]; render(); });
    });
    Array.prototype.forEach.call(app.querySelectorAll('[data-sort]'), function (b) {
      b.addEventListener('click', function () {
        var k = b.getAttribute('data-sort');
        if (state.sort === k) state.dir = -state.dir; else { state.sort = k; state.dir = -1; }
        render();
      });
    });
    Array.prototype.forEach.call(app.querySelectorAll('tbody tr[data-slug]'), function (tr) {
      tr.addEventListener('click', function () { location.hash = '#/p/' + tr.getAttribute('data-slug'); });
    });
  }

  function refresh() {
    var keep = document.activeElement && document.activeElement.id;
    var val = keep ? document.activeElement.value : null;
    var pos = keep && document.activeElement.selectionStart;
    render();
    if (keep) {
      var el = document.getElementById(keep);
      if (el) { el.focus(); if (val !== null) el.value = val; if (pos !== null && el.setSelectionRange) el.setSelectionRange(pos, pos); }
    }
  }

  window.addEventListener('hashchange', render);
  render();
})();
