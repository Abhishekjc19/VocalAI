// utils/logger.js — colourful, readable terminal output

const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  white: "\x1b[37m",
};

export const log = {
  info: (msg) => console.log(`${c.cyan}${msg}${c.reset}`),
  success: (msg) => console.log(`${c.green}${msg}${c.reset}`),
  warn: (msg) => console.log(`${c.yellow}${msg}${c.reset}`),
  error: (msg) => console.error(`${c.red}${msg}${c.reset}`),
  debug: (msg) => {
    if (process.env.DEBUG) console.log(`${c.dim}${msg}${c.reset}`);
  },
  stage: (n, label) =>
    console.log(
      `\n${c.bold}${c.magenta}── Stage ${n}: ${label} ${"─".repeat(30 - label.length > 0 ? 30 - label.length : 0)}${c.reset}`
    ),
  item: (msg) => console.log(`  ${c.dim}•${c.reset} ${msg}`),
};

export function banner() {
  console.log(`
${c.bold}${c.cyan}╔════════════════════════════════════════════╗
║   🚀  Automated Cold Outreach Pipeline     ║
║   Ocean.io → Prospeo → Eazyreach → Brevo  ║
╚════════════════════════════════════════════╝${c.reset}
`);
}

export function summary(seedDomain, domains, prospects, verified) {
  console.log(`
  Seed domain  : ${c.bold}${seedDomain}${c.reset}
  Lookalikes   : ${domains.length} companies
  Prospects    : ${prospects.length} decision-makers found
  Verified ✉️  : ${verified.length} emails ready to send

  Recipients:
${verified
  .map(
    (v) =>
      `    ${c.green}✓${c.reset} ${v.name.padEnd(25)} ${v.title.padEnd(30)} ${c.dim}${v.email}${c.reset}`
  )
  .join("\n")}
`);
}
