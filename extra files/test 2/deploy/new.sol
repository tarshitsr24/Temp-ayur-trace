// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title SupplyChainTrace
 * @dev Tracks a product's journey through a supply chain.
 * This version adds Actor profiles to store user details on-chain.
 */
contract SupplyChainTrace {
    // Roles define the different stakeholders in the supply chain.
    enum Role { Unknown, Farmer, Collector, Auditor, Manufacturer, Distributor }

    // Actor profile to store details on-chain.
    struct Actor {
        string actorId;
        string name;
        string addr;
        string phone;
        Role role;
        bool isRegistered;
    }

    // Each action in the supply chain is recorded as a BlockEntry.
    struct BlockEntry {
        uint256 index;
        Role role;
        string actorId;
        string name;
        string addr;
        string timeStamp;
        string cropName;
        uint256 quantity;
        string location;
        string batchId;
        uint256 prevIndex;
        uint256 createdAt;
    }

    // --- Storage ---
    BlockEntry[] private blocks;
    mapping(string => Actor) public actors; // actorId -> Actor Profile
    mapping(string => uint256[]) private batchToIndices;
    mapping(string => string) private productToBatch;
    
    address public owner;

    // --- Events ---
    event BlockCreated(uint256 indexed index, string batchId, Role role, string actorId);
    event ActorRegistered(string actorId, Role role, string name);

    // --- Modifiers ---
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can perform this action");
        _;
    }

    modifier onlyRegisteredActor(string memory actorId, Role expectedRole) {
        require(actors[actorId].isRegistered, "Actor is not registered");
        require(actors[actorId].role == expectedRole, "Actor role does not match");
        _;
    }

    constructor() {
        owner = msg.sender;
        // Add a dummy block at index 0
        blocks.push();
    }

    // ========== Admin / Registration ==========
    function registerActor(string memory actorId, Role role, string memory name, string memory addr, string memory phone) external {
        require(!actors[actorId].isRegistered, "Actor ID is already registered");
        require(role != Role.Unknown, "Cannot register with Unknown role");
        
        actors[actorId] = Actor({
            actorId: actorId,
            name: name,
            addr: addr,
            phone: phone,
            role: role,
            isRegistered: true
        });

        emit ActorRegistered(actorId, role, name);
    }

    // ========== Internal helpers ==========
    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + value % 10));
            value /= 10;
        }
        return string(buffer);
    }
    
    function _generateBatchId(string memory actorId) internal view returns (string memory) {
        string memory ts = _toString(block.timestamp);
        string memory counter = _toString(blocks.length);
        return string(abi.encodePacked("B-", actorId, "-", ts, "-", counter));
    }

    function _createBlock(
        Role role,
        string memory actorId,
        string memory timeStamp,
        string memory cropName,
        uint256 quantity,
        string memory location,
        string memory batchId,
        uint256 prevIndex
    ) internal returns (uint256) {
        Actor storage actor = actors[actorId];
        uint256 newIndex = blocks.length;

        blocks.push(BlockEntry({
            index: newIndex, role: role, actorId: actorId, name: actor.name, addr: actor.addr,
            timeStamp: timeStamp, cropName: cropName, quantity: quantity, location: location,
            batchId: batchId, prevIndex: prevIndex, createdAt: block.timestamp
        }));

        batchToIndices[batchId].push(newIndex);
        emit BlockCreated(newIndex, batchId, role, actorId);
        return newIndex;
    }

    // ========== Create block functions ==========
    function createFarmerBlockAutoBatch(
        string memory farmerId, string memory timeStamp,
        string memory cropName, uint256 quantity, string memory location
    ) external onlyRegisteredActor(farmerId, Role.Farmer) returns (uint256 index, string memory batchId) {
        batchId = _generateBatchId(farmerId);
        index = _createBlock(Role.Farmer, farmerId, timeStamp, cropName, quantity, location, batchId, 0);
    }

    function createCollectorBlock(
        string memory collectorId, string memory timeStamp,
        string memory cropName, uint256 quantity, string memory location, string memory batchId, uint256 prevIndex
    ) external onlyRegisteredActor(collectorId, Role.Collector) returns (uint256) {
        require(prevIndex > 0 && prevIndex < blocks.length, "Previous index out of range");
        return _createBlock(Role.Collector, collectorId, timeStamp, cropName, quantity, location, batchId, prevIndex);
    }

    function createAuditorBlock(
        string memory auditorId, string memory timeStamp,
        string memory cropName, uint256 quantity, string memory location, string memory batchId, uint256 prevIndex
    ) external onlyRegisteredActor(auditorId, Role.Auditor) returns (uint256) {
        require(prevIndex > 0 && prevIndex < blocks.length, "Previous index out of range");
        return _createBlock(Role.Auditor, auditorId, timeStamp, cropName, quantity, location, batchId, prevIndex);
    }

    function createManufacturerBlock(
        string memory manufacturerId, string memory timeStamp,
        string memory productName, uint256 quantity, string memory location, string memory batchId, 
        uint256 prevIndex, string memory productId
    ) external onlyRegisteredActor(manufacturerId, Role.Manufacturer) returns (uint256) {
        require(prevIndex > 0 && prevIndex < blocks.length, "Previous index out of range");
        uint256 idx = _createBlock(Role.Manufacturer, manufacturerId, timeStamp, productName, quantity, location, batchId, prevIndex);
        if (bytes(productId).length > 0) {
            productToBatch[productId] = batchId;
        }
        return idx;
    }

    function createDistributorBlock(
        string memory distributorId, string memory timeStamp,
        string memory productName, uint256 quantity, string memory location, string memory batchId, uint256 prevIndex
    ) external onlyRegisteredActor(distributorId, Role.Distributor) returns (uint256) {
        require(prevIndex > 0 && prevIndex < blocks.length, "Previous index out of range");
        return _createBlock(Role.Distributor, distributorId, timeStamp, productName, quantity, location, batchId, prevIndex);
    }
    
    // ========== View / Query functions ==========
    function getBlock(uint256 index) public view returns (BlockEntry memory) {
        require(index > 0 && index < blocks.length, "Index out of range");
        return blocks[index];
    }
    
    function getFullChainByBatch(string memory batchId) public view returns (BlockEntry[] memory) {
        uint256[] memory indices = batchToIndices[batchId];
        uint256 n = indices.length;
        BlockEntry[] memory result = new BlockEntry[](n);

        for (uint256 i = 0; i < n; i++) {
            result[i] = blocks[indices[i]];
        }
        return result;
    }

    function getBatchIdForProduct(string memory productId) public view returns (string memory) {
        return productToBatch[productId];
    }
}
