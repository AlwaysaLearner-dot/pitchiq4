// All requests go to /api/* on the SAME origin.
// Vercel rewrites /api/* → Railway automatically.
// Zero CORS. API key never sent from frontend.

async function req(path, opts = {}) {
  let res;
  try {
    res = await fetch(path, opts);
  } catch (e) {
    // Network error — Railway might be down
    throw new Error(
      "Cannot reach the server. Make sure Railway is running and " +
      "vercel.json has the correct Railway URL in the rewrites section."
    );
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Server error (${res.status})`);
  return data;
}

export async function uploadPPTX(file) {
  const fd = new FormData();
  fd.append("file", file);
  return req("/api/upload", { method: "POST", body: fd });
}

export async function analyseSession(payload) {
  const data = await req("/api/analyse", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(payload),
  });
  return data.report;
}

export async function sendChat(payload) {
  const data = await req("/api/chat", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(payload),
  });
  return data.reply;
}
