/**
 * GOTHAM OSINT OVERLAY PANEL
 * Toggleable OSINT intelligence panels - accessed from GOTHAM right panel
 * API: http://localhost:5555
 */

class GothamOSINTOverlay {
  constructor() {
    this.API = 'http://localhost:5555';
    this._createOverlay();
    this._wireUp();
  }

  _createOverlay() {
    const existing = document.getElementById('gotham-osint-overlay');
    if (existing) existing.remove();
    const html = `
<div id="gotham-osint-overlay" style="display:none;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:720px;max-height:82vh;background:rgba(0,0,0,0.97);border:1px solid rgba(0,240,255,0.4);border-radius:8px;z-index:99999;font-family:'Courier New',monospace;color:#fff;box-shadow:0 0 60px rgba(0,240,255,0.15),0 0 120px rgba(255,0,255,0.1);overflow:hidden;">
  <div style="background:linear-gradient(135deg,rgba(0,240,255,0.15),rgba(255,0,255,0.1));padding:10px 14px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(0,240,255,0.3);">
    <div style="display:flex;align-items:center;gap:12px">
      <span style="font-size:16px">&#128269;</span>
      <span id="osint-panel-title" style="font-size:13px;font-weight:bold;color:#00f0ff;letter-spacing:3px">GOTHAM OSINT MODULE</span>
      <span id="osint-panel-status" style="font-size:10px;color:#0f8">&#9679; 14 TOOLS ONLINE</span>
    </div>
    <button id="osint-close" style="background:rgba(255,0,0,0.2);border:1px solid rgba(255,0,100,0.5);color:#f44;padding:4px 10px;cursor:pointer;border-radius:3px;font-family:inherit;font-size:11px;">CLOSE [ESC]</button>
  </div>
  <div style="padding:8px 14px;display:flex;gap:5px;flex-wrap:wrap;border-bottom:1px solid rgba(255,255,255,0.1);background:rgba(0,0,0,0.4);" id="osint-tabs">
    <button class="osint-tab" data-tab="username" style="background:rgba(0,240,255,0.15);border:1px solid #00f0ff;color:#00f0ff;padding:5px 10px;cursor:pointer;border-radius:4px;font-size:10px;font-family:inherit;letter-spacing:1px;">USERNAME</button>
    <button class="osint-tab" data-tab="url" style="background:rgba(0,240,255,0.05);border:1px solid rgba(0,240,255,0.2);color:#666;padding:5px 10px;cursor:pointer;border-radius:4px;font-size:10px;font-family:inherit;letter-spacing:1px;">URL SCAN</button>
    <button class="osint-tab" data-tab="cve" style="background:rgba(0,240,255,0.05);border:1px solid rgba(0,240,255,0.2);color:#666;padding:5px 10px;cursor:pointer;border-radius:4px;font-size:10px;font-family:inherit;letter-spacing:1px;">CVE LOOKUP</button>
    <button class="osint-tab" data-tab="cvesearch" style="background:rgba(0,240,255,0.05);border:1px solid rgba(0,240,255,0.2);color:#666;padding:5px 10px;cursor:pointer;border-radius:4px;font-size:10px;font-family:inherit;letter-spacing:1px;">CVE SEARCH</button>
    <button class="osint-tab" data-tab="vip" style="background:rgba(0,240,255,0.05);border:1px solid rgba(0,240,255,0.2);color:#666;padding:5px 10px;cursor:pointer;border-radius:4px;font-size:10px;font-family:inherit;letter-spacing:1px;">VIP TRACK</button>
    <button class="osint-tab" data-tab="breach" style="background:rgba(0,240,255,0.05);border:1px solid rgba(0,240,255,0.2);color:#666;padding:5px 10px;cursor:pointer;border-radius:4px;font-size:10px;font-family:inherit;letter-spacing:1px;">BREACH</button>
    <button class="osint-tab" data-tab="password" style="background:rgba(0,240,255,0.05);border:1px solid rgba(0,240,255,0.2);color:#666;padding:5px 10px;cursor:pointer;border-radius:4px;font-size:10px;font-family:inherit;letter-spacing:1px;">PASS CHECK</button>
    <button class="osint-tab" data-tab="outages" style="background:rgba(0,240,255,0.05);border:1px solid rgba(0,240,255,0.2);color:#666;padding:5px 10px;cursor:pointer;border-radius:4px;font-size:10px;font-family:inherit;letter-spacing:1px;">OUTAGES</button>
    <button class="osint-tab" data-tab="frontlines" style="background:rgba(0,240,255,0.05);border:1px solid rgba(0,240,255,0.2);color:#666;padding:5px 10px;cursor:pointer;border-radius:4px;font-size:10px;font-family:inherit;letter-spacing:1px;">FRONTLINES</button>
  </div>
  <div id="osint-content" style="padding:14px;max-height:calc(82vh - 110px);overflow-y:auto;background:rgba(0,10,20,0.5);"></div>
</div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    document.getElementById('osint-close').addEventListener('click', () => this.hide());
  }

  _wireUp() {
    document.querySelectorAll('.osint-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.osint-tab').forEach(b => {
          b.style.background = 'rgba(0,240,255,0.05)';
          b.style.color = '#666';
          b.style.borderColor = 'rgba(0,240,255,0.2)';
        });
        btn.style.background = 'rgba(0,240,255,0.15)';
        btn.style.color = '#00f0ff';
        btn.style.borderColor = '#00f0ff';
        this._showTab(btn.dataset.tab);
      });
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') this.hide(); });
  }

  toggle() {
    const el = document.getElementById('gotham-osint-overlay');
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
    if (el.style.display === 'block') this._showTab('username');
  }
  show() { document.getElementById('gotham-osint-overlay').style.display = 'block'; this._showTab('username'); }
  hide() { const el = document.getElementById('gotham-osint-overlay'); if (el) el.style.display = 'none'; }

  async _showTab(tab) {
    const content = document.getElementById('osint-content');
    const title = document.getElementById('osint-panel-title');
    const tabs = {
      username:    { title: 'USERNAME OSINT — 21 PLATFORM SCAN', render: () => this._renderUsername() },
      url:         { title: 'URL ANALYSIS — FINGERPRINT + METADATA', render: () => this._renderUrl() },
      cve:         { title: 'CVE LOOKUP — NVD/NIST INTELLIGENCE', render: () => this._renderCVE() },
      cvesearch:   { title: 'CVE SEARCH — VULNERABILITY DATABASE', render: () => this._renderCVESearch() },
      vip:         { title: 'VIP TRACKER — SHADOWBROKER DATABASE', render: () => this._renderVIP() },
      breach:      { title: 'BREACH CHECK — HAVEIBEENPWNED + BREACHDIRECTORY', render: () => this._renderBreach() },
      password:    { title: 'PASSWORD EXPOSURE — HIBP K-ANONYMITY', render: () => this._renderPassword() },
      outages:     { title: 'INTERNET OUTAGES — IODA GEORGIA TECH', render: () => this._renderOutages() },
      frontlines:  { title: 'UKRAINE FRONTLINES — DEEPSTATEMAP', render: () => this._renderFrontlines() },
    };
    const m = tabs[tab];
    if (m) { title.textContent = m.title; content.innerHTML = '<div style="color:#666;font-size:11px">Loading...</div>'; m.render(); }
  }

  _btn(label, id) {
    return `<button id="osint-btn-${id}" style="background:rgba(0,240,255,0.1);border:1px solid rgba(0,240,255,0.4);color:#00f0ff;padding:7px 16px;cursor:pointer;border-radius:4px;font-family:inherit;font-size:10px;letter-spacing:1px;margin-right:8px;margin-top:6px;">${label}</button>`;
  }

  _qbtn(label, id) {
    return `<button class="qs-btn" data-val="${id}" style="background:rgba(255,0,255,0.08);border:1px solid rgba(255,0,255,0.3);color:#f0f;padding:4px 10px;cursor:pointer;border-radius:3px;font-size:9px;font-family:inherit;margin-right:4px;margin-top:4px;">${label}</button>`;
  }

  _input(label, id, placeholder) {
    return `<div style="margin-bottom:10px"><div style="color:#888;font-size:10px;margin-bottom:3px">${label}</div><input id="osint-${id}" type="text" placeholder="${placeholder}" style="width:100%;background:rgba(0,0,0,0.6);border:1px solid rgba(0,240,255,0.3);color:#00f0ff;padding:7px 10px;border-radius:4px;font-family:inherit;font-size:12px;outline:none;box-sizing:border-box;"></div>`;
  }

  // ── USERNAME ────────────────────────────────────────────────────────────────
  _renderUsername() {
    const content = document.getElementById('osint-content');
    content.innerHTML = `${this._input('TARGET USERNAME', 'username-input', 'e.g. elonmusk, realdonaldtrump')}${this._btn('SCAN 21 PLATFORMS', 'username-scan')}<div id="osint-username-result"></div>`;
    content.querySelector('#osint-btn-username-scan').addEventListener('click', async () => {
      const u = document.getElementById('osint-username-input').value.trim();
      if (!u) return;
      const btn = content.querySelector('#osint-btn-username-scan');
      btn.textContent = 'SCANNING...'; btn.disabled = true;
      try {
        const r = await fetch(`${this.API}/api/username`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ username: u }) });
        const d = await r.json();
        const found = d.found || [];
        let h = `<div style="margin-top:12px"><div style="color:${found.length>0?'#0f8':'#f44'};font-size:12px;margin-bottom:8px">FOUND: ${found.length} | NOT FOUND: ${(d.not_found||[]).length}</div>`;
        found.forEach(p => { h += `<div style="background:rgba(0,255,136,0.08);border:1px solid rgba(0,255,136,0.3);padding:6px 10px;border-radius:3px;margin-bottom:4px;font-size:11px"><span style="color:#0f8">${p.platform}</span><span style="color:#fff;margin-left:8px">${p.url||p.profile_url||''}</span></div>`; });
        if (found.length === 0) h += `<div style="color:#666;font-size:11px;margin-top:8px">No confirmed presences found.</div>`;
        content.querySelector('#osint-username-result').innerHTML = h + '</div>';
      } catch(e) { content.querySelector('#osint-username-result').innerHTML = `<div style="color:#f44;margin-top:8px">Error: ${e.message}</div>`; }
      btn.textContent = 'SCAN 21 PLATFORMS'; btn.disabled = false;
    });
  }

  // ── URL ────────────────────────────────────────────────────────────────────
  _renderUrl() {
    const content = document.getElementById('osint-content');
    content.innerHTML = `${this._input('TARGET URL', 'url-input', 'https://example.com')}${this._btn('FINGERPRINT URL', 'url-scan')}<div id="osint-url-result"></div>`;
    content.querySelector('#osint-btn-url-scan').addEventListener('click', async () => {
      const url = document.getElementById('osint-url-input').value.trim();
      if (!url) return;
      const btn = content.querySelector('#osint-btn-url-scan');
      btn.textContent = 'ANALYZING...'; btn.disabled = true;
      try {
        const r = await fetch(`${this.API}/api/url`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ url }) });
        const d = await r.json();
        let h = `<div style="margin-top:12px">`;
        if (d.ip) h += `<div style="color:#888;font-size:10px;margin-bottom:6px">IP: <span style="color:#00f0ff">${d.ip}</span> | SSL: <span style="color:${d.ssl?'#0f8':'#f44'}">${d.ssl?'YES':'NO'}</span></div>`;
        if (d.dns) { h += `<div style="font-size:10px;color:#888;margin-bottom:4px">DNS:</div>`; (d.dns||[]).forEach(r => { h += `<div style="font-size:10px;color:#ccc;margin-left:8px">${r}</div>`; }); }
        if (d.emails&&d.emails.length) h += `<div style="font-size:10px;color:#f0f;margin-top:6px">EMAILS: ${d.emails.join(', ')}</div>`;
        if (d.phones&&d.phones.length) h += `<div style="font-size:10px;color:#f80;margin-top:4px">PHONES: ${d.phones.join(', ')}</div>`;
        content.querySelector('#osint-url-result').innerHTML = h + '</div>';
      } catch(e) { content.querySelector('#osint-url-result').innerHTML = `<div style="color:#f44;margin-top:8px">Error: ${e.message}</div>`; }
      btn.textContent = 'FINGERPRINT URL'; btn.disabled = false;
    });
  }

  // ── CVE LOOKUP ──────────────────────────────────────────────────────────────
  _renderCVE() {
    const content = document.getElementById('osint-content');
    content.innerHTML = `${this._input('CVE ID', 'cve-input', 'CVE-2021-44228 (Log4j)')}
      <div style="margin-bottom:8px">${this._qbtn('LOG4J','CVE-2021-44228')}${this._qbtn('ETERNALBLUE','CVE-2017-0144')}${this._qbtn('HEARTBLEED','CVE-2014-0160')}${this._qbtn('SHELLSHOCK','CVE-2014-6271')}${this._qbtn('STRUTS2','CVE-2017-5638')}</div>
      ${this._btn('LOOKUP CVE', 'cve-lookup')}<div id="osint-cve-result"></div>`;
    const doLookup = async (cveId) => {
      const btn = content.querySelector('#osint-btn-cve-lookup');
      btn.textContent = 'LOOKING UP...'; btn.disabled = true;
      try {
        const r = await fetch(`${this.API}/api/cve-lookup?cve=${cveId}`);
        const d = await r.json();
        const score = d.cvss_score || 0;
        const level = d.gotham_risk_level || 'unknown';
        const action = d.action || '';
        const sevColor = level==='critical'?'#f44':level==='high'?'#f80':level==='medium'?'#ff0':'#0f8';
        let h = `<div style="margin-top:12px">
          <div style="display:flex;align-items:center;margin-bottom:8px">
            <span style="color:#fff;font-size:14px;font-weight:bold">${cveId}</span>
            <span style="background:${sevColor}22;border:1px solid ${sevColor};color:${sevColor};padding:2px 8px;border-radius:3px;font-size:10px;margin-left:10px">CVSS ${score} — ${(level||'').toUpperCase()}</span>
            <span style="color:#f44;font-size:10px;margin-left:12px;font-weight:bold">${action}</span>
          </div>
          <div style="color:#888;font-size:10px;margin-bottom:8px;line-height:1.4">${(d.description||'').substring(0,400)}...</div>
          <div style="color:#666;font-size:10px">CWE: ${(d.cwe||[]).filter(Boolean).join(', ')||'N/A'} | Published: ${d.published?new Date(d.published).toLocaleDateString():'N/A'}</div>
          ${d.references&&d.references.length?`<div style="margin-top:8px"><div style="color:#0f8;font-size:10px;margin-bottom:4px">REFERENCES:</div>${d.references.slice(0,3).map(ref=>`<div style="font-size:9px;color:#555;word-break:break-all;margin-bottom:2px">${ref}</div>`).join('')}</div>`:''}
        </div>`;
        content.querySelector('#osint-cve-result').innerHTML = h;
      } catch(e) { content.querySelector('#osint-cve-result').innerHTML = `<div style="color:#f44;margin-top:8px">Error: ${e.message}</div>`; }
      btn.textContent = 'LOOKUP CVE'; btn.disabled = false;
    };
    content.querySelector('#osint-btn-cve-lookup').addEventListener('click', () => doLookup(document.getElementById('osint-cve-input').value.trim()));
    content.querySelectorAll('.qs-btn').forEach(b => b.addEventListener('click', () => doLookup(b.dataset.val)));
  }

  // ── CVE SEARCH ──────────────────────────────────────────────────────────────
  _renderCVESearch() {
    const content = document.getElementById('osint-content');
    content.innerHTML = `${this._input('SEARCH TERM', 'cvesearch-input', 'e.g. apache, kubernetes, windows')}
      <div style="margin-bottom:8px">${this._qbtn('APACHE','apache')}${this._qbtn('KUBERNETES','kubernetes')}${this._qbtn('WINDOWS','windows')}${this._qbtn('ORACLE','oracle')}${this._qbtn('JENKINS','jenkins')}</div>
      ${this._btn('SEARCH NVD DATABASE', 'cvesearch-do')}<div id="osint-cvesearch-result"></div>`;
    const doSearch = async (q) => {
      const btn = content.querySelector('#osint-btn-cvesearch-do');
      btn.textContent = 'SEARCHING...'; btn.disabled = true;
      try {
        const r = await fetch(`${this.API}/api/cve-search?q=${encodeURIComponent(q)}&limit=10`);
        const d = await r.json();
        let h = `<div style="margin-top:12px;color:#888;font-size:10px;margin-bottom:8px">${d.total_results||0} results for "${q}"</div>`;
        (d.results||[]).forEach(cve => {
          const sev = cve.cvss_severity||'';
          const col = sev==='CRITICAL'?'#f44':sev==='HIGH'?'#f80':'#0f8';
          h += `<div style="background:rgba(0,0,0,0.4);border:1px solid rgba(0,240,255,0.15);padding:8px;border-radius:4px;margin-bottom:6px">
            <div style="display:flex;justify-content:space-between"><span style="color:#00f0ff;font-size:11px;font-weight:bold">${cve.cve_id||'N/A'}</span><span style="color:${col};font-size:10px">CVSS ${cve.cvss_score||'N/A'} — ${sev}</span></div>
            <div style="color:#888;font-size:10px;margin-top:4px;line-height:1.3">${(cve.description||'').substring(0,150)}...</div>
          </div>`;
        });
        content.querySelector('#osint-cvesearch-result').innerHTML = h;
      } catch(e) { content.querySelector('#osint-cvesearch-result').innerHTML = `<div style="color:#f44;margin-top:8px">Error: ${e.message}</div>`; }
      btn.textContent = 'SEARCH NVD DATABASE'; btn.disabled = false;
    };
    content.querySelector('#osint-btn-cvesearch-do').addEventListener('click', () => doSearch(document.getElementById('osint-cvesearch-input').value.trim()));
    content.querySelectorAll('.qs-btn').forEach(b => b.addEventListener('click', () => doSearch(b.dataset.val)));
  }

  // ── VIP TRACK ───────────────────────────────────────────────────────────────
  _renderVIP() {
    const content = document.getElementById('osint-content');
    content.innerHTML = `${this._input('SEARCH NAME / AIRCRAFT / OPERATOR', 'vip-input', 'e.g. Trump, Putin, Elon, Roman Abramovich')}
      <div style="margin-bottom:8px">${this._qbtn('GOVERNMENT','Government')}${this._qbtn('OLIGARCH','Oligarch')}${this._qbtn('CELEBRITY','Celebrity')}${this._qbtn('BUSINESS','Business')}${this._qbtn('F1','Formula 1')}${this._qbtn('SPORTS','Sports')}</div>
      ${this._btn('SEARCH DATABASE', 'vip-search')}<div id="osint-vip-result"></div>`;
    const doSearch = async (q, cat) => {
      const btn = content.querySelector('#osint-btn-vip-search');
      btn.textContent = 'SEARCHING...'; btn.disabled = true;
      try {
        let url = `${this.API}/api/vip-track?`;
        if (q) url += `q=${encodeURIComponent(q)}`;
        if (cat) url += `&category=${encodeURIComponent(cat)}`;
        const r = await fetch(url);
        const d = await r.json();
        let h = `<div style="margin-top:12px"><div style="color:#888;font-size:10px;margin-bottom:8px">${d.total_results||0} of ${d.db_total||0} entries matched</div></div>`;
        (d.results||[]).slice(0,30).forEach(item => {
          const catCol = item.category==='Government'?'#00f0ff':item.category==='Oligarch'?'#f0f':'#0f8';
          h += `<div style="background:rgba(0,0,0,0.4);border:1px solid rgba(0,240,255,0.1);padding:7px 10px;border-radius:4px;margin-bottom:4px;display:flex;justify-content:space-between">
            <span style="color:#fff;font-size:11px">${item.name}</span>
            <span style="color:${catCol};font-size:9px">${item.category}</span>
          </div>`;
        });
        content.querySelector('#osint-vip-result').innerHTML = h;
      } catch(e) { content.querySelector('#osint-vip-result').innerHTML = `<div style="color:#f44;margin-top:8px">Error: ${e.message}</div>`; }
      btn.textContent = 'SEARCH DATABASE'; btn.disabled = false;
    };
    content.querySelector('#osint-btn-vip-search').addEventListener('click', () => doSearch(document.getElementById('osint-vip-input').value.trim(), ''));
    content.querySelectorAll('.qs-btn').forEach(b => b.addEventListener('click', () => doSearch('', b.dataset.val)));
  }

  // ── BREACH CHECK ────────────────────────────────────────────────────────────
  _renderBreach() {
    const content = document.getElementById('osint-content');
    content.innerHTML = `${this._input('EMAIL ADDRESS', 'breach-input', 'target@email.com')}${this._btn('CHECK BREACHES', 'breach-check')}<div id="osint-breach-result"></div>`;
    content.querySelector('#osint-btn-breach-check').addEventListener('click', async () => {
      const email = document.getElementById('osint-breach-input').value.trim();
      if (!email) return;
      const btn = content.querySelector('#osint-btn-breach-check');
      btn.textContent = 'CHECKING...'; btn.disabled = true;
      try {
        const r = await fetch(`${this.API}/api/breach`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ email }) });
        const d = await r.json();
        const count = d.breach_count||0;
        let h = `<div style="margin-top:12px"><div style="color:${count>0?'#f44':'#0f8'};font-size:14px;font-weight:bold;margin-bottom:8px">${count} BREACH${count!==1?'ES':''} FOUND FOR ${email}</div></div>`;
        (d.breaches||[]).forEach(b => {
          h += `<div style="background:rgba(255,0,0,0.06);border:1px solid rgba(255,0,100,0.3);padding:8px;border-radius:4px;margin-bottom:6px">
            <div style="color:#f44;font-size:11px;font-weight:bold">${b.name||b.title||'Unknown Breach'}</div>
            <div style="color:#888;font-size:10px;margin-top:2px">Date: ${b.breach_date||'N/A'} | Source: ${b.source||'BreachDirectory'}</div>
            <div style="color:#666;font-size:10px;margin-top:4px;line-height:1.3">${(b.description||'').substring(0,200)}</div>
            ${b.data_classes&&b.data_classes.length?`<div style="margin-top:4px">${b.data_classes.slice(0,6).map(d=>`<span style="background:rgba(255,0,100,0.2);color:#f44;padding:1px 6px;border-radius:2px;font-size:9px;margin-right:3px">${d}</span>`).join('')}</div>`:''}
          </div>`;
        });
        if (count===0) h += `<div style="color:#0f8;font-size:11px;margin-top:8px">No breaches found. This email has not appeared in known data breaches.</div>`;
        content.querySelector('#osint-breach-result').innerHTML = h;
      } catch(e) { content.querySelector('#osint-breach-result').innerHTML = `<div style="color:#f44;margin-top:8px">Error: ${e.message}</div>`; }
      btn.textContent = 'CHECK BREACHES'; btn.disabled = false;
    });
  }

  // ── PASSWORD CHECK ─────────────────────────────────────────────────────────
  _renderPassword() {
    const content = document.getElementById('osint-content');
    content.innerHTML = `<div style="background:rgba(255,0,100,0.08);border:1px solid rgba(255,0,100,0.3);padding:10px;border-radius:4px;margin-bottom:12px;font-size:10px;color:#f44">PASSWORD NEVER STORED OR TRANSMITTED. Uses k-anonymity - only SHA1 prefix sent to HIBP API.</div>${this._input('PASSWORD', 'password-input', 'Enter password to check')}${this._btn('CHECK EXPOSURE', 'password-check')}<div id="osint-password-result"></div>`;
    content.querySelector('#osint-btn-password-check').addEventListener('click', async () => {
      const pw = document.getElementById('osint-password-input').value;
      if (!pw) return;
      const btn = content.querySelector('#osint-btn-password-check');
      btn.textContent = 'CHECKING...'; btn.disabled = true;
      try {
        const r = await fetch(`${this.API}/api/password-breach`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ password: pw }) });
        const d = await r.json();
        let h = `<div style="margin-top:12px"><div style="color:${d.exposed?'#f44':'#0f8'};font-size:16px;font-weight:bold;margin-bottom:8px">${d.exposed?'PASSWORD EXPOSED IN BREACHES':'PASSWORD NOT FOUND IN BREACHES'}</div>`;
        if (d.exposed) h += `<div style="color:#f44;font-size:12px">Found ${(d.exposure_count||0).toLocaleString()} times across breach databases.</div>`;
        content.querySelector('#osint-password-result').innerHTML = h + '</div>';
      } catch(e) { content.querySelector('#osint-password-result').innerHTML = `<div style="color:#f44;margin-top:8px">Error: ${e.message}</div>`; }
      btn.textContent = 'CHECK EXPOSURE'; btn.disabled = false;
    });
  }

  // ── OUTAGES ─────────────────────────────────────────────────────────────────
  _renderOutages() {
    const content = document.getElementById('osint-content');
    content.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><span style="color:#888;font-size:10px">Internet Outage Detection - IODA Georgia Tech (BGP + Ping)</span>${this._btn('REFRESH', 'outages-refresh')}</div><div id="osint-outages-result"></div>`;
    const load = async () => {
      const btn = content.querySelector('#osint-btn-outages-refresh');
      btn.textContent = 'LOADING...'; btn.disabled = true;
      try {
        const r = await fetch(`${this.API}/api/internet-outages`);
        const d = await r.json();
        let h = `<div style="margin-bottom:10px"><span style="color:#f44;font-size:12px">SEVERE: ${d.severe||0}</span><span style="color:#888;font-size:12px;margin-left:16px">TOTAL: ${d.total||0}</span></div>`;
        h += `<div style="color:#0f8;font-size:10px;margin-bottom:8px">SEVERE OUTAGES (>50% drop):</div>`;
        if (!d.severe_outages||d.severe_outages.length===0) h += `<div style="color:#666;font-size:11px">No severe outages detected in the last 24 hours.</div>`;
        (d.severe_outages||[]).forEach(o => {
          h += `<div style="border-left:3px solid #f44;padding:6px 10px;margin-bottom:4px;background:rgba(255,0,0,0.05);border-radius:0 4px 4px 0">
            <div style="display:flex;justify-content:space-between"><span style="color:#fff;font-size:11px">${o.region}</span><span style="color:#f44;font-size:10px">${o.severity}%</span></div>
            <div style="color:#888;font-size:9px">${o.country} (${o.country_code||''}) | ${o.datasource||'BGP'}</div>
          </div>`;
        });
        h += `<div style="color:#0f8;font-size:10px;margin-top:12px;margin-bottom:8px">ALL OUTAGES:</div>`;
        (d.outages||[]).slice(0,20).forEach(o => {
          h += `<div style="display:flex;justify-content:space-between;padding:4px 8px;background:rgba(0,0,0,0.3);border-radius:3px;margin-bottom:3px;font-size:10px"><span style="color:#ccc">${o.region}</span><span style="color:${o.severity>=50?'#f44':o.severity>=25?'#f80':'#0f8'}">${o.severity}%</span></div>`;
        });
        content.querySelector('#osint-outages-result').innerHTML = h;
      } catch(e) { content.querySelector('#osint-outages-result').innerHTML = `<div style="color:#f44;margin-top:8px">Error: ${e.message}</div>`; }
      btn.textContent = 'REFRESH'; btn.disabled = false;
    };
    content.querySelector('#osint-btn-outages-refresh').addEventListener('click', load);
    load();
  }

