// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ManufacturerChain
 * @dev This contract logs the processing of audited batches into final products.
 */
contract ManufacturerChain {
    /**
     * @dev Represents a finished product batch created from a source batch.
     * `productId` is the new, unique identifier for the final product.
     * `processingDate`, `packagingDate`, and `expiryDate` are all timestamps.
     */
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

    // Mapping to store product records, keyed by the new product ID.
    mapping(string => Product) public products;

    // Event emitted when a new product is successfully created.
    event ProductCreated(
        string indexed productId,
        string sourceBatchId,
        string productType,
        string manufacturerId
    );

    /**
     * @dev Creates a new product record on the blockchain.
     * This function is called from the web interface.
     */
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
        // Ensure the new product ID is unique.
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
