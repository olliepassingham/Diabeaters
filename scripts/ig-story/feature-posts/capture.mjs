import { chromium } from "playwright";
import { fileURLToPath } from "url";
import path from "path";

const dir = path.dirname(fileURLToPath(import.meta.url));

const posts = [
  {
    file: "01-home-1080x1350.png",
    shot: "home-crop.png",
    kicker: "Home",
    title: "The day, <em>before it starts</em>",
    sub: "Live glucose, the next step, and help close by.",
  },
  {
    file: "02-bedtime-1080x1350.png",
    shot: "bedtime-crop.png",
    kicker: "Bedtime",
    title: "Last night, <em>already counted</em>",
    sub: "The overnight low, time in target, and the shape of the night.",
  },
  {
    file: "03-exercise-1080x1350.png",
    shot: "exercise-crop.png",
    kicker: "Exercise",
    title: "Carbs, ready <em>before you start</em>",
    sub: "Alerts, fast carbs, and the gel you already use.",
  },
  {
    file: "04-feed-1080x1350.png",
    shot: "feed-crop.png",
    kicker: "Community",
    title: "Out for food. <em>Still in range.</em>",
    sub: "A feed of people living with Type 1.",
  },
  {
    file: "05-supporter-1080x1350.png",
    shot: "supporter-crop.png",
    kicker: "Supporter",
    title: "Someone close, <em>in the loop</em>",
    sub: "Hypos, supplies, and a way to check they're OK.",
  },
];

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1080, height: 1350 },
  deviceScaleFactor: 1,
});

for (const post of posts) {
  await page.goto(`file://${path.join(dir, "post.html")}`);
  await page.evaluate(
    (data) => {
      document.getElementById("kicker").textContent = data.kicker;
      document.getElementById("title").innerHTML = data.title;
      document.getElementById("sub").textContent = data.sub;
      document.getElementById("shot").src = data.shot;
    },
    { ...post, shot: `file://${path.join(dir, "shots", post.shot)}` },
  );
  await page.locator("#shot").evaluate(
    (img) =>
      new Promise((resolve) => {
        if (img.complete && img.naturalWidth > 0) resolve();
        else img.addEventListener("load", () => resolve(), { once: true });
      }),
  );
  const out = path.join(dir, post.file);
  await page.screenshot({ path: out });
  console.log(`Saved ${out}`);
}

await browser.close();
