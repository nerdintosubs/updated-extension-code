/**
 * Popup UI for OU Link Validator.
 * - Validates input URLs (MyLearn only)
 * - Uses background service worker for render-based validation
 * - Exports CSV and copies FAIL URLs
 */
const HOST = "mylearn.oracle.com";
let lastResults = [], runIso = null;

const $ = id => document.getElementById(id);
const clearEl = el => { while (el.firstChild) el.removeChild(el.firstChild); };
const setButtons = st => {
  $("exportBtn").disabled      = !st.all;
  $("exportFailBtn").disabled  = !st.fail;
  $("copyFailBtn").disabled    = !st.fail;
};
const status = msg => { $("actionStatus").textContent = msg; };

function isMyLearn(u){
  try {
    const x = new URL(u.trim());
    return x.hostname === HOST && ["https:","http:"].includes(x.protocol);
  } catch { return false; }
}

function csvEscape(v){
  if(v==null) return "";
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
}
function toCsv(rows){
  const head=["run_at","url","final_url","result","reason","marker","selector","checked_at"];
  return [head,...rows].map(r=>r.map(csvEscape).join(",")).join("\n");
}
function dlCsv(text,name){
  const b=new Blob([text],{type:"text/csv"}),u=URL.createObjectURL(b),a=document.createElement("a");
  a.href=u; a.download=name; document.body.append(a); a.click(); a.remove(); URL.revokeObjectURL(u);
}
async function copy(txt){ await navigator.clipboard.writeText(txt); }

$("exportBtn").addEventListener("click",()=>{
  if(!lastResults.length) return;
  const csv=toCsv(lastResults.map(o=>[
    runIso,o.url,o.fin,o.ok?"PASS":"FAIL",o.why,o.mark||"",o.selector||"",o.at
  ]));
  dlCsv(csv,`OU_Link_check_ALL_${runIso.replace(/[:.]/g,"-")}.csv`);
  status("CSV (all) exported.");
});

$("exportFailBtn").addEventListener("click",()=>{
  const fails=lastResults.filter(r=>!r.ok);
  if(!fails.length){ status("No FAIL rows."); return; }
  const csv=toCsv(fails.map(o=>[
    runIso,o.url,o.fin,"FAIL",o.why,o.mark||"",o.selector||"",o.at
  ]));
  dlCsv(csv,`OU_Link_check_FAIL_${runIso.replace(/[:.]/g,"-")}.csv`);
  status("CSV (FAIL) exported.");
});

$("copyFailBtn").addEventListener("click",async()=>{
  const fails=lastResults.filter(r=>!r.ok).map(r=>r.url).join("\n");
  if(!fails){ status("No FAIL URLs."); return; }
  try { await copy(fails); status("FAIL URLs copied."); }
  catch { status("Clipboard blocked by browser."); }
});

$("checkBtn").addEventListener("click", async ()=>{
  const lines = $("linksInput").value.split(/\n/).map(x=>x.trim()).filter(Boolean);
  const valid = lines.filter(isMyLearn);
  const invalid = lines.filter(x=>!isMyLearn(x));

  const resEl = $("result");
  clearEl(resEl); resEl.textContent="Preparing..."; resEl.setAttribute("aria-busy","true");
  status(""); setButtons({all:false,fail:false});
  runIso = new Date().toISOString(); lastResults = [];

  clearEl(resEl);
  if(invalid.length){
    const lbl=document.createElement("b"); lbl.textContent="Invalid URLs:"; resEl.appendChild(lbl);
    const ul=document.createElement("ul");
    invalid.forEach(l=>{ const li=document.createElement("li"); li.className="fail"; li.textContent=`FAIL ${l}`; ul.appendChild(li); });
    resEl.appendChild(ul);
  }
  if(!valid.length){ status("No valid MyLearn URLs."); resEl.removeAttribute("aria-busy"); return; }

  const lbl2=document.createElement("b"); lbl2.textContent="Results:"; resEl.appendChild(lbl2);
  const ul2=document.createElement("ul"); resEl.appendChild(ul2);

  let processed=0, failCount=0;
  status(`Checking 0/${valid.length}...`);

  try{
    const port = chrome.runtime.connect({ name: "validator" });
    const timeoutMs = Number($("timeoutMs")?.value || 12000);
    const concurrency = Number($("concurrency")?.value || 3);
    const selectorsRaw = $("selectorsInput")?.value || "";
    const selectors = selectorsRaw.split(/\n/).map(s=>s.trim()).filter(Boolean);
    const debug = Boolean($("debug")?.checked);

    port.onMessage.addListener((msg)=>{
      if(msg.type==="progress" && msg.result){
        processed++;
        lastResults.push(msg.result);
        if(!msg.result.ok) failCount++;

        status(`Checking ${processed}/${valid.length}...`);

        const r = msg.result;
        const li=document.createElement("li"); li.className=r.ok?"ok":"fail";
        const det=[`why=${r.why}`, r.selector?`sel=${r.selector}`:null, r.mark?`mark=${r.mark}`:null]
          .filter(Boolean).join(" | ");
        li.textContent = r.ok ? `OK ${r.url}` : `FAIL ${r.url} (${det})`;
        ul2.appendChild(li);
      } else if(msg.type==="done"){
        setButtons({all:lastResults.length>0,fail:failCount>0});
        status(`Done. Total ${lastResults.length}, FAIL ${failCount}`);
        resEl.removeAttribute("aria-busy");
        try{ port.disconnect(); } catch {}
      }
    });

    port.postMessage({ type:"start", urls: valid, options: { timeoutMs, concurrency, selectors, debug } });
  } catch (e){
    status(`Cannot start render-based validation: ${e?.message||e}`);
    resEl.removeAttribute("aria-busy");
  }
});
