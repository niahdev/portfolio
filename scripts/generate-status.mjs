import { writeFile } from "node:fs/promises";

const targets = [
  { name: "ER-Dodge", url: "https://niah.site/", environment: "OVHcloud · K3s" },
  { name: "gif_lower", url: "https://gif.niah.site/", environment: "OVHcloud · K3s" },
  { name: "Portfolio", url: "https://pt.niah.site/", environment: "K3s · GitHub Actions" }
];

async function checkService(target) {
  const startedAt = performance.now();
  try {
    const response = await fetch(target.url, {
      redirect: "follow",
      signal: AbortSignal.timeout(12_000),
      headers: { "user-agent": "niahdev-portfolio-status/1.0" }
    });
    await response.body?.cancel();
    return {
      ...target,
      status: response.ok ? "operational" : "degraded",
      responseMs: Math.round(performance.now() - startedAt)
    };
  } catch {
    return { ...target, status: "degraded", responseMs: null };
  }
}

const generatedAt = new Date().toISOString();
const services = await Promise.all(targets.map(checkService));
const status = {
  generatedAt,
  deployment: {
    commit: process.env.GITHUB_SHA?.slice(0, 7) ?? null,
    deployedAt: generatedAt
  },
  services
};

const outputPath = process.env.STATUS_OUTPUT || "status.json";
await writeFile(outputPath, `${JSON.stringify(status, null, 2)}\n`, "utf8");
