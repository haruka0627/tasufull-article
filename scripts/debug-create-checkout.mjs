import { readFileSync } from "node:fs";
const k = readFileSync("chat-supabase-config.js", "utf8").match(/anonKey:\s*"([^"]+)"/)[1];
for (const plan of ["genai_basic_300", "genai_pro_980"]) {
  const r = await fetch(
    "https://ddojquacsyqesrjhcvmn.supabase.co/functions/v1/stripe-create-genai-checkout",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${k}`, apikey: k },
      body: JSON.stringify({ genai_plan: plan, user_id: "u_test", origin: "http://127.0.0.1:5173" }),
    }
  );
  console.log(plan, r.status, (await r.json()).ok ? "OK" : await r.text());
}
