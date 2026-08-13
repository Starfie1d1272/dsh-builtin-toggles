/**
 * Standalone build for dsh-builtin-toggles, mirroring the official DSH
 * client-bundle contract without depending on the monorepo preset:
 *
 * - Node half: plain ESM library (`lib/index.js` under `"type": "module"`)
 *   with type declarations.
 *   All @deepseek-ai imports are type-only and erased, so nothing needs to
 *   be external at runtime — the host composition provides `ctx.webServer`
 *   and `ctx.loader`.
 * - Client half: the browser bundle the DSH ModuleLoader table expects:
 *   CJS output whose first statement calls
 *   `window.__ModuleLoader__.load({ id, factory })` and whose factory
 *   resolves platform modules (react and friends) through the injected
 *   `require` — never through globals or an import map. `entryFileNames`
 *   pins the artifact to exactly `lib/client.js`, which `exports["./client"]`
 *   points at.
 */
import { defineConfig } from 'tsdown'

/** The DSH web shell's frozen platform module table (see @deepseek-ai/dsh-client-web src/platform). */
const PLATFORM_MODULES = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-web-react',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-attachment',
  '@deepseek-ai/dsh-client-schema-form',
]

export default defineConfig([
  {
    // Node half: the host plugin (API routes + policy + profile patch).
    name: 'dsh-builtin-toggles',
    entry: ['src/index.ts'],
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    fixedExtension: false,
    dts: true,
    clean: true,
  },
  {
    // Browser half: the Settings → Plugins → Built-ins tab.
    name: 'dsh-builtin-toggles/client',
    entry: { client: 'src/client/index.ts' },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    target: 'es2022',
    dts: false,
    clean: false,
    // Only platform-module specifiers may stay external: the loader module
    // table answers them. Everything else (there is nothing else today)
    // must be inlined — a require() the table cannot answer throws at boot.
    external: [...PLATFORM_MODULES],
    noExternal: (id: string) => (PLATFORM_MODULES.includes(id) ? undefined : true),
    outputOptions: {
      entryFileNames: 'client.js',
      sourcemap: true,
      banner: 'window.__ModuleLoader__.load({ id: "dsh-builtin-toggles", factory: (require) => {',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
      footer: 'return module.exports; } });',
    },
  },
])
