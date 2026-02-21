const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf-8');

const virtualConsole = new jsdom.VirtualConsole();
virtualConsole.sendTo(console);

virtualConsole.on("jsdomError", (e) => {
    console.error("JSDOM Error:", e.message);
});

const dom = new JSDOM(html, {
    runScripts: "dangerously",
    resources: "usable",
    url: "http://localhost:8000/",
    virtualConsole
});

setTimeout(() => {
    console.log("Finished checking JSDOM");
    process.exit(0);
}, 2000);
