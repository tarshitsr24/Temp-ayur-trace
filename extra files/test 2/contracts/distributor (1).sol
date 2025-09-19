// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title HerbChainDistributor
 * @dev Manages a distributor's inventory and transactions on the HerbChain platform.
 */
contract HerbChainDistributor {
    // --- STRUCTS ---

    /**
     * @dev Represents a batch of herbs in the distributor's inventory.
     */
    struct InventoryItem {
        string batchId; // The unique ID for the product batch
        string herbType; // e.g., "Turmeric", "Ginger"
        uint256 quantity; // The current quantity in stock (e.g., in kg)
        string storageLocation; // e.g., "A1" for Warehouse A, Section 1
        string status; // e.g., "In Stock", "Dispatched"
        bool isInitialized; // Flag to check if the batch has been recorded
    }

    // --- STATE VARIABLES ---

    // Mapping from a batch ID to its inventory details.
    mapping(string => InventoryItem) public inventory;

    // --- EVENTS ---

    /**
     * @dev Emitted when a new product batch is received and recorded.
     */
    event ProductReceived(
        string indexed batchId,
        string herbType,
        uint256 quantity,
        string storageLocation,
        address recordedBy
    );

    /**
     * @dev Emitted when a product batch is dispatched from the warehouse.
     */
    event ProductDispatched(
        string indexed batchId,
        uint256 quantityDispatched,
        string destination,
        address recordedBy
    );

    // --- FUNCTIONS ---

    /**
     * @notice Records the reception of a new product batch into inventory.
     * @dev This function is called from the "Receive Product" form.
     * @param _batchId The unique ID of the batch being received.
     * @param _herbType The type of herb in the batch.
     * @param _quantity The quantity of the product received.
     * @param _storageLocation The location in the warehouse where it is stored.
     */
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

    /**
     * @notice Records the dispatch of a product batch and updates its quantity.
     * @dev This function is called from the "Dispatch Products" form.
     * @param _batchId The ID of the batch to be dispatched.
     * @param _quantityToDispatch The quantity to be dispatched from the batch.
     * @param _destination The destination (retailer/market) of the dispatch.
     */
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
}
