// Compatibility entry point. The current audit follows native game controls.
if (process.argv.includes('--hud-only') && !process.argv.includes('--smoke')) process.argv.push('--smoke');
if (!process.argv.some(arg => arg.startsWith('--port='))) process.argv.push('--port=3266');
await import('./audit-arena-releve-guide.mjs');
