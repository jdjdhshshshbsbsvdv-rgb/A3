import axios from "axios";
import crypto from "node:crypto";
const COOKIE = "webid=1776941875581cyaokuxv; __locale=en; usertoken=eyJhbGciOiJIUzI1NiJ9.eyJtb2JpbGUiOiIiLCJuaWNrbmFtZSI6Ik9NQVIgISIsImF2YXRhciI6IiIsInVzZXJJZCI6MTU0MTYyMTksInV1aWQiOiJhNGQ0MzI3YzIwOTY0Yzc4OTEyMTc4NDFkNWQ3N2NmMSIsImVtYWlsIjoiamF1cmVzLmV4QGdtYWlsLmNvbSIsImNyZWF0ZUF0IjoxNzc2OTQyMDAxMDAwLCJqdGkiOiJtelY5bmhOWk00Iiwic3ViIjoiT01BUiAhIiwiaWF0IjoxNzc2OTQyMDAxLCJpc3MiOiJsb3ZhcnQtYXV0aCIsImV4cCI6MTc3NzU0NjgwMX0.lIslVrZaA091K6NburqaRqokUIiaALZ9Ytti8WmvNTg; useruuid=a4d4327c20964c7891217841d5d77cf1";
const TOKEN = COOKIE.match(/usertoken=([^;]+)/)[1];
const H = (path) => ({
  "user-agent":"Mozilla/5.0", cookie: COOKIE, token: TOKEN, language:"en","x-language":"en",
  "x-trace-id": crypto.randomUUID().replace(/-/g,""),
  origin:"https://www.lovart.ai", referer:"https://www.lovart.ai"+path,
  "content-type":"application/json",
});
async function J(method, path, data, ref="/tools/veo3.1") {
  const r = await axios({ method, url:"https://www.lovart.ai"+path, headers: H(ref), data, timeout:30000, validateStatus:()=>true });
  return r;
}
const tries = [
  ["GET", "/api/canva/agent/v1/generators/tasks", null],
  ["POST", "/api/canva/agent/v1/generators/task", { name:"wan/wan-2-6", input:{prompt:"cat"} }],
  ["POST", "/api/canva/agent/v1/generators/run", { name:"wan/wan-2-6", input:{prompt:"cat"} }],
  ["POST", "/api/canva/agent/v1/generators/submit", { name:"wan/wan-2-6", input:{prompt:"cat"} }],
  ["POST", "/api/canva/agent/v1/generators/create", { name:"wan/wan-2-6", input:{prompt:"cat"} }],
  ["POST", "/api/canva/agent/v1/generators/invoke", { name:"wan/wan-2-6", input:{prompt:"cat"} }],
  ["POST", "/api/canva/agent/v1/generator/tasks", { name:"wan/wan-2-6", input:{prompt:"cat"} }],
  // What about taskInfo to see expected body?
  ["POST", "/api/canva/agent/v1/generators/taskInfo", { taskId:"x" }],
  ["POST", "/api/canva/agent/v1/generators/taskInfo", { task_id:"x" }],
  ["POST", "/api/canva/agent/v1/generators/taskInfo", { id:"x" }],
];
for (const [m,p,b] of tries) {
  const r = await J(m,p,b);
  console.log(m,p,"->",r.status, JSON.stringify(r.data).slice(0,200));
}
