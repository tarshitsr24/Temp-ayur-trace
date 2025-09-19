// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract AyurTraceUnified {

    // From FarmerDashboard.sol
    enum BatchStatus { Pending, InTransit, Delivered, Processing }

    struct CropBatch {
        string batchId;
        string cropType;
        uint quantity; // in kg
        string harvestDate; // YYYY-MM-DD format
        string farmLocation; // Village name or GPS coordinates
        bytes32 photoHash; // SHA-256 hash of the geo-tagged photo
        BatchStatus status;
        address owner;
        uint timestamp; // Creation timestamp
    // Add-on metadata (does not affect legacy behavior)
    string farmerName;      // Optional snapshot of the farmer's name
    string farmerUsername;  // Optional snapshot of the farmer's username
    }

    mapping(string => CropBatch) public batches;
    mapping(address => string[]) public farmerBatchIds;

    event BatchCreated(
        string indexed batchId,
        address indexed owner,
        string cropType,
        uint quantity,
        string farmLocation,
        bytes32 photoHash,
        uint timestamp
    );

    // Additive event with name+username snapshot at creation (does not replace the legacy one)
    event BatchCreatedV2(
        string indexed batchId,
        address indexed owner,
        string cropType,
        uint quantity,
        string farmLocation,
        bytes32 photoHash,
        string farmerName,
        string farmerUsername,
        uint timestamp
    );

    event BatchStatusUpdated(
        string indexed batchId,
        address indexed updater,
        BatchStatus oldStatus,
        BatchStatus newStatus,
        uint timestamp
    );

    // From auditor.sol
    struct Inspection {
        string batchId;        // Batch ID (e.g. FR123-20250908)
        string inspectorId;    // Auditor ID (e.g. AUD001)
        string result;         // approved / rejected / pending
        string notes;          // Quality notes
        uint256 date;          // Inspection date (timestamp)
    }

    mapping(string => Inspection) public inspections;
    event InspectionAdded(string batchId, string inspectorId, string result, string notes, uint256 date);

    // From collector.sol
    struct Collection {
        string farmerBatchId; // Unique ID from the farmer, e.g., FR123-20250908
        string farmerId; // Farmer's identifier, e.g., Ramesh (FR123)
        string cropName; // Name of the crop, e.g., Rice
        uint256 quantity; // Quantity in kg, e.g., 100
        string collectorId; // ID of the collector who registered this
        uint256 collectionDate; // Timestamp of collection
        string status; // e.g., "Sent to Auditor"
    }

    mapping(string => Collection) public collections;

    event CollectionAdded(
        string indexed farmerBatchId,
        string collectorId,
        string farmerId,
        uint256 collectionDate
    );

    // From distributor (1).sol
    struct InventoryItem {
        string batchId; // The unique ID for the product batch
        string herbType; // e.g., "Turmeric", "Ginger"
        uint256 quantity; // The current quantity in stock (e.g., in kg)
        string storageLocation; // e.g., "A1" for Warehouse A, Section 1
        string status; // e.g., "In Stock", "Dispatched"
        bool isInitialized; // Flag to check if the batch has been recorded
    }

    mapping(string => InventoryItem) public inventory;

    event ProductReceived(
        string indexed batchId,
        string herbType,
        uint256 quantity,
        string storageLocation,
        address recordedBy
    );

    event ProductDispatched(
        string indexed batchId,
        uint256 quantityDispatched,
        string destination,
        address recordedBy
    );

    // From maufacturer.sol
    struct Product {
        string productId; // New ID for the final product, e.g., MF789-20250909
        string sourceBatchId; // The ID of the raw material batch, e.g., FR123-20250908
        string productType; // e.g., "Rice Bag 25kg"
        uint256 quantityProcessed; // Input quantity
        uint256 wastage; // Wastage in kg
        uint256 processingDate; // Timestamp of processing
        uint256 expiryDate; // Timestamp of expiry
        string manufacturerId; // ID of the manufacturer
    }

    mapping(string => Product) public products;

    event ProductCreated(
        string indexed productId,
        string sourceBatchId,
        string productType,
        string manufacturerId
    );

    // -----------------------------
    // Stakeholder Profiles (generic)
    // -----------------------------
    // Supports saving name + username for all stakeholders and fetching by
    // address, username, or name.

    enum Role { Unknown, Farmer, Auditor, Collector, Manufacturer, Distributor }

    struct Profile {
        string name;        // Full name to display
        string username;    // Unique username (global uniqueness)
        Role role;          // Stakeholder role
        address account;    // Account address (owner of this profile)
        uint256 createdAt;  // First time profile was created
    }

    // Address => Profile
    mapping(address => Profile) public profiles;

    // keccak256(username) => address (enforces global uniqueness)
    mapping(bytes32 => address) public usernameToAddress;

    // keccak256(name) => addresses (multiple users can share the same name)
    mapping(bytes32 => address[]) private nameToAddresses;

    event ProfileSet(
        address indexed account,
        string name,
        string username,
        Role role,
        uint256 timestamp
    );

    // -----------------------------
    // Batch indexes by farmer username/name (for search)
    // -----------------------------
    // These enable querying batches by farmer username/name without relying on address.
    mapping(bytes32 => string[]) private batchIdsByFarmerUsername; // keccak256(username) => batchIds
    mapping(bytes32 => string[]) private batchIdsByFarmerName;     // keccak256(name) => batchIds

    function _setProfile(
        string memory _name,
        string memory _username,
        Role _role
    ) internal {
        require(bytes(_name).length > 0, "Name required");
        require(bytes(_username).length > 0, "Username required");

        bytes32 unameHash = keccak256(bytes(_username));
        address currentOwner = usernameToAddress[unameHash];
        require(
            currentOwner == address(0) || currentOwner == msg.sender,
            "Username already taken"
        );

        // If user had a previous username, free it when changing
        Profile storage p = profiles[msg.sender];
        if (bytes(p.username).length > 0) {
            bytes32 oldHash = keccak256(bytes(p.username));
            if (oldHash != unameHash && usernameToAddress[oldHash] == msg.sender) {
                usernameToAddress[oldHash] = address(0);
            }
        }

        // Update profile
        p.name = _name;
        p.username = _username;
        p.role = _role;
        p.account = msg.sender;
        if (p.createdAt == 0) {
            p.createdAt = block.timestamp;
        }

        // Indexes
        usernameToAddress[unameHash] = msg.sender;
        nameToAddresses[keccak256(bytes(_name))].push(msg.sender);

        emit ProfileSet(msg.sender, _name, _username, _role, block.timestamp);
    }

    // Convenience role-specific setters
    function setFarmerProfile(string memory _name, string memory _username) public {
        _setProfile(_name, _username, Role.Farmer);
    }

    function setAuditorProfile(string memory _name, string memory _username) public {
        _setProfile(_name, _username, Role.Auditor);
    }

    function setCollectorProfile(string memory _name, string memory _username) public {
        _setProfile(_name, _username, Role.Collector);
    }

    function setManufacturerProfile(string memory _name, string memory _username) public {
        _setProfile(_name, _username, Role.Manufacturer);
    }

    function setDistributorProfile(string memory _name, string memory _username) public {
        _setProfile(_name, _username, Role.Distributor);
    }

    // Getters
    function getProfile(address _account)
        public
        view
        returns (
            string memory name_,
            string memory username_,
            Role role_,
            address account_,
            uint256 createdAt_
        )
    {
        Profile storage p = profiles[_account];
        return (p.name, p.username, p.role, p.account, p.createdAt);
    }

    function getAccountByUsername(string memory _username) public view returns (address) {
        return usernameToAddress[keccak256(bytes(_username))];
    }

    function getProfileByUsername(string memory _username)
        public
        view
        returns (
            string memory name_,
            string memory username_,
            Role role_,
            address account_,
            uint256 createdAt_
        )
    {
        address account = usernameToAddress[keccak256(bytes(_username))];
        require(account != address(0), "Username not found");
        Profile storage p = profiles[account];
        return (p.name, p.username, p.role, p.account, p.createdAt);
    }

    function getAddressesByName(string memory _name) public view returns (address[] memory) {
        // Filter to only current matches (avoid stale entries if a user changed name)
        bytes32 key = keccak256(bytes(_name));
        address[] storage list = nameToAddresses[key];

        // First pass: count matches
        uint256 count = 0;
        for (uint256 i = 0; i < list.length; i++) {
            if (keccak256(bytes(profiles[list[i]].name)) == key) {
                count++;
            }
        }

        // Second pass: collect matches
        address[] memory out = new address[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < list.length; i++) {
            if (keccak256(bytes(profiles[list[i]].name)) == key) {
                out[idx++] = list[i];
            }
        }
        return out;
    }

    // Convenience: get a farmer's batches by username directly
    function getFarmerBatchIdsByUsername(string memory _username) public view returns (string[] memory) {
        address farmer = usernameToAddress[keccak256(bytes(_username))];
        require(farmer != address(0), "Username not found");
        return farmerBatchIds[farmer];
    }

    function getFarmerBatchIdsByName(string memory _name) public view returns (string[] memory) {
        address[] memory addrs = getAddressesByName(_name);
        // Count total batches across all addresses
        uint256 total = 0;
        for (uint256 i = 0; i < addrs.length; i++) {
            total += farmerBatchIds[addrs[i]].length;
        }
        // Collect
        string[] memory out = new string[](total);
        uint256 k = 0;
        for (uint256 i = 0; i < addrs.length; i++) {
            string[] storage ids = farmerBatchIds[addrs[i]];
            for (uint256 j = 0; j < ids.length; j++) {
                out[k++] = ids[j];
            }
        }
        return out;
    }

    // --- FUNCTIONS ---

    // From FarmerDashboard.sol
    function createBatch(
        string memory _batchId,
        string memory _cropType,
        uint _quantity,
        string memory _harvestDate,
        string memory _farmLocation,
        bytes32 _photoHash
    ) public {
        require(bytes(batches[_batchId].batchId).length == 0, "Batch ID already exists.");

        batches[_batchId] = CropBatch({
            batchId: _batchId,
            cropType: _cropType,
            quantity: _quantity,
            harvestDate: _harvestDate,
            farmLocation: _farmLocation,
            photoHash: _photoHash,
            status: BatchStatus.Pending,
            owner: msg.sender,
            timestamp: block.timestamp,
            farmerName: "",
            farmerUsername: ""
        });

        farmerBatchIds[msg.sender].push(_batchId);

        emit BatchCreated(
            _batchId,
            msg.sender,
            _cropType,
            _quantity,
            _farmLocation,
            _photoHash,
            block.timestamp
        );
    }

    // Backward-compatible new function that also captures farmer name + username snapshot.
    // If not provided, it will try to use the profile of msg.sender, if available.
    function createBatchV2(
        string memory _batchId,
        string memory _cropType,
        uint _quantity,
        string memory _harvestDate,
        string memory _farmLocation,
        bytes32 _photoHash,
        string memory _farmerName,
        string memory _farmerUsername
    ) public {
        require(bytes(batches[_batchId].batchId).length == 0, "Batch ID already exists.");

        // Resolve name and username: prefer explicit args, otherwise pull from profile (no hard registration required)
        string memory nameToSet = bytes(_farmerName).length > 0 ? _farmerName : profiles[msg.sender].name;
        string memory unameToSet = bytes(_farmerUsername).length > 0 ? _farmerUsername : profiles[msg.sender].username;

        batches[_batchId] = CropBatch({
            batchId: _batchId,
            cropType: _cropType,
            quantity: _quantity,
            harvestDate: _harvestDate,
            farmLocation: _farmLocation,
            photoHash: _photoHash,
            status: BatchStatus.Pending,
            owner: msg.sender,
            timestamp: block.timestamp,
            farmerName: nameToSet,
            farmerUsername: unameToSet
        });

        farmerBatchIds[msg.sender].push(_batchId);

        // Emit both events for broader compatibility
        emit BatchCreated(
            _batchId,
            msg.sender,
            _cropType,
            _quantity,
            _farmLocation,
            _photoHash,
            block.timestamp
        );
        emit BatchCreatedV2(
            _batchId,
            msg.sender,
            _cropType,
            _quantity,
            _farmLocation,
            _photoHash,
            nameToSet,
            unameToSet,
            block.timestamp
        );

        // Index this batch by username and name if available
        if (bytes(unameToSet).length > 0) {
            batchIdsByFarmerUsername[keccak256(bytes(unameToSet))].push(_batchId);
        }
        if (bytes(nameToSet).length > 0) {
            batchIdsByFarmerName[keccak256(bytes(nameToSet))].push(_batchId);
        }
    }

    function updateBatchStatus(string memory _batchId, BatchStatus _newStatus) public {
        require(bytes(batches[_batchId].batchId).length > 0, "Batch ID does not exist.");
        require(batches[_batchId].owner == msg.sender, "Only the owner can update batch status.");

        BatchStatus oldStatus = batches[_batchId].status;
        batches[_batchId].status = _newStatus;

        emit BatchStatusUpdated(_batchId, msg.sender, oldStatus, _newStatus, block.timestamp);
    }

    function getBatchDetails(string memory _batchId) public view returns (
        string memory batchId,
        string memory cropType,
        uint quantity,
        string memory harvestDate,
        string memory farmLocation,
        bytes32 photoHash,
        BatchStatus status,
        address owner,
        uint timestamp
    ) {
        require(bytes(batches[_batchId].batchId).length > 0, "Batch ID does not exist.");
        CropBatch storage batch = batches[_batchId];
        return (
            batch.batchId,
            batch.cropType,
            batch.quantity,
            batch.harvestDate,
            batch.farmLocation,
            batch.photoHash,
            batch.status,
            batch.owner,
            batch.timestamp
        );
    }

    // Extended getter including farmer name and username snapshot
    function getBatchDetailsV2(string memory _batchId) public view returns (
        string memory batchId,
        string memory cropType,
        uint quantity,
        string memory harvestDate,
        string memory farmLocation,
        bytes32 photoHash,
        BatchStatus status,
        address owner,
        uint timestamp,
        string memory farmerName,
        string memory farmerUsername
    ) {
        require(bytes(batches[_batchId].batchId).length > 0, "Batch ID does not exist.");
        CropBatch storage batch = batches[_batchId];
        return (
            batch.batchId,
            batch.cropType,
            batch.quantity,
            batch.harvestDate,
            batch.farmLocation,
            batch.photoHash,
            batch.status,
            batch.owner,
            batch.timestamp,
            batch.farmerName,
            batch.farmerUsername
        );
    }

    // Batch search helpers
    function getBatchIdsByFarmerUsername(string memory _username) public view returns (string[] memory) {
        return batchIdsByFarmerUsername[keccak256(bytes(_username))];
    }
    function getBatchIdsByFarmerName(string memory _name) public view returns (string[] memory) {
        return batchIdsByFarmerName[keccak256(bytes(_name))];
    }

    function getFarmerBatchIds(address _farmerAddress) public view returns (string[] memory) {
        return farmerBatchIds[_farmerAddress];
    }

    function getBatchStatusString(BatchStatus _status) public pure returns (string memory) {
        if (_status == BatchStatus.Pending) return "Pending";
        if (_status == BatchStatus.InTransit) return "InTransit";
        if (_status == BatchStatus.Delivered) return "Delivered";
        if (_status == BatchStatus.Processing) return "Processing";
        return "Unknown";
    }

    // From auditor.sol
    function addInspection(
        string memory _batchId,
        string memory _inspectorId,
        string memory _result,
        string memory _notes
    ) public {
        inspections[_batchId] = Inspection({
            batchId: _batchId,
            inspectorId: _inspectorId,
            result: _result,
            notes: _notes,
            date: block.timestamp
        });

        emit InspectionAdded(_batchId, _inspectorId, _result, _notes, block.timestamp);
    }

    function getInspection(string memory _batchId) public view returns (
        string memory, string memory, string memory, string memory, uint256
    ) {
        Inspection memory i = inspections[_batchId];
        return (i.batchId, i.inspectorId, i.result, i.notes, i.date);
    }

    // From collector.sol
    function addCollection(
        string memory _farmerBatchId,
        string memory _farmerId,
        string memory _cropName,
        uint256 _quantity,
        string memory _collectorId
    ) public {
        require(
            collections[_farmerBatchId].collectionDate == 0,
            "Error: Batch ID already exists."
        );

        collections[_farmerBatchId] = Collection({
            farmerBatchId: _farmerBatchId,
            farmerId: _farmerId,
            cropName: _cropName,
            quantity: _quantity,
            collectorId: _collectorId,
            collectionDate: block.timestamp,
            status: "Sent to Auditor"
        });

        emit CollectionAdded(
            _farmerBatchId,
            _collectorId,
            _farmerId,
            block.timestamp
        );
    }

    function getCollection(
        string memory _farmerBatchId
    )
        public
        view
        returns (
            string memory,
            string memory,
            string memory,
            uint256,
            string memory,
            uint256,
            string memory
        )
    {
        Collection memory c = collections[_farmerBatchId];
        return (
            c.farmerBatchId,
            c.farmerId,
            c.cropName,
            c.quantity,
            c.collectorId,
            c.collectionDate,
            c.status
        );
    }

    // From distributor (1).sol
    function recordReception(
        string memory _batchId,
        string memory _herbType,
        uint256 _quantity,
        string memory _storageLocation
    ) public {
        require(
            !inventory[_batchId].isInitialized,
            "Batch ID has already been received."
        );
        require(_quantity > 0, "Quantity must be greater than zero.");

        inventory[_batchId] = InventoryItem({
            batchId: _batchId,
            herbType: _herbType,
            quantity: _quantity,
            storageLocation: _storageLocation,
            status: "In Stock",
            isInitialized: true
        });

        emit ProductReceived(
            _batchId,
            _herbType,
            _quantity,
            _storageLocation,
            msg.sender
        );
    }

    function recordDispatch(
        string memory _batchId,
        uint256 _quantityToDispatch,
        string memory _destination
    ) public {
        InventoryItem storage item = inventory[_batchId];

        require(item.isInitialized, "Batch ID not found in inventory.");
        require(
            item.quantity >= _quantityToDispatch,
            "Insufficient quantity to dispatch."
        );
        require(
            _quantityToDispatch > 0,
            "Dispatch quantity must be greater than zero."
        );

        item.quantity -= _quantityToDispatch;

        if (item.quantity == 0) {
            item.status = "Dispatched";
        }

        emit ProductDispatched(
            _batchId,
            _quantityToDispatch,
            _destination,
            msg.sender
        );
    }

    // From maufacturer.sol
    function createProduct(
        string memory _productId,
        string memory _sourceBatchId,
        string memory _productType,
        uint256 _quantityProcessed,
        uint256 _wastage,
        uint256 _processingDate,
        uint256 _expiryDate,
        string memory _manufacturerId
    ) public {
        require(
            products[_productId].processingDate == 0,
            "Error: Product ID already exists."
        );

        products[_productId] = Product({
            productId: _productId,
            sourceBatchId: _sourceBatchId,
            productType: _productType,
            quantityProcessed: _quantityProcessed,
            wastage: _wastage,
            processingDate: _processingDate,
            expiryDate: _expiryDate,
            manufacturerId: _manufacturerId
        });

        emit ProductCreated(
            _productId,
            _sourceBatchId,
            _productType,
            _manufacturerId
        );
    }
}