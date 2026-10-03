import React, { useState } from "react";

export default function App() {
  const [activeTab, setActiveTab] = useState<"standard" | "prime">("standard");
  const [copied, setCopied] = useState<string | null>(null);

  const goldenLogoUrl =
    "https://images.unsplash.com/photo-1618005198919-d3d4b5a92ead?q=80&w=800&auto=format&fit=crop";

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="min-h-screen bg-[#0d0e12] text-slate-100 flex flex-col font-sans selection:bg-purple-500 selection:text-white">
      {/* Header Bar */}
      <header className="border-b border-slate-800/80 bg-[#12141a]/90 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-18 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 p-0.5 shadow-lg shadow-purple-500/20">
              <div className="w-full h-full bg-[#0d0e12] rounded-[10px] flex items-center justify-center font-black text-xl tracking-tighter bg-gradient-to-br from-indigo-400 to-purple-300 bg-clip-text text-transparent">
                Z
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-wide text-white">Zenith Studio</span>
                <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300">
                  Asset Hub
                </span>
              </div>
              <p className="text-xs text-slate-400">Official Brand Assets & Logos</p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-[#181a22] p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab("standard")}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "standard"
                  ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Zenith Standard
            </button>
            <button
              onClick={() => setActiveTab("prime")}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === "prime"
                  ? "bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-bold shadow-md shadow-amber-500/30"
                  : "text-amber-400/80 hover:text-amber-300"
              }`}
            >
              <span>✦</span> Zenith Prime (Gold)
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-12">
        {activeTab === "standard" ? (
          /* Standard Zenith Logo View */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Logo Display Card */}
            <div className="lg:col-span-7 bg-[#14161f] border border-slate-800/80 rounded-2xl p-8 relative overflow-hidden shadow-2xl">
              <div className="absolute -right-24 -top-24 w-72 h-72 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -left-24 -bottom-24 w-72 h-72 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

              <div className="flex items-center justify-between mb-6">
                <div>
                  <span className="text-xs uppercase tracking-widest text-purple-400 font-bold">Standard Identity</span>
                  <h2 className="text-2xl font-bold text-white mt-1">Zenith Core Logo</h2>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
                  Vector • 1024x1024
                </span>
              </div>

              {/* Logo Canvas Showcase */}
              <div className="aspect-square w-full max-w-[360px] mx-auto rounded-3xl bg-gradient-to-br from-[#0c0d12] via-[#151722] to-[#1c162b] p-8 flex items-center justify-center border border-purple-500/20 shadow-inner relative group">
                <div className="absolute inset-0 bg-radial from-purple-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl" />
                
                {/* SVG Vector Logo */}
                <svg
                  viewBox="0 0 200 200"
                  className="w-full h-full drop-shadow-[0_0_35px_rgba(168,85,247,0.45)] transition-transform duration-500 group-hover:scale-105"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <defs>
                    <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#2e1065" />
                      <stop offset="50%" stopColor="#0f172a" />
                      <stop offset="100%" stopColor="#030712" />
                    </linearGradient>
                    <linearGradient id="zGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#a855f7" />
                      <stop offset="50%" stopColor="#38bdf8" />
                      <stop offset="100%" stopColor="#ec4899" />
                    </linearGradient>
                    <linearGradient id="borderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#a855f7" />
                      <stop offset="100%" stopColor="#38bdf8" />
                    </linearGradient>
                  </defs>

                  {/* Outer Shield/Hexagon */}
                  <polygon
                    points="100,12 178,56 178,144 100,188 22,144 22,56"
                    fill="url(#shieldGrad)"
                    stroke="url(#borderGrad)"
                    strokeWidth="3.5"
                    strokeLinejoin="round"
                  />

                  {/* Inner Circuit Details */}
                  <polygon
                    points="100,26 166,63 166,137 100,174 34,137 34,63"
                    fill="none"
                    stroke="#a855f7"
                    strokeWidth="1"
                    strokeOpacity="0.3"
                    strokeDasharray="4 4"
                  />

                  {/* Futuristic 'Z' Glyph */}
                  <path
                    d="M62 60 H138 L142 70 L94 130 H142 L138 140 H60 L56 130 L104 70 H62 Z"
                    fill="url(#zGrad)"
                    filter="drop-shadow(0 2px 8px rgba(168,85,247,0.6))"
                  />

                  {/* Tech Nodes */}
                  <circle cx="100" cy="12" r="3" fill="#38bdf8" />
                  <circle cx="178" cy="56" r="3" fill="#a855f7" />
                  <circle cx="178" cy="144" r="3" fill="#ec4899" />
                  <circle cx="100" cy="188" r="3" fill="#38bdf8" />
                  <circle cx="22" cy="144" r="3" fill="#a855f7" />
                  <circle cx="22" cy="56" r="3" fill="#ec4899" />
                </svg>
              </div>

              {/* Action Buttons */}
              <div className="mt-8 flex flex-wrap gap-3 justify-center">
                <button
                  onClick={() =>
                    handleCopy(
                      `<svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#2e1065"/><stop offset="50%" stopColor="#0f172a"/><stop offset="100%" stopColor="#030712"/></linearGradient><linearGradient id="zGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#a855f7"/><stop offset="50%" stopColor="#38bdf8"/><stop offset="100%" stopColor="#ec4899"/></linearGradient><linearGradient id="borderGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#a855f7"/><stop offset="100%" stopColor="#38bdf8"/></linearGradient></defs><polygon points="100,12 178,56 178,144 100,188 22,144 22,56" fill="url(#shieldGrad)" stroke="url(#borderGrad)" strokeWidth="3.5" strokeLinejoin="round"/><polygon points="100,26 166,63 166,137 100,174 34,137 34,63" fill="none" stroke="#a855f7" strokeWidth="1" strokeOpacity="0.3" strokeDasharray="4 4"/><path d="M62 60 H138 L142 70 L94 130 H142 L138 140 H60 L56 130 L104 70 H62 Z" fill="url(#zGrad)"/><circle cx="100" cy="12" r="3" fill="#38bdf8"/><circle cx="178" cy="56" r="3" fill="#a855f7"/><circle cx="178" cy="144" r="3" fill="#ec4899"/><circle cx="100" cy="188" r="3" fill="#38bdf8"/><circle cx="22" cy="144" r="3" fill="#a855f7"/><circle cx="22" cy="56" r="3" fill="#ec4899"/></svg>`,
                      "svg-std"
                    )
                  }
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium text-xs transition-all shadow-lg shadow-purple-600/20 flex items-center gap-2"
                >
                  <span>{copied === "svg-std" ? "✓ Copied SVG Code" : "Copy SVG Vector"}</span>
                </button>
              </div>
            </div>

            {/* Discord Avatar Preview */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-[#14161f] border border-slate-800/80 rounded-2xl p-6">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4">
                  Discord In-App Appearance
                </h3>

                {/* Discord Message Mock */}
                <div className="bg-[#2b2d31] rounded-xl p-4 flex gap-4 text-left border border-slate-700/40">
                  <div className="w-10 h-10 rounded-full bg-[#1e1f22] p-1 flex-shrink-0 border border-purple-500/40 overflow-hidden flex items-center justify-center">
                    <span className="font-black text-purple-400 text-lg">Z</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-white">Zenith</span>
                      <span className="bg-[#5865f2] text-[10px] font-bold px-1.5 py-0.2 rounded text-white tracking-wider">
                        BOT
                      </span>
                      <span className="text-[11px] text-slate-400">Today at 12:00</span>
                    </div>
                    <div className="mt-2 text-xs bg-[#1e1f22] p-3 rounded-lg border-l-4 border-purple-500 space-y-1">
                      <div className="font-bold text-white flex items-center gap-1.5">
                        <span className="text-purple-400">✦</span> Zenith System Online
                      </div>
                      <p className="text-slate-300 text-[11px]">
                        Anti-Nuke Protection & High-Fi Audio streaming are 100% active.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Command Cheat Sheet */}
              <div className="bg-[#14161f] border border-slate-800/80 rounded-2xl p-6 space-y-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">
                  How to Set as Avatar in Discord
                </h3>
                <div className="space-y-2 text-xs text-slate-300">
                  <div className="p-2.5 rounded-lg bg-[#0e1017] border border-slate-800 font-mono text-[11px] flex justify-between items-center">
                    <code>.botavatar &lt;image_url&gt;</code>
                    <span className="text-slate-500 text-[10px]">Per-Server</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#0e1017] border border-slate-800 font-mono text-[11px] flex justify-between items-center">
                    <code>.gbotavatar &lt;image_url&gt;</code>
                    <span className="text-amber-500 text-[10px]">Global (Owner)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Zenith Prime Golden Logo View */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Golden Logo Showcase */}
            <div className="lg:col-span-7 bg-[#171510] border border-amber-500/30 rounded-2xl p-8 relative overflow-hidden shadow-2xl">
              <div className="absolute -right-24 -top-24 w-72 h-72 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -left-24 -bottom-24 w-72 h-72 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="flex items-center justify-between mb-6">
                <div>
                  <span className="text-xs uppercase tracking-widest text-amber-400 font-bold flex items-center gap-1">
                    <span>👑</span> VIP Premium Guild Branding
                  </span>
                  <h2 className="text-2xl font-bold text-amber-100 mt-1">Zenith Prime (24K Gold)</h2>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  VIP EXCLUSIVE
                </span>
              </div>

              {/* Golden Logo Showcase */}
              <div className="aspect-square w-full max-w-[360px] mx-auto rounded-3xl bg-gradient-to-br from-[#1c180d] via-[#121008] to-[#262010] p-8 flex items-center justify-center border border-amber-500/40 shadow-2xl shadow-amber-500/10 relative group">
                {/* SVG 24K Gold Vector Logo */}
                <svg
                  viewBox="0 0 200 200"
                  className="w-full h-full drop-shadow-[0_0_35px_rgba(245,158,11,0.5)] transition-transform duration-500 group-hover:scale-105"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <defs>
                    <linearGradient id="goldShield" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#451a03" />
                      <stop offset="30%" stopColor="#1c1308" />
                      <stop offset="100%" stopColor="#0a0703" />
                    </linearGradient>
                    <linearGradient id="goldTrim" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#fef08a" />
                      <stop offset="35%" stopColor="#eab308" />
                      <stop offset="70%" stopColor="#ca8a04" />
                      <stop offset="100%" stopColor="#fef08a" />
                    </linearGradient>
                    <linearGradient id="goldZ" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#fffbeb" />
                      <stop offset="25%" stopColor="#fde047" />
                      <stop offset="60%" stopColor="#eab308" />
                      <stop offset="100%" stopColor="#a16207" />
                    </linearGradient>
                  </defs>

                  {/* Outer Luxury Shield */}
                  <polygon
                    points="100,12 178,56 178,144 100,188 22,144 22,56"
                    fill="url(#goldShield)"
                    stroke="url(#goldTrim)"
                    strokeWidth="4"
                    strokeLinejoin="round"
                  />

                  {/* Inner Gold Rings */}
                  <polygon
                    points="100,24 168,62 168,138 100,176 32,138 32,62"
                    fill="none"
                    stroke="url(#goldTrim)"
                    strokeWidth="1.2"
                    strokeOpacity="0.4"
                  />

                  {/* Crown Top Accent */}
                  <path
                    d="M85 36 L100 24 L115 36 L108 42 L100 34 L92 42 Z"
                    fill="url(#goldTrim)"
                  />

                  {/* Prime 'Z' Holographic Glyph */}
                  <path
                    d="M62 60 H138 L142 70 L94 130 H142 L138 140 H60 L56 130 L104 70 H62 Z"
                    fill="url(#goldZ)"
                    filter="drop-shadow(0 2px 10px rgba(234,179,8,0.7))"
                  />

                  {/* Gold Gems */}
                  <circle cx="100" cy="12" r="3.5" fill="#fef08a" />
                  <circle cx="178" cy="56" r="3.5" fill="#eab308" />
                  <circle cx="178" cy="144" r="3.5" fill="#eab308" />
                  <circle cx="100" cy="188" r="3.5" fill="#fef08a" />
                  <circle cx="22" cy="144" r="3.5" fill="#eab308" />
                  <circle cx="22" cy="56" r="3.5" fill="#eab308" />
                </svg>
              </div>

              {/* Action Buttons */}
              <div className="mt-8 flex flex-wrap gap-3 justify-center">
                <button
                  onClick={() => handleCopy(goldenLogoUrl, "url-gold")}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-black font-bold text-xs transition-all shadow-lg shadow-amber-500/20"
                >
                  {copied === "url-gold" ? "✓ Copied Direct Image URL" : "Copy Golden Image URL"}
                </button>
                <button
                  onClick={() =>
                    handleCopy(
                      `<svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="goldShield" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#451a03"/><stop offset="30%" stopColor="#1c1308"/><stop offset="100%" stopColor="#0a0703"/></linearGradient><linearGradient id="goldTrim" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#fef08a"/><stop offset="35%" stopColor="#eab308"/><stop offset="70%" stopColor="#ca8a04"/><stop offset="100%" stopColor="#fef08a"/></linearGradient><linearGradient id="goldZ" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#fffbeb"/><stop offset="25%" stopColor="#fde047"/><stop offset="60%" stopColor="#eab308"/><stop offset="100%" stopColor="#a16207"/></linearGradient></defs><polygon points="100,12 178,56 178,144 100,188 22,144 22,56" fill="url(#goldShield)" stroke="url(#goldTrim)" strokeWidth="4" strokeLinejoin="round"/><path d="M62 60 H138 L142 70 L94 130 H142 L138 140 H60 L56 130 L104 70 H62 Z" fill="url(#goldZ)"/></svg>`,
                      "svg-gold"
                    )
                  }
                  className="px-5 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-medium text-xs transition-all border border-amber-500/40"
                >
                  {copied === "svg-gold" ? "✓ Copied Gold Vector" : "Copy Gold SVG"}
                </button>
              </div>
            </div>

            {/* Discord Premium Avatar Preview */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-[#171510] border border-amber-500/30 rounded-2xl p-6">
                <h3 className="text-sm font-bold uppercase tracking-wider text-amber-400/80 mb-4">
                  Zenith Prime In-Server Preview
                </h3>

                {/* Discord Message Mock */}
                <div className="bg-[#2b2d31] rounded-xl p-4 flex gap-4 text-left border border-amber-500/30 shadow-lg">
                  <div className="w-10 h-10 rounded-full bg-[#1e1f22] p-1 flex-shrink-0 border-2 border-amber-400 overflow-hidden flex items-center justify-center shadow-md shadow-amber-500/20">
                    <span className="font-black text-amber-400 text-lg">Z</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-amber-300">Zenith Prime</span>
                      <span className="bg-gradient-to-r from-amber-500 to-yellow-400 text-[10px] font-bold px-1.5 py-0.2 rounded text-black tracking-wider">
                        VIP
                      </span>
                      <span className="text-[11px] text-slate-400">Today at 12:00</span>
                    </div>
                    <div className="mt-2 text-xs bg-[#1e1f22] p-3 rounded-lg border-l-4 border-amber-400 space-y-1">
                      <div className="font-bold text-amber-300 flex items-center gap-1.5">
                        <span>👑</span> Premium VIP Server Active
                      </div>
                      <p className="text-slate-300 text-[11px]">
                        No-Prefix Command Routing & 24/7 Always-On Dedicated Voice Node enabled.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Premium Auto-Branding Notice */}
              <div className="bg-[#171510] border border-amber-500/30 rounded-2xl p-6 space-y-2">
                <h3 className="text-sm font-bold uppercase tracking-wider text-amber-400">
                  Automatic Activation
                </h3>
                <p className="text-xs text-amber-200/80 leading-relaxed">
                  In servers with active **Zenith VIP / Premium**, the bot automatically renames itself to **"Zenith Prime"** and adopts the golden aesthetic across all embed interactions.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
