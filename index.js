const core = require("@actions/core");
const axios = require("axios");
const cheerio = require("cheerio");

async function fetchPage(url) {
  try {
    const start = Date.now();
    const res = await axios.get(url, { timeout: 10000, validateStatus: () => true });
    const time = Date.now() - start;
    return { status: res.status, time_ms: time, headers: res.headers, data: res.data };
  } catch (e) {
    return { error: e.message };
  }
}

function analyzeHTML(html) {
  const $ = cheerio.load(html);

  const title = $('title').text().trim();
  const metaDesc = $('meta[name="description"]').attr('content') || "";
  const h1 = $('h1').first().text().trim();

  const h2 = $('h2').map((i, el) => $(el).text().trim()).get();
  const imgs = $('img').map((i, el) => $(el).attr('src')).get();
  const links = $('a').map((i, el) => $(el).attr('href')).get();

  const wordCount = $('body').text().split(/\s+/).filter(Boolean).length;

  const issues = [];
  if (!title) issues.push("Missing <title>");
  if (!metaDesc) issues.push("Missing meta description");
  if (!h1) issues.push("Missing H1");

  const canonical = $('link[rel="canonical"]').attr('href') || null;
  const robots = $('meta[name="robots"]').attr('content') || null;

  const ogTitle = $('meta[property="og:title"]').attr('content') || null;
  const ogImage = $('meta[property="og:image"]').attr('content') || null;

  return {
    title,
    metaDesc,
    h1,
    h2_count: h2.length,
    imgs_count: imgs.length,
    links_count: links.length,
    word_count: wordCount,
    issues,
    canonical,
    robots,
    og: { ogTitle, ogImage }
  };
}

function scoreSeo(m) {
  let score = 0;
  if (m.title) score += 20;
  if (m.metaDesc) score += 20;
  if (m.h1) score += 20;
  if (m.word_count > 300) score += 20;
  if (m.links_count > 5) score += 20;
  return score;
}

async function run() {
  try {
    const rawUrl = core.getInput("url", { required: true });
    const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;

    const report = { url, timestamp: new Date().toISOString() };

    const page = await fetchPage(url);
    if (page.error) return core.setFailed(page.error);

    report.http = { status: page.status, time_ms: page.time_ms };

    const metrics = analyzeHTML(page.data);
    report.metrics = metrics;
    report.seo_score = scoreSeo(metrics);

    const out = JSON.stringify(report, null, 2);
    core.setOutput("report", out);
    core.info(out);

  } catch (err) {
    core.setFailed(err.message);
  }
}

run();
