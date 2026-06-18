import fs from "fs";
const s = fs.readFileSync("shop-vendors.html", "utf8");
console.log("len", s.length);
console.log(s.slice(0, 200));
console.log("data-page", s.includes('data-page="shop_store_list"'));
console.log("shop-store-page.js", s.includes("shop-store-page.js"));
console.log("shop-store-cards.css", s.includes("shop-store-cards.css"));
console.log("shop-vendors action", s.includes('action="shop-vendors.html"'));
