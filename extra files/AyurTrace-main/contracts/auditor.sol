// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract AuditorChain {
    struct Inspection {
        string batchId;        // Batch ID (e.g. FR123-20250908)
        string inspectorId;    // Auditor ID (e.g. AUD001)
        string result;         // approved / rejected / pending
        string notes;          // Quality notes
        uint256 date;          // Inspection date (timestamp)
    }

    mapping(string => Inspection) public inspections;  
    event InspectionAdded(string batchId, string inspectorId, string result, string notes, uint256 date);

    // function jo blockchain pr record save karega
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

    // function jo data read karne ke liye use hoga
    function getInspection(string memory _batchId) public view returns (
        string memory, string memory, string memory, string memory, uint256
    ) {
        Inspection memory i = inspections[_batchId];
        return (i.batchId, i.inspectorId, i.result, i.notes, i.date);
    }
}
