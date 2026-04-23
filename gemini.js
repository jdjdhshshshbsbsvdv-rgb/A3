import { GoogleGenAI, Type } from "@google/genai";
import readline from "node:readline";
import { nanoBananaImage, aiLabsImage, bratVideo, soraVideo } from "./tools.js";

if (!process.env.AI_INTEGRATIONS_GEMINI_BASE_URL || !process.env.AI_INTEGRATIONS_GEMINI_API_KEY) {
  console.error("Missing Gemini env vars."); process.exit(1);
}

const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: { apiVersion: "", baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL },
});

const C = { cyan: "\x1b[36m", green: "\x1b[32m", yellow: "\x1b[33m", magenta: "\x1b[35m", dim: "\x1b[2m", reset: "\x1b[0m" };

const PERSONA = `أنت عمر، شاب مغربي ودود وذكي من الدار البيضاء. تجمع روح جيميني الفضولية مع قدرات نانو بانا في الصور وقدرات أيلابز كبديل وقدرات برات في تحريك النصوص كفيديو.
أسلوبك مرح، يخلط بين الدارجة المغربية والفصحى، والإنجليزية فقط عند الحاجة.
لا تستعمل أبداً الشرطة السفلية ولا الشرطة العادية داخل أي كلمة في ردودك.
عندك أربع أدوات وكتختار وحدة بدون انتظار أي أمر صريح:
- nanoBananaImage: للصور الواقعية أو الفنية الراقية، عطيها وصف إنجليزي مفصل.
- aiLabsImage: بديل مجاني للصور لمّا المستخدم يطلب نمط مختلف أو لمّا الأولى تفشل.
- soraVideo: لمّا المستخدم يطلب فيديو حقيقي مولد بالذكاء (تيكست تو فيديو سورا)، عطيها وصف إنجليزي قصير.
- bratVideo: مني المستخدم يعطيك نص قصير وتحس أنه يستحق فيديو نصي متحرك بألوان، استعمله مباشرة.
نادي الأدوات تلقائياً، وبعد كل ناتج علق بجملة قصيرة بأسلوبك المغربي.`;

const tools = [{
  functionDeclarations: [
    {
      name: "nanoBananaImage",
      description: "Photoreal or artistic image via nano banana (best quality).",
      parameters: { type: Type.OBJECT, properties: {
        prompt: { type: Type.STRING, description: "Detailed English visual description." },
        filename: { type: Type.STRING, description: "Short ascii letters only, no extension." },
      }, required: ["prompt", "filename"] },
    },
    {
      name: "aiLabsImage",
      description: "Free alternative image generator. Use for variety or as fallback.",
      parameters: { type: Type.OBJECT, properties: {
        prompt: { type: Type.STRING, description: "English visual description, ascii only." },
        filename: { type: Type.STRING, description: "Short ascii letters only, no extension." },
      }, required: ["prompt", "filename"] },
    },
    {
      name: "soraVideo",
      description: "AI text to video (Sora style). Generates a real generated video clip from a short English prompt.",
      parameters: { type: Type.OBJECT, properties: {
        prompt: { type: Type.STRING, description: "Short English visual scene description." },
        filename: { type: Type.STRING, description: "Short ascii letters only, no extension." },
      }, required: ["prompt", "filename"] },
    },
    {
      name: "bratVideo",
      description: "Animated brat-style text video (typewriter + colors). Use when user gives a short phrase that suits a text video.",
      parameters: { type: Type.OBJECT, properties: {
        text: { type: Type.STRING, description: "Short text to animate." },
        filename: { type: Type.STRING, description: "Short ascii letters only, no extension." },
        speed: { type: Type.STRING, description: "fast | normal | slow" },
      }, required: ["text", "filename"] },
    },
  ],
}];

const impl = { nanoBananaImage, aiLabsImage, soraVideo, bratVideo };
const labels = { nanoBananaImage: "صورة (نانو بانا)", aiLabsImage: "صورة (أيلابز)", soraVideo: "فيديو (سورا)", bratVideo: "فيديو (برات)" };

const history = [];

async function turn(userText) {
  history.push({ role: "user", parts: [{ text: userText }] });
  while (true) {
    const res = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: history,
      config: { systemInstruction: PERSONA, tools, maxOutputTokens: 8192 },
    });
    const parts = res.candidates?.[0]?.content?.parts ?? [];
    const calls = parts.filter((p) => p.functionCall);
    const text = parts.filter((p) => p.text).map((p) => p.text).join("");
    if (text) console.log(`${C.cyan}عمر:${C.reset} ${text}`);
    if (calls.length === 0) { history.push({ role: "model", parts }); return; }
    history.push({ role: "model", parts });
    const responses = [];
    for (const c of calls) {
      const fc = c.functionCall;
      console.log(`${C.dim}(${labels[fc.name] || fc.name} ...)${C.reset}`);
      try {
        const out = await impl[fc.name](fc.args || {});
        if (out.ok) console.log(`${C.green}ملف:${C.reset} ${out.path}`);
        else console.log(`${C.yellow}تعذر:${C.reset} ${out.error}`);
        responses.push({ functionResponse: { name: fc.name, response: out } });
      } catch (e) {
        console.log(`${C.yellow}خطأ:${C.reset} ${e.message}`);
        responses.push({ functionResponse: { name: fc.name, response: { ok: false, error: String(e.message || e) } } });
      }
    }
    history.push({ role: "user", parts: responses });
  }
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
console.log(`${C.magenta}عمر — Gemini × Nano Banana × AiLabs × Brat${C.reset}\n${C.dim}اكتب أي شيء.${C.reset}\n`);
rl.setPrompt(`${C.green}أنت:${C.reset} `);
rl.prompt();
rl.on("line", async (line) => {
  const input = line.trim();
  if (!input) return rl.prompt();
  rl.pause();
  try { await turn(input); } catch (e) { console.error(`${C.yellow}خطأ:${C.reset} ${e.message}`); }
  rl.resume(); rl.prompt();
});
rl.on("close", () => process.exit(0));
