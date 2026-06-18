import fs from "fs";

const path = "detail-shop-retail.css";
let css = fs.readFileSync(path, "utf8");
const profiles = ["retail", "goods_interior", "vintage_brand"];

function profileSelectors(suffix) {
  return profiles.map((p) => `body.shop-detail-page[data-shop-category-profile="${p}"]${suffix}`).join(",\n");
}

css = css.replace(
  /body\.shop-detail-page\[data-shop-category-profile="retail"\],\s*\nbody\.shop-detail-page\[data-shop-category-profile="goods_interior"\] ([^{\n]+)/g,
  (_, rest) => profileSelectors(` ${rest.trim()}`)
);

css = css.replace(
  /body\.shop-detail-page\[data-shop-category-profile="retail"\],\s*\nbody\.shop-detail-page\[data-shop-category-profile="goods_interior"\] \{/g,
  `${profileSelectors("")} {`
);

fs.writeFileSync(path, css);
console.log("patched", path);
