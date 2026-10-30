import { build } from 'esbuild';
import { mkdir, cp, writeFile } from 'node:fs/promises';
await mkdir('dist', {recursive:true});
await cp('public','dist',{recursive:true});
await build({entryPoints:['src/app.jsx'],bundle:true,minify:true,outfile:'dist/app.js',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},legalComments:'none'});
await writeFile('dist/index.html',`<!doctype html><html lang="es-AR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#071e34"><meta name="robots" content="noindex,nofollow"><title>Atlas Cargo | Centro de operaciones</title><meta name="description" content="Embarques, documentación y seguimiento operativo. Centro de operaciones de Atlas Cargo."><link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>`);
