import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  // Next's own config already ignores .next/node_modules, but not Netlify's local build
  // output (vendored Deno/edge-runtime bundles, generated handler shims) — without this,
  // `npm run lint` was reporting dozens of errors from third-party code we don't own or ship
  // as source, drowning out real findings from src/.
  { ignores: [".netlify/**"] },
  ...nextCoreWebVitals,
];

export default eslintConfig;
