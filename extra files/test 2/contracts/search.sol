// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// import "./AyuTrace.sol"; // Import the main data contract

// contract AyuTraceSearch {
//     AyuTrace public ayuTraceContract; // Instance of the main AyuTrace contract

//     // Constructor to set the address of the deployed AyuTrace contract
//     constructor(address _ayuTraceContractAddress) {
//         ayuTraceContract = AyuTrace(_ayuTraceContractAddress);
//     }

//     // --- View Functions for Search.html ---

//     // Function to get details of a specific crop batch
//     function getBatchDetails(string memory _batchId) public view returns (
//         string memory batchId,
//         string memory cropType,
//         uint quantity,
//         string memory harvestDate,
//         string memory farmLocation,
//         bytes32 photoHash,
//         AyuTrace.BatchStatus status,
//         address farmer,
//         uint timestamp
//     ) {
//         return ayuTraceContract.getBatchDetails(_batchId);
//     }

//     // Function to get details of a specific packaged product
//     /*function getProductDetails(string memory _productId) public view returns (
//         string memory productId,
//         bytes32 productHash,
//         string memory productName,
//         uint packageSize,
//         string memory parentBatchId,
//         string memory productionDate,
//         AyuTrace.ProductStatus status,
//         address manufacturer,
//         uint timestamp
//     ) {
//         return ayuTraceContract.getProductDetails(_productId);
//     }*/

//     // Function to get a product ID by its hash
//     /*function getProductIdByHash(bytes32 _productHash) public view returns (string memory) {
//         return ayuTraceContract.getProductIdByHash(_productHash);
//     }*/

//     // Function to get all product IDs derived from a specific batch
//     /*function getProductsByBatch(string memory _batchId) public view returns (string[] memory) {
//         return ayuTraceContract.getProductsByBatch(_batchId);
//     }*/

//     // Helper functions to convert enums to string (for off-chain display)
//     function getBatchStatusString(AyuTrace.BatchStatus _status) public view returns (string memory) {
//         return ayuTraceContract.getBatchStatusString(_status);
//     }

//     function getProductStatusString(AyuTrace.ProductStatus _status) public view returns (string memory) {
//         return ayuTraceContract.getProductStatusString(_status);
//     }
// }