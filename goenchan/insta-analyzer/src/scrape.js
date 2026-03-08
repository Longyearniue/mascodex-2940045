#!/usr/bin/env node
/**
 * Instagram Profile Scraper
 *
 * Scrapes an Instagram profile's public data:
 *   - Profile info (name, bio, stats, profile pic)
 *   - Latest 24 posts from the grid (image, caption, likes, comments, timestamp)
 *   - Downloads post images locally
 *
 * Usage:
 *   node src/scrape.js <username | @username | https://instagram.com/username/>
 */

import puppeteer from "puppeteer";
import { writeFile, mkdir } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import https from "node:https";
import http from "node:http";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const MAX_POSTS = 24;
const MAX_SCROLL_ATTEMPTS = 5;
const POST_VISIT_DELAY_MS = 1500;
const PAGE_LOAD_TIMEOUT_MS = 30_000;
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse CLI input into a bare username. */
function parseUsername(input) {
  if (!input) return null;
  // Full URL: https://www.instagram.com/username/ or http://instagram.com/username
  const urlMatch = input.match(
    /(?:https?:\/\/)?(?:www\.)?instagram\.com\/([A-Za-z0-9_.]+)/,
  );
  if (urlMatch) return urlMatch[1];
  // @username
  if (input.startsWith("@")) return input.slice(1);
  // bare username (validate characters)
  if (/^[A-Za-z0-9_.]+$/.test(input)) return input;
  return null;
}

/** Sleep for a given number of milliseconds. */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Download a file from a URL to a local path. Follows redirects. */
async function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const request = (targetUrl) => {
      const proto = targetUrl.startsWith("https") ? https : http;
      proto
        .get(targetUrl, { headers: { "User-Agent": USER_AGENT } }, (res) => {
          // Follow redirects (301, 302, 307, 308)
          if (
            res.statusCode >= 300 &&
            res.statusCode < 400 &&
            res.headers.location
          ) {
            request(res.headers.location);
            return;
          }
          if (res.statusCode !== 200) {
            reject(
              new Error(`Download failed: HTTP ${res.statusCode} for ${targetUrl}`),
            );
            return;
          }
          const fileStream = createWriteStream(destPath);
          pipeline(res, fileStream).then(resolve).catch(reject);
        })
        .on("error", reject);
    };
    request(url);
  });
}

/** Format a number with padding. */
function padIndex(i, width = 2) {
  return String(i).padStart(width, "0");
}

// ---------------------------------------------------------------------------
// Profile extraction (runs inside Puppeteer page context)
// ---------------------------------------------------------------------------

async function extractProfile(page) {
  return page.evaluate(() => {
    const result = { profilePic: null, stats: [], headerHTML: "" };

    // Profile picture - look for the main profile image
    const profileImg =
      document.querySelector('header img[alt*="profile picture"]') ||
      document.querySelector("header img");
    if (profileImg) {
      result.profilePic = profileImg.src;
    }

    // Stats (posts, followers, following) - typically in header <ul> or <a> elements
    const header = document.querySelector("header");
    if (header) {
      // Instagram uses <li> elements or <a> elements for stats in the header
      const statElements = header.querySelectorAll("li");
      if (statElements.length >= 3) {
        result.stats = Array.from(statElements)
          .slice(0, 3)
          .map((el) => el.textContent.trim());
      }
      // Fallback: try spans with stat-like content
      if (result.stats.length === 0) {
        const spans = header.querySelectorAll("span");
        const statTexts = [];
        for (const span of spans) {
          const text = span.textContent.trim();
          if (
            /\d+\s*(posts?|followers?|following)/i.test(text) &&
            statTexts.length < 3
          ) {
            statTexts.push(text);
          }
        }
        if (statTexts.length > 0) result.stats = statTexts;
      }
      result.headerHTML = header.innerHTML.slice(0, 5000);
    }

    return result;
  });
}

// ---------------------------------------------------------------------------
// Grid post extraction
// ---------------------------------------------------------------------------

