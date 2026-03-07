const JSZip = require("jszip");

async function parsePPTX(buffer) {
  const zip = await JSZip.loadAsync(buffer);

  const slideFiles = Object.keys(zip.files)
    .filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => {
      const na = parseInt(a.match(/\d+/)[0]);
      const nb = parseInt(b.match(/\d+/)[0]);
      return na - nb;
    });

  if (!slideFiles.length) {
    throw new Error("No slides found. Make sure this is a valid .pptx file.");
  }

  const slides = [];
  for (let i = 0; i < slideFiles.length; i++) {
    const xml   = await zip.files[slideFiles[i]].async("string");
    const texts = extractTexts(xml);
    slides.push({
      index: i + 1,
      title: texts[0] || `Slide ${i + 1}`,
      body:  texts.slice(1).join(" • "),
      raw:   texts.join(" "),
    });
  }
  return slides;
}

function extractTexts(xml) {
  return [...xml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)]
    .map(m => decode(m[1].trim()))
    .filter(Boolean);
}

function decode(s) {
  return s
    .replace(/&amp;/g,  "&")
    .replace(/&lt;/g,   "<")
    .replace(/&gt;/g,   ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)));
}

module.exports = { parsePPTX };
