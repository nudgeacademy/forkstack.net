/* The app's own screens, drawn on canvases for the home page film (film.js): the
 * waiter's order, the kitchen display, the till, the stock board, the owner's
 * AI chat, and the ticker of the assistant's tools. Drawn bright on clear,
 * so they glow as holograms. */
export function ui(W, H, draw) {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.textBaseline = 'middle';
  draw(g, W, H);
  return c;
}
const rr = (g, x, y, w, h, r) => {
  g.beginPath();
  if (g.roundRect) { g.roundRect(x, y, w, h, r); return; }
  r = Math.min(r, w / 2, h / 2);
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
};
const txt = (g, s, x, y, size, weight, color, align = 'left', font = 'Inter') => {
  g.font = `${weight} ${size}px ${font}, system-ui, sans-serif`; g.fillStyle = color; g.textAlign = align; g.fillText(s, x, y);
};
export const G1 = '#6BF0A6', W1 = '#F4F1EA', M1 = '#9C978E', A1 = '#FFB547';

export const orderUI = () => ui(420, 860, (g, W) => {
  txt(g, '9:41', 34, 40, 24, 600, W1);
  txt(g, 'Table 4', 34, 120, 56, 700, W1);
  txt(g, '2 guests · Rahul', 34, 176, 26, 500, M1);
  g.fillStyle = M1; g.fillRect(34, 216, W - 68, 2);
  [['1×', 'Dum Biryani', '340'], ['2×', 'Butter Naan', '130'], ['1×', 'Lime Soda', '80']].forEach(([q, n, p], i) => {
    const y = 262 + i * 104;
    g.strokeStyle = '#5E5A53'; g.lineWidth = 3; rr(g, 34, y, W - 68, 84, 16); g.stroke();
    txt(g, q, 60, y + 42, 30, 700, G1); txt(g, n, 112, y + 42, 30, 600, W1); txt(g, p, W - 60, y + 42, 30, 600, W1, 'right');
  });
  txt(g, 'Total', 34, 610, 30, 500, M1); txt(g, '550.00', W - 34, 610, 40, 700, W1, 'right');
  g.fillStyle = G1; rr(g, 34, 700, W - 68, 108, 26); g.fill();
  txt(g, 'Send to kitchen', W / 2, 754, 36, 700, '#000', 'center');
});

export const kdsUI = () => ui(1000, 600, (g) => {
  txt(g, 'Kitchen', 40, 46, 40, 700, W1); txt(g, '3 open · oldest first', 220, 48, 26, 500, M1);
  const t = [
    ['T4 · KOT 104', '00:48', G1, ['1× Dum Biryani', '2× Butter Naan', '1× Lime Soda']],
    ['T2 · KOT 103', '06:12', A1, ['2× Chicken Tikka', '1× Raita']],
    ['T7 · KOT 101', '11:40', '#FF6B5E', ['3× Paneer Tikka', '2× Garlic Naan', '1× Dal']],
  ];
  t.forEach(([h, time, c, items], i) => {
    const x = 40 + i * 320;
    g.strokeStyle = c; g.lineWidth = 4; rr(g, x, 100, 290, 460, 18); g.stroke();
    g.fillStyle = c; rr(g, x, 100, 290, 74, 18); g.fill(); g.fillRect(x, 150, 290, 24);
    txt(g, h, x + 20, 138, 28, 700, '#000');
    txt(g, time, x + 20, 228, 54, 700, c);
    items.forEach((it, j) => txt(g, it, x + 20, 306 + j * 56, 28, 500, W1));
  });
});

export const tillUI = () => ui(1000, 620, (g) => {
  ['Biryani', 'Naan', 'Tikka', 'Soda', 'Dal', 'Raita', 'Lassi', 'Kheer', 'Tea'].forEach((n, i) => {
    const x = 30 + (i % 3) * 172, y = 40 + Math.floor(i / 3) * 132;
    g.strokeStyle = '#5E5A53'; g.lineWidth = 3; rr(g, x, y, 156, 112, 14); g.stroke();
    txt(g, n, x + 16, y + 40, 26, 600, W1); txt(g, ['340', '65', '260', '80', '180', '90', '120', '110', '40'][i], x + 16, y + 80, 22, 500, G1);
  });
  const X = 570;
  txt(g, 'Table 4', X, 60, 36, 700, W1);
  [['Subtotal', '550.00'], ['VAT 5%', '27.50']].forEach(([a, b], i) => { txt(g, a, X, 128 + i * 46, 26, 500, M1); txt(g, b, 970, 128 + i * 46, 26, 500, W1, 'right'); });
  txt(g, 'Total', X, 246, 32, 600, W1); txt(g, '577.50', 970, 246, 52, 700, W1, 'right');
  [['Cash', '300.00'], ['Card', '277.50']].forEach(([a, b], i) => {
    const y = 300 + i * 82;
    g.strokeStyle = G1; g.lineWidth = 3; rr(g, X, y, 400, 66, 14); g.stroke();
    txt(g, a, X + 20, y + 33, 28, 600, G1); txt(g, b + '  ✓', 950, y + 33, 28, 600, W1, 'right');
  });
  g.strokeStyle = A1; g.lineWidth = 3; rr(g, X, 480, 400, 62, 31); g.stroke();
  txt(g, 'Offline · 3 bills queued', X + 200, 511, 24, 600, A1, 'center');
});

