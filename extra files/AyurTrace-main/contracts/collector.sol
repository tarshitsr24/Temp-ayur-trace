// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title CollectorChain
 * @dev This contract manages the collection of farm batches by collectors.
 * It records details like the farmer, crop, and quantity, and marks the
 * batch as ready for the next stage (auditing).
 */
contract CollectorChain {
    /**
     * @dev Represents a single batch collected from a farmer.
     * `farmerBatchId` is the primary identifier for the batch.
     * `collectionDate` is a timestamp automatically set when the record is created.
     * `status` is hardcoded to "Sent to Auditor" upon creation.
     */
    struct Collection {
        string farmerBatchId; // Unique ID from the farmer, e.g., FR123-20250908
        string farmerId; // Farmer's identifier, e.g., Ramesh (FR123)
        string cropName; // Name of the crop, e.g., Rice
        uint256 quantity; // Quantity in kg, e.g., 100
        string collectorId; // ID of the collector who registered this
        uint256 collectionDate; // Timestamp of collection
        string status; // e.g., "Sent to Auditor"
    }

    // Mapping to store collection records, keyed by the farmer's batch ID.
    mapping(string => Collection) public collections;

    // Event emitted when a new collection is successfully added to the blockchain.
    event CollectionAdded(
        string indexed farmerBatchId,
        string collectorId,
        string farmerId,
        uint256 collectionDate
    );

    /**
     * @dev Adds a new collection record to the blockchain.
     * This function is called when the collector submits the form.
     * @param _farmerBatchId The unique ID of the batch from the farmer.
     * @param _farmerId The identifier of the farmer.
     * @param _cropName The name of the collected crop.
     * @param _quantity The quantity collected, in kilograms.
     * @param _collectorId The identifier of the collector submitting the record.
     */
    function addCollection(
        string memory _farmerBatchId,
        string memory _farmerId,
        string memory _cropName,
        uint256 _quantity,
        string memory _collectorId
    ) public {
        // Ensure that a batch with this ID has not already been collected.
        require(
            collections[_farmerBatchId].collectionDate == 0,
            "Error: Batch ID already exists."
        );

        // Store the new collection record on the blockchain.
        collections[_farmerBatchId] = Collection({
            farmerBatchId: _farmerBatchId,
            farmerId: _farmerId,
            cropName: _cropName,
            quantity: _quantity,
            collectorId: _collectorId,
            collectionDate: block.timestamp,
            status: "Sent to Auditor"
        });

        // Emit an event to notify listeners (like the frontend) of the new collection.
        emit CollectionAdded(
            _farmerBatchId,
            _collectorId,
            _farmerId,
            block.timestamp
        );
    }

    /**
     * @dev Retrieves the details of a previously recorded collection.
     * @param _farmerBatchId The ID of the batch to look up.
     * @return A tuple containing all the details of the Collection struct.
     */
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
}
