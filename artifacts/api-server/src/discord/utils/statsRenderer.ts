import { createCanvas } from "@napi-rs/canvas";

export interface StatItem {
  label: string;
  value: string | number;
  sub?: string;
}

export interface BarChartItem {
  label: string;
  value: number;
}

export interface RenderTemplateOptions {
  categoryTitle: string; // e.g. "USER ACTIVITY STATS" | "ROLE ACTIVITY STATS" | "SERVER ACTIVITY" | "JOIN / LEAVE FLOW"
  mainTitle: string;     // e.g. "Message Volume Overview"
  subtitle?: string;     // e.g. "Realtime Guild Intelligence Engine"
  guildName: string;
  items: StatItem[];
  bars?: BarChartItem[];
  hourlyActivity?: number[]; // 24 values
  footerNote?: string;
}

export async function renderStatsCard(opts: RenderTemplateOptions): Promise<Buffer> {
  const width = 1000;
  const height = 620;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Background Gradient - Deep dark futuristic theme matching Zenith aesthetics
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, "#0e1117");
  bgGrad.addColorStop(0.5, "#151922");
  bgGrad.addColorStop(1, "#0b0d13");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Subtle decorative gridlines & ambient glow
  ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
  ctx.lineWidth = 1;
  for (let x = 40; x < width; x += 60) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 40; y < height; y += 60) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Header Banner Glow
  const topGlow = ctx.createLinearGradient(0, 0, width, 0);
  topGlow.addColorStop(0, "#57f287");
  topGlow.addColorStop(0.5, "#5dade2");
  topGlow.addColorStop(1, "#9b59b6");
  ctx.fillStyle = topGlow;
  ctx.fillRect(0, 0, width, 6);

  // Header pill badge
  ctx.fillStyle = "rgba(87, 242, 135, 0.15)";
  ctx.beginPath();
  ctx.roundRect(40, 30, 220, 26, 6);
  ctx.fill();

  ctx.fillStyle = "#57f287";
  ctx.font = "bold 12px sans-serif";
  ctx.fillText(`• ${opts.categoryTitle.toUpperCase()}`, 52, 47);

  // Server Name & Main Title
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 28px sans-serif";
  ctx.fillText(opts.mainTitle, 40, 88);

  ctx.fillStyle = "#8a96a3";
  ctx.font = "14px sans-serif";
  ctx.fillText(`${opts.guildName} • ${opts.subtitle || "Zenith Analytics Intelligence"}`, 40, 114);

  // Draw Stat Metric Boxes (Grid of Cards)
  const boxY = 140;
  const boxHeight = 100;
  const boxGap = 20;
  const numItems = Math.min(opts.items.length, 4);
  const boxWidth = (width - 80 - (numItems - 1) * boxGap) / Math.max(numItems, 1);

  for (let i = 0; i < numItems; i++) {
    const item = opts.items[i]!;
    const bx = 40 + i * (boxWidth + boxGap);

    // Box Background
    ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(bx, boxY, boxWidth, boxHeight, 10);
    ctx.fill();
    ctx.stroke();

    // Box Top accent
    ctx.fillStyle = i === 0 ? "#57f287" : i === 1 ? "#5dade2" : i === 2 ? "#ffd700" : "#ff7675";
    ctx.beginPath();
    ctx.roundRect(bx, boxY, boxWidth, 3, [10, 10, 0, 0]);
    ctx.fill();

    // Box Label
    ctx.fillStyle = "#9ba3af";
    ctx.font = "12px sans-serif";
    ctx.fillText(item.label.toUpperCase(), bx + 16, boxY + 28);

    // Box Big Number
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 24px sans-serif";
    ctx.fillText(String(item.value), bx + 16, boxY + 62);

    // Box Subtext
    if (item.sub) {
      ctx.fillStyle = "#636e7b";
      ctx.font = "11px sans-serif";
      ctx.fillText(item.sub, bx + 16, boxY + 84);
    }
  }

  // Lower Section: Charts / Graphs / Lists
  const graphAreaY = 270;
  const graphAreaH = 280;

  if (opts.bars && opts.bars.length > 0) {
    // Left chart panel: Bar Graph (e.g. 7-day joins/leaves or top contributors)
    const chartW = opts.hourlyActivity ? 580 : 920;
    ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
    ctx.beginPath();
    ctx.roundRect(40, graphAreaY, chartW, graphAreaH, 12);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 16px sans-serif";
    ctx.fillText("Trend Distribution / Rankings", 60, graphAreaY + 32);

    const maxVal = Math.max(...opts.bars.map((b) => b.value), 1);
    const startY = graphAreaY + 60;
    const barSpacing = Math.min(32, (graphAreaH - 80) / opts.bars.length);

    opts.bars.slice(0, 6).forEach((b, idx) => {
      const cy = startY + idx * barSpacing;
      // Label
      ctx.fillStyle = "#c5d1de";
      ctx.font = "13px sans-serif";
      const lbl = b.label.length > 18 ? b.label.slice(0, 17) + "…" : b.label;
      ctx.fillText(lbl, 60, cy + 14);

      // Bar BG
      const barX = 220;
      const maxBarW = chartW - 320;
      ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
      ctx.beginPath();
      ctx.roundRect(barX, cy + 2, maxBarW, 16, 4);
      ctx.fill();

      // Filled Bar
      const fillW = Math.max(4, (b.value / maxVal) * maxBarW);
      const barGrad = ctx.createLinearGradient(barX, 0, barX + fillW, 0);
      barGrad.addColorStop(0, "#57f287");
      barGrad.addColorStop(1, "#5dade2");
      ctx.fillStyle = barGrad;
      ctx.beginPath();
      ctx.roundRect(barX, cy + 2, fillW, 16, 4);
      ctx.fill();

      // Number count
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 13px sans-serif";
      ctx.fillText(String(b.value), barX + maxBarW + 12, cy + 15);
    });

    // Right chart panel: 24h Hourly Activity sparkline / mini graph
    if (opts.hourlyActivity) {
      const sideX = 640;
      const sideW = 320;
      ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
      ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
      ctx.beginPath();
      ctx.roundRect(sideX, graphAreaY, sideW, graphAreaH, 12);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 16px sans-serif";
      ctx.fillText("24-Hour Time Activity (UTC)", sideX + 20, graphAreaY + 32);

      const maxHourly = Math.max(...opts.hourlyActivity, 1);
      const miniH = 150;
      const miniBaseY = graphAreaY + 220;
      const barColW = (sideW - 40) / 24;

      for (let h = 0; h < 24; h++) {
        const val = opts.hourlyActivity[h] || 0;
        const colH = Math.max(3, (val / maxHourly) * miniH);
        const colX = sideX + 20 + h * barColW;

        ctx.fillStyle = h % 6 === 0 ? "#5dade2" : "rgba(87, 242, 135, 0.7)";
        ctx.fillRect(colX, miniBaseY - colH, Math.max(2, barColW - 2), colH);
      }

      ctx.fillStyle = "#717d8a";
      ctx.font = "11px sans-serif";
      ctx.fillText("00:00", sideX + 20, miniBaseY + 18);
      ctx.fillText("12:00", sideX + 150, miniBaseY + 18);
      ctx.fillText("23:00", sideX + 270, miniBaseY + 18);
    }
  } else if (opts.hourlyActivity) {
    // Full width 24h graph
    const chartW = 920;
    ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
    ctx.beginPath();
    ctx.roundRect(40, graphAreaY, chartW, graphAreaH, 12);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 18px sans-serif";
    ctx.fillText("24-Hour Server Traffic Heatmap (Hourly Activity)", 60, graphAreaY + 35);

    const maxHourly = Math.max(...opts.hourlyActivity, 1);
    const miniH = 160;
    const miniBaseY = graphAreaY + 230;
    const barColW = (chartW - 60) / 24;

    for (let h = 0; h < 24; h++) {
      const val = opts.hourlyActivity[h] || 0;
      const colH = Math.max(4, (val / maxHourly) * miniH);
      const colX = 60 + h * barColW;

      const grad = ctx.createLinearGradient(0, miniBaseY - colH, 0, miniBaseY);
      grad.addColorStop(0, "#57f287");
      grad.addColorStop(1, "#27ae60");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(colX, miniBaseY - colH, barColW - 4, colH, 3);
      ctx.fill();

      // Hour text
      if (h % 3 === 0) {
        ctx.fillStyle = "#9ba3af";
        ctx.font = "11px sans-serif";
        ctx.fillText(`${h}h`, colX, miniBaseY + 18);
      }
    }
  }

  // Footer bar
  ctx.fillStyle = "#4a5568";
  ctx.font = "12px sans-serif";
  ctx.fillText(opts.footerNote || "Zenith Real-Time Analytical Engine • Powered by High-Resolution Vector Rendering", 40, height - 20);

  return canvas.toBuffer("image/png");
}
