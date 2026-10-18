// Compatibility entry point for all six guided meetings.
if (!process.argv.includes('--meetings-only')) process.argv.push('--meetings-only');
if (!process.argv.some(arg => arg.startsWith('--port='))) process.argv.push('--port=3267');
await import('./audit-arena-releve-guide.mjs');
