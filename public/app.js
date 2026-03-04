/* ── state ── */
let sessions = [];
let currentSession = null;
let currentEvents = null;
let activeTab = 'info';

/* ── utils ── */
function $(id) { return document.getElementById(id); }

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function relTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return `${days}d ago`;
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('zh-CN', { hour12: false });
}

function shortId(id) {
  if (!id) return '—';
  return id.substring(0, 8) + '…';
}

/* ── API ── */
async function fetchSessions() {
  const r = await fetch('/api/sessions');
  return r.json();
}

async function fetchEvents(sessionId) {
  const r = await fetch(`/api/sessions/${sessionId}/events`);
  return r.json();
}

/* ── render sidebar ── */
function renderSessionList(sessions) {
  const container = $('sessionList');
  if (!sessions.length) {
    container.innerHTML = '<div class="empty">No sessions found in ~/.acpx/sessions</div>';
    return;
  }
  container.innerHTML = sessions.map((s, i) => {
    const isActive = !s.closed && s.pid;
    const id = s.acpx_record_id || s.id || 'unknown';
    const agent = s.agent_command || s.agentCommand || 'unknown';
    const cwd = s.cwd || '—';
    const updated = s.last_used_at || s.updated_at || s.created_at;
    return `
      <div class="session-item${currentSession?.acpx_record_id === id ? ' active' : ''}"
           onclick="selectSession(${i})" data-idx="${i}">
        <div class="session-item-id">${esc(id)}</div>
        <div class="session-item-agent">${esc(agent)}</div>
        <div class="session-item-cwd">${esc(cwd)}</div>
        <div class="session-item-footer">
          <span class="status-dot ${isActive ? 'active' : 'closed'}" title="${isActive ? 'Active' : 'Closed/Inactive'}"></span>
          <span class="time-label">${relTime(updated)}</span>
        </div>
      </div>
    `;
  }).join('');
}

/* ── render detail ── */
function selectSession(idx) {
  currentSession = sessions[idx];
  currentEvents = null;
  activeTab = 'info';
  $('welcome').classList.add('hidden');
  $('detail').classList.remove('hidden');

  // update sidebar active
  document.querySelectorAll('.session-item').forEach((el, i) => {
    el.classList.toggle('active', i === idx);
  });

  renderDetailHeader();
  renderTab('info');
  setActiveTab('info');
}

function renderDetailHeader() {
  const s = currentSession;
  const id = s.acpx_record_id || s.id || '—';
  const agent = s.agent_command || s.agentCommand || '—';
  $('detailTitle').textContent = id;

  const isActive = !s.closed && s.pid;
  const msgs = (s.messages || []).length;
  $('detailMeta').innerHTML = `
    <span>${esc(agent)}</span>
    <span title="${esc(s.cwd)}">${esc(s.cwd)}</span>
    <span style="color:${isActive ? 'var(--green)' : 'var(--text2)'}">
      ${isActive ? '● Active' : '○ Inactive'}
    </span>
    ${msgs ? `<span>${msgs} messages</span>` : ''}
  `;
}

/* ── tabs ── */
function setActiveTab(name) {
  activeTab = name;
  document.querySelectorAll('.tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === name);
  });
}

async function renderTab(name) {
  const container = $('tabContent');
  setActiveTab(name);

  if (name === 'info') {
    container.innerHTML = renderInfoTab(currentSession);
  } else if (name === 'messages') {
    container.innerHTML = renderMessagesTab(currentSession);
  } else if (name === 'events') {
    if (!currentEvents) {
      container.innerHTML = '<div class="loading">Loading events…</div>';
      const id = currentSession.acpx_record_id || currentSession.id;
      currentEvents = await fetchEvents(id);
    }
    container.innerHTML = renderEventsTab(currentEvents);
  } else if (name === 'raw') {
    container.innerHTML = `<pre class="raw-json">${esc(JSON.stringify(currentSession, null, 2))}</pre>`;
  }
}