export const wifiUI = () => ui(240, 240, (g) => {
  g.strokeStyle = A1; g.lineWidth = 16; g.lineCap = 'round';
  [90, 62, 34].forEach((r) => { g.beginPath(); g.arc(120, 170, r, Math.PI * 1.22, Math.PI * 1.78); g.stroke(); });
  g.fillStyle = A1; g.beginPath(); g.arc(120, 170, 12, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#FF6B5E'; g.lineWidth = 14; g.beginPath(); g.moveTo(40, 40); g.lineTo(200, 210); g.stroke();
});

export const cardUI = () => ui(240, 300, (g) => {
  txt(g, 'Card', 120, 70, 34, 600, M1, 'center');
  txt(g, '277.50', 120, 140, 48, 700, W1, 'center');
  txt(g, 'Approved ✓', 120, 220, 30, 700, G1, 'center');
});

export const kotUI = () => ui(240, 640, (g) => {
  txt(g, 'KOT 104', 120, 60, 40, 700, W1, 'center');
  txt(g, 'T4 · 7:42 pm', 120, 116, 26, 500, M1, 'center');
  g.fillStyle = M1; g.fillRect(20, 160, 200, 3);
  ['1× Dum Biryani', '2× Butter Naan', '1× Lime Soda'].forEach((s, i) => txt(g, s, 20, 220 + i * 70, 26, 600, W1));
  g.fillStyle = M1; g.fillRect(20, 450, 200, 3);
  txt(g, 'ROUND 1', 120, 510, 30, 700, G1, 'center');
});

export const stockUI = () => ui(1000, 680, (g) => {
  txt(g, 'Stock · tonight', 40, 52, 40, 700, W1);
  [['Basmati rice', '4.0 kg', 0.18, A1], ['Paneer', '1.2 kg', 0.22, A1], ['Cream', '0.8 L', 0.15, A1], ['Chicken', '11 kg', 0.7, G1], ['Onions', '18 kg', 0.86, G1]].forEach(([n, q, f, c], i) => {
    const y = 120 + i * 74;
    txt(g, n, 40, y + 22, 28, 600, W1); txt(g, q, 960, y + 22, 26, 600, c, 'right');
    g.fillStyle = '#3E3B36'; rr(g, 330, y + 10, 480, 24, 12); g.fill();
    g.fillStyle = c; rr(g, 330, y + 10, 480 * f, 24, 12); g.fill();
  });
  g.strokeStyle = G1; g.lineWidth = 3; rr(g, 40, 512, 920, 136, 22); g.stroke();
  txt(g, '✦ What is running low?', 70, 554, 28, 600, G1);
  txt(g, '3 items are under their reorder level:', 70, 602, 26, 500, W1);
  txt(g, 'basmati rice, paneer, cream.', 560, 602, 26, 700, A1);
});

export const chatUI = () => ui(440, 940, (g, W) => {
  g.fillStyle = G1; rr(g, 30, 34, 44, 44, 12); g.fill();
  txt(g, '✦', 52, 57, 26, 700, '#000', 'center');
  txt(g, 'ForkStack AI', 90, 56, 30, 700, W1);
  g.fillStyle = '#4A4741'; rr(g, 120, 120, 290, 76, 26); g.fill();
  txt(g, 'How did we do tonight?', 265, 158, 25, 600, W1, 'center');
  txt(g, '21,340 across 64 bills.', 30, 250, 33, 700, G1);
  txt(g, 'Dum Biryani led the night.', 30, 300, 27, 500, W1);
  g.strokeStyle = '#5E5A53'; g.lineWidth = 3; rr(g, 30, 340, 380, 330, 20); g.stroke();
  txt(g, 'TOP SELLERS · PLATES', 52, 380, 20, 600, M1);
  [['Dum Biryani', 42], ['Butter Naan', 34], ['Chicken Tikka', 27], ['Lime Soda', 21]].forEach(([n, v], i) => {
    const y = 428 + i * 58;
    txt(g, n, 52, y, 22, 500, W1);
    g.fillStyle = G1; rr(g, 230, y - 10, 140 * (v / 42), 20, 10); g.fill();
    txt(g, String(v), 392, y, 22, 600, M1, 'right');
  });
  txt(g, 'From 64 bills · 4 tools used', 52, 638, 20, 500, M1);
  txt(g, 'Basmati rice needs reordering.', 30, 720, 25, 600, A1);
  g.strokeStyle = '#5E5A53'; g.lineWidth = 3; rr(g, 30, 820, 380, 78, 39); g.stroke();
  txt(g, 'Ask about sales, stock, staff…', 60, 859, 22, 500, M1);
  g.fillStyle = G1; g.beginPath(); g.arc(372, 859, 24, 0, Math.PI * 2); g.fill();
});

export const ringUI = (text, color) => ui(4096, 110, (g, W) => {
  g.font = '500 62px JetBrains Mono, ui-monospace, monospace';
  let x = 0;
  while (x < W) { g.fillStyle = color; g.textAlign = 'left'; g.fillText(text, x, 58); x += g.measureText(text).width; }
});

export const wordUI = () => ui(1200, 260, (g) => txt(g, 'ForkStack', 600, 130, 190, 700, W1, 'center'));
export let logoUI = null;
export const logoReady = new Promise((resolve) => {
  const img = new Image();
  img.onload = () => {
    logoUI = ui(700, 700, (g) => { g.drawImage(img, 0, 0, 700, 700); g.globalCompositeOperation = 'source-in'; g.fillStyle = G1; g.fillRect(0, 0, 700, 700); });
    resolve();
  };
  img.onerror = () => resolve();
  img.src = '/assets/brand/symbol.svg';
});

