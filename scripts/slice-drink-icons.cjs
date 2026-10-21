// Rebuild: node scripts/slice-drink-icons.cjs '/absolute/path/to/sheet.png'
const sharp = require("sharp");
const fs = require("node:fs");
const path = require("node:path");
const names =
  "water sparkling-water coffee espresso iced-coffee latte tea iced-tea cola soda-bottle energy-drink sports-drink orange-juice juice-bottle milk plant-milk smoothie protein-shake beer wine cocktail shot hot-chocolate coconut-water kombucha electrolyte-drink lemonade broth my-bottle custom-drink".split(
    " ",
  );
const out = path.join(__dirname, "../assets/drinks");
const pointKey = (x, y) => `${x},${y}`;
function simplify(p, tolerance = 1.1) {
  if (p.length < 3) return p;
  const a = p[0],
    b = p.at(-1);
  let far = 0,
    index = 0;
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    len = dx * dx + dy * dy;
  for (let i = 1; i < p.length - 1; i++) {
    const t = len
      ? Math.max(
          0,
          Math.min(1, ((p[i][0] - a[0]) * dx + (p[i][1] - a[1]) * dy) / len),
        )
      : 0;
    const d = Math.hypot(p[i][0] - a[0] - t * dx, p[i][1] - a[1] - t * dy);
    if (d > far) {
      far = d;
      index = i;
    }
  }
  return far > tolerance
    ? [
        ...simplify(p.slice(0, index + 1), tolerance).slice(0, -1),
        ...simplify(p.slice(index), tolerance),
      ]
    : [a, b];
}
function trace(mask, w, h) {
  const edges = new Map();
  function edge(a, b) {
    const k = pointKey(...a);
    if (!edges.has(k)) edges.set(k, []);
    edges.get(k).push(b);
  }
  const ink = (x, y) => x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (ink(x, y)) {
        if (!ink(x, y - 1)) edge([x, y], [x + 1, y]);
        if (!ink(x + 1, y)) edge([x + 1, y], [x + 1, y + 1]);
        if (!ink(x, y + 1)) edge([x + 1, y + 1], [x, y + 1]);
        if (!ink(x - 1, y)) edge([x, y + 1], [x, y]);
      }
  const loops = [];
  while (edges.size) {
    const start = edges.keys().next().value;
    let current = start,
      points = [];
    do {
      points.push(current.split(",").map(Number));
      const list = edges.get(current);
      if (!list) break;
      const next = list.pop();
      if (!list.length) edges.delete(current);
      current = pointKey(...next);
    } while (current !== start && points.length < w * h * 4);
    const area = Math.abs(
      points.reduce((a, p, i) => {
        const q = points[(i + 1) % points.length];
        return a + p[0] * q[1] - q[0] * p[1];
      }, 0) / 2,
    );
    if (area > 10) {
      const half = Math.floor(points.length / 2);
      const p = [
        ...simplify(points.slice(0, half + 1)).slice(0, -1),
        ...simplify([...points.slice(half), points[0]]).slice(0, -1),
      ];
      loops.push(p);
    }
  }
  return loops;
}
function boundaries(projection, count) {
  const result = [0];
  for (let n = 1; n < count; n++) {
    const nominal = (projection.length * n) / count,
      range = (projection.length / count) * 0.25;
    let best = null,
      start = null;
    for (
      let x = Math.floor(nominal - range);
      x <= Math.ceil(nominal + range);
      x++
    ) {
      if (projection[x] === 0) {
        if (start === null) start = x;
      } else if (start !== null) {
        const end = x - 1;
        if (!best || end - start > best[1] - best[0]) best = [start, end];
        start = null;
      }
    }
    if (start !== null) {
      const end = Math.ceil(nominal + range);
      if (!best || end - start > best[1] - best[0]) best = [start, end];
    }
    result.push(
      best ? Math.round((best[0] + best[1]) / 2) : Math.round(nominal),
    );
  }
  return [...result, projection.length];
}
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const { data, info } = await sharp(process.argv[2])
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: c } = info,
    mask = new Uint8Array(w * h),
    xs = Array(w).fill(0),
    ys = Array(h).fill(0);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * c,
        r = data[i],
        g = data[i + 1],
        b = data[i + 2];
      if (
        Math.min(r, g, b) < 215 &&
        (Math.max(r, g, b) - Math.min(r, g, b) > 18 || Math.max(r, g, b) < 190)
      ) {
        mask[y * w + x] = 1;
        xs[x]++;
        ys[y]++;
      }
    }
  const xb = boundaries(xs, 6),
    yb = boundaries(ys, 5),
    manifest = {};
  for (let n = 0; n < 30; n++) {
    const col = n % 6,
      row = Math.floor(n / 6),
      left = xb[col],
      top = yb[row],
      right = xb[col + 1],
      bottom = yb[row + 1];
    let minx = right,
      miny = bottom,
      maxx = left,
      maxy = top,
      colors = [[], [], []];
    for (let y = top; y < bottom; y++)
      for (let x = left; x < right; x++)
        if (mask[y * w + x]) {
          minx = Math.min(minx, x);
          miny = Math.min(miny, y);
          maxx = Math.max(maxx, x);
          maxy = Math.max(maxy, y);
          for (let k = 0; k < 3; k++) colors[k].push(data[(y * w + x) * c + k]);
        }
    const cw = maxx - minx + 1,
      ch = maxy - miny + 1,
      local = new Uint8Array(cw * ch),
      rgba = Buffer.alloc(cw * ch * 4);
    for (let y = 0; y < ch; y++)
      for (let x = 0; x < cw; x++) {
        const src = (miny + y) * w + minx + x,
          i = (y * cw + x) * 4;
        local[y * cw + x] = mask[src];
        for (let k = 0; k < 3; k++) rgba[i + k] = data[src * c + k];
        rgba[i + 3] = mask[src] ? 255 : 0;
      }
    const color =
      "#" +
      colors
        .map((v) => {
          v.sort((a, b) => a - b);
          return v[Math.floor(v.length / 2)].toString(16).padStart(2, "0");
        })
        .join("");
    const scale = 56 / Math.max(cw, ch),
      ox = (64 - cw * scale) / 2,
      oy = (64 - ch * scale) / 2;
    const xy = (p) =>
      `${+(ox + p[0] * scale).toFixed(2)} ${+(oy + p[1] * scale).toFixed(2)}`;
    const loops = trace(local, cw, ch);
    const d = loops
      .map((p) => {
        const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        return (
          "M" +
          xy(mid(p.at(-1), p[0])) +
          p
            .map(
              (q, i) => "Q" + xy(q) + " " + xy(mid(q, p[(i + 1) % p.length])),
            )
            .join("") +
          "Z"
        );
      })
      .join("");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path fill="${color}" fill-rule="evenodd" d="${d}"/></svg>`;
    fs.writeFileSync(path.join(out, names[n] + ".svg"), svg);
    for (const density of [1, 2, 3]) {
      const size = 64 * density,
        iw = Math.round(cw * scale * density),
        ih = Math.round(ch * scale * density);
      const icon = await sharp(rgba, {
        raw: { width: cw, height: ch, channels: 4 },
      })
        .resize(iw, ih)
        .png()
        .toBuffer();
      await sharp({
        create: {
          width: size,
          height: size,
          channels: 4,
          background: "#00000000",
        },
      })
        .composite([
          {
            input: icon,
            left: Math.floor((size - iw) / 2),
            top: Math.floor((size - ih) / 2),
          },
        ])
        .png()
        .toFile(
          path.join(
            out,
            names[n] + (density === 1 ? "" : `@${density}x`) + ".png",
          ),
        );
    }
    manifest[names[n]] = {
      color,
      path: d,
      raster: false,
      cell: { left, top, right, bottom },
      bounds: { minx, miny, maxx, maxy },
    };
  }
  fs.writeFileSync(
    path.join(out, "traces.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );
  fs.writeFileSync(
    path.join(out, "sources.ts"),
    "// Generated by scripts/slice-drink-icons.cjs\nexport const pngSources = {\n" +
      names.map((name) => `  "${name}": require("./${name}.png"),`).join("\n") +
      "\n};\n",
  );
  const cells = await Promise.all(
    names.map(async (name, i) => {
      const icon = await sharp(path.join(out, name + ".svg"))
        .resize(24, 24)
        .png()
        .toBuffer();
      const label = Buffer.from(
        `<svg width="180" height="60"><rect width="180" height="60" fill="white"/><text x="90" y="51" text-anchor="middle" font-size="12" font-family="sans-serif">${name}</text></svg>`,
      );
      return [
        { input: label, left: (i % 6) * 180, top: Math.floor(i / 6) * 70 },
        {
          input: icon,
          left: (i % 6) * 180 + 78,
          top: Math.floor(i / 6) * 70 + 3,
        },
      ];
    }),
  );
  await sharp({
    create: { width: 1080, height: 350, channels: 4, background: "white" },
  })
    .composite(cells.flat())
    .png()
    .toFile(path.join(out, "preview-24px.png"));
  console.log(
    "Generated 30 SVGs and 90 PNGs. Adaptive whitespace grid:",
    xb,
    yb,
  );
})();
