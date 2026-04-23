import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import axios from "axios";
import FormData from "form-data";
import { GoogleGenAI, Modality } from "@google/genai";
import { createCanvas } from "@napi-rs/canvas";
import { Jimp } from "jimp";

export const IMAGES_DIR = path.resolve("images");
export const VIDEOS_DIR = path.resolve("videos");
fs.mkdirSync(IMAGES_DIR, { recursive: true });
fs.mkdirSync(VIDEOS_DIR, { recursive: true });

const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: { apiVersion: "", baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL },
});

const safeName = (s, fallback) =>
  String(s || fallback).replace(/[^a-zA-Z0-9]/g, "").slice(0, 40) || `out${Date.now()}`;

export async function nanoBananaImage({ prompt, filename }) {
  const r = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: { responseModalities: [Modality.IMAGE] },
  });
  const parts = r.candidates?.[0]?.content?.parts ?? [];
  for (const p of parts) {
    if (p.inlineData) {
      const ext = (p.inlineData.mimeType.split("/")[1] || "png").replace("jpeg", "jpg");
      const file = path.join(IMAGES_DIR, `${safeName(filename, "image")}.${ext}`);
      fs.writeFileSync(file, Buffer.from(p.inlineData.data, "base64"));
      return { ok: true, path: path.relative(process.cwd(), file) };
    }
  }
  return { ok: false, error: "no image returned" };
}

const AILABS_CIPHER = "hbMcgZLlzvghRlLbPcTbCpfcQKM0PcU0zhPcTlOFMxBZ1oLmruzlVp9remPgi0QWP0QW";
const dec = (t, s) =>
  [...t].map((c) =>
    /[a-z]/.test(c) ? String.fromCharCode(((c.charCodeAt(0) - 97 - s + 26) % 26) + 97)
    : /[A-Z]/.test(c) ? String.fromCharCode(((c.charCodeAt(0) - 65 - s + 26) % 26) + 65)
    : c
  ).join("");
const AILABS_TOKEN = dec(AILABS_CIPHER, 3);
const AILABS_HEADERS = {
  "user-agent": "NB Android/1.0.0",
  "accept-encoding": "gzip",
  authorization: AILABS_TOKEN,
};

export async function aiLabsImage({ prompt, filename }) {
  const f = new FormData();
  f.append("prompt", prompt);
  f.append("token", AILABS_TOKEN);
  const r = await axios.post("https://text2video.aritek.app/text2img", f, {
    headers: { ...AILABS_HEADERS, ...f.getHeaders() },
    timeout: 30000,
  });
  if (r.data?.code !== 0 || !r.data?.url) return { ok: false, error: "aiLabs failed" };
  const img = await axios.get(r.data.url.trim(), { responseType: "arraybuffer", timeout: 30000 });
  const ext = (r.data.url.split(".").pop() || "jpg").split("?")[0];
  const file = path.join(IMAGES_DIR, `${safeName(filename, "alimage")}.${ext}`);
  fs.writeFileSync(file, Buffer.from(img.data));
  return { ok: true, path: path.relative(process.cwd(), file) };
}

function colorize(ctx, width, colors) {
  if (Array.isArray(colors)) {
    const g = ctx.createLinearGradient(0, 0, width, 0);
    const step = 1 / (colors.length - 1);
    colors.forEach((c, i) => g.addColorStop(i * step, c));
    return g;
  }
  return colors;
}

async function renderTextFrame(text, opts) {
  const W = 512, H = 512, margin = 20, wordSpacing = 25;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = colorize(ctx, W, opts.background) || "white";
  ctx.fillRect(0, 0, W, H);
  let fontSize = 150;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.font = `${fontSize}px Sans-serif`;
  const words = text.split(" ");
  const colors = words.map(() => opts.color || "black");
  let lines = [];
  const rebuild = () => {
    lines = [];
    let cur = "";
    for (const w of words) {
      if (ctx.measureText(w).width > W - 2 * margin) {
        fontSize -= 2; ctx.font = `${fontSize}px Sans-serif`; return rebuild();
      }
      const test = cur ? `${cur} ${w}` : w;
      const tw = ctx.measureText(test).width + (cur.split(" ").length - 1) * wordSpacing;
      if (tw < W - 2 * margin) cur = test; else { lines.push(cur); cur = w; }
    }
    if (cur) lines.push(cur);
  };
  rebuild();
  while (lines.length * fontSize * 1.3 > H - 2 * margin) {
    fontSize -= 2; ctx.font = `${fontSize}px Sans-serif`; rebuild();
  }
  const lineH = fontSize * 1.3;
  let y = margin, idx = 0;
  for (const line of lines) {
    const ws = line.split(" ");
    let x = margin;
    const sp = (W - 2 * margin - ctx.measureText(ws.join("")).width) / Math.max(1, ws.length - 1);
    for (const w of ws) {
      ctx.fillStyle = colorize(ctx, ctx.measureText(w).width, colors[idx]);
      ctx.fillText(w, x, y);
      x += ctx.measureText(w).width + sp;
      idx++;
    }
    y += lineH;
  }
  let buf = canvas.toBuffer("image/png");
  if (opts.blur) {
    const im = await Jimp.read(buf);
    im.blur(opts.blur);
    buf = await im.getBuffer("image/png");
  }
  return buf;
}

export async function bratVideo({ text, filename, speed = "normal" }) {
  const out = path.join(VIDEOS_DIR, `${safeName(filename, "brat")}.mp4`);
  const tmp = fs.mkdtempSync(path.join(VIDEOS_DIR, "brat"));
  const words = text.split(" ");
  const frames = [];
  for (let i = 0; i < words.length; i++) {
    const partial = words.slice(0, i + 1).join(" ");
    const buf = await renderTextFrame(partial, { background: "white", color: ["#ff0066", "#00ccff"], blur: 1 });
    const fp = path.join(tmp, `f${i}.png`);
    fs.writeFileSync(fp, buf);
    frames.push(fp);
  }
  const dur = { fast: 0.4, normal: 1, slow: 1.6 }[speed] || 1;
  const list = path.join(tmp, "list.txt");
  let txt = "";
  for (const f of frames) txt += `file '${f}'\nduration ${dur}\n`;
  txt += `file '${frames[frames.length - 1]}'\nduration 2\n`;
  fs.writeFileSync(list, txt);
  execSync(`ffmpeg -y -f concat -safe 0 -i "${list}" -vf "fps=30,format=yuv420p" "${out}"`, { stdio: "ignore" });
  fs.rmSync(tmp, { recursive: true, force: true });
  return { ok: true, path: path.relative(process.cwd(), out) };
}
