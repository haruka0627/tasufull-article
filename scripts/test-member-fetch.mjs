import { readFileSync } from "node:fs";

const m = readFileSync("chat-supabase-config.js", "utf8");
const url = m.match(/url:\s*"([^"]+)"/)?.[1];
const key = m.match(/anonKey:\s*"([^"]+)"/)?.[1];
const headers = { apikey: key, Authorization: `Bearer ${key}` };

for (const table of ["members", "users", "profiles"]) {
  const res = await fetch(`${url}/rest/v1/${table}?select=*&user_id=eq.u_me`, {
    headers,
  });
  const body = await res.json();
  console.log(table, res.status, body);
}

const usersRes = await fetch(`${url}/rest/v1/users?select=*&id=eq.u_me`, {
  headers,
});
console.log("users by id", usersRes.status, await usersRes.json());
