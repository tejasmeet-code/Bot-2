export function getDashboardHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Zenith Bot • Operations & Admin Control Center</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-base: #0a0c10;
      --bg-surface: #11141c;
      --bg-surface-elevated: #181d28;
      --bg-surface-hover: #202636;
      --border-subtle: #252b3d;
      --border-strong: #37415a;
      --text-primary: #f3f4f6;
      --text-secondary: #9ca3af;
      --text-muted: #6b7280;
      --accent-primary: #5865f2;
      --accent-primary-hover: #4752c4;
      --accent-success: #23a55a;
      --accent-success-bg: rgba(35, 165, 90, 0.12);
      --accent-warning: #f0b232;
      --accent-warning-bg: rgba(240, 178, 50, 0.12);
      --accent-danger: #f23f43;
      --accent-danger-bg: rgba(242, 63, 67, 0.12);
      --font-sans: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      --font-mono: 'JetBrains Mono', monospace;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background-color: var(--bg-base);
      color: var(--text-primary);
      font-family: var(--font-sans);
      min-height: 100vh;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
      display: flex;
      flex-direction: column;
    }

    /* Top Navigation Header */
    header {
      background: var(--bg-surface);
      border-bottom: 1px solid var(--border-subtle);
      position: sticky;
      top: 0;
      z-index: 50;
    }

    .header-inner {
      max-width: 1320px;
      margin: 0 auto;
      padding: 0.85rem 1.5rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }

    .brand-section {
      display: flex;
      align-items: center;
      gap: 0.85rem;
    }

    .bot-avatar-wrap {
      position: relative;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: var(--bg-surface-elevated);
      overflow: visible;
      flex-shrink: 0;
    }

    .bot-avatar-img {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      object-fit: cover;
      display: block;
      border: 2px solid var(--border-subtle);
    }

    .online-indicator-dot {
      position: absolute;
      bottom: 0px;
      right: 0px;
      width: 14px;
      height: 14px;
      background: var(--accent-success);
      border-radius: 50%;
      border: 2.5px solid var(--bg-surface);
      box-shadow: 0 0 10px rgba(35, 165, 90, 0.6);
      animation: pulse 2.5s infinite;
    }

    @keyframes pulse {
      0% { box-shadow: 0 0 0 0 rgba(35, 165, 90, 0.7); }
      70% { box-shadow: 0 0 0 8px rgba(35, 165, 90, 0); }
      100% { box-shadow: 0 0 0 0 rgba(35, 165, 90, 0); }
    }

    .brand-title {
      font-size: 1.15rem;
      font-weight: 700;
      color: var(--text-primary);
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .brand-tag {
      font-size: 0.8rem;
      color: var(--text-muted);
      font-family: var(--font-mono);
      font-weight: 500;
    }

    /* Live Status Pill */
    .status-badge-healthy {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.35rem 0.85rem;
      background: var(--accent-success-bg);
      border: 1px solid rgba(35, 165, 90, 0.35);
      border-radius: 9999px;
      font-size: 0.82rem;
      font-weight: 600;
      color: #38d37a;
      letter-spacing: 0.01em;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .metric-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.35rem 0.75rem;
      background: var(--bg-surface-elevated);
      border: 1px solid var(--border-subtle);
      border-radius: 8px;
      font-size: 0.8rem;
      font-family: var(--font-mono);
      color: var(--text-secondary);
    }

    .metric-pill strong {
      color: var(--text-primary);
    }

    /* Navigation Tabs Bar */
    .tabs-bar {
      background: var(--bg-surface);
      border-bottom: 1px solid var(--border-subtle);
    }

    .tabs-inner {
      max-width: 1320px;
      margin: 0 auto;
      padding: 0 1.5rem;
      display: flex;
      gap: 0.5rem;
      overflow-x: auto;
      scrollbar-width: none;
    }
    .tabs-inner::-webkit-scrollbar { display: none; }

    .nav-tab {
      background: transparent;
      border: none;
      color: var(--text-secondary);
      padding: 0.85rem 1rem;
      font-size: 0.9rem;
      font-weight: 600;
      font-family: var(--font-sans);
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      border-bottom: 2px solid transparent;
      white-space: nowrap;
      transition: all 0.15s ease;
    }

    .nav-tab:hover {
      color: var(--text-primary);
      background: rgba(255, 255, 255, 0.03);
    }

    .nav-tab.active {
      color: var(--accent-primary);
      border-bottom-color: var(--accent-primary);
      background: rgba(88, 101, 242, 0.06);
    }

    .badge-count {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.1rem 0.45rem;
      font-size: 0.72rem;
      border-radius: 9999px;
      background: var(--bg-surface-hover);
      color: var(--text-secondary);
      font-family: var(--font-mono);
      font-weight: 600;
    }

    /* Main Container */
    main {
      max-width: 1320px;
      width: 100%;
      margin: 0 auto;
      padding: 2rem 1.5rem;
      flex: 1;
    }

    .tab-pane {
      display: none;
      animation: fadeIn 0.2s ease;
    }
    .tab-pane.active {
      display: block;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(3px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* Grid Layouts */
    .grid-stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
      gap: 1.25rem;
      margin-bottom: 2rem;
    }

    .stat-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: 12px;
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      transition: transform 0.15s ease, border-color 0.15s ease;
    }

    .stat-card:hover {
      border-color: var(--border-strong);
      transform: translateY(-2px);
    }

    .stat-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      color: var(--text-muted);
      font-size: 0.8rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .stat-value {
      font-size: 1.85rem;
      font-weight: 800;
      color: var(--text-primary);
      font-family: var(--font-mono);
      display: flex;
      align-items: baseline;
      gap: 0.4rem;
    }

    .stat-sub {
      font-size: 0.78rem;
      color: var(--text-secondary);
    }

    /* Section Containers & Cards */
    .section-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: 14px;
      padding: 1.5rem;
      margin-bottom: 2rem;
    }

    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1.25rem;
      flex-wrap: wrap;
      gap: 1rem;
    }

    .section-title {
      font-size: 1.15rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 0.6rem;
      color: var(--text-primary);
    }

    .section-subtitle {
      font-size: 0.85rem;
      color: var(--text-secondary);
      margin-top: 0.25rem;
    }

    /* Tables */
    .table-container {
      overflow-x: auto;
      border: 1px solid var(--border-subtle);
      border-radius: 10px;
      background: var(--bg-base);
    }

    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.88rem;
    }

    th {
      background: var(--bg-surface-elevated);
      color: var(--text-secondary);
      font-weight: 600;
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      padding: 0.85rem 1rem;
      border-bottom: 1px solid var(--border-subtle);
    }

    td {
      padding: 0.95rem 1rem;
      border-bottom: 1px solid var(--border-subtle);
      color: var(--text-primary);
      vertical-align: middle;
    }

    tr:last-child td {
      border-bottom: none;
    }

    tr:hover td {
      background: rgba(255, 255, 255, 0.02);
    }

    /* Role Badges */
    .role-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.25rem 0.6rem;
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: 700;
      font-family: var(--font-mono);
      letter-spacing: 0.02em;
    }
    .role-owner { background: rgba(241, 196, 15, 0.15); color: #f1c40f; border: 1px solid rgba(241, 196, 15, 0.3); }
    .role-co_owner { background: rgba(243, 156, 18, 0.15); color: #f39c12; border: 1px solid rgba(243, 156, 18, 0.3); }
    .role-admin { background: rgba(88, 101, 242, 0.15); color: #5865f2; border: 1px solid rgba(88, 101, 242, 0.3); }
    .role-mod { background: rgba(231, 76, 60, 0.15); color: #e74c3c; border: 1px solid rgba(231, 76, 60, 0.3); }
    .role-help { background: rgba(46, 204, 113, 0.15); color: #2ecc71; border: 1px solid rgba(46, 204, 113, 0.3); }

    /* Buttons */
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.45rem;
      padding: 0.55rem 1rem;
      border-radius: 8px;
      font-size: 0.85rem;
      font-weight: 600;
      font-family: var(--font-sans);
      cursor: pointer;
      border: 1px solid transparent;
      transition: all 0.15s ease;
      white-space: nowrap;
    }

    .btn-primary {
      background: var(--accent-primary);
      color: #fff;
    }
    .btn-primary:hover {
      background: var(--accent-primary-hover);
    }

    .btn-secondary {
      background: var(--bg-surface-elevated);
      border-color: var(--border-subtle);
      color: var(--text-primary);
    }
    .btn-secondary:hover {
      background: var(--bg-surface-hover);
      border-color: var(--border-strong);
    }

    .btn-danger {
      background: var(--accent-danger-bg);
      border-color: rgba(242, 63, 67, 0.3);
      color: var(--accent-danger);
    }
    .btn-danger:hover {
      background: rgba(242, 63, 67, 0.25);
    }

    .btn-sm {
      padding: 0.35rem 0.65rem;
      font-size: 0.78rem;
      border-radius: 6px;
    }

    /* Forms & Inputs */
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      margin-bottom: 1rem;
    }

    .form-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1rem;
      align-items: flex-end;
    }

    label {
      font-size: 0.82rem;
      font-weight: 600;
      color: var(--text-secondary);
    }

    input, select, textarea {
      width: 100%;
      background: var(--bg-base);
      border: 1px solid var(--border-subtle);
      border-radius: 8px;
      padding: 0.6rem 0.85rem;
      font-size: 0.88rem;
      font-family: var(--font-sans);
      color: var(--text-primary);
      outline: none;
      transition: border-color 0.15s ease;
    }

    input:focus, select:focus, textarea:focus {
      border-color: var(--accent-primary);
      box-shadow: 0 0 0 2px rgba(88, 101, 242, 0.2);
    }

    /* Search Input */
    .search-wrap {
      position: relative;
      min-width: 260px;
    }
    .search-input {
      padding-left: 2.2rem;
    }
    .search-icon {
      position: absolute;
      left: 0.75rem;
      top: 50%;
      transform: translateY(-50%);
      color: var(--text-muted);
      pointer-events: none;
    }

    /* Progress bar */
    .progress-bar-bg {
      width: 100%;
      height: 8px;
      background: var(--bg-base);
      border-radius: 9999px;
      overflow: hidden;
      margin-top: 0.5rem;
      border: 1px solid var(--border-subtle);
    }
    .progress-bar-fill {
      height: 100%;
      background: var(--accent-primary);
      border-radius: 9999px;
      transition: width 0.3s ease;
    }

    /* Toast Notification */
    #toast-container {
      position: fixed;
      bottom: 1.5rem;
      right: 1.5rem;
      z-index: 100;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      pointer-events: none;
    }

    .toast {
      pointer-events: auto;
      background: var(--bg-surface-elevated);
      border: 1px solid var(--border-strong);
      color: var(--text-primary);
      padding: 0.85rem 1.25rem;
      border-radius: 10px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
      font-size: 0.88rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      animation: slideUp 0.25s ease;
      max-width: 420px;
    }

    .toast-success { border-color: rgba(35, 165, 90, 0.5); }
    .toast-error { border-color: rgba(242, 63, 67, 0.5); }

    @keyframes slideUp {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* Server Icon Image */
    .server-avatar {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      background: var(--bg-surface-elevated);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 0.85rem;
      color: var(--text-secondary);
      object-fit: cover;
      flex-shrink: 0;
      border: 1px solid var(--border-subtle);
    }

    .user-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: var(--bg-surface-elevated);
      object-fit: cover;
      flex-shrink: 0;
      border: 1px solid var(--border-subtle);
    }

    .empty-state {
      padding: 3rem 1rem;
      text-align: center;
      color: var(--text-muted);
    }

    /* Code Pill */
    .code-pill {
      font-family: var(--font-mono);
      font-size: 0.82rem;
      background: var(--bg-surface-elevated);
      padding: 0.2rem 0.45rem;
      border-radius: 6px;
      border: 1px solid var(--border-subtle);
      color: var(--text-primary);
    }

    /* Footer */
    footer {
      border-top: 1px solid var(--border-subtle);
      background: var(--bg-surface);
      padding: 1.25rem 1.5rem;
      margin-top: auto;
      font-size: 0.8rem;
      color: var(--text-muted);
    }
    .footer-inner {
      max-width: 1320px;
      margin: 0 auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 1rem;
    }
  </style>
</head>
<body>

  <!-- Top Header -->
  <header>
    <div class="header-inner">
      <div class="brand-section">
        <div class="bot-avatar-wrap">
          <img id="header-avatar" class="bot-avatar-img" src="" alt="Bot Avatar" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
          <div class="online-indicator-dot" title="Real-time Discord Gateway Heartbeat Active"></div>
        </div>
        <div>
          <div class="brand-title">
            <span id="header-bot-name">Zenith Bot</span>
            <span class="status-badge-healthy" id="header-healthy-badge">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
              Bot is online and healthy!
            </span>
          </div>
          <div class="brand-tag" id="header-bot-id">ID: Loading...</div>
        </div>
      </div>

      <div class="header-actions">
        <div class="metric-pill" title="Discord WebSocket Heartbeat Latency">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
          <span id="header-ping">-- ms</span>
        </div>
        <div class="metric-pill" title="Process Uptime">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <span id="header-uptime">--</span>
        </div>
        <button class="btn btn-secondary btn-sm" id="btn-refresh" onclick="refreshDashboardData()" title="Reload all metrics">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
          Refresh
        </button>
      </div>
    </div>
  </header>

  <!-- Navigation Tabs -->
  <div class="tabs-bar">
    <div class="tabs-inner">
      <button class="nav-tab active" data-tab="overview" onclick="switchTab('overview')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
        Overview & Health
      </button>
      <button class="nav-tab" data-tab="staff" onclick="switchTab('staff')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        Bot Staff
        <span class="badge-count" id="badge-staff-count">0</span>
      </button>
      <button class="nav-tab" data-tab="guilds" onclick="switchTab('guilds')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>
        Servers Bot Is In
        <span class="badge-count" id="badge-guilds-count">0</span>
      </button>
      <button class="nav-tab" data-tab="premium" onclick="switchTab('premium')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>
        Premium Access
        <span class="badge-count" id="badge-premium-count">0</span>
      </button>
      <button class="nav-tab" data-tab="whitelist" onclick="switchTab('whitelist')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        Bot Whitelist
      </button>
      <button class="nav-tab" data-tab="controls" onclick="switchTab('controls')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        Broadcast & Controls
      </button>
      <button class="nav-tab" data-tab="hosting" onclick="switchTab('hosting')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
        Hosting & Conflict Inspector
      </button>
      <button class="nav-tab" data-tab="settings" onclick="switchTab('settings')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        Bot Settings
      </button>
    </div>
  </div>

  <main>
    <!-- TAB 1: OVERVIEW & HEALTH -->
    <div id="tab-overview" class="tab-pane active">
      <div class="grid-stats">
        <div class="stat-card">
          <div class="stat-header">
            <span>Connected Servers</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>
          </div>
          <div class="stat-value" id="stat-guilds">0</div>
          <div class="stat-sub">Active Discord Server Guilds</div>
        </div>

        <div class="stat-card">
          <div class="stat-header">
            <span>Total Members Served</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
          </div>
          <div class="stat-value" id="stat-users">0</div>
          <div class="stat-sub">Guild members protected</div>
        </div>

        <div class="stat-card">
          <div class="stat-header">
            <span>Gateway WebSocket Latency</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
          </div>
          <div class="stat-value"><span id="stat-ping">0</span><span style="font-size: 1rem; color: var(--text-secondary);">ms</span></div>
          <div class="stat-sub">Real-time Discord Gateway Heartbeat</div>
        </div>

        <div class="stat-card">
          <div class="stat-header">
            <span>Commands Available</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
          </div>
          <div class="stat-value" id="stat-commands">0</div>
          <div class="stat-sub">Slash & Prefix handlers loaded</div>
        </div>
      </div>

      <!-- System Resources & Hardware -->
      <div class="section-card">
        <div class="section-header">
          <div>
            <h3 class="section-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></svg>
              Container Architecture & Host Specifications
            </h3>
            <div class="section-subtitle">Real-time system telemetry and process resource distribution</div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem;">
          <!-- Memory breakdown -->
          <div style="background: var(--bg-base); padding: 1.25rem; border-radius: 10px; border: 1px solid var(--border-subtle);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
              <span style="font-weight: 600; font-size: 0.85rem; color: var(--text-secondary);">RAM Memory Usage</span>
              <span style="font-family: var(--font-mono); font-weight: 700; color: var(--accent-primary);" id="sys-mem-percent">0%</span>
            </div>
            <div class="progress-bar-bg">
              <div class="progress-bar-fill" id="sys-mem-bar" style="width: 0%;"></div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-top: 1rem; font-size: 0.82rem;">
              <div>
                <div style="color: var(--text-muted);">Used Container RAM</div>
                <div style="font-family: var(--font-mono); font-weight: 600;" id="sys-mem-used">-- GB</div>
              </div>
              <div>
                <div style="color: var(--text-muted);">Total Host RAM</div>
                <div style="font-family: var(--font-mono); font-weight: 600;" id="sys-mem-total">-- GB</div>
              </div>
              <div>
                <div style="color: var(--text-muted);">Process Heap Used</div>
                <div style="font-family: var(--font-mono); font-weight: 600;" id="sys-heap-used">-- MB</div>
              </div>
              <div>
                <div style="color: var(--text-muted);">Process RSS</div>
                <div style="font-family: var(--font-mono); font-weight: 600;" id="sys-rss">-- MB</div>
              </div>
            </div>
          </div>

          <!-- CPU & Environment -->
          <div style="background: var(--bg-base); padding: 1.25rem; border-radius: 10px; border: 1px solid var(--border-subtle);">
            <div style="font-weight: 600; font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.85rem;">CPU & Environment</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; font-size: 0.82rem;">
              <div>
                <div style="color: var(--text-muted);">CPU Cores</div>
                <div style="font-family: var(--font-mono); font-weight: 600;" id="sys-cpu-cores">--</div>
              </div>
              <div>
                <div style="color: var(--text-muted);">Load Average</div>
                <div style="font-family: var(--font-mono); font-weight: 600;" id="sys-load">--</div>
              </div>
              <div>
                <div style="color: var(--text-muted);">Node.js Runtime</div>
                <div style="font-family: var(--font-mono); font-weight: 600;" id="sys-node-version">--</div>
              </div>
              <div>
                <div style="color: var(--text-muted);">Discord.js</div>
                <div style="font-family: var(--font-mono); font-weight: 600;">v14.26.3</div>
              </div>
              <div style="grid-column: span 2;">
                <div style="color: var(--text-muted);">Processor Model</div>
                <div style="font-family: var(--font-mono); font-weight: 500; font-size: 0.78rem;" id="sys-cpu-model">--</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 2: BOT STAFF MANAGEMENT -->
    <div id="tab-staff" class="tab-pane">
      <div class="section-card">
        <div class="section-header">
          <div>
            <h3 class="section-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
              Appoint New Bot Staff Member
            </h3>
            <div class="section-subtitle">Assign official bot administration ranks with global privileges (Owner, Co-Owner, Admin, Mod, Helper)</div>
          </div>
        </div>

        <form id="form-appoint-staff" onsubmit="handleAppointStaff(event)">
          <div class="form-row">
            <div class="form-group" style="flex: 2;">
              <label for="staff-user-id">Discord User ID</label>
              <input type="text" id="staff-user-id" placeholder="e.g. 1384512046200127570 or @username" required>
            </div>
            <div class="form-group" style="flex: 1.5;">
              <label for="staff-role-select">Staff Rank / Clearance</label>
              <select id="staff-role-select" required onchange="updateRoleBenefitsPreview()">
                <option value="owner">Owner (Full Global Authority)</option>
                <option value="co_owner">Co-Owner (Full Command Privileges)</option>
                <option value="admin" selected>Admin (Bot Configuration & Premium)</option>
                <option value="mod">Mod (Global Moderation & Investigations)</option>
                <option value="help">Help (Official Bot Support & Onboarding)</option>
              </select>
            </div>
            <div class="form-group" style="flex: 1;">
              <button type="submit" class="btn btn-primary" style="width: 100%;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                Appoint Staff
              </button>
            </div>
          </div>
          <div id="role-benefit-preview" style="font-size: 0.8rem; color: var(--text-secondary); background: var(--bg-base); padding: 0.75rem 1rem; border-radius: 8px; border: 1px solid var(--border-subtle); margin-top: 0.5rem;">
            Loading privileges...
          </div>
        </form>
      </div>

      <div class="section-card">
        <div class="section-header">
          <div>
            <h3 class="section-title">Current Official Bot Staff Roster</h3>
            <div class="section-subtitle">Staff members recognized globally by the bot with elevated controls</div>
          </div>
        </div>

        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>User / Member</th>
                <th>Discord ID</th>
                <th>Role & Clearance</th>
                <th>Appointed Date</th>
                <th>Appointed By</th>
                <th style="text-align: right;">Action</th>
              </tr>
            </thead>
            <tbody id="table-staff-body">
              <tr>
                <td colspan="6" class="empty-state">Loading staff roster...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- TAB 3: SERVERS BOT IS IN -->
    <div id="tab-guilds" class="tab-pane">
      <div class="section-card">
        <div class="section-header">
          <div>
            <h3 class="section-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/></svg>
              Connected Discord Servers (<span id="guilds-total-header">0</span>)
            </h3>
            <div class="section-subtitle">Every Discord community the bot is actively serving. You can inspect stats or force server leaves.</div>
          </div>
          <div class="search-wrap">
            <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" id="guild-search-input" class="search-input" placeholder="Search servers by name or ID..." oninput="filterGuildsList()">
          </div>
        </div>

        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Server</th>
                <th>Guild ID</th>
                <th>Members</th>
                <th>Channels</th>
                <th>Owner ID</th>
                <th style="text-align: right;">Control</th>
              </tr>
            </thead>
            <tbody id="table-guilds-body">
              <tr>
                <td colspan="6" class="empty-state">Loading servers...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- TAB 4: PREMIUM ACCESS -->
    <div id="tab-premium" class="tab-pane">
      <div class="section-card">
        <div class="section-header">
          <div>
            <h3 class="section-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>
              Grant Direct Premium Clearance
            </h3>
            <div class="section-subtitle">Grant lifetime or timed premium tiers to specific users or server guilds</div>
          </div>
        </div>

        <form id="form-grant-premium" onsubmit="handleGrantPremium(event)">
          <div class="form-row">
            <div class="form-group" style="flex: 2;">
              <label for="prem-target-id">Target ID (User ID or Server ID)</label>
              <input type="text" id="prem-target-id" placeholder="e.g. 1384512046200127570" required>
            </div>
            <div class="form-group" style="flex: 1.2;">
              <label for="prem-target-type">Target Type</label>
              <select id="prem-target-type" required>
                <option value="user">User Account</option>
                <option value="guild">Server Guild</option>
              </select>
            </div>
            <div class="form-group" style="flex: 1.5;">
              <label for="prem-duration-select">Duration</label>
              <select id="prem-duration-select" required>
                <option value="30">30 Days</option>
                <option value="90">90 Days</option>
                <option value="365">1 Year (365 Days)</option>
                <option value="3650" selected>Permanent / Lifetime (10 Years)</option>
              </select>
            </div>
            <div class="form-group" style="flex: 1;">
              <button type="submit" class="btn btn-primary" style="width: 100%;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                Grant Premium
              </button>
            </div>
          </div>
        </form>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 1.5rem;">
        <!-- Premium Users -->
        <div class="section-card">
          <div class="section-header">
            <h3 class="section-title">Premium Users</h3>
          </div>
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>ID</th>
                  <th>Status</th>
                  <th style="text-align: right;">Action</th>
                </tr>
              </thead>
              <tbody id="table-prem-users-body">
                <tr><td colspan="4" class="empty-state">Loading premium users...</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Premium Servers -->
        <div class="section-card">
          <div class="section-header">
            <h3 class="section-title">Premium Servers</h3>
          </div>
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>Server</th>
                  <th>Guild ID</th>
                  <th>Status</th>
                  <th style="text-align: right;">Action</th>
                </tr>
              </thead>
              <tbody id="table-prem-guilds-body">
                <tr><td colspan="4" class="empty-state">Loading premium servers...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 5: BOT WHITELIST -->
    <div id="tab-whitelist" class="tab-pane">
      <div class="section-card">
        <div class="section-header">
          <div>
            <h3 class="section-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              Permanent Bot Whitelist Management
            </h3>
            <div class="section-subtitle">Whitelisted IDs bypass automod and command execution restrictions globally</div>
          </div>
        </div>

        <form id="form-whitelist-add" onsubmit="handleWhitelistAdd(event)">
          <div class="form-row">
            <div class="form-group" style="flex: 3;">
              <label for="wl-user-id">Discord User ID</label>
              <input type="text" id="wl-user-id" placeholder="e.g. 1384512046200127570" required>
            </div>
            <div class="form-group" style="flex: 1;">
              <button type="submit" class="btn btn-primary" style="width: 100%;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add to Whitelist
              </button>
            </div>
          </div>
        </form>
      </div>

      <div class="section-card">
        <div class="section-header">
          <h3 class="section-title">Whitelisted Developer & Admin IDs</h3>
        </div>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>User ID</th>
                <th>Classification</th>
                <th style="text-align: right;">Action</th>
              </tr>
            </thead>
            <tbody id="table-whitelist-body">
              <tr><td colspan="3" class="empty-state">Loading whitelist...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- TAB 6: BROADCAST & CONTROLS -->
    <div id="tab-controls" class="tab-pane">
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(450px, 1fr)); gap: 1.5rem;">
        <!-- Global Broadcast -->
        <div class="section-card">
          <div class="section-header">
            <div>
              <h3 class="section-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                Global Bot Announcement Broadcast
              </h3>
              <div class="section-subtitle">Dispatches an official embed announcement to all connected server system/announcement channels</div>
            </div>
          </div>

          <form id="form-broadcast" onsubmit="handleBroadcast(event)">
            <div class="form-group">
              <label for="broadcast-title">Announcement Title</label>
              <input type="text" id="broadcast-title" value="📢 Official Bot Announcement" required>
            </div>
            <div class="form-group">
              <label for="broadcast-message">Announcement Message (Markdown supported)</label>
              <textarea id="broadcast-message" rows="5" placeholder="Write your announcement message here..." required></textarea>
            </div>
            <button type="submit" class="btn btn-primary" id="btn-submit-broadcast">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              Dispatch Global Broadcast
            </button>
          </form>
        </div>

        <!-- Bot Activity / Presence -->
        <div class="section-card">
          <div class="section-header">
            <div>
              <h3 class="section-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                Live Bot Presence & Activity
              </h3>
              <div class="section-subtitle">Instantly customize the bot's status message visible across all servers and member lists</div>
            </div>
          </div>

          <form id="form-activity" onsubmit="handleUpdateActivity(event)">
            <div class="form-group">
              <label for="activity-type">Activity Type</label>
              <select id="activity-type" required>
                <option value="Playing">Playing</option>
                <option value="Watching">Watching</option>
                <option value="Listening">Listening to</option>
                <option value="Competing">Competing in</option>
              </select>
            </div>
            <div class="form-group">
              <label for="activity-name">Status Text</label>
              <input type="text" id="activity-name" placeholder="e.g. Protecting Servers | .help" required>
            </div>
            <button type="submit" class="btn btn-secondary">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
              Update Presence
            </button>
          </form>
        </div>
      </div>
    </div>

    <!-- TAB 7: HOSTING & CONFLICT INSPECTOR -->
    <div id="tab-hosting" class="tab-pane">
      <div class="section-card">
        <div class="section-header">
          <div>
            <h3 class="section-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
              Multi-Instance Hosting & Token Conflict Diagnostic
            </h3>
            <div class="section-subtitle">Real-time gateway stability monitor to detect and resolve duplicate hosting interference</div>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="loadHostingData()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            Re-Analyze Gateway Session
          </button>
        </div>

        <div id="hosting-risk-card" style="padding: 1.25rem; border-radius: 12px; margin-bottom: 1.5rem; background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle);">
          <div style="font-weight: 700; font-size: 1.1rem; margin-bottom: 0.5rem;" id="hosting-risk-status">Checking Gateway Session Health...</div>
          <div style="color: var(--text-secondary); font-size: 0.9rem;" id="hosting-risk-desc">Analyzing disconnect logs and token session stability...</div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
          <div style="background: var(--bg-base); padding: 1rem; border-radius: 10px; border: 1px solid var(--border-subtle);">
            <div style="color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase;">Average Gateway Ping</div>
            <div style="font-size: 1.5rem; font-weight: 800; font-family: var(--font-mono); color: var(--accent-primary);" id="host-ping">-- ms</div>
          </div>
          <div style="background: var(--bg-base); padding: 1rem; border-radius: 10px; border: 1px solid var(--border-subtle);">
            <div style="color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase;">Gateway Reconnects</div>
            <div style="font-size: 1.5rem; font-weight: 800; font-family: var(--font-mono);" id="host-reconnects">0</div>
          </div>
          <div style="background: var(--bg-base); padding: 1rem; border-radius: 10px; border: 1px solid var(--border-subtle);">
            <div style="color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase;">Disconnect Drops</div>
            <div style="font-size: 1.5rem; font-weight: 800; font-family: var(--font-mono);" id="host-disconnects">0</div>
          </div>
          <div style="background: var(--bg-base); padding: 1rem; border-radius: 10px; border: 1px solid var(--border-subtle);">
            <div style="color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase;">Invalidated Sessions</div>
            <div style="font-size: 1.5rem; font-weight: 800; font-family: var(--font-mono);" id="host-invalidated">0</div>
          </div>
        </div>

        <!-- Troubleshooting Guide -->
        <div style="background: var(--bg-base); border-radius: 12px; border: 1px solid var(--border-subtle); padding: 1.5rem;">
          <h4 style="font-size: 1rem; font-weight: 700; margin-bottom: 0.75rem; color: var(--text-primary); display: flex; align-items: center; gap: 0.5rem;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            Why do previous hostings disturb your bot?
          </h4>
          <p style="font-size: 0.88rem; color: var(--text-secondary); line-height: 1.6; margin-bottom: 1rem;">
            If you previously ran your bot on other platforms (such as previous <strong>Replit repls, Render, Railway, Heroku, Pterodactyl panels, or a local Node.js command line on your PC</strong>) and didn't completely delete the token environment variable or stop the process, <strong>both hostings log into Discord's Gateway simultaneously with the exact same bot token</strong>.
          </p>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; margin-bottom: 1.25rem;">
            <div style="background: var(--bg-surface); padding: 1rem; border-radius: 8px; border: 1px solid var(--border-subtle);">
              <div style="font-weight: 600; color: var(--accent-danger); font-size: 0.85rem; margin-bottom: 0.35rem;">Symptom 1: Reconnect Loops</div>
              <div style="font-size: 0.82rem; color: var(--text-secondary);">Discord repeatedly kicks one hosting whenever the other attempts to connect, triggering Gateway disconnects (4004/4000).</div>
            </div>
            <div style="background: var(--bg-surface); padding: 1rem; border-radius: 8px; border: 1px solid var(--border-subtle);">
              <div style="font-weight: 600; color: var(--accent-danger); font-size: 0.85rem; margin-bottom: 0.35rem;">Symptom 2: Double Replies</div>
              <div style="font-size: 0.82rem; color: var(--text-secondary);">Both hostings receive message events, causing the bot to respond twice to a single message or prefix command.</div>
            </div>
            <div style="background: var(--bg-surface); padding: 1rem; border-radius: 8px; border: 1px solid var(--border-subtle);">
              <div style="font-weight: 600; color: var(--accent-danger); font-size: 0.85rem; margin-bottom: 0.35rem;">Symptom 3: Failed Interactions</div>
              <div style="font-size: 0.82rem; color: var(--text-secondary);">Slash commands, buttons, and dropdowns show "This interaction failed" because the old host invalidates the interaction token first.</div>
            </div>
          </div>

          <div style="background: rgba(88, 101, 242, 0.1); border: 1px solid rgba(88, 101, 242, 0.3); border-radius: 10px; padding: 1.25rem;">
            <div style="font-weight: 700; color: var(--accent-primary); font-size: 0.95rem; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              Permanent 1-Click Fix: Invalidate All Old Hostings
            </div>
            <ol style="padding-left: 1.25rem; font-size: 0.85rem; color: var(--text-primary); line-height: 1.7;">
              <li>Open the <a href="https://discord.com/developers/applications" target="_blank" style="color: var(--accent-primary); text-decoration: underline;">Discord Developer Portal</a> in your web browser.</li>
              <li>Select your Bot Application and navigate to the <strong>Bot</strong> tab on the left menu.</li>
              <li>Click <strong>Reset Token</strong> and confirm. This instantly invalidates the old token and <strong>forces ALL previous hosting servers to lose access immediately</strong>.</li>
              <li>Copy the new bot token, paste it into your <code>DISCORD_BOT_TOKEN</code> variable in your current hosting panel, and restart this server.</li>
            </ol>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 8: BOT SETTINGS -->
    <div id="tab-settings" class="tab-pane">
      <div class="section-card">
        <div class="section-header">
          <div>
            <h3 class="section-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              Command Prefix & Global Bot Settings
            </h3>
            <div class="section-subtitle">Customize the bot command invocation prefix and save persistent configuration to the database</div>
          </div>
        </div>

        <form id="form-update-prefix" onsubmit="handleSavePrefix(event)">
          <div class="form-row">
            <div class="form-group" style="flex: 2;">
              <label for="setting-prefix-input">Command Prefix Symbol</label>
              <input type="text" id="setting-prefix-input" placeholder="e.g. . or ! or ? or bp? or zenith." value="." required maxlength="10">
            </div>
            <div class="form-group" style="flex: 2;">
              <label for="setting-target-select">Scope Target</label>
              <select id="setting-target-select">
                <option value="global" selected>Global Default (All Connected Servers)</option>
              </select>
            </div>
            <div class="form-group" style="flex: 1;">
              <button type="submit" class="btn btn-primary" style="width: 100%;" id="btn-save-prefix">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                Save to Database
              </button>
            </div>
          </div>
          <div style="font-size: 0.8rem; color: var(--text-secondary); background: var(--bg-base); padding: 0.75rem 1rem; border-radius: 8px; border: 1px solid var(--border-subtle); margin-top: 0.5rem;">
            <strong>Database Storage Persistence:</strong> Updating the prefix writes to persistent database configuration storage (<code>config.json</code> & Firestore). All commands like <code>[prefix]help</code>, <code>[prefix]play</code>, and <code>[prefix]ping</code> immediately adapt to the new prefix.
          </div>
        </form>
      </div>

      <div class="section-card">
        <div class="section-header">
          <div>
            <h3 class="section-title">Per-Server Active Prefix Roster</h3>
            <div class="section-subtitle">Live prefix configurations across all connected Discord communities</div>
          </div>
        </div>

        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Server</th>
                <th>Guild ID</th>
                <th>Active Prefix</th>
                <th>No-Prefix Mode</th>
                <th style="text-align: right;">Quick Action</th>
              </tr>
            </thead>
            <tbody id="table-settings-guilds-body">
              <tr>
                <td colspan="5" class="empty-state">Loading server settings...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </main>

  <!-- Footer -->
  <footer>
    <div class="footer-inner">
      <div>Zenith Bot Central Operations Dashboard • Live WebSocket Gateway Connected</div>
      <div id="footer-build-info">Deployment Region: Cloud Run • Port 3000 Active</div>
    </div>
  </footer>

  <!-- Toast Notification Container -->
  <div id="toast-container"></div>

  <!-- Client-Side Dashboard Script -->
  <script>
    let currentTab = 'overview';
    let cachedGuilds = [];
    let roleMetaMap = {};

    function showToast(message, type = 'success') {
      const container = document.getElementById('toast-container');
      const toast = document.createElement('div');
      toast.className = 'toast toast-' + type;
      toast.innerHTML = (type === 'success' 
        ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#23a55a" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
        : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f23f43" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
      ) + '<span>' + message + '</span>';
      container.appendChild(toast);
      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        toast.style.transition = 'all 0.25s ease';
        setTimeout(() => toast.remove(), 250);
      }, 4000);
    }

    function switchTab(tabId) {
      currentTab = tabId;
      document.querySelectorAll('.nav-tab').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-tab') === tabId);
      });
      document.querySelectorAll('.tab-pane').forEach(p => {
        p.classList.toggle('active', p.id === 'tab-' + tabId);
      });

      if (tabId === 'staff') loadStaffData();
      if (tabId === 'guilds') loadGuildsData();
      if (tabId === 'premium') loadPremiumData();
      if (tabId === 'whitelist') loadWhitelistData();
      if (tabId === 'hosting') loadHostingData();
      if (tabId === 'settings') loadSettingsData();
    }

    function formatUptime(seconds) {
      const d = Math.floor(seconds / (3600 * 24));
      const h = Math.floor((seconds % (3600 * 24)) / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = Math.floor(seconds % 60);
      if (d > 0) return d + 'd ' + h + 'h ' + m + 'm';
      if (h > 0) return h + 'h ' + m + 'm ' + s + 's';
      return m + 'm ' + s + 's';
    }

    async function loadOverviewData() {
      try {
        const res = await fetch('/api/dashboard/overview');
        if (!res.ok) throw new Error('Failed to fetch overview');
        const data = await res.json();

        if (data.bot) {
          if (data.bot.avatar) document.getElementById('header-avatar').src = data.bot.avatar;
          document.getElementById('header-bot-name').textContent = data.bot.username;
          document.getElementById('header-bot-id').textContent = 'ID: ' + data.bot.id + ' • ' + (data.bot.tag || '');
          if (!document.getElementById('activity-name').value && data.bot.activity) {
            document.getElementById('activity-name').value = data.bot.activity;
          }
        }

        if (data.stats) {
          document.getElementById('header-ping').textContent = data.stats.wsPing + ' ms';
          document.getElementById('header-uptime').textContent = formatUptime(data.stats.uptimeSeconds);
          document.getElementById('stat-guilds').textContent = data.stats.guildsCount.toLocaleString();
          document.getElementById('stat-users').textContent = data.stats.usersCount.toLocaleString();
          document.getElementById('stat-ping').textContent = data.stats.wsPing;
          document.getElementById('stat-commands').textContent = data.stats.commandsCount;
          document.getElementById('badge-guilds-count').textContent = data.stats.guildsCount;
          document.getElementById('guilds-total-header').textContent = data.stats.guildsCount;
        }

        if (data.system) {
          const m = data.system.memory;
          document.getElementById('sys-mem-percent').textContent = m.memPercent + '%';
          document.getElementById('sys-mem-bar').style.width = m.memPercent + '%';
          document.getElementById('sys-mem-used').textContent = m.usedMemGB + ' GB';
          document.getElementById('sys-mem-total').textContent = m.totalMemGB + ' GB';
          document.getElementById('sys-heap-used').textContent = m.heapUsedMB + ' MB';
          document.getElementById('sys-rss').textContent = m.rssMB + ' MB';

          const c = data.system.cpu;
          document.getElementById('sys-cpu-cores').textContent = c.cores + ' Cores';
          document.getElementById('sys-load').textContent = c.loadAvg;
          document.getElementById('sys-cpu-model').textContent = c.model;
          document.getElementById('sys-node-version').textContent = data.system.nodeVersion;
        }
      } catch (err) {
        console.error('Error loading overview:', err);
      }
    }

    async function loadStaffData() {
      try {
        const res = await fetch('/api/dashboard/staff');
        if (!res.ok) throw new Error('Failed to fetch staff');
        const data = await res.json();

        roleMetaMap = data.roles || {};
        updateRoleBenefitsPreview();

        const tbody = document.getElementById('table-staff-body');
        document.getElementById('badge-staff-count').textContent = data.staff?.length || 0;

        if (!data.staff || data.staff.length === 0) {
          tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No staff members appointed yet. Use the form above to appoint staff.</td></tr>';
          return;
        }

        tbody.innerHTML = data.staff.map(s => {
          const avatarUrl = s.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png';
          const roleClass = 'role-' + s.role;
          const roleTitle = escapeHtml(s.roleMeta?.title || s.role.toUpperCase());
          const dateStr = s.assignedAt ? new Date(s.assignedAt).toLocaleDateString() : 'Permanent';
          const sUserId = escapeHtml(s.userId);
          const sUsername = escapeHtml(s.username);
          const sTag = escapeHtml(s.tag);
          const sAssignedBy = escapeHtml(s.assignedBy || 'Admin');
          return '<tr>' +
            '<td>' +
              '<div style="display: flex; align-items: center; gap: 0.75rem;">' +
                '<img src="' + avatarUrl + '" class="user-avatar" alt="Avatar">' +
                '<div>' +
                  '<div style="font-weight: 600;">' + sUsername + '</div>' +
                  '<div style="font-size: 0.75rem; color: var(--text-muted);">' + sTag + '</div>' +
                '</div>' +
              '</div>' +
            '</td>' +
            '<td><span class="code-pill">' + sUserId + '</span></td>' +
            '<td><span class="role-badge ' + roleClass + '">' + roleTitle + '</span></td>' +
            '<td style="color: var(--text-secondary);">' + dateStr + '</td>' +
            '<td style="color: var(--text-secondary);">' + sAssignedBy + '</td>' +
            '<td style="text-align: right;">' +
              '<button class="btn btn-danger btn-sm" onclick="handleRemoveStaff(\'' + sUserId + '\')">' +
                '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>' +
                ' Remove' +
              '</button>' +
            '</td>' +
          '</tr>';
        }).join('');
      } catch (err) {
        console.error('Error loading staff:', err);
      }
    }

    function updateRoleBenefitsPreview() {
      const select = document.getElementById('staff-role-select');
      const role = select.value;
      const meta = roleMetaMap[role];
      const preview = document.getElementById('role-benefit-preview');
      if (meta && meta.benefits) {
        preview.innerHTML = '<strong>' + meta.title + ' Benefits:</strong> ' + meta.benefits.join(' • ');
      } else {
        preview.textContent = 'Standard bot administration role benefits applied.';
      }
    }

    async function handleAppointStaff(e) {
      e.preventDefault();
      const userId = document.getElementById('staff-user-id').value.trim();
      const role = document.getElementById('staff-role-select').value;
      if (!userId) return;

      try {
        const res = await fetch('/api/dashboard/staff/appoint', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, role }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to appoint staff');
        showToast(data.message + (data.dmSent ? ' (Discord notification DM delivered)' : ''), 'success');
        document.getElementById('staff-user-id').value = '';
        loadStaffData();
      } catch (err) {
        showToast(err.message, 'error');
      }
    }

    async function handleRemoveStaff(userId) {
      if (!confirm('Are you sure you want to remove staff privileges from User ID ' + userId + '?')) return;
      try {
        const res = await fetch('/api/dashboard/staff/remove', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to remove staff');
        showToast(data.message, 'success');
        loadStaffData();
      } catch (err) {
        showToast(err.message, 'error');
      }
    }

    async function loadGuildsData() {
      try {
        const res = await fetch('/api/dashboard/guilds');
        if (!res.ok) throw new Error('Failed to fetch guilds');
        const data = await res.json();
        cachedGuilds = data.guilds || [];
        renderGuildsTable(cachedGuilds);
      } catch (err) {
        console.error('Error loading guilds:', err);
      }
    }

    function renderGuildsTable(guilds) {
      const tbody = document.getElementById('table-guilds-body');
      if (!guilds || guilds.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No matching servers found.</td></tr>';
        return;
      }

      tbody.innerHTML = guilds.map(g => {
        const gId = escapeHtml(g.id);
        const gName = escapeHtml(g.name);
        const iconHtml = g.icon 
          ? '<img src="' + escapeHtml(g.icon) + '" class="server-avatar" alt="icon">'
          : '<div class="server-avatar">' + escapeHtml(g.name.substring(0, 2).toUpperCase()) + '</div>';

        return '<tr>' +
          '<td>' +
            '<div style="display: flex; align-items: center; gap: 0.75rem;">' +
              iconHtml +
              '<div>' +
                '<div style="font-weight: 600;">' + gName + '</div>' +
                '<div style="font-size: 0.75rem; color: var(--text-muted);">Joined <t:' + Math.floor(g.joinedAt/1000) + ':R></div>' +
              '</div>' +
            '</div>' +
          '</td>' +
          '<td><span class="code-pill">' + gId + '</span></td>' +
          '<td><strong>' + g.memberCount.toLocaleString() + '</strong></td>' +
          '<td>' + g.channelsCount + '</td>' +
          '<td><span class="code-pill">' + g.ownerId + '</span></td>' +
          '<td style="text-align: right;">' +
            '<button class="btn btn-danger btn-sm" onclick="handleLeaveGuild(\'' + gId + '\', \'' + escapeHtml(g.name.replace(/'/g, '')) + '\')">' +
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>' +
              ' Leave Server' +
            '</button>' +
          '</td>' +
        '</tr>';
      }).join('');
    }

    function filterGuildsList() {
      const query = document.getElementById('guild-search-input').value.toLowerCase().trim();
      if (!query) {
        renderGuildsTable(cachedGuilds);
        return;
      }
      const filtered = cachedGuilds.filter(g => 
        g.name.toLowerCase().includes(query) || g.id.includes(query) || g.ownerId.includes(query)
      );
      renderGuildsTable(filtered);
    }

    async function handleLeaveGuild(guildId, guildName) {
      if (!confirm('CONFIRM SERVER LEAVE:\\n\\nAre you sure you want to force the bot to leave "' + guildName + '" (' + guildId + ')?')) return;

      try {
        const res = await fetch('/api/dashboard/guilds/leave', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ guildId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to leave guild');
        showToast(data.message, 'success');
        loadGuildsData();
        loadOverviewData();
      } catch (err) {
        showToast(err.message, 'error');
      }
    }

    async function loadPremiumData() {
      try {
        const res = await fetch('/api/dashboard/premium');
        if (!res.ok) throw new Error('Failed to fetch premium data');
        const data = await res.json();

        const userCount = data.users?.length || 0;
        const guildCount = data.guilds?.length || 0;
        document.getElementById('badge-premium-count').textContent = userCount + guildCount;

        // Render Users
        const tbodyUsers = document.getElementById('table-prem-users-body');
        if (userCount === 0) {
          tbodyUsers.innerHTML = '<tr><td colspan="4" class="empty-state">No premium users active</td></tr>';
        } else {
          tbodyUsers.innerHTML = data.users.map(u => {
            const avatar = u.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png';
            const status = u.isPermanent 
              ? '<span class="role-badge role-owner">LIFETIME</span>' 
              : '<span class="role-badge role-admin">Expires ' + new Date(u.expiresAt).toLocaleDateString() + '</span>';
            const uId = escapeHtml(u.id);
            const uUsername = escapeHtml(u.username);
            return '<tr>' +
              '<td>' +
                '<div style="display: flex; align-items: center; gap: 0.5rem;">' +
                  '<img src="' + avatar + '" class="user-avatar" alt="Avatar">' +
                  '<span style="font-weight: 600;">' + uUsername + '</span>' +
                '</div>' +
              '</td>' +
              '<td><span class="code-pill">' + uId + '</span></td>' +
              '<td>' + status + '</td>' +
              '<td style="text-align: right;">' +
                '<button class="btn btn-danger btn-sm" onclick="handleRevokePremium(\'' + uId + '\', \'user\')">Revoke</button>' +
              '</td>' +
            '</tr>';
          }).join('');
        }

        // Render Guilds
        const tbodyGuilds = document.getElementById('table-prem-guilds-body');
        if (guildCount === 0) {
          tbodyGuilds.innerHTML = '<tr><td colspan="4" class="empty-state">No premium servers active</td></tr>';
        } else {
          tbodyGuilds.innerHTML = data.guilds.map(g => {
            const status = g.isPermanent 
              ? '<span class="role-badge role-owner">LIFETIME</span>' 
              : '<span class="role-badge role-admin">Expires ' + new Date(g.expiresAt).toLocaleDateString() + '</span>';
            const gId = escapeHtml(g.id);
            const gName = escapeHtml(g.name);
            return '<tr>' +
              '<td><strong>' + gName + '</strong></td>' +
              '<td><span class="code-pill">' + gId + '</span></td>' +
              '<td>' + status + '</td>' +
              '<td style="text-align: right;">' +
                '<button class="btn btn-danger btn-sm" onclick="handleRevokePremium(\'' + gId + '\', \'guild\')">Revoke</button>' +
              '</td>' +
            '</tr>';
          }).join('');
        }
      } catch (err) {
        console.error('Error loading premium:', err);
      }
    }

    async function handleGrantPremium(e) {
      e.preventDefault();
      const targetId = document.getElementById('prem-target-id').value.trim();
      const targetType = document.getElementById('prem-target-type').value;
      const days = document.getElementById('prem-duration-select').value;
      if (!targetId) return;

      try {
        const res = await fetch('/api/dashboard/premium/grant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetId, targetType, days }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to grant premium');
        showToast(data.message, 'success');
        document.getElementById('prem-target-id').value = '';
        loadPremiumData();
      } catch (err) {
        showToast(err.message, 'error');
      }
    }

    async function handleRevokePremium(targetId, targetType) {
      if (!confirm('Revoke premium clearance from ' + targetType + ' ' + targetId + '?')) return;
      try {
        const res = await fetch('/api/dashboard/premium/revoke', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetId, targetType }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to revoke premium');
        showToast(data.message, 'success');
        loadPremiumData();
      } catch (err) {
        showToast(err.message, 'error');
      }
    }

    async function loadWhitelistData() {
      try {
        const res = await fetch('/api/dashboard/whitelist');
        if (!res.ok) throw new Error('Failed to fetch whitelist');
        const data = await res.json();

        const tbody = document.getElementById('table-whitelist-body');
        const allIds = [
          ...(data.base || []).map(id => ({ id, type: 'Base Permanent Developer' })),
          ...(data.extras || []).map(id => ({ id, type: 'Dynamic Appointed Whitelist' })),
        ];

        if (allIds.length === 0) {
          tbody.innerHTML = '<tr><td colspan="3" class="empty-state">No whitelist entries found</td></tr>';
          return;
        }

        tbody.innerHTML = allIds.map(item => {
          const isBase = item.type.includes('Base');
          const itemId = escapeHtml(item.id);
          const itemType = escapeHtml(item.type);
          const deleteBtn = isBase
            ? '<span style="font-size: 0.75rem; color: var(--text-muted);">Protected Base ID</span>'
            : '<button class="btn btn-danger btn-sm" onclick="handleRemoveWhitelist(\'' + itemId + '\')">Remove</button>';
          return '<tr>' +
            '<td><span class="code-pill">' + itemId + '</span></td>' +
            '<td><span class="role-badge ' + (isBase ? 'role-owner' : 'role-admin') + '">' + itemType + '</span></td>' +
            '<td style="text-align: right;">' + deleteBtn + '</td>' +
          '</tr>';
        }).join('');
      } catch (err) {
        console.error('Error loading whitelist:', err);
      }
    }

    async function handleWhitelistAdd(e) {
      e.preventDefault();
      const userId = document.getElementById('wl-user-id').value.trim();
      if (!userId) return;

      try {
        const res = await fetch('/api/dashboard/whitelist/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to add to whitelist');
        showToast(data.message, 'success');
        document.getElementById('wl-user-id').value = '';
        loadWhitelistData();
      } catch (err) {
        showToast(err.message, 'error');
      }
    }

    async function handleRemoveWhitelist(userId) {
      if (!confirm('Remove User ID ' + userId + ' from permanent whitelist?')) return;
      try {
        const res = await fetch('/api/dashboard/whitelist/remove', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to remove from whitelist');
        showToast(data.message, 'success');
        loadWhitelistData();
      } catch (err) {
        showToast(err.message, 'error');
      }
    }

    async function handleBroadcast(e) {
      e.preventDefault();
      const title = document.getElementById('broadcast-title').value.trim();
      const message = document.getElementById('broadcast-message').value.trim();
      if (!message) return;

      if (!confirm('CONFIRM GLOBAL DISPATCH:\\n\\nThis will broadcast an announcement embed to ALL connected Discord servers. Proceed?')) return;

      const submitBtn = document.getElementById('btn-submit-broadcast');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Dispatching broadcast...';

      try {
        const res = await fetch('/api/dashboard/broadcast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, message }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to dispatch broadcast');
        showToast(data.message, 'success');
        document.getElementById('broadcast-message').value = '';
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Dispatch Global Broadcast';
      }
    }

    async function handleUpdateActivity(e) {
      e.preventDefault();
      const type = document.getElementById('activity-type').value;
      const name = document.getElementById('activity-name').value.trim();
      if (!name) return;

      try {
        const res = await fetch('/api/dashboard/bot/activity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, name }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update presence');
        showToast(data.message, 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    }

    async function loadHostingData() {
      try {
        const res = await fetch('/api/dashboard/hosting-health');
        if (!res.ok) throw new Error('Failed to fetch hosting report');
        const data = await res.json();

        const report = data.report || {};
        document.getElementById('host-ping').textContent = (report.avgPing || 0) + ' ms';
        document.getElementById('host-reconnects').textContent = report.reconnectCount || 0;
        document.getElementById('host-disconnects').textContent = report.disconnectCount || 0;
        document.getElementById('host-invalidated').textContent = report.invalidSessions || 0;

        const statusEl = document.getElementById('hosting-risk-status');
        const descEl = document.getElementById('hosting-risk-desc');
        const cardEl = document.getElementById('hosting-risk-card');

        if (report.conflictRisk === 'HIGH') {
          statusEl.innerHTML = '<span style="color: var(--accent-danger);">🔴 HIGH RISK — MULTI-HOST TOKEN CONFLICT DETECTED</span>';
          cardEl.style.borderColor = 'rgba(242, 63, 67, 0.5)';
          cardEl.style.background = 'rgba(242, 63, 67, 0.08)';
        } else if (report.conflictRisk === 'MEDIUM') {
          statusEl.innerHTML = '<span style="color: var(--accent-warning);">🟡 MEDIUM RISK — ELEVATED GATEWAY RECONNECTS</span>';
          cardEl.style.borderColor = 'rgba(240, 178, 50, 0.5)';
          cardEl.style.background = 'rgba(240, 178, 50, 0.08)';
        } else {
          statusEl.innerHTML = '<span style="color: var(--accent-success);">🟢 LOW RISK — CLEAN SINGLE HOSTING SESSION</span>';
          cardEl.style.borderColor = 'rgba(35, 165, 90, 0.5)';
          cardEl.style.background = 'rgba(35, 165, 90, 0.08)';
        }
        descEl.textContent = report.conflictReason || 'Gateway connection is stable.';
      } catch (err) {
        console.error('Error loading hosting health:', err);
      }
    }

    async function loadSettingsData() {
      try {
        const res = await fetch('/api/dashboard/settings');
        if (!res.ok) throw new Error('Failed to fetch settings');
        const data = await res.json();

        if (data.defaultPrefix) {
          const input = document.getElementById('setting-prefix-input');
          if (input && !input.dataset.userEdited) {
            input.value = data.defaultPrefix;
          }
        }

        const select = document.getElementById('setting-target-select');
        const tbody = document.getElementById('table-settings-guilds-body');

        if (data.guilds && Array.isArray(data.guilds)) {
          // Populate select options
          select.innerHTML = '<option value="global" selected>Global Default (All Connected Servers)</option>' +
            data.guilds.map(g => '<option value="' + escapeHtml(g.guildId) + '">' + escapeHtml(g.guildName) + ' (' + g.prefix + ')</option>').join('');

          // Populate guild roster table
          if (data.guilds.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No connected servers found</td></tr>';
            return;
          }

          tbody.innerHTML = data.guilds.map(g => {
            const gId = escapeHtml(g.guildId);
            const gPrefix = escapeHtml(g.prefix);
            const gName = escapeHtml(g.guildName);
            const iconHtml = g.icon
              ? '<img src="' + escapeHtml(g.icon) + '" style="width: 28px; height: 28px; border-radius: 50%; vertical-align: middle; margin-right: 8px;">'
              : '<div style="width: 28px; height: 28px; border-radius: 50%; background: var(--bg-surface-elevated); display: inline-flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.75rem; vertical-align: middle; margin-right: 8px;">' + escapeHtml(gName.slice(0, 2)) + '</div>';

            const npBadge = g.noPrefixEnabled 
              ? '<span style="color: var(--accent-success); font-weight: 600;">Active</span>' 
              : '<span style="color: var(--text-muted);">Disabled</span>';

            return '<tr>' +
              '<td>' + iconHtml + '<strong>' + gName + '</strong></td>' +
              '<td><span class="code-pill">' + gId + '</span></td>' +
              '<td><span class="role-badge role-owner" style="font-family: var(--font-mono); font-size: 0.9rem;">' + gPrefix + '</span></td>' +
              '<td>' + npBadge + '</td>' +
              '<td style="text-align: right;">' +
                '<button class="btn btn-secondary btn-sm" onclick="handleQuickSetPrefix(\'' + gId + '\', \'' + gPrefix + '\')">Change Prefix</button>' +
              '</td>' +
            '</tr>';
          }).join('');
        }
      } catch (err) {
        console.error('Error loading settings:', err);
      }
    }

    async function handleQuickSetPrefix(guildId, currentPrefix) {
      const newPrefix = prompt('Enter new command prefix for server ID ' + guildId + ':', currentPrefix);
      if (!newPrefix || !newPrefix.trim()) return;

      try {
        const res = await fetch('/api/dashboard/settings/prefix', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prefix: newPrefix.trim(), guildId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update prefix');
        showToast(data.message, 'success');
        loadSettingsData();
      } catch (err) {
        showToast(err.message, 'error');
      }
    }

    async function handleSavePrefix(e) {
      e.preventDefault();
      const prefix = document.getElementById('setting-prefix-input').value.trim();
      const guildId = document.getElementById('setting-target-select').value;
      if (!prefix) return;

      const btn = document.getElementById('btn-save-prefix');
      btn.disabled = true;

      try {
        const res = await fetch('/api/dashboard/settings/prefix', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prefix, guildId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to save prefix');
        showToast(data.message, 'success');
        loadSettingsData();
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        btn.disabled = false;
      }
    }

    function refreshDashboardData() {
      loadOverviewData();
      if (currentTab === 'staff') loadStaffData();
      if (currentTab === 'guilds') loadGuildsData();
      if (currentTab === 'premium') loadPremiumData();
      if (currentTab === 'whitelist') loadWhitelistData();
      if (currentTab === 'hosting') loadHostingData();
      if (currentTab === 'settings') loadSettingsData();
      showToast('Dashboard data refreshed', 'success');
    }

    function escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    // Auto-load on startup and poll every 8 seconds
    window.addEventListener('DOMContentLoaded', () => {
      loadOverviewData();
      loadStaffData();
      setInterval(loadOverviewData, 8000);
    });
  </script>
</body>
</html>`;
}
