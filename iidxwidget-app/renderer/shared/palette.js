// 스크래치 이미지에서 위젯 색상 세트를 추천한다. 브라우저에서는 window.palette, node(테스트)에서는 module.exports로 쓴다.
// 방법: 픽셀을 사람 눈 기준 색 공간(OKLab)으로 바꿔 k-means로 대표 색을 뽑고,
//   - 대표 색(면적이 크고 채도가 있는 색) → 배경·입력 전·글자색의 색조
//   - 강조 색(채도와 밝기가 높아 눈에 띄는 색) → 입력 중 색
//   - 강조 색과 색조가 확실히 다른 색 → 롱노트 색
// 으로 나눈다. 원판은 원형으로 잘려 보이므로 가운데 픽셀에 가중치를 더 준다 (주인공이 보통 가운데 있다).
(function (root) {
  // ─── 색 변환 (sRGB ↔ OKLab / OKLCH) ─────────────
  const toLinear = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const toGamma = c => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

  function rgbToOklab(r, g, b) {
    const R = toLinear(r / 255), G = toLinear(g / 255), B = toLinear(b / 255);
    const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
    const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
    const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
    return [
      0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
    ];
  }

  function oklabToLinearRgb(L, a, b) {
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
    return [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
    ];
  }

  // OKLCH → '#rrggbb'. 화면에 낼 수 없는 색이면 색조와 밝기는 두고 채도만 줄인다
  function oklchToHex(L, C, h) {
    let chroma = Math.max(0, C);
    let rgb;
    for (let i = 0; i < 40; i++) {
      rgb = oklabToLinearRgb(L, chroma * Math.cos(h), chroma * Math.sin(h));
      if (rgb.every(v => v >= -0.0005 && v <= 1.0005)) break;
      chroma *= 0.9;
    }
    return '#' + rgb.map(v => Math.round(Math.min(1, Math.max(0, toGamma(Math.min(1, Math.max(0, v))))) * 255).toString(16).padStart(2, '0')).join('');
  }

  const chromaOf = (a, b) => Math.hypot(a, b);
  const hueOf = (a, b) => Math.atan2(b, a);
  const hueDistance = (h1, h2) => { const d = Math.abs(h1 - h2) % (2 * Math.PI); return d > Math.PI ? 2 * Math.PI - d : d; };
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const DEG = Math.PI / 180;

  // ─── 픽셀 → 가중치가 붙은 OKLab 점 ─────────────
  function samplePoints(rgba, width, height) {
    const points = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const alpha = rgba[i + 3] / 255;
        if (alpha < 0.5) continue; // 투명한 부분은 원판에 안 보인다
        const dx = (x + 0.5) / width * 2 - 1, dy = (y + 0.5) / height * 2 - 1;
        const r2 = dx * dx + dy * dy;
        const spatial = r2 > 1 ? 0.1 : 1 - 0.5 * r2; // 원 밖(모서리)은 거의 안 보이고, 가운데일수록 중요
        const [L, a, b] = rgbToOklab(rgba[i], rgba[i + 1], rgba[i + 2]);
        points.push({ L, a, b, w: alpha * spatial });
      }
    }
    return points;
  }

  // ─── k-means (결과가 매번 같도록 시작점을 정해서 고른다) ─────────────
  function kmeans(points, k = 6, iterations = 12) {
    if (!points.length) return [];
    const dist2 = (p, c) => (p.L - c.L) ** 2 + (p.a - c.a) ** 2 + (p.b - c.b) ** 2;
    // 시작점: 가중 평균 → 그다음부터는 기존 중심들에서 가장 먼 점 (가중치 반영)
    const total = points.reduce((s, p) => s + p.w, 0);
    const centers = [{
      L: points.reduce((s, p) => s + p.L * p.w, 0) / total,
      a: points.reduce((s, p) => s + p.a * p.w, 0) / total,
      b: points.reduce((s, p) => s + p.b * p.w, 0) / total
    }];
    while (centers.length < k) {
      let best = null, bestScore = -1;
      for (const p of points) {
        const score = p.w * Math.min(...centers.map(c => dist2(p, c)));
        if (score > bestScore) { bestScore = score; best = p; }
      }
      if (!best || bestScore <= 1e-9) break;
      centers.push({ L: best.L, a: best.a, b: best.b });
    }
    let groups = [];
    for (let it = 0; it < iterations; it++) {
      groups = centers.map(() => ({ L: 0, a: 0, b: 0, w: 0 }));
      for (const p of points) {
        let nearest = 0, nd = Infinity;
        centers.forEach((c, i) => { const d = dist2(p, c); if (d < nd) { nd = d; nearest = i; } });
        const g = groups[nearest];
        g.L += p.L * p.w; g.a += p.a * p.w; g.b += p.b * p.w; g.w += p.w;
      }
      groups.forEach((g, i) => { if (g.w > 0) centers[i] = { L: g.L / g.w, a: g.a / g.w, b: g.b / g.w }; });
    }
    const totalW = groups.reduce((s, g) => s + g.w, 0) || 1;
    return centers.map((c, i) => ({ ...c, C: chromaOf(c.a, c.b), h: hueOf(c.a, c.b), share: groups[i].w / totalW }))
      .filter(c => c.share > 0);
  }

  // ─── 역할 나누기 ─────────────
  const CHROMATIC = 0.035; // 이보다 채도가 낮으면 무채색으로 본다

  function paletteFromClusters(clusters) {
    if (!clusters.length) return null;
    // 대표 색: 면적이 크고 채도가 있는 색. 채도 있는 색이 없으면 무채색 테마
    const chromatic = clusters.filter(c => c.C >= CHROMATIC && c.share >= 0.04);
    const dominant = chromatic.length
      ? chromatic.reduce((best, c) => (c.share * (0.4 + 0.6 * Math.min(c.C, 0.15) / 0.15) > best.share * (0.4 + 0.6 * Math.min(best.C, 0.15) / 0.15) ? c : best))
      : { ...clusters.reduce((a, b) => (a.share > b.share ? a : b)), C: 0 };

    // 강조 색: 눈에 띄는 색. 밝기는 어차피 밝게 올려 쓰므로 채도를 가장 크게 본다
    const visible = clusters.filter(c => c.share >= 0.02);
    const salience = c => c.C * 3 + c.L * 0.25 + (c.C >= CHROMATIC ? 0.1 : 0);
    const active = visible.reduce((a, b) => (salience(b) > salience(a) ? b : a), visible[0] || clusters[0]);
    const activeIsNeutral = active.C < 0.06;

    // 롱노트 색: 강조 색과 색조가 60도 이상 다르고 면적도 어느 정도 있는 색.
    // 없으면 강조 색이 무채색일 때는 대표 색조를 진하게, 아니면 강조 색에서 90도 돌린 색조
    const others = clusters.filter(c => c.share >= 0.05 && c.C >= 0.05 && (activeIsNeutral || hueDistance(c.h, active.h) >= 60 * DEG));
    let ln = others.length ? others.reduce((a, b) => (b.C * b.share ** 0.3 > a.C * a.share ** 0.3 ? b : a)) : null;
    if (!ln) {
      if (activeIsNeutral && dominant.C >= CHROMATIC) ln = { h: dominant.h, C: 0.12 };
      else if (activeIsNeutral) ln = { h: 70 * DEG, C: 0.13 }; // 무채색 이미지: 기본 롱노트 색(호박색) 계열
      else {
        // 강조 색이 차가운 색이면 기본 롱노트 색(호박색, 약 70도)에 가까운 따뜻한 쪽으로 90도,
        // 강조 색 자체가 따뜻한 색(호박색에서 60도 안)이면 차가운 쪽(+110도, 하늘색 계열)으로 대비를 준다
        const AMBER = 70 * DEG;
        if (hueDistance(active.h, AMBER) < 60 * DEG) ln = { h: active.h + 110 * DEG, C: 0.12 };
        else {
          const a = active.h + 90 * DEG, b = active.h - 90 * DEG;
          ln = { h: hueDistance(a, AMBER) <= hueDistance(b, AMBER) ? a : b, C: 0.12 };
        }
      }
    }

    const h = dominant.h, dc = dominant.C;
    return {
      containerBackground: oklchToHex(0.17, Math.min(dc, 0.045), h),
      background: oklchToHex(0.23, Math.min(dc, 0.06), h),
      accent: oklchToHex(0.40, Math.min(dc, 0.09), h),
      fontColor: oklchToHex(0.94, Math.min(dc * 0.35, 0.035), h),
      // 강조 색이 무채색이면(흑백 사진 등) 대표 색조를 밝게 써서 배경과 어울리게 한다
      activeColor: activeIsNeutral
        ? oklchToHex(0.9, clamp(dc, 0.03, 0.06), h)
        : oklchToHex(clamp(active.L, 0.8, 0.9), clamp(active.C * 1.15, 0, 0.17), active.h),
      lnColor: oklchToHex(0.8, clamp(ln.C, 0.09, 0.15), ln.h)
    };
  }

  // rgba: 픽셀 배열(RGBA 순서), width·height: 크기 (64×64 정도로 줄여서 넘기면 충분하다). 투명한 이미지면 null
  function paletteFromPixels(rgba, width, height) {
    return paletteFromClusters(kmeans(samplePoints(rgba, width, height)));
  }

  const PALETTE_KEYS = ['containerBackground', 'background', 'accent', 'fontColor', 'activeColor', 'lnColor'];
  const isPalette = value => !!value && typeof value === 'object' && PALETTE_KEYS.every(key => /^#[0-9a-f]{6}$/i.test(value[key]));

  const clustersFromPixels = (rgba, width, height) => kmeans(samplePoints(rgba, width, height));
  const api = { paletteFromPixels, paletteFromClusters, clustersFromPixels, rgbToOklab, oklchToHex, isPalette, PALETTE_KEYS };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.palette = api;
})(typeof window !== 'undefined' ? window : globalThis);
