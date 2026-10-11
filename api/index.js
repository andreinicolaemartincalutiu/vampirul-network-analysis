const express = require("express");
const path = require("path");

const app = express();

app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/", (req, res) => {
    res.redirect("/home");
});

app.get("/home", (req, res) => {
    res.sendFile(path.join(process.cwd(), "public", "home.html"));
});

app.get("/about", (req, res) => {
    res.sendFile(path.join(process.cwd(), "public", "about.html"));
});

app.get("/vampirul-character-network", (req, res) => {
    res.sendFile(path.join(process.cwd(), "public", "vampirul-character-network.html"));
});

app.get("/vampirul-network-data.json", (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.sendFile(path.join(process.cwd(), "public", "vampirul-network-data.json"));
});

app.get("/the-canal-character-network", (req, res) => {
    res.sendFile(path.join(process.cwd(), "public", "the-canal-character-network.html"));
});

app.get("/the-canal-network-data.json", (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.sendFile(path.join(process.cwd(), "public", "the-canal-network-data.json"));
});

app.get("/miss-christina-character-network", (req, res) => {
    res.sendFile(path.join(process.cwd(), "public", "miss-christina-character-network.html"));
});

app.get("/miss-christina-network-data.json", (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.sendFile(path.join(process.cwd(), "public", "miss-christina-network-data.json"));
});

app.get("/the-silver-countess-character-network", (req, res) => {
    res.sendFile(path.join(process.cwd(), "public", "the-silver-countess-character-network.html"));
});

app.get("/the-silver-countess-network-data.json", (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.sendFile(path.join(process.cwd(), "public", "the-silver-countess-network-data.json"));
});

app.get("/the-pixie-of-the-marshes-character-network", (req, res) => {
    res.sendFile(path.join(process.cwd(), "public", "the-pixie-of-the-marshes-character-network.html"));
});

app.get("/the-pixie-of-the-marshes-network-data.json", (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.sendFile(path.join(process.cwd(), "public", "the-pixie-of-the-marshes-network-data.json"));
});

app.get("/the-stranger-character-network", (req, res) => {
    res.sendFile(path.join(process.cwd(), "public", "the-stranger-character-network.html"));
});

app.get("/the-stranger-network-data.json", (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.sendFile(path.join(process.cwd(), "public", "the-stranger-network-data.json"));
});

app.get("/the-mysterious-stranger-character-network", (req, res) => {
    res.sendFile(path.join(process.cwd(), "public", "the-mysterious-stranger-character-network.html"));
});

app.get("/the-mysterious-stranger-network-data.json", (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.sendFile(path.join(process.cwd(), "public", "the-mysterious-stranger-network-data.json"));
});

app.get("/vampire-nation-character-network", (req, res) => {
    res.sendFile(path.join(process.cwd(), "public", "vampire-nation-character-network.html"));
});

app.get("/vampire-nation-network-data.json", (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.sendFile(path.join(process.cwd(), "public", "vampire-nation-network-data.json"));
});

app.get("/the-stranger-translation-differences", (req, res) => {
    res.sendFile(path.join(process.cwd(), "public", "the-stranger-translation-differences.html"));
});

app.get("/the-stranger-translation-differences.json", (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.sendFile(path.join(process.cwd(), "public", "the-stranger-translation-differences.json"));
});

app.get(/^\/([a-z0-9-]+-character-network)$/, (req, res) => {
    res.sendFile(path.join(process.cwd(), "public", req.params[0] + ".html"));
});

module.exports = app;