/* ── info tab ── */
function renderInfoTab(s) {
  const isActive = !s.closed && s.pid;
  const caps = s.agent_capabilities || s.agentCapabilities || {};
  const promptCaps = caps.promptCapabilities || {};
  const sessionCaps = caps.sessionCapabilities || {};
  const eventLog = s.event_log || {};

  const capTags = [
    ...Object.entries(promptCaps).filter(([,v]) => v).map(([k]) => `prompt:${k}`),
    ...Object.keys(sessionCaps).map(k => `session:${k}`),
    caps.loadSession ? 'loadSession' : null,
  ].filter(Boolean);

  const availCmds = s.acpx?.available_commands || [];

  return `
    <div class="info-grid">
      <div class="info-card">
        <div class="info-card-label">Record ID</div>
        <div class="info-card-value accent">${esc(s.acpx_record_id || '—')}</div>
      </div>
      <div class="info-card">
        <div class="info-card-label">ACP Session ID</div>
        <div class="info-card-value accent">${esc(s.acp_session_id || '—')}</div>
      </div>
      <div class="info-card">
        <div class="info-card-label">Status</div>
        <div class="info-card-value ${isActive ? 'green' : 'red'}">
          ${isActive ? '● Active' : '○ ' + (s.closed ? 'Closed' : 'Inactive')}
        </div>
      </div>
      <div class="info-card">
        <div class="info-card-label">Agent Command</div>
        <div class="info-card-value">${esc(s.agent_command || s.agentCommand || '—')}</div>
      </div>
      <div class="info-card">
        <div class="info-card-label">Working Directory</div>
        <div class="info-card-value">${esc(s.cwd || '—')}</div>
      </div>
      <div class="info-card">
        <div class="info-card-label">PID</div>
        <div class="info-card-value ${s.pid ? 'green' : 'red'}">${s.pid || '—'}</div>
      </div>
      <div class="info-card">
        <div class="info-card-label">Protocol Version</div>
        <div class="info-card-value">${s.protocol_version || s.protocolVersion || '—'}</div>
      </div>
      <div class="info-card">
        <div class="info-card-label">Last Sequence</div>
        <div class="info-card-value">${s.last_seq != null ? s.last_seq : '—'}</div>
      </div>
      <div class="info-card">
        <div class="info-card-label">Schema</div>
        <div class="info-card-value">${esc(s.schema || '—')}</div>
      </div>
    </div>

    <div class="section-title">Timestamps</div>
    <div class="info-grid">
      <div class="info-card">
        <div class="info-card-label">Created At</div>
        <div class="info-card-value">${fmtDate(s.created_at || s.createdAt)}</div>
      </div>
      <div class="info-card">
        <div class="info-card-label">Last Used At</div>
        <div class="info-card-value">${fmtDate(s.last_used_at || s.lastUsedAt)}</div>
      </div>
      <div class="info-card">
        <div class="info-card-label">Last Prompt At</div>
        <div class="info-card-value">${fmtDate(s.last_prompt_at || s.lastPromptAt)}</div>
      </div>
      <div class="info-card">
        <div class="info-card-label">Agent Started At</div>
        <div class="info-card-value">${fmtDate(s.agent_started_at || s.agentStartedAt)}</div>
      </div>
      <div class="info-card">
        <div class="info-card-label">Updated At</div>
        <div class="info-card-value">${fmtDate(s.updated_at)}</div>
      </div>
      ${s.closed_at || s.closedAt ? `
      <div class="info-card">
        <div class="info-card-label">Closed At</div>
        <div class="info-card-value red">${fmtDate(s.closed_at || s.closedAt)}</div>
      </div>` : ''}
    </div>

    ${capTags.length ? `
    <div class="section-title">Agent Capabilities</div>
    <div class="cap-grid">
      ${capTags.map(t => `<span class="cap-tag">${esc(t)}</span>`).join('')}
    </div>` : ''}

    ${availCmds.length ? `
    <div class="section-title">Available acpx Commands</div>
    <div class="cap-grid">
      ${availCmds.map(c => `<span class="cap-tag" style="color:var(--yellow)">${esc(c)}</span>`).join('')}
    </div>` : ''}

    ${eventLog.active_path ? `
    <div class="section-title">Event Log</div>
    <div class="info-grid">
      <div class="info-card">
        <div class="info-card-label">Active Path</div>
        <div class="info-card-value" style="font-size:11px">${esc(eventLog.active_path)}</div>
      </div>
      <div class="info-card">
        <div class="info-card-label">Segment Count / Max</div>
        <div class="info-card-value">${eventLog.segment_count} / ${eventLog.max_segments}</div>
      </div>
      <div class="info-card">
        <div class="info-card-label">Max Segment Size</div>
        <div class="info-card-value">${Math.round((eventLog.max_segment_bytes || 0) / 1024 / 1024)} MB</div>
      </div>
      ${eventLog.last_write_at ? `
      <div class="info-card">
        <div class="info-card-label">Last Write</div>
        <div class="info-card-value">${fmtDate(eventLog.last_write_at)}</div>
      </div>` : ''}
    </div>` : ''}
  `;
}

