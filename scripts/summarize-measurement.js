#!/usr/bin/env node
// Summarize a measurement run's results.csv into summary.json with metrics.
// Usage:
//   node scripts/summarize-measurement.js --in test-results/url_measurement/latest/results.csv --out test-results/url_measurement/latest/summary.json

import fs from 'fs/promises';
import path from 'path';

function parseArgs(argv){
  const args = {}; for(let i=2;i<argv.length;i++){ const a=argv[i]; if(a.startsWith('--')){ const k=a.slice(2); const v=(i+1<argv.length && !argv[i+1].startsWith('--'))? argv[++i] : true; args[k]=v; } } return args;
}

function csvParseSimple(text){
  const lines = text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  if(lines.length===0) return { header:[], rows:[] };
  const header = lines[0].split(',').map(s=>s.trim());
  const rows = lines.slice(1).map(line=>{
    const cols = line.split(',');
    const obj = {}; header.forEach((h, idx)=> obj[h] = (cols[idx] ?? '').trim());
    return obj;
  });
  return { header, rows };
}

function binLabel(label){
  const l = String(label||'').toLowerCase();
  if(l === 'ok') return 'ok';
  if(l === 'broken' || l === 'soft-fail') return 'not-ok';
  return 'not-ok';
}

function summarize(rows){
  let TP=0, TN=0, FP=0, FN=0; // with respect to positive="not-ok"
  let total=0;
  for(const r of rows){
    const expBin = binLabel(r.expected_label);
    const predBin = binLabel(r.predicted_label);
    total++;
    if(expBin==='not-ok' && predBin==='not-ok') TP++;
    else if(expBin==='ok' && predBin==='ok') TN++;
    else if(expBin==='ok' && predBin==='not-ok') FP++;
    else if(expBin==='not-ok' && predBin==='ok') FN++;
  }
  const success = total ? (TP+TN)/total : 0;
  const precisionNotOk = (TP+FP) ? TP/(TP+FP) : 0;
  const recallNotOk = (TP+FN) ? TP/(TP+FN) : 0;
  return {
    totals: { total, TP, TN, FP, FN },
    metrics: {
      success_rate: Number(success.toFixed(4)),
      not_ok_precision: Number(precisionNotOk.toFixed(4)),
      not_ok_recall: Number(recallNotOk.toFixed(4))
    },
    thresholds: {
      success_rate_pass: success >= 0.90,
      not_ok_recall_pass: recallNotOk >= 0.85
    }
  };
}

async function main(){
  const args = parseArgs(process.argv);
  const inCsv = args.in || args.i;
  const outJson = args.out || args.o;
  if(!inCsv || !outJson){
    console.error('Usage: node scripts/summarize-measurement.js --in <results.csv> --out <summary.json>');
    process.exit(2);
  }
  const raw = await fs.readFile(inCsv, 'utf8');
  const { header, rows } = csvParseSimple(raw);
  const required = ['url','expected_label','predicted_label'];
  for(const c of required){ if(!header.includes(c)){ console.error(`Missing required column in CSV: ${c}`); process.exit(2);} }
  const summary = summarize(rows);
  await fs.writeFile(outJson, JSON.stringify(summary, null, 2), 'utf8');
  console.log(`[summarize-measurement] Wrote ${outJson}`);
}

main().catch(err=>{ console.error(err); process.exit(1); });
