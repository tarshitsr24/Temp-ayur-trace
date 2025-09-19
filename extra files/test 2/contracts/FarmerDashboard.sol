// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract FarmerDashboard {
    // Enum for batch status
    enum BatchStatus { Pending, InTransit, Delivered, Processing }

    // Struct to hold batch information
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
    }

    // Mapping from batchId to CropBatch
    mapping(string => CropBatch) public batches;
    // Mapping from owner address to an array of their batchIds
    mapping(address => string[]) public farmerBatchIds;

    // Event emitted when a new batch is created
    event BatchCreated(
        string indexed batchId,
        address indexed owner,
        string cropType,
        uint quantity,
        string farmLocation,
        bytes32 photoHash,
        uint timestamp
    );

    // Event emitted when a batch status is updated
    event BatchStatusUpdated(
        string indexed batchId,
        address indexed updater,
        BatchStatus oldStatus,
        BatchStatus newStatus,
        uint timestamp
    );

    // Function to create a new crop batch
    function createBatch(
        string memory _batchId,
        string memory _cropType,
        uint _quantity,
        string memory _harvestDate,
        string memory _farmLocation,
        bytes32 _photoHash
    ) public {
        require(bytes(batches[_batchId].batchId).length == 0, "Batch ID already exists."); // Ensure batchId is unique

        batches[_batchId] = CropBatch({
            batchId: _batchId,
            cropType: _cropType,
            quantity: _quantity,
            harvestDate: _harvestDate,
            farmLocation: _farmLocation,
            photoHash: _photoHash,
            status: BatchStatus.Pending, // Default status
            owner: msg.sender,
            timestamp: block.timestamp
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

    // Function to update the status of an existing batch
    function updateBatchStatus(string memory _batchId, BatchStatus _newStatus) public {
        require(bytes(batches[_batchId].batchId).length > 0, "Batch ID does not exist."); // Ensure batch exists
        require(batches[_batchId].owner == msg.sender, "Only the owner can update batch status."); // Only owner can update

        BatchStatus oldStatus = batches[_batchId].status;
        batches[_batchId].status = _newStatus;

        emit BatchStatusUpdated(_batchId, msg.sender, oldStatus, _newStatus, block.timestamp);
    }

    // Function to get details of a specific batch
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

    // Function to get all batch IDs for a specific farmer
    function getFarmerBatchIds(address _farmerAddress) public view returns (string[] memory) {
        return farmerBatchIds[_farmerAddress];
    }

    // Helper function to convert BatchStatus enum to string (for off-chain display)
    function getBatchStatusString(BatchStatus _status) public pure returns (string memory) {
        if (_status == BatchStatus.Pending) return "Pending";
        if (_status == BatchStatus.InTransit) return "InTransit";
        if (_status == BatchStatus.Delivered) return "Delivered";
        if (_status == BatchStatus.Processing) return "Processing";
        return "Unknown";
    }
}
