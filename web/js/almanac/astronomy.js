// 天文基础算法。基于 Jean Meeus《天文算法》简化版 + 寿星天文历（许剑伟）口径。
// 时间基准：力学时(JD) vs 世界时(UT)，用 ΔT 经验公式修正。
// 太阳视黄经含章动(月升交点平黄经)与光行差(-20.5")修正。
//
// 约定：
// - toJD / fromJD 处理世界时 UT（调用方自行处理时区）。
// - sunLongitude / moonLongitude 内部转力学时后再算黄经。
// - 所有黄经返回值：度，范围 0-360。

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

// 公历日期(UT) → 儒略日 JD(UT)。
export function toJD(year, month, day, hour = 0, min = 0, sec = 0) {
  if (month <= 2) {
    year -= 1;
    month += 12;
  }
  const A = Math.floor(year / 100);
  const B = 2 - A + Math.floor(A / 4);
  const ut = (hour + min / 60 + sec / 3600) / 24;
  return (
    Math.floor(365.25 * (year + 4716)) +
    Math.floor(30.6001 * (month + 1)) +
    day +
    B -
    1524.5 +
    ut
  );
}

// JD(UT) → 公历 {y,m,d,h,mi,s}。日期为世界时，时区由调用方处理。
export function fromJD(jd) {
  jd += 0.5;
  const Z = Math.floor(jd);
  const F = jd - Z;
  let A = Z;
  if (Z >= 2299161) {
    const a = Math.floor((Z - 1867216.25) / 36524.25);
    A = Z + 1 + a - Math.floor(a / 4);
  }
  const B = A + 1524;
  const C = Math.floor((B - 122.1) / 365.25);
  const D = Math.floor(365.25 * C);
  const E = Math.floor((B - D) / 30.6001);
  const day = B - D - Math.floor(30.6001 * E);
  const month = E < 14 ? E - 1 : E - 13;
  const year = month > 2 ? C - 4716 : C - 4715;
  const totalSec = F * 86400;
  const h = Math.floor(totalSec / 3600);
  const mi = Math.floor((totalSec % 3600) / 60);
  const s = Math.floor(totalSec % 60);
  return { y: year, m: month, d: day, h, mi, s };
}

// ΔT(力学时-世界时，单位秒)。2000-2100 / 1900-2000 经验公式，其余兜底。
// 出处：Espenak & Meeus 经验拟合（寿星天文历采用同一族公式）。
function deltaT(year) {
  const t = (year - 2000) / 100;
  if (year >= 2000 && year < 2100) {
    return 102 + 102 * t + 25.3 * t * t;
  }
  if (year >= 1900 && year < 2000) {
    const t1 = (year - 1900) / 100;
    return -2.44 + 87.36 * t1 + 5.9 * t1 * t1;
  }
  if (year >= 2100 && year < 2200) {
    return 102 + 102 * t + 25.3 * t * t + 0.37 * t * t * t;
  }
  return 69; // 兜底
}

// JD(UT) → JD(力学时)
function toDynamical(jd) {
  const year = fromJD(jd).y;
  return jd + deltaT(year) / 86400;
}

// 角度归一化到 [0,360)
function norm360(deg) {
  return ((deg % 360) + 360) % 360;
}

// 太阳视黄经（度，0-360）。输入 jd(UT)。
// 采用 Meeus《天文算法》25.4 经典度制公式（平黄经基准），含章动与光行差修正。
export function sunLongitude(jd) {
  const jdk = toDynamical(jd);
  const T = (jdk - 2451545.0) / 36525; // 儒略世纪（注意：世纪，非千年）
  const T2 = T * T;

  // 太阳几何平黄经（度制，Meeus 25.2）
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T2;

  // 太阳平近点角（度制，Meeus 25.3）
  const M = 357.52911 + 35999.05029 * T - 0.0001537 * T2;
  const Mrad = M * RAD;

  // 中心差（地球轨道方程，度制，Meeus 25.4）
  const C =
    (1.914602 - 0.004817 * T - 0.000014 * T2) * Math.sin(Mrad) +
    (0.019993 - 0.000101 * T) * Math.sin(2 * Mrad) +
    0.000289 * Math.sin(3 * Mrad);

  // 太阳真黄经（度）
  const sunTrue = L0 + C;

  // 章动修正（黄经章动，简化单项主项）。Ω = 月升交点平黄经。
  const omega = 125.04452 - 1934.136261 * T;
  const nutationLong = (-17.2 * Math.sin(omega * RAD)) / 3600; // 度

  // 光行差修正（约 -20.5"，Meeus 用 -20.4898"/r）。
  const aberration = -20.4898 / 3600; // 度

  // 视黄经 = 真黄经 + 章动 + 光行差
  return norm360(sunTrue + nutationLong + aberration);
}