/* ── messages tab ── */
function renderMessagesTab(s) {
  const messages = s.messages || [];
  if (!messages.length) {
    return '<div class="empty">No messages recorded in this session.</div>';
  }

  const bubbles = messages.map(msg => {
    const role = msg.User ? 'user' : msg.Agent ? 'agent' : 'unknown';
    const data = msg.User || msg.Agent || {};
    const contents = data.content || [];

    let html = '';
    for (const block of contents) {
      if (block.Text) {
        html += `<div class="message-text">${esc(block.Text)}</div>`;
      } else if (block.ToolUse) {
        const tu = block.ToolUse;
        html += `
          <div class="tool-use-block">
            <div class="tool-name">🔧 ${esc(tu.name || tu.id)}</div>
            ${tu.raw_input ? `<div style="color:var(--text2);margin-top:4px;font-size:11px">${esc(tu.raw_input.substring(0, 200))}${tu.raw_input.length > 200 ? '…' : ''}</div>` : ''}
          </div>`;
      }
    }

    return `
      <div class="message-bubble ${role}">
        <div class="message-role">${role === 'user' ? '👤 User' : '🤖 Agent'}</div>
        ${html}
      </div>`;
  }).join('');

  return `<div class="message-thread">${bubbles}</div>`;
}

/* ── events tab ── */
function renderEventsTab(events) {
  if (!events || !events.length) {
    return '<div class="empty">No events found in the stream log.</div>';
  }

  const items = events.map((e, i) => {
    const isResponse = 'result' in e || 'error' in e;
    const isError = 'error' in e;
    const method = e.method || (isError ? `error(id=${e.id})` : `result(id=${e.id})`);
    const cls = isError ? 'error' : isResponse ? 'response' : '';

    let summary = '';
    if (e.method) {
      const params = e.params;
      if (params) {
        if (params.sessionId) summary = `sessionId=${params.sessionId}`;
        else if (params.cwd) summary = `cwd=${params.cwd}`;
        else if (params.protocolVersion) summary = `protocolVersion=${params.protocolVersion}`;
      }
    } else if (e.result) {
      const r = e.result;
      if (r.sessionId) summary = `sessionId=${r.sessionId}`;
      else if (r.protocolVersion) summary = `protocolVersion=${r.protocolVersion}`;
      else summary = JSON.stringify(r).substring(0, 80);
    } else if (e.error) {
      summary = e.error.message || '';
    }

    return `
      <div class="event-item">
        <span class="event-method ${cls}">${esc(method)}</span>
        <span class="event-summary" onclick="toggleEventDetail(${i}, this)"
              data-expanded="false" data-raw="${esc(JSON.stringify(e))}">
          ${esc(summary)}
        </span>
      </div>
      <pre id="event-detail-${i}" class="raw-json hidden" style="margin:0 0 4px 0;font-size:11px;max-height:200px;overflow-y:auto"></pre>
    `;
  }).join('');

  return `<div class="event-list">${items}</div>`;
}

function toggleEventDetail(idx, el) {
  const pre = document.getElementById(`event-detail-${idx}`);
  if (el.dataset.expanded === 'false') {
    pre.textContent = JSON.stringify(JSON.parse(el.dataset.raw), null, 2);
    pre.classList.remove('hidden');
    el.dataset.expanded = 'true';
  } else {
    pre.classList.add('hidden');
    el.dataset.expanded = 'false';
  }
}

/* ── init ── */
async function load() {
  $('sessionList').innerHTML = '<div class="loading">Loading sessions…</div>';
  sessions = await fetchSessions();
  renderSessionList(sessions);
  // auto-select first if none selected
  if (!currentSession && sessions.length) {
    selectSession(0);
  } else if (currentSession) {
    const idx = sessions.findIndex(s => s.acpx_record_id === currentSession.acpx_record_id);
    if (idx >= 0) selectSession(idx);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  load();

  $('refreshBtn').addEventListener('click', load);

  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => renderTab(tab.dataset.tab));
  });
});
