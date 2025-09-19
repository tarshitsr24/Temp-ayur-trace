// Inject dynamic data into static stakeholder dashboards without modifying original files
// Works for same-origin iframes. We target common selectors and replace hardcoded text.
(function(){
  function setText(el, text){ if (el) el.textContent = text; }
  function setHtml(el, html){ if (el) el.innerHTML = html; }

  function injectFarmer(doc, session){
    // Replace Welcome name and user menu initials if present
    const name = session.name || session.email;
    const initials = name.split(/\s+/).map(s=>s[0]).join('').slice(0,2).toUpperCase();
    setText(doc.querySelector('.user-menu span'), name);
    setText(doc.querySelector('.user-avatar'), initials);
    const welcomeH1 = Array.from(doc.querySelectorAll('h1')).find(h=>/welcome/i.test(h.textContent));
    if (welcomeH1) welcomeH1.textContent = `Welcome back, ${name.split(' ')[0]}!`;

    // Load user batches from DB and render into .batch-history-grid if exists
    const grid = doc.getElementById('batchHistoryGrid');
    if (grid){
      const batches = DB.listBatchesByUser(session.id);
      if (batches.length){
        grid.innerHTML = '';
        for (const b of batches){
          const card = doc.createElement('div');
          card.className = 'batch-card';
          card.innerHTML = `
            <div class="batch-header">
              <div class="batch-crop">
                <div class="crop-icon"><i class="fas fa-leaf"></i></div>
                <div class="crop-name">${b.cropType || '-'}${b.productType? ' - ' + b.productType : ''}</div>
              </div>
              <span class="status ${b.status && b.status.toLowerCase()}">${b.status || 'Pending'}</span>
            </div>
            <div class="batch-details">
              <div class="detail-row"><span class="detail-label">Batch ID</span><span class="detail-value">${b.id}</span></div>
              <div class="detail-row"><span class="detail-label">Quantity</span><span class="detail-value">${b.quantity || '-'}kg</span></div>
              <div class="detail-row"><span class="detail-label">Created</span><span class="detail-value">${new Date(b.createdAt).toLocaleString()}</span></div>
            </div>`;
          grid.appendChild(card);
        }
      }

      // Hook create new batch form if it exists
      const form = doc.getElementById('newBatchForm');
      const qrOut = doc.getElementById('qrCodeOutput');
      const batchIdEl = doc.getElementById('generatedBatchId');
      const qrImg = doc.getElementById('generatedQrCode');
      if (form && qrOut && batchIdEl && qrImg){
        form.addEventListener('submit', (ev)=>{
          try{
            // Let the page's own handler run first; then mirror into DB after a short delay
            setTimeout(()=>{
              const cropType = doc.getElementById('cropType')?.value;
              const quantity = doc.getElementById('quantity')?.value;
              const harvestDate = doc.getElementById('harvestDate')?.value;
              const farmLocation = doc.getElementById('farmLocation')?.value;
              const record = DB.addBatch({
                id: DB.generateBatchId(harvestDate),
                cropType, quantity, harvestDate, farmLocation,
                createdBy: session.id,
                ownerRole: 'Farmer',
                status: 'Pending'
              });
              batchIdEl.textContent = record.id;
              qrImg.src = DB.makeQrDataUrl({ batchId: record.id, cropType, quantity, harvestDate, farmLocation });
              qrOut.style.display = 'block';
            }, 100);
          }catch(e){ console.warn('Batch mirror failed', e); }
        }, true);
      }
    }
  }

  function injectCollector(doc, session){
    setText(doc.querySelector('.dashboard-header h2'), 'Collector Dashboard');
  }

  function injectManufacturer(doc, session){
    // Optionally inject name somewhere if exists
  }

  function injectAuditor(doc, session){ }
  function injectDistributor(doc, session){ }

  const Injector = {
    inject(frame, session){
      const doc = frame.contentDocument;
      if (!doc) return;
      const title = (doc.title || '').toLowerCase();
      // Generic user name injection if header exists
      const headerLogo = doc.querySelector('header .logo h1');
      if (headerLogo) headerLogo.textContent = 'AyurTrace';

      if (title.includes('farmer')) return injectFarmer(doc, session);
      if (title.includes('collector')) return injectCollector(doc, session);
      if (title.includes('manufacturer')) return injectManufacturer(doc, session);
      if (title.includes('auditor')) return injectAuditor(doc, session);
      if (title.includes('distributor')) return injectDistributor(doc, session);
    }
  };

  window.Injector = Injector;
})();
