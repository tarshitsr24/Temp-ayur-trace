var deployedContracts = (function() {
    try {
        if (typeof window !== 'undefined') {
            var paths = [
                'deployed_contracts.json',
                './deployed_contracts.json',
                '../deployed_contracts.json',
                '/deployed_contracts.json'
            ];
            for (var i = 0; i < paths.length; i++) {
                try {
                    var xhr = new XMLHttpRequest();
                    xhr.open('GET', paths[i], false);
                    xhr.send(null);
                    if (xhr.status >= 200 && xhr.status < 300 && xhr.responseText) {
                        return JSON.parse(xhr.responseText);
                    }
                } catch (e) { /* try next path */ }
            }
        }
    } catch (e) {}
    try {
        if (typeof require === 'function') {
            return require('./deployed_contracts.json');
        }
    } catch (e) {}
    return {};
})();

const config = {
    GANACHE_URL: "http://127.0.0.1:7545", // Or your Ganache URL
    CONTRACT_ADDRESSES: {
        AuditorChain: deployedContracts.AuditorChain.address,
        CollectorChain: deployedContracts.CollectorChain.address,
        HerbChainDistributor: deployedContracts.HerbChainDistributor.address,
        FarmerDashboard: deployedContracts.FarmerDashboard.address,
        ManufacturerChain: deployedContracts.ManufacturerChain.address
    },
    PRIVATE_KEY: '0xbd414fbc0dbe0c33bcb8c7f232d9ec5a5cca11662cf983e854de54a3e797c6c3', // IMPORTANT: Replace with a private key from your Ganache instance
    CONTRACT_ABIS: {
        AuditorChain: deployedContracts.AuditorChain.abi,
        CollectorChain: deployedContracts.CollectorChain.abi,
        HerbChainDistributor: deployedContracts.HerbChainDistributor.abi,
        FarmerDashboard: deployedContracts.FarmerDashboard.abi,
        ManufacturerChain: deployedContracts.ManufacturerChain.abi
    },
    SUPABASE_URL: 'YOUR_SUPABASE_URL', // Replace with your Supabase Project URL
    SUPABASE_ANON_KEY: 'YOUR_SUPABASE_ANON_KEY' // Replace with your Supabase Public Anon Key
};

window.config = config;