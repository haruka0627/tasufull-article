#!/usr/bin/env node
import fs from "node:fs";

const [a, b] = process.argv.slice(2);
const A = fs.readFileSync(a, "utf8").split("\n");
const B = fs.readFileSync(b, "utf8").split("\n");
const max = Math.max(A.length, B.length);
let diff = 0;
for (let i = 0; i < max; i++) {
  if (A[i] !== B[i]) {
    diff++;
    if (diff <= 25) {
      console.log(`--- line ${i + 1}`);
      console.log("CUR:", (A[i] || "").slice(0, 120));
      console.log("BAK:", (B[i] || "").slice(0, 120));
    }
  }
}
console.log("total diff lines:", diff);