async function extractGridPosts(page, maxPosts) {
  // Scroll to load more posts
  let previousCount = 0;
  for (let attempt = 0; attempt < MAX_SCROLL_ATTEMPTS; attempt++) {
    const currentCount = await page.evaluate(() => {
      return document.querySelectorAll("article a[href*='/p/'], article a[href*='/reel/']").length;
    });
    console.log(
      `  Scroll attempt ${attempt + 1}/${MAX_SCROLL_ATTEMPTS}: found ${currentCount} posts`,
    );
    if (currentCount >= maxPosts) break;
    if (currentCount === previousCount && attempt > 0) {
      // No new posts loaded, stop scrolling
      console.log("  No new posts loaded, stopping scroll.");
      break;
    }
    previousCount = currentCount;

    await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2));
    await sleep(1500);
  }

  // Extract post links and thumbnail data from the grid
  const posts = await page.evaluate((max) => {
    const anchors = document.querySelectorAll(
      "article a[href*='/p/'], article a[href*='/reel/']",
    );
    const seen = new Set();
    const results = [];
    for (const a of anchors) {
      if (results.length >= max) break;
      const href = a.getAttribute("href");
      if (!href || seen.has(href)) continue;
      seen.add(href);

      const img = a.querySelector("img");
      results.push({
        link: `https://www.instagram.com${href}`,
        imgSrc: img ? img.src : null,
        alt: img ? img.alt : "",
      });
    }
    return results;
  }, maxPosts);

  return posts;
}

// ---------------------------------------------------------------------------
// Individual post detail extraction
// ---------------------------------------------------------------------------

