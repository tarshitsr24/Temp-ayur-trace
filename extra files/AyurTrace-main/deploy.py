
import os
import json
from web3 import Web3
from solcx import compile_source, install_solc

def compile_contracts(contracts_dir):
    """Compiles all Solidity contracts in the given directory."""
    install_solc('0.8.0')
    compiled_contracts = {}
    for filename in os.listdir(contracts_dir):
        if filename.endswith(".sol") and filename != "search.sol":
            filepath = os.path.join(contracts_dir, filename)
            with open(filepath, 'r') as f:
                source = f.read()
            compiled_sol = compile_source(source, output_values=['abi', 'bin'], solc_version='0.8.0')
            contract_name = compiled_sol.keys().__iter__().__next__().split(':')[1]
            compiled_contracts[contract_name] = compiled_sol[f'<stdin>:{contract_name}']
    return compiled_contracts

def deploy_contracts(w3, compiled_contracts, account):
    """Deploys the compiled contracts to the blockchain."""
    deployed_contracts = {}
    for contract_name, contract_interface in compiled_contracts.items():
        contract = w3.eth.contract(abi=contract_interface['abi'], bytecode=contract_interface['bin'])
        tx_hash = contract.constructor().transact({'from': account})
        tx_receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
        deployed_contracts[contract_name] = {
            'address': tx_receipt.contractAddress,
            'abi': contract_interface['abi']
        }
    return deployed_contracts

if __name__ == "__main__":
    # --- Configuration ---
    GANACHE_URL = "http://127.0.0.1:7545"
    CONTRACTS_DIR = "contracts"
    OUTPUT_FILE = "deployed_contracts.json"

    # --- Connect to Ganache ---
    w3 = Web3(Web3.HTTPProvider(GANACHE_URL))
    if not w3.is_connected():
        print("Error: Could not connect to Ganache.")
        exit()
    
    w3.eth.default_account = w3.eth.accounts[0]
    
    # --- Compile Contracts ---
    print("Compiling contracts...")
    compiled_contracts = compile_contracts(CONTRACTS_DIR)
    print("Contracts compiled successfully.")

    # --- Deploy Contracts ---
    print("Deploying contracts...")
    deployed_contracts = {}
    try:
        deployed_contracts = deploy_contracts(w3, compiled_contracts, w3.eth.default_account)
        print("Contracts deployed successfully.")
    except Exception as e:
        print(f"Error deploying contracts: {e}")

    # --- Save Deployment Information ---
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(deployed_contracts, f, indent=4)
    
    print(f"Deployment information saved to {OUTPUT_FILE}")
