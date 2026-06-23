#!/usr/bin/env node
import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://127.0.0.1:8788";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(`${BASE}/company/`, { waitUntil: "networkidle" });

const data = await page.evaluate(() => {
  const hero = document.querySelector(".tasful-hero");
  const heroRect = hero.getBoundingClientRect();
  const pick = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top: Math.round(r.top - heroRect.top), bottom: Math.round(r.bottom - heroRect.top), w: Math.round(r.width), h: Math.round(r.height) };
  };
  const bg = document.querySelector(".tasful-hero__bg");
  return {
    heroH: Math.round(heroRect.height),
    heroClass: hero.className,
    bgSrc: bg?.getAttribute("src"),
    logo: pick(".tasful-logo-main"),
    catch: pick(".tasful-hero__catch"),
    sub: pick(".hero-container"),
    btn: pick(".neon-btn"),
    card: pick(".hero-card--construction .neon-card"),
  };
});
console.log(JSON.stringify(data, null, 2));
await browser.close();