async function extractPostDetails(page, postUrl) {
  try {
    await page.goto(postUrl, {
      waitUntil: "networkidle2",
      timeout: PAGE_LOAD_TIMEOUT_MS,
    });

    // Wait a moment for dynamic content
    await sleep(800);

    const details = await page.evaluate(() => {
      const result = {
        likes: null,
        comments: null,
        caption: null,
        timestamp: null,
        imgSrc: null,
      };

      // ---- Image source (high-res from the post page) ----
      // Post images are typically in article > div img or role="presentation" img
      const postImgs = document.querySelectorAll(
        'article img[style*="object-fit"], article img[srcset], article img[decoding="auto"]',
      );
      for (const img of postImgs) {
        // Skip profile pics (small, alt contains "profile picture")
        if (img.alt && img.alt.includes("profile picture")) continue;
        if (img.src) {
          result.imgSrc = img.src;
          break;
        }
      }
      // Broader fallback
      if (!result.imgSrc) {
        const mainImg = document.querySelector(
          'article div[role="button"] img, article img',
        );
        if (mainImg && !mainImg.alt?.includes("profile picture")) {
          result.imgSrc = mainImg.src;
        }
      }

      // ---- Likes ----
      // Instagram often renders likes as "Liked by X and Y others" or a plain number
      const likeSection = document.querySelector(
        'section a[href*="liked_by"], section span[class]',
      );
      if (likeSection) {
        const likeText = likeSection.textContent.trim();
        // "1,234 likes" or "1234"
        const numMatch = likeText.replace(/,/g, "").match(/(\d+)/);
        if (numMatch) result.likes = parseInt(numMatch[1], 10);
      }
      // Fallback: search all spans for a pattern like "X likes"
      if (result.likes === null) {
        const spans = document.querySelectorAll("article span");
        for (const span of spans) {
          const txt = span.textContent.trim();
          const m = txt.replace(/,/g, "").match(/^([\d]+)\s*likes?$/i);
          if (m) {
            result.likes = parseInt(m[1], 10);
            break;
          }
        }
      }

      // ---- Comments count ----
      // "View all X comments"
      const commentLink = document.querySelector(
        'a[href*="/comments/"], span[class]',
      );
      if (commentLink) {
        const cText = commentLink.textContent.trim();
        const m = cText.replace(/,/g, "").match(/(\d+)\s*comments?/i);
        if (m) result.comments = parseInt(m[1], 10);
      }

      // ---- Caption ----
      // The first <h1> in the article or the first user-linked span followed by text
      const captionEl = document.querySelector("article h1");
      if (captionEl) {
        result.caption = captionEl.textContent.trim();
      }
      // Fallback: look for the caption container (typically a span after the username link)
      if (!result.caption) {
        const article = document.querySelector("article");
        if (article) {
          const spans = article.querySelectorAll("span");
          for (const span of spans) {
            const text = span.textContent.trim();
            // Skip very short text, stat-like text, and UI elements
            if (
              text.length > 30 &&
              !/^\d+\s*(likes?|comments?|views?)$/i.test(text)
            ) {
              result.caption = text.slice(0, 2000);
              break;
            }
          }
        }
      }

      // ---- Timestamp ----
      const timeEl = document.querySelector("article time[datetime]");
      if (timeEl) {
        result.timestamp = timeEl.getAttribute("datetime");
      }

      return result;
    });

    return details;
  } catch (err) {
    console.error(`  Error extracting post details for ${postUrl}: ${err.message}`);
    return {
      likes: null,
      comments: null,
      caption: null,
      timestamp: null,
      imgSrc: null,
    };
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const rawInput = process.argv[2];
  const username = parseUsername(rawInput);

  if (!username) {
    console.error(
      "Usage: node src/scrape.js <username | @username | https://instagram.com/username/>",
    );
    process.exit(1);
  }

  console.log(`\n--- Instagram Scraper ---`);
  console.log(`Target: ${username}`);
  console.log(`Max posts: ${MAX_POSTS}\n`);

  // Prepare output directories
  const dataDir = path.join(PROJECT_ROOT, "data", username);
  const imagesDir = path.join(dataDir, "images");
  await mkdir(imagesDir, { recursive: true });

  let browser;
  try {
    // Launch browser
    console.log("Launching browser...");
    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
      ],
    });

    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);
    await page.setViewport({ width: 1280, height: 900 });

    // Mask webdriver property to reduce detection
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", {
        get: () => undefined,
      });
    });

    // Navigate to profile
    const profileUrl = `https://www.instagram.com/${username}/`;
    console.log(`Navigating to ${profileUrl}`);
    await page.goto(profileUrl, {
      waitUntil: "networkidle2",
      timeout: PAGE_LOAD_TIMEOUT_MS,
    });

    // Check for login wall / page-not-found
    const pageContent = await page.content();
    if (pageContent.includes("Page Not Found") || pageContent.includes("this page isn't available")) {
      console.error(`Profile not found: ${username}`);
      process.exit(1);
    }

    // Handle cookie/login popups - try to dismiss them
    try {
      // Use page.evaluate to find buttons by text content (no :has-text in CSS)
      await page.evaluate(() => {
        const dismissTexts = ["not now", "decline", "accept", "allow"];
        const buttons = document.querySelectorAll(
          'button, [role="dialog"] button, [role="button"]',
        );
        for (const btn of buttons) {
          const text = btn.textContent.trim().toLowerCase();
          if (dismissTexts.some((t) => text === t)) {
            btn.click();
            break;
          }
        }
      });
      await sleep(500);
    } catch {
      // Popups may not appear; that is fine
    }

    // Wait a bit for content to settle
    await sleep(1000);

    // ---- Extract profile info ----
    console.log("Extracting profile info...");
    const profile = await extractProfile(page);
    console.log(`  Stats: ${profile.stats.join(" | ") || "(none detected)"}`);

    // ---- Extract grid posts ----
    console.log("Extracting grid posts...");
    const gridPosts = await extractGridPosts(page, MAX_POSTS);
    console.log(`  Found ${gridPosts.length} posts in grid.`);

    // ---- Visit each post for details ----
    console.log("Visiting individual post pages for details...");
    const posts = [];

    for (let i = 0; i < gridPosts.length; i++) {
      const gp = gridPosts[i];
      const label = `post_${padIndex(i)}`;
      console.log(`  [${i + 1}/${gridPosts.length}] ${gp.link}`);

      const details = await extractPostDetails(page, gp.link);

      // Use the higher-resolution image from the post page if available
      const finalImgSrc = details.imgSrc || gp.imgSrc;

      // Download image
      let localImage = null;
      if (finalImgSrc) {
        // Determine extension from the URL path (ignore query params)
        const urlPath = new URL(finalImgSrc).pathname;
        const ext = urlPath.endsWith(".webp") ? "webp" : "jpg";
        const filename = `${label}.${ext}`;
        const destPath = path.join(imagesDir, filename);
        try {
          await downloadFile(finalImgSrc, destPath);
          localImage = `images/${filename}`;
          console.log(`    -> saved ${filename}`);
        } catch (dlErr) {
          console.error(`    -> image download failed: ${dlErr.message}`);
        }
      }

      posts.push({
        link: gp.link,
        imgSrc: finalImgSrc,
        alt: gp.alt,
        likes: details.likes,
        comments: details.comments,
        caption: details.caption,
        timestamp: details.timestamp,
        localImage,
        index: i,
      });

      // Rate limit between post visits
      if (i < gridPosts.length - 1) {
        await sleep(POST_VISIT_DELAY_MS);
      }
    }

    // ---- Build output JSON ----
    const output = {
      username,
      scrapedAt: new Date().toISOString(),
      profile,
      posts,
    };

    const jsonPath = path.join(dataDir, "profile.json");
    await writeFile(jsonPath, JSON.stringify(output, null, 2), "utf-8");
    console.log(`\nSaved profile data to ${jsonPath}`);
    console.log(
      `Downloaded ${posts.filter((p) => p.localImage).length}/${posts.length} images.`,
    );
    console.log("Done.\n");
  } catch (err) {
    console.error(`Fatal error: ${err.message}`);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

main();