  // ── FRONTLINES ───────────────────────────────────────────────────────────────
  _renderFrontlines() {
    const content = document.getElementById('osint-content');
    content.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><span style="color:#888;font-size:10px">Ukraine Conflict Zones - DeepStateMap GeoJSON (GitHub Mirror)</span>${this._btn('LOAD FRONTLINES', 'frontlines-load')}</div><div id="osint-frontlines-result"><div style="color:#666;font-size:11px">Click LOAD FRONTLINES to fetch latest data from DeepStateMap.</div></div>`;
    content.querySelector('#osint-btn-frontlines-load').addEventListener('click', async () => {
      const btn = content.querySelector('#osint-btn-frontlines-load');
      btn.textContent = 'LOADING...'; btn.disabled = true;
      try {
        const r = await fetch(`${this.API}/api/ukraine-frontlines`);
        const d = await r.json();
        let h = `<div style="margin-bottom:10px"><span style="color:#f44;font-size:12px">${d.total_zones||0} ZONES</span><span style="color:#888;font-size:10px;margin-left:12px">Source: ${d.source||'DeepStateMap'}</span></div>`;
        const zoneColors = { 'Russian-occupied areas': '#f44', 'Russian advance': '#f80', 'Liberated area': '#0f8', 'Directions of UA attacks': '#00f0ff' };
        (d.features||[]).forEach((f, i) => {
          const name = f.properties?.name||'Unknown';
          const color = zoneColors[name]||'#888';
          h += `<div style="border-left:3px solid ${color};padding:5px 8px;margin-bottom:3px;background:rgba(0,0,0,0.3);border-radius:0 4px 4px 0">
            <span style="color:${color};font-size:10px;font-weight:bold">${name}</span>
            <span style="color:#555;font-size:9px;margin-left:8px">zone_id: ${f.properties?.zone_id||'?'}</span>
          </div>`;
        });
        if (!d.features||d.features.length===0) h += `<div style="color:#666;font-size:11px">No zone data available. Ukraine frontlines may not be fetching correctly.</div>`;
        content.querySelector('#osint-frontlines-result').innerHTML = h;
      } catch(e) { content.querySelector('#osint-frontlines-result').innerHTML = `<div style="color:#f44;margin-top:8px">Error: ${e.message}</div>`; }
      btn.textContent = 'LOAD FRONTLINES'; btn.disabled = false;
    });
  }
}

// Auto-init when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('[GOTHAM OSINT] Overlay ready. Click OSINT button in right panel to open.');
  // Auto-create on first load so it's ready when needed
  window.gothamOSINTOverlay = new GothamOSINTOverlay();
});