// 月亮视黄经（度，0-360）。输入 jd(UT)。
// 采用 Meeus《天文算法》第47章月历表的主要周期项（ELP2000 同族简化），用于定朔。
export function moonLongitude(jd) {
  const jdk = toDynamical(jd);
  const T = (jdk - 2451545.0) / 36525; // 世纪
  const T2 = T * T;
  const T3 = T2 * T;
  const T4 = T3 * T;

  // 平参数（Meeus 47.1）
  const Lp = norm360(218.3164591 + 481267.88134236 * T - 0.0013268 * T2 + T3 / 538841 + T4 / 65194000); // 月亮平黄经
  const D = 297.8501921 + 445267.1114034 * T - 0.00163 * T2 + T3 / 545868 - T4 / 113065000; // 月日距角
  const M = 357.5291092 + 35999.0502909 * T - 0.0001536 * T2 + T3 / 24490000; // 太阳平近点角
  const Mp = 134.9633964 + 477198.8675055 * T + 0.0087414 * T2 + T3 / 69699 - T4 / 14712000; // 月亮平近点角
  const F = 93.2720950 + 483202.0175233 * T - 0.0036539 * T2 - T3 / 3526000 + T4 / 863310000; // 月升交点距角

  const dRad = D * RAD;
  const mRad = M * RAD;
  const mpRad = Mp * RAD;
  const fRad = F * RAD;

  // 主要正弦周期项（度，Meeus 47.A 表前若干主项）
  let sum =
    6.288774 * Math.sin(mpRad) +
    1.274011 * Math.sin(2 * dRad - mpRad) +
    0.658311 * Math.sin(2 * dRad) +
    0.213618 * Math.sin(2 * mpRad) -
    0.185118 * Math.sin(mRad) -
    0.114332 * Math.sin(2 * fRad) +
    0.058793 * Math.sin(2 * dRad - 2 * mpRad) +
    0.057066 * Math.sin(2 * dRad - mRad - mpRad) +
    0.053322 * Math.sin(2 * dRad + mpRad) +
    0.045758 * Math.sin(2 * dRad - mRad) -
    0.040923 * Math.sin(mRad - mpRad) -
    0.034720 * Math.sin(dRad) -
    0.030383 * Math.sin(mRad + mpRad);

  return norm360(Lp + sum);
}

// 定气：太阳视黄经达到 targetLongitude 度的精确时刻(jd, UT)。
// jdApprox 为近似时刻。太阳黄经随时间单调递增，用线性反推迭代求根。
export function solarTermJD(jdApprox, targetLongitude) {
  let jd = jdApprox;
  for (let i = 0; i < 30; i++) {
    const lon = sunLongitude(jd);
    let diff = lon - targetLongitude;
    diff = norm360(diff);
    if (diff > 180) diff -= 360; // 取 -180..180
    if (Math.abs(diff) < 0.0001) break;
    // 太阳平均角速度约 0.9856473 度/日
    jd -= diff / 0.9856473;
  }
  return jd;
}

// 定朔：日月视黄经相等的精确时刻(jd, UT)。
// jdApprox 为近似时刻。月亮相对太阳每天前进约 12.19 度。
export function newMoonJD(jdApprox) {
  let jd = jdApprox;
  for (let i = 0; i < 25; i++) {
    const sl = sunLongitude(jd);
    const ml = moonLongitude(jd);
    let diff = ml - sl;
    diff = norm360(diff);
    if (diff > 180) diff -= 360; // -180..180
    if (Math.abs(diff) < 0.0001) break;
    // 月相对日每天前进约 12.19 度
    jd -= diff / 12.19;
  }
  return jd;
}
