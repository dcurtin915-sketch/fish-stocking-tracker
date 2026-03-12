(function(){
  'use strict';

  const PER_PAGE = 50;
  let allData = [];
  let filtered = [];
  let currentPage = 1;
  let sortCol = null;
  let sortAsc = true;

  const COLORS = ['#0f4c3a','#1a6b50','#2d8a6e','#3ba37f','#4dc990','#67e8b4','#16a34a','#15803d','#166534','#14532d',
                   '#0e7490','#0891b2','#06b6d4','#22d3ee','#155e75','#1e40af','#7c3aed'];

  // DOM refs
  const els = {};
  const ids = ['stat-records','stat-states','stat-species','stat-waters',
               'filter-state','filter-county','filter-species','filter-search','btn-reset',
               'result-count','table-body','table-head','pagination',
               'chart-species','chart-states','state-cards'];

  function init(){
    ids.forEach(id => els[id] = document.getElementById(id));
    fetch('data.json')
      .then(r => r.json())
      .then(data => {
        allData = data;
        populateFilters();
        applyFilters();
        renderStats();
        renderCharts();
        bindEvents();
      })
      .catch(e => console.error('Failed to load data:', e));
  }

  function unique(arr, key){
    return [...new Set(arr.map(r=>r[key]).filter(Boolean))].sort();
  }

  function populateFilters(){
    fillSelect(els['filter-state'], unique(allData,'state'), 'All States');
    fillSelect(els['filter-county'], unique(allData,'county'), 'All Counties');
    fillSelect(els['filter-species'], unique(allData,'species'), 'All Species');
  }

  function fillSelect(sel, opts, placeholder){
    sel.innerHTML = '<option value="">'+placeholder+'</option>' +
      opts.map(o => '<option value="'+o+'">'+o+'</option>').join('');
  }

  function updateCountyFilter(){
    const st = els['filter-state'].value;
    const subset = st ? allData.filter(r=>r.state===st) : allData;
    const current = els['filter-county'].value;
    fillSelect(els['filter-county'], unique(subset,'county'), 'All Counties');
    if([...els['filter-county'].options].some(o=>o.value===current)) els['filter-county'].value = current;
  }

  function applyFilters(){
    const st = els['filter-state'].value;
    const co = els['filter-county'].value;
    const sp = els['filter-species'].value;
    const q = els['filter-search'].value.toLowerCase().trim();

    filtered = allData.filter(r => {
      if(st && r.state !== st) return false;
      if(co && r.county !== co) return false;
      if(sp && r.species !== sp) return false;
      if(q && !(r.water_name||'').toLowerCase().includes(q)) return false;
      return true;
    });

    if(sortCol !== null) doSort();
    currentPage = 1;
    renderTable();
    renderPagination();
    els['result-count'].textContent = filtered.length.toLocaleString() + ' result' + (filtered.length===1?'':'s');
  }

  function renderStats(){
    els['stat-records'].textContent = allData.length.toLocaleString();
    els['stat-states'].textContent = unique(allData,'state').length;
    els['stat-species'].textContent = unique(allData,'species').length;
    els['stat-waters'].textContent = unique(allData,'water_name').length.toLocaleString();
  }

  // ===== Table =====
  const COLS = [
    {key:'state',label:'State',cls:''},
    {key:'water_name',label:'Water Body',cls:''},
    {key:'county',label:'County',cls:''},
    {key:'species',label:'Species',cls:''},
    {key:'number',label:'Count',cls:'num'},
    {key:'date_display',label:'Date',cls:''},
    {key:'source',label:'Source',cls:''}
  ];

  function renderTable(){
    const start = (currentPage-1)*PER_PAGE;
    const page = filtered.slice(start, start+PER_PAGE);

    els['table-body'].innerHTML = page.map(r => {
      const dateStr = r.date || r.date_range || '—';
      const num = r.number != null ? r.number.toLocaleString() : '—';
      const src = r.source_url ? '<a href="'+r.source_url+'" target="_blank" rel="noopener">Source</a>' : '';
      return '<tr>'+
        '<td>'+esc(r.state)+'</td>'+
        '<td>'+esc(r.water_name||'—')+'</td>'+
        '<td>'+esc(r.county||'—')+'</td>'+
        '<td>'+esc(r.species||'—')+'</td>'+
        '<td class="num">'+num+'</td>'+
        '<td>'+esc(dateStr)+'</td>'+
        '<td>'+src+'</td>'+
        '</tr>';
    }).join('');
  }

  function renderPagination(){
    const total = Math.ceil(filtered.length / PER_PAGE) || 1;
    let html = '<button id="pg-prev">&laquo; Prev</button> ';

    // Show max 7 page buttons
    let pages = [];
    if(total <= 7){
      for(let i=1;i<=total;i++) pages.push(i);
    } else {
      pages.push(1);
      if(currentPage > 3) pages.push('...');
      for(let i=Math.max(2,currentPage-1);i<=Math.min(total-1,currentPage+1);i++) pages.push(i);
      if(currentPage < total-2) pages.push('...');
      pages.push(total);
    }

    pages.forEach(p => {
      if(p==='...') html += '<span style="padding:0 .25rem;color:#94a3b8">…</span>';
      else html += '<button class="pg-num'+(p===currentPage?' active':'')+'" data-pg="'+p+'">'+p+'</button> ';
    });

    html += '<button id="pg-next">Next &raquo;</button>';
    html += ' <span class="page-info">Page '+currentPage+' of '+total+'</span>';
    els['pagination'].innerHTML = html;

    document.getElementById('pg-prev').disabled = currentPage===1;
    document.getElementById('pg-next').disabled = currentPage===total;

    document.getElementById('pg-prev').onclick = () => {if(currentPage>1){currentPage--;renderTable();renderPagination();}};
    document.getElementById('pg-next').onclick = () => {if(currentPage<total){currentPage++;renderTable();renderPagination();}};
    els['pagination'].querySelectorAll('.pg-num').forEach(b => {
      b.onclick = () => {currentPage=parseInt(b.dataset.pg);renderTable();renderPagination();};
    });
  }

  // ===== Sorting =====
  function bindSort(){
    els['table-head'].querySelectorAll('th[data-col]').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.dataset.col;
        if(sortCol===col) sortAsc=!sortAsc;
        else { sortCol=col; sortAsc=true; }
        doSort();
        renderTable();
        renderPagination();
        // Update arrows
        els['table-head'].querySelectorAll('th').forEach(t=>t.classList.remove('sorted'));
        th.classList.add('sorted');
        els['table-head'].querySelectorAll('.sort-arrow').forEach(a=>a.textContent='↕');
        th.querySelector('.sort-arrow').textContent = sortAsc ? '↑' : '↓';
      });
    });
  }

  function doSort(){
    const key = sortCol;
    const dir = sortAsc ? 1 : -1;
    filtered.sort((a,b) => {
      let va = key==='number' ? (a[key]??-1) : (key==='date_display' ? (a.date||a.date_range||'') : (a[key]||''));
      let vb = key==='number' ? (b[key]??-1) : (key==='date_display' ? (b.date||b.date_range||'') : (b[key]||''));
      if(typeof va==='string') va=va.toLowerCase();
      if(typeof vb==='string') vb=vb.toLowerCase();
      if(va<vb) return -dir;
      if(va>vb) return dir;
      return 0;
    });
  }

  // ===== Charts =====
  function renderCharts(){
    // Species chart
    const speciesCounts = {};
    allData.forEach(r => { const s=r.species||'Unknown'; speciesCounts[s]=(speciesCounts[s]||0)+1; });
    const speciesSorted = Object.entries(speciesCounts).sort((a,b)=>b[1]-a[1]);
    const maxSpecies = speciesSorted[0]?speciesSorted[0][1]:1;

    els['chart-species'].innerHTML = speciesSorted.map(([name,count],i) => {
      const pct = (count/maxSpecies*100).toFixed(1);
      const color = COLORS[i % COLORS.length];
      return '<div class="bar-row">'+
        '<span class="bar-label">'+esc(name)+'</span>'+
        '<div class="bar-track"><div class="bar-fill" style="width:'+pct+'%;background:'+color+'">'+count+'</div></div>'+
        '</div>';
    }).join('');

    // State cards
    const states = unique(allData,'state');
    els['state-cards'].innerHTML = states.map(st => {
      const stData = allData.filter(r=>r.state===st);
      const waters = new Set(stData.map(r=>r.water_name)).size;
      const species = new Set(stData.map(r=>r.species)).size;
      const withCount = stData.filter(r=>r.number!=null);
      const totalFish = withCount.reduce((s,r)=>s+r.number,0);
      return '<div class="state-card">'+
        '<h3>'+esc(st)+'</h3>'+
        '<div class="detail">📋 '+stData.length.toLocaleString()+' stockings</div>'+
        '<div class="detail">🏞️ '+waters.toLocaleString()+' water bodies</div>'+
        '<div class="detail">🐟 '+species+' species</div>'+
        (totalFish ? '<div class="detail">🔢 '+totalFish.toLocaleString()+' fish reported</div>' : '')+
        '</div>';
    }).join('');
  }

  // ===== Events =====
  function bindEvents(){
    els['filter-state'].addEventListener('change', () => {updateCountyFilter(); applyFilters();});
    els['filter-county'].addEventListener('change', applyFilters);
    els['filter-species'].addEventListener('change', applyFilters);
    let debounce;
    els['filter-search'].addEventListener('input', () => {clearTimeout(debounce); debounce=setTimeout(applyFilters,250);});
    els['btn-reset'].addEventListener('click', () => {
      els['filter-state'].value='';
      els['filter-county'].value='';
      els['filter-species'].value='';
      els['filter-search'].value='';
      updateCountyFilter();
      sortCol=null; sortAsc=true;
      applyFilters();
    });
    bindSort();
  }

  function esc(s){
    const d=document.createElement('div');d.textContent=s;return d.innerHTML;
  }

  document.addEventListener('DOMContentLoaded', init);
})();
