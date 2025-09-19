// Simple localStorage-based data store for AyurTrace web-app
(function(){
  const KEYS = {
    batches: 'ayurtrace_batches_v1',
  };

  function read(key, fallback){
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; }
  }
  function write(key, value){
    localStorage.setItem(key, JSON.stringify(value));
  }

  function uid(prefix='ID'){
    return `${prefix}-${Math.random().toString(36).slice(2,8)}-${Date.now().toString(36)}`;
  }

  function generateBatchId(dateStr){
    // AYR-YYYYMMDD-XXX
    const datePart = (dateStr || new Date().toISOString().slice(0,10)).replace(/-/g,'');
    const rand = Math.floor(Math.random()*1000).toString().padStart(3,'0');
    return `AYR-${datePart}-${rand}`;
  }

  function getBatches(){ return read(KEYS.batches, []); }
  function setBatches(list){ write(KEYS.batches, list); }

  function addBatch(batch){
    const list = getBatches();
    list.unshift({
      id: batch.id || generateBatchId(batch.harvestDate),
      createdAt: new Date().toISOString(),
      status: batch.status || 'Pending',
      ...batch,
    });
    setBatches(list);
    return list[0];
  }

  function updateBatch(id, patch){
    const list = getBatches();
    const idx = list.findIndex(b => b.id === id);
    if (idx >= 0){ list[idx] = { ...list[idx], ...patch }; setBatches(list); return list[idx]; }
    return null;
  }

  function getBatchById(id){ return getBatches().find(b => b.id === id) || null; }
  function listBatchesByUser(userId){ return getBatches().filter(b => b.createdBy === userId); }

  function makeQrDataUrl(data){
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(payload)}`;
  }

  window.DB = {
    uid,
    generateBatchId,
    getBatches,
    setBatches,
    addBatch,
    updateBatch,
    getBatchById,
    listBatchesByUser,
    makeQrDataUrl,
  };
})();
