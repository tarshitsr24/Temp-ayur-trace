/* global window, ethers */

(function () {
  const cfg = window.AppConfig || window.config || {};

  // --- Config Validation ---
  function validateConfig() {
    const required = [
      'GANACHE_URL', 'CONTRACT_ADDRESS', 'CONTRACT_ABI', 'DEV_PRIVATE_KEY',
      'PINATA_GATEWAY', 'PINATA_UPLOAD_URL', 'PINATA_JWT'
    ];
    for (const key of required) {
      if (!cfg[key]) {
        console.error(`Config error: Missing ${key} in config.js`);
        throw new Error(`Missing required config: ${key}`);
      }
    }
    if (!Array.isArray(cfg.CONTRACT_ABI)) {
      throw new Error('CONTRACT_ABI must be an array');
    }
    if (typeof BigInt !== 'function') {
      throw new Error('BigInt is not supported in this environment.');
    }
  }

  const Blockchain = {
    provider: null,
    signer: null,
    contractRO: null,
    contractRW: null,
    cache: new Map(), // Add caching for performance
    batchCache: new Map(), // Cache for batch details

    async init() {
      // Prevent re-initialization
      if (this.provider && this.signer && this.contractRO && this.contractRW) {
        return true;
      }
      validateConfig();
      // Use Ganache RPC directly with provided private key
      this.provider = new ethers.JsonRpcProvider(cfg.GANACHE_URL);
      // Use the provided private key for signing
      if (cfg.DEV_PRIVATE_KEY) {
        this.signer = new ethers.Wallet(cfg.DEV_PRIVATE_KEY, this.provider);
      } else {
        throw new Error('DEV_PRIVATE_KEY not configured in config.js');
      }
      // Read-only contract
      this.contractRO = new ethers.Contract(cfg.CONTRACT_ADDRESS, cfg.CONTRACT_ABI, this.provider);
      // Read-write contract with signer
      this.contractRW = this.contractRO.connect(this.signer);
      // ABI sanity check
      if (!this.contractRO.interface) {
        console.warn('ABI/interface not found on contract. Check CONTRACT_ABI.');
      }
      return true;
    },

    requireSigner() {
      if (!this.contractRW) throw new Error('No signer available. Check DEV_PRIVATE_KEY in config.js');
      return this.contractRW;
    },

    // --- Image Upload to Pinata ---
    async uploadImageToPinata(imageBlob, metadata = {}) {
      const cfg = window.AppConfig || window.config || {};
      if (!cfg.PINATA_JWT || !cfg.PINATA_UPLOAD_URL) {
        throw new Error('Pinata credentials not configured in config.js');
      }

      const formData = new FormData();
      formData.append('file', imageBlob);
      formData.append('pinataMetadata', JSON.stringify({
        name: `crop-${Date.now()}.jpg`,
        ...metadata
      }));

      const response = await fetch(cfg.PINATA_UPLOAD_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cfg.PINATA_JWT}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Pinata upload failed: ${response.statusText}`);
      }

      const result = await response.json();
      return result.IpfsHash;
    },

    // Get IPFS image URL from hash
    getImageFromPinata(ipfsHash) {
      const cfg = window.AppConfig || window.config || {};
      const gateway = cfg.PINATA_GATEWAY || 'https://gateway.pinata.cloud';
      return `${gateway}/ipfs/${ipfsHash}`;
    },

    // Store IPFS hash mapping (for demo - in production, store in contract or database)
    storeIPFSMapping(photoHash, ipfsHash) {
      // Warning: localStorage is browser-specific and not persistent for production
      try {
        const mappings = JSON.parse(localStorage.getItem('ipfs_mappings') || '{}');
        mappings[photoHash] = ipfsHash;
        localStorage.setItem('ipfs_mappings', JSON.stringify(mappings));
      } catch (e) {
        console.warn('Failed to store IPFS mapping in localStorage:', e);
      }
    },

    // Get original IPFS hash from bytes32 hash
    getOriginalIPFSHash(photoHash) {
      try {
        const mappings = JSON.parse(localStorage.getItem('ipfs_mappings') || '{}');
        return mappings[photoHash] || null;
      } catch (e) {
        console.warn('Failed to read IPFS mapping from localStorage:', e);
        return null;
      }
    },
    // Parse farmLocation augmented string like: "Village A ::FARMER=Ramesh ::IPFS=Qm..."
    parseFarmLocationMeta(farmLocationStr) {
      if (!farmLocationStr || typeof farmLocationStr !== 'string') {
        return { base: farmLocationStr || '', farmer: null, ipfs: null };
      }
      let base = farmLocationStr;
      let farmer = null;
      let ipfs = null;
      const parts = farmLocationStr.split('::').map(p => p.trim());
      if (parts.length > 1) {
        base = parts[0].trim();
        for (let i = 1; i < parts.length; i++) {
          const p = parts[i];
          if (p.toUpperCase().startsWith('FARMER=')) {
            farmer = p.substring(7).trim();
          } else if (p.toUpperCase().startsWith('IPFS=')) {
            ipfs = p.substring(5).trim();
          }
        }
      }
      return { base, farmer, ipfs };
    },
    // Build image URL for a BatchCreated args if possible (photoHash mapping or embedded ipfs)
    imageUrlFromArgs(args) {
      // prefer embedded IPFS if present in farmLocation meta
      try {
        const meta = this.parseFarmLocationMeta(args.farmLocation || '');
        if (meta.ipfs) {
          return this.getImageFromPinata(meta.ipfs);
        }
      } catch (e) { console.warn('parseFarmLocationMeta error:', e); }
      // fallback: use stored mapping from photoHash -> ipfs hash if available
      try {
        if (args.photoHash) {
          const original = this.getOriginalIPFSHash(args.photoHash);
          if (original) return this.getImageFromPinata(original);
        }
      } catch (e) { console.warn('imageUrlFromArgs fallback error:', e); }
      return null;
    },

    // --- Farmer ---
    async createBatch({ batchId, cropType, quantity, harvestDate, farmLocation, photoHash }) {
      const c = this.requireSigner();
      const hash = photoHash && /^0x[0-9a-fA-F]{64}$/.test(photoHash)
        ? photoHash
        : ethers.id(`${batchId}:${Date.now()}`); // placeholder bytes32

      // Try to attach user name/username from Supabase session and use V2

      let session = null;
      if (typeof window.getCurrentUser === 'function') {
        session = await window.getCurrentUser();
      } else {
        console.warn('window.getCurrentUser is not defined. Farmer name/username may be missing.');
      }
      const farmerName = session?.name || session?.actorId || '';
      const farmerUsername = session?.actorId || '';

      if (c.createBatchV2) {
        const tx = await c.createBatchV2(batchId, cropType, BigInt(quantity), harvestDate, farmLocation, hash, farmerName, farmerUsername);
        const receipt = await tx.wait();
        return receipt;
      }

      // Fallback to legacy
      const tx = await c.createBatch(batchId, cropType, BigInt(quantity), harvestDate, farmLocation, hash);
      const receipt = await tx.wait();
      return receipt;
    },
    async getBatchDetails(batchId) {
      // Check cache first for performance
      const cacheKey = `batch_${batchId}`;
      if (this.batchCache.has(cacheKey)) {
        return this.batchCache.get(cacheKey);
      }
      console.log(`📋 Getting batch details for: ${batchId}`);
      let result;
      try {
        if (typeof this.contractRO.getBatchDetailsV2 === 'function') {
          console.log('📋 Using getBatchDetailsV2');
          result = await this.contractRO.getBatchDetailsV2(batchId);
        } else if (typeof this.contractRO.getBatchDetails === 'function') {
          console.log('📋 Using getBatchDetails');
          result = await this.contractRO.getBatchDetails(batchId);
        } else {
          throw new Error('No batch details function available');
        }
        console.log('📋 Raw batch result:', result);
        // Check if batch exists (batchId should not be empty)
        if (!result || (Array.isArray(result) && result[0] === '') || (!Array.isArray(result) && result.batchId === '')) {
          console.log('📋 Batch does not exist (empty batchId)');
          return null;
        }
        // Cache the result for 5 minutes
        this.batchCache.set(cacheKey, result);
        setTimeout(() => this.batchCache.delete(cacheKey), 5 * 60 * 1000);
        console.log('📋 Batch exists and cached');
        return result;
      } catch (error) {
        console.error(`📋 Error getting batch details for ${batchId}:`, error);
        throw error;
      }
    },

    // Debug function to check what batches exist
    async debugListAllBatches() {
      try {
        console.log('🔍 Searching for all BatchCreated events...');

        // Try BatchCreatedV2 first, then fallback to BatchCreated
        let logs = [];
        if (this.contractRO.filters.BatchCreatedV2) {
          logs = await this.contractRO.queryFilter(this.contractRO.filters.BatchCreatedV2(), 0, 'latest');
          console.log(`Found ${logs.length} BatchCreatedV2 events`);
        }

        if (logs.length === 0) {
          logs = await this.contractRO.queryFilter(this.contractRO.filters.BatchCreated(), 0, 'latest');
          console.log(`Found ${logs.length} BatchCreated events`);
        }

        const batchIds = logs.map(log => log.args.batchId).filter(id => id);
        console.log('📦 Found batch IDs:', batchIds);
        return batchIds;
      } catch (error) {
        console.error('Error listing batches:', error);
        return [];
      }
    },

    // Get all batches created by the current farmer
    async getFarmerBatches(fromBlock = 0n, toBlock = 'latest') {
      try {
        const batchCreatedLogs = await this.contractRO.queryFilter(
          (this.contractRO.filters.BatchCreatedV2 ? this.contractRO.filters.BatchCreatedV2() : this.contractRO.filters.BatchCreated()),
          fromBlock,
          toBlock
        );

        const batches = [];
        for (const log of batchCreatedLogs) {
          try {
            const batchId = log.args.batchId;
            const batchDetails = await this.getBatchDetails(batchId);

            if (batchDetails && (batchDetails[0] || batchDetails.batchId)) { // Check if batch exists
              const bd = batchDetails;
              const asArr = Array.isArray(bd) ? bd : [bd.batchId, bd.cropType, bd.quantity, bd.harvestDate, bd.farmLocation, bd.photoHash, bd.status, bd.owner, bd.timestamp, bd.farmerName, bd.farmerUsername];
              batches.push({
                id: asArr[0],
                cropType: asArr[1] || 'Unknown',
                quantity: asArr[2] ? asArr[2].toString() : '0',
                harvestDate: asArr[3] || '',
                farmLocation: asArr[4] || '',
                farmerName: asArr[9] || '',
                farmerUsername: asArr[10] || '',
                timestamp: log.blockNumber ? new Date().toISOString() : new Date().toISOString(), // temp
                status: 'Created',
                blockNumber: log.blockNumber
              });
            }
          } catch (err) {
            console.warn(`Failed to get details for batch ${log.args.batchId}:`, err);
          }
        }

        // Sort by block number (newest first)
        return batches.sort((a, b) => (b.blockNumber || 0) - (a.blockNumber || 0));
      } catch (error) {
        console.error('Error fetching farmer batches:', error);
        return [];
      }
    },

    // Search by username/name via contract indexes
    async findBatchesByFarmerUsername(username) {
      if (!this.contractRO.getBatchIdsByFarmerUsername) return [];
      try { return await this.contractRO.getBatchIdsByFarmerUsername(username); } catch { return []; }
    },
    async findBatchesByFarmerName(name) {
      if (!this.contractRO.getBatchIdsByFarmerName) return [];
      try { return await this.contractRO.getBatchIdsByFarmerName(name); } catch { return []; }
    },

    // High-level: fetch batches for a specific username in real time
    async getBatchesForUsername(username) {
      await this.init();
      // If no username provided, try to get from current session

      let actualUsername = username;
      if (!actualUsername) {
        if (typeof window.getCurrentActorId === 'function') {
          actualUsername = await window.getCurrentActorId();
        } else {
          console.warn('window.getCurrentActorId is not defined. Username may be missing.');
        }
      }
      if (!actualUsername) {
        console.warn('No username available for batch fetch');
        return [];
      }

      console.log('Fetching batches for username:', actualUsername);

      // 1) Get IDs by username (V2 index) - only if function exists
      let ids = [];
      try {
        if (this.contractRO.getBatchIdsByFarmerUsername) {
          ids = await this.findBatchesByFarmerUsername(actualUsername);
          console.log('V2 username index returned:', ids);
        }
      } catch (e) {
        console.warn('V2 username fetch failed:', e.message);
      }

      // 2) Fallback: resolve address then get legacy address-indexed IDs
      if ((!ids || ids.length === 0) && this.contractRO.getAccountByUsername) {
        try {
          const addr = await this.contractRO.getAccountByUsername(actualUsername);
          console.log('Resolved username to address:', addr);
          if (addr && addr !== ethers.ZeroAddress && this.contractRO.getFarmerBatchIds) {
            ids = await this.contractRO.getFarmerBatchIds(addr);
            console.log('Legacy address-based IDs:', ids);
          }
        } catch (e) {
          console.warn('Address resolution failed:', e.message);
        }
      }

      if (!ids || ids.length === 0) {
        console.warn('No batch IDs found for username:', actualUsername);
        return [];
      }

      // 3) Load details for each ID (prefer V2 getter to get name/username)
      const results = [];
      for (const id of ids) {
        try {
          const d = (this.contractRO.getBatchDetailsV2)
            ? await this.contractRO.getBatchDetailsV2(id)
            : await this.contractRO.getBatchDetails(id);
          const arr = Array.isArray(d) ? d : [d.batchId, d.cropType, d.quantity, d.harvestDate, d.farmLocation, d.photoHash, d.status, d.owner, d.timestamp, d.farmerName, d.farmerUsername];
          results.push({
            id: arr[0],
            cropType: arr[1] || 'Unknown',
            quantity: arr[2] ? String(arr[2]) : '0',
            harvestDate: arr[3] || '',
            farmLocation: arr[4] || '',
            photoHash: arr[5],
            status: 'Created',
            timestamp: Number(arr[8] || Date.now()),
            farmerName: arr[9] || '',
            farmerUsername: arr[10] || ''
          });
        } catch (e) {
          console.warn('Failed to load batch', id, e.message);
        }
      }

      console.log('Final batch results:', results);
      return results;
    },

    // --- Collector ---
    async addCollection({ farmerBatchId, farmerId, cropName, quantity, collectorId }) {
      const c = this.requireSigner();
      // Use current actorId as collectorId if not provided
      let actualCollectorId = collectorId;
      if (!actualCollectorId) {
        if (typeof window.getCurrentActorId === 'function') {
          actualCollectorId = await window.getCurrentActorId();
        } else {
          console.warn('window.getCurrentActorId is not defined. CollectorId may be missing.');
        }
      }
      actualCollectorId = actualCollectorId || 'unknown';
      const tx = await c.addCollection(farmerBatchId, farmerId, cropName, BigInt(quantity), actualCollectorId);
      return await tx.wait();
    },
    async getCollection(farmerBatchId) {
      return await this.contractRO.getCollection(farmerBatchId);
    },

    // --- Auditor ---
    async addInspection({ batchId, inspectorId, result, notes }) {
      const c = this.requireSigner();
      // Use current actorId as inspectorId if not provided
      let actualInspectorId = inspectorId;
      if (!actualInspectorId) {
        if (typeof window.getCurrentActorId === 'function') {
          actualInspectorId = await window.getCurrentActorId();
        } else {
          console.warn('window.getCurrentActorId is not defined. InspectorId may be missing.');
        }
      }
      actualInspectorId = actualInspectorId || 'unknown';
      const tx = await c.addInspection(batchId, actualInspectorId, result, notes);
      return await tx.wait();
    },
    async getInspection(batchId) {
      return await this.contractRO.getInspection(batchId);
    },

    // --- Manufacturer ---
    async createProduct({ productId, sourceBatchId, productType, quantityProcessed, wastage, processingDate, expiryDate, manufacturerId }) {
      const c = this.requireSigner();
      // Use current actorId as manufacturerId if not provided
      let actualManufacturerId = manufacturerId;
      if (!actualManufacturerId) {
        if (typeof window.getCurrentActorId === 'function') {
          actualManufacturerId = await window.getCurrentActorId();
        } else {
          console.warn('window.getCurrentActorId is not defined. ManufacturerId may be missing.');
        }
      }
      actualManufacturerId = actualManufacturerId || 'unknown';
      const tx = await c.createProduct(
        productId,
        sourceBatchId,
        productType,
        BigInt(quantityProcessed),
        BigInt(wastage),
        BigInt(processingDate),
        BigInt(expiryDate),
        actualManufacturerId
      );
      return await tx.wait();
    },
    async getProduct(productId) {
      return await this.contractRO.products(productId);
    },

    // --- Distributor ---
    async recordReception({ batchId, herbType, quantity, storageLocation }) {
      const c = this.requireSigner();
      const tx = await c.recordReception(batchId, herbType, BigInt(quantity), storageLocation);
      return await tx.wait();
    },
    async recordDispatch({ batchId, quantityToDispatch, destination }) {
      const c = this.requireSigner();
      const tx = await c.recordDispatch(batchId, BigInt(quantityToDispatch), destination);
      return await tx.wait();
    },
    async getInventory(batchId) {
      return await this.contractRO.inventory(batchId);
    },

    // --- Events & Chain ---
    // --- Events & Chain (Optimized with Caching) ---
    async getChainForBatch(batchId, fromBlock = 0n, toBlock = 'latest') {
      // Check cache first
      const cacheKey = `chain_${batchId}_${fromBlock}_${toBlock}`;
      if (this.cache.has(cacheKey)) {
        console.log('Using cached chain data for', batchId);
        return this.cache.get(cacheKey);
      }

      console.time(`Fetching chain for ${batchId}`);
      console.log(`🔍 Searching for batch: ${batchId}`);
      const logs = [];

      try {
        // First, check if batch exists using getBatchDetails
        console.log('📋 Checking if batch exists...');
        let batchExists = false;
        try {
          const details = await this.getBatchDetails(batchId);
          console.log('📋 Batch details:', details);
          if (details && details.batchId && details.batchId !== '') {
            batchExists = true;
            console.log('✅ Batch exists in contract');
          }
        } catch (err) {
          console.log('❌ Batch does not exist or error getting details:', err.message);
        }

        if (!batchExists) {
          console.log('🚫 Batch not found, returning empty logs');
          return [];
        }

        // Resolve 'latest' to actual block number for range-limited queries
        let resolvedToBlock = toBlock;
        if (toBlock === 'latest') {
          resolvedToBlock = await this.provider.getBlockNumber();
        }

        // Use multicall pattern - batch all queries
        const queryPromises = [
          // BatchCreated query
          this.contractRO.queryFilter((this.contractRO.filters.BatchCreatedV2 ? this.contractRO.filters.BatchCreatedV2(batchId) : this.contractRO.filters.BatchCreated(batchId)), fromBlock, resolvedToBlock)
            .then(async (bc) => {
              console.log(`📦 BatchCreated events found: ${bc.length}`);
              if (bc.length > 0) {
                const detailsRaw = await this.getBatchDetails(batchId);
                const statusNames = ['Pending', 'InTransit', 'Delivered', 'Processing'];
                const asArr = Array.isArray(detailsRaw) ? detailsRaw : [detailsRaw.batchId, detailsRaw.cropType, detailsRaw.quantity, detailsRaw.harvestDate, detailsRaw.farmLocation, detailsRaw.photoHash, detailsRaw.status, detailsRaw.owner, detailsRaw.timestamp, detailsRaw.farmerName, detailsRaw.farmerUsername];
                return {
                  blockNumber: bc[0].blockNumber,
                  fragment: { name: (this.contractRO.filters.BatchCreatedV2 ? 'BatchCreatedV2' : 'BatchCreated') },
                  args: {
                    batchId: asArr[0],
                    cropType: asArr[1],
                    quantity: asArr[2],
                    harvestDate: asArr[3],
                    farmLocation: asArr[4],
                    photoHash: asArr[5],
                    status: asArr[6],
                    owner: asArr[7],
                    timestamp: asArr[8],
                    farmerName: asArr[9] || '',
                    farmerUsername: asArr[10] || '',
                    statusText: statusNames[Number(asArr[6] ?? 0)] || 'Unknown'
                  }
                };
              }
              return null;
            }).catch((err) => {
              console.log('❌ Error getting BatchCreated events:', err.message);
              return null;
            }),

          // Collection query
          this.contractRO.queryFilter(this.contractRO.filters.CollectionAdded(batchId), fromBlock, resolvedToBlock)
            .then(async (ca) => {
              if (ca.length > 0) {
                const colRaw = await this.getCollection(batchId);
                return {
                  blockNumber: ca[0].blockNumber,
                  fragment: { name: 'CollectionAdded' },
                  args: {
                    farmerBatchId: colRaw[0],
                    farmerId: colRaw[1],
                    cropName: colRaw[2],
                    quantity: colRaw[3],
                    collectorId: colRaw[4],
                    collectionDate: colRaw[5],
                    status: colRaw[6]
                  }
                };
              }
              return null;
            }).catch(() => null),

          // Inspection query
          (async () => {
            try {
              const insp = await this.getInspection(batchId);
              if (insp && insp[4] && BigInt(insp[4]) > 0n) {
                return {
                  blockNumber: 0,
                  args: { batchId, inspectorId: insp[1], result: insp[2], notes: insp[3], date: insp[4] },
                  fragment: { name: 'InspectionAdded' }
                };
              }
              return null;
            } catch {
              return null;
            }
          })()
        ];

        // Execute main queries in parallel
        const [batchResult, collectionResult, inspectionResult] = await Promise.all(queryPromises);
        // Add valid results
        [batchResult, collectionResult, inspectionResult].forEach(result => {
          if (result) logs.push(result);
        });

        // Handle product events with reduced scope
        try {
          // Only use BigInt for block numbers
          let productFromBlock = (typeof fromBlock === 'bigint' ? fromBlock : BigInt(fromBlock));
          let productToBlock = (typeof resolvedToBlock === 'bigint' ? resolvedToBlock : BigInt(resolvedToBlock));
          // Limit to last 1000 blocks if possible
          if (productToBlock > productFromBlock + 1000n) {
            productFromBlock = productToBlock - 1000n;
          }
          const productLogs = await this.contractRO.queryFilter(
            this.contractRO.filters.ProductCreated(),
            productFromBlock,
            productToBlock
          );
          // Process only relevant products in parallel
          const relevantProducts = await Promise.all(
            productLogs.slice(0, 10).map(async (l) => { // Limit to 10 recent products
              try {
                const product = await this.getProduct(l.args.productId);
                if (product && product.sourceBatchId === batchId) {
                  return {
                    blockNumber: l.blockNumber,
                    fragment: { name: 'ProductCreated' },
                    args: {
                      productId: product[0],
                      sourceBatchId: product[1],
                      productType: product[2],
                      quantityProcessed: product[3],
                      wastage: product[4],
                      processingDate: product[5],
                      expiryDate: product[6],
                      manufacturerId: product[7]
                    }
                  };
                }
              } catch (err) {
                console.warn('Error in getProduct for ProductCreated:', err);
              }
              return null;
            })
          );
          relevantProducts.forEach(p => p && logs.push(p));
        } catch (e) {
          console.warn('Product query failed:', e);
        }

        // Reception/Dispatch in parallel
        try {
          const [prLogs, pdLogs] = await Promise.all([
            this.contractRO.queryFilter(this.contractRO.filters.ProductReceived(batchId), fromBlock, resolvedToBlock),
            this.contractRO.queryFilter(this.contractRO.filters.ProductDispatched(batchId), fromBlock, resolvedToBlock)
          ]);
          logs.push(...prLogs.map(l => ({ ...l, fragment: { name: 'ProductReceived' } })));
          logs.push(...pdLogs.map(l => ({ ...l, fragment: { name: 'ProductDispatched' } })));
        } catch (err) {
          console.warn('Reception/Dispatch query failed:', err);
        }

        // Optimized timestamp enrichment
        const uniqueBlocks = [...new Set(logs.filter(l => l.blockNumber > 0).map(l => Number(l.blockNumber)))];
        if (uniqueBlocks.length > 0) {
          const blockPromises = uniqueBlocks.slice(0, 20).map(bn => // Limit to 20 blocks
            this.provider.getBlock(bn).then(blk => ({ bn, timestamp: blk?.timestamp })).catch(() => ({ bn, timestamp: null }))
          );
          const blockResults = await Promise.all(blockPromises);
          const blockTs = Object.fromEntries(blockResults.filter(r => r.timestamp).map(r => [r.bn, r.timestamp]));
          logs.forEach(l => {
            if (!l.args) return;
            const hasTs = ['timestamp', 'collectionDate', 'date', 'processingDate'].some(field => l.args[field] !== undefined);
            if (!hasTs && l.blockNumber && blockTs[Number(l.blockNumber)]) {
              l.args = { ...l.args, timestamp: BigInt(blockTs[Number(l.blockNumber)]) };
            }
          });
        }

        logs.sort((a, b) => (Number(a.blockNumber || 0) - Number(b.blockNumber || 0)));
        // Cache result for 2 minutes
        this.cache.set(cacheKey, logs);
        setTimeout(() => this.cache.delete(cacheKey), 2 * 60 * 1000);
        console.timeEnd(`Fetching chain for ${batchId}`);
        console.log(`Found ${logs.length} events for batch ${batchId}`);
        return logs;
      } catch (error) {
        console.error(`Error fetching chain for ${batchId}:`, error);
        throw error;
      }
    },

    // --- Lightweight off-chain metadata helpers (for names & extras) ---
    storeBatchMeta(batchId, meta) {
      // Warning: localStorage is browser-specific and not persistent for production
      try {
        const key = 'batch_meta';
        const all = JSON.parse(localStorage.getItem(key) || '{}');
        all[batchId] = { ...(all[batchId] || {}), ...meta };
        localStorage.setItem(key, JSON.stringify(all));
      } catch (e) {
        console.warn('Failed to store batch meta in localStorage:', e);
      }
    },
    getBatchMeta(batchId) {
      try {
        const all = JSON.parse(localStorage.getItem('batch_meta') || '{}');
        return all[batchId] || null;
      } catch (e) {
        console.warn('Failed to read batch meta from localStorage:', e);
        return null;
      }
    }
  };

  window.Blockchain = Blockchain;
})();
