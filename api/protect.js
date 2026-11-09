// Anti-scraping layer for Undead Networks.
//
// What it does (in order, before any file is served):
//   1. Refuses known AI crawlers, SEO crawlers and scraping libraries (403).
//   2. Sends opt-out headers on every response: no AI training / no text and
//      data mining (TDM reservation, Art. 4(3) of EU Directive 2019/790).
//   3. Lets search engines index only the public pages (home, about,
//      whitepaper, privacy); every visualizer and data file is "noindex".
//   4. Serves the *.json network data only to the site's own pages: a direct
//      link, a script or another website gets 403.
//
// Limits: a determined scraper can fake a browser's headers. This raises the
// bar for bots and states the reservation of rights in machine-readable form;
// the Vercel Firewall (Bot Protection + AI Bots rulesets) adds a second layer.

// User agents refused outright. Search engines (Googlebot, Bingbot, Applebot)
// and link-preview fetchers (facebookexternalhit, Twitterbot, LinkedInBot,
// Slackbot, Discordbot, WhatsApp) are deliberately NOT listed.
const BLOCKED_AGENTS = [
    // AI crawlers and AI assistants' fetchers
    "GPTBot", "ChatGPT-User", "OAI-SearchBot", "ClaudeBot", "Claude-Web",
    "Claude-User", "Claude-SearchBot", "anthropic-ai", "CCBot", "PerplexityBot",
    "Perplexity-User", "Bytespider", "Amazonbot", "meta-externalagent",
    "meta-externalfetcher", "FacebookBot", "cohere-ai", "cohere-training-data-crawler",
    "Diffbot", "ImagesiftBot", "Omgilibot", "Omgili", "YouBot", "Timpibot",
    "AI2Bot", "Ai2Bot-Dolma", "PanguBot", "Kangaroo Bot", "Sidetrade",
    "img2dataset", "Webzio-Extended", "MistralAI-User", "DuckAssistBot",
    "PetalBot", "Scrapy", "VelenPublicWebCrawler", "Brightbot", "Novellum",
    "QualifiedBot", "iaskspider", "ISSCyberRiskCrawler", "SemrushBot-OCOB",
    // SEO / data-harvesting crawlers
    "AhrefsBot", "SemrushBot", "MJ12bot", "DotBot", "DataForSeoBot", "BLEXBot",
    "SeekportBot", "serpstatbot", "MegaIndex", "ZoominfoBot",
    // Generic HTTP clients and headless browsers
    "python-requests", "python-urllib", "aiohttp", "httpx", "curl", "Wget",
    "Go-http-client", "node-fetch", "axios", "undici", "libwww-perl",
    "okhttp", "Java/", "Apache-HttpClient", "HeadlessChrome", "PhantomJS",
    "Puppeteer", "Playwright", "Selenium", "colly", "HTTrack", "WebCopier",
    "SiteSnagger", "Offline Explorer", "Teleport",
];

const blockedRe = new RegExp(
    BLOCKED_AGENTS.map(a => a.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")).join("|"),
    "i"
);

// Pages search engines may index. Everything else is noindex.
const INDEXABLE = new Set(["/", "/home", "/about", "/whitepaper", "/privacy"]);

function isOwnPage(req) {
    // Modern browsers say where a request comes from.
    const site = req.get("sec-fetch-site");
    if (site) return site === "same-origin";
    // Older browsers: fall back to the Referer header.
    const ref = req.get("referer");
    if (!ref) return false;
    try {
        return new URL(ref).host === req.get("host");
    } catch {
        return false;
    }
}

function protect(req, res, next) {
    const ua = req.get("user-agent") || "";

    // robots.txt and the TDM policy stay readable by everyone, so the
    // reservation of rights can actually be found.
    const isPolicyFile = req.path === "/robots.txt" || req.path.startsWith("/.well-known/");

    if (!isPolicyFile && (!ua.trim() || blockedRe.test(ua))) {
        return res.status(403).type("text/plain").send(
            "Automated access to Undead Networks is not permitted. " +
            "Text and data mining rights are reserved (Art. 4(3), Directive (EU) 2019/790)."
        );
    }

    res.set("tdm-reservation", "1");
    res.set("tdm-policy", "https://" + req.get("host") + "/.well-known/tdmrep.json");
    res.set(
        "X-Robots-Tag",
        INDEXABLE.has(req.path)
            ? "noai, noimageai, noarchive"
            : "noindex, nofollow, noarchive, noai, noimageai"
    );

    if (req.path.endsWith(".json") && !req.path.startsWith("/.well-known/")) {
        if (!isOwnPage(req)) {
            return res.status(403).type("text/plain").send(
                "The network data is available only through the Undead Networks visualizer."
            );
        }
        res.set("Cache-Control", "no-store");
    }

    next();
}

// robots.txt: AI crawlers are refused everywhere; other crawlers may index
// only the public pages.
const AI_ROBOTS = [
    "GPTBot", "ChatGPT-User", "OAI-SearchBot", "ClaudeBot", "Claude-Web",
    "Claude-User", "Claude-SearchBot", "anthropic-ai", "CCBot", "Google-Extended",
    "Google-CloudVertexBot", "Applebot-Extended", "PerplexityBot", "Perplexity-User",
    "Bytespider", "Amazonbot", "meta-externalagent", "meta-externalfetcher",
    "FacebookBot", "cohere-ai", "cohere-training-data-crawler", "Diffbot",
    "ImagesiftBot", "Omgilibot", "YouBot", "Timpibot", "AI2Bot", "Ai2Bot-Dolma",
    "PanguBot", "img2dataset", "Webzio-Extended", "MistralAI-User", "DuckAssistBot",
    "PetalBot", "Scrapy", "AhrefsBot", "SemrushBot", "MJ12bot", "DotBot",
    "DataForSeoBot", "BLEXBot",
];

const ROBOTS_TXT = [
    "# Undead Networks - text and data mining rights reserved",
    "# (Art. 4(3), Directive (EU) 2019/790). No AI training, no scraping.",
    "",
    ...AI_ROBOTS.map(a => `User-agent: ${a}`),
    "Disallow: /",
    "",
    "User-agent: *",
    "Allow: /$",
    "Allow: /home$",
    "Allow: /about$",
    "Allow: /whitepaper$",
    "Allow: /privacy$",
    "Allow: /favicon.png$",
    "Allow: /site.css$",
    "Allow: /site.js$",
    "Allow: /fonts/",
    "Disallow: /",
    "",
].join("\n");

// TDMRep (W3C Community Group): machine-readable reservation of TDM rights.
const TDMREP = [{ location: "/*", "tdm-reservation": 1 }];

module.exports = { protect, ROBOTS_TXT, TDMREP };
