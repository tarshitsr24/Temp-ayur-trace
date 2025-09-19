import os
import sys
import json
from web3 import Web3
from solcx import compile_standard, install_solc, set_solc_version
from solcx.exceptions import SolcInstallationError


# ---------- USER CONFIG ----------
# Ensure this matches your Ganache or other RPC endpoint
GANACHE_URL = "HTTP://127.0.0.1:7545"
# Your Ganache account address and private key are now set directly here
ACCOUNT_ADDRESS = "0xC71412306de7874c0f9e7B9117Dab825A77e4590"
PRIVATE_KEY = "0xb55356cb07c2df2d1a018f25a5e46196fc7e398e1af74a70438702aa85788d01"
# Path to your solidity file
SOLIDITY_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "AyurTraceUnified.sol")
# Solidity compiler version
SOLC_VERSION = "0.8.20"

# ---------------------------------

def check_config():
    """Validates that necessary configuration is present."""
    if not ACCOUNT_ADDRESS or not PRIVATE_KEY:
        print("[ERROR] Error: ACCOUNT_ADDRESS and PRIVATE_KEY must be set in the script.")
        sys.exit(1)
    if not Web3.is_address(ACCOUNT_ADDRESS):
        print(f"[ERROR] Error: '{ACCOUNT_ADDRESS}' is not a valid Ethereum address.")
        sys.exit(1)

def ensure_solc(version: str):
    """Checks for the specified solc version and installs it if not found."""
    try:
        current_version = set_solc_version(version, silent=True)
        print(f"[SUCCESS] solc version {version} is ready.")
    except Exception:
        print(f" solc {version} not found. Attempting to install...")
        try:
            install_solc(version)
            set_solc_version(version)
            print(f"[SUCCESS] Successfully installed and set solc version {version}.")
        except SolcInstallationError as e:
            print(f"[ERROR] Failed to install solc {version}: {e}")
            sys.exit(1)

def compile_contract(source_path: str):
    """Compiles the Solidity contract and returns ABI and bytecode."""
    if not os.path.exists(source_path):
        print(f"[ERROR] Error: Solidity file not found at {source_path}")
        sys.exit(1)

    with open(source_path, "r", encoding="utf-8") as f:
        source = f.read()

    print(f"\n- Compiling {source_path}...")
    ensure_solc(SOLC_VERSION)

    compiled = compile_standard(
        {
            "language": "Solidity",
            "sources": {os.path.basename(source_path): {"content": source}},
            "settings": {
                "optimizer": {"enabled": True, "runs": 200},
                "evmVersion": "london",
                "viaIR": True,
                "outputSelection": {"*": {"*": ["abi", "evm.bytecode"]}},
            },
        },
        solc_version=SOLC_VERSION,
    )

    contract_filename = os.path.basename(source_path)
    contract_name = list(compiled["contracts"][contract_filename].keys())[0]
    abi = compiled["contracts"][contract_filename][contract_name]["abi"]
    bytecode = compiled["contracts"][contract_filename][contract_name]["evm"]["bytecode"]["object"]

    print(f"[SUCCESS] Compiled contract: '{contract_name}'")
    return contract_name, abi, bytecode

def deploy(w3: Web3, abi, bytecode, account_address, private_key):
    """Deploys the contract to the blockchain."""
    print(f"\n- Preparing to deploy from account: {account_address}")
    Contract = w3.eth.contract(abi=abi, bytecode=bytecode)
    nonce = w3.eth.get_transaction_count(account_address)
    chain_id = w3.eth.chain_id
    gas_price = w3.eth.gas_price

    print(f"  - Chain ID: {chain_id}, Nonce: {nonce}, Gas Price: {w3.from_wei(gas_price, 'gwei')} Gwei")
    
    constructor = Contract.constructor()

    try:
        estimated_gas = constructor.estimate_gas({"from": account_address})
        print(f"  - Gas estimate: {estimated_gas}")
    except Exception as e:
        print("\n[ERROR] Gas estimation failed!")
        print(f"   Error: {e}")
        print("   This can happen if the contract has a revert error in its constructor,")
        print("   or if the connected RPC node is out of sync.")
        sys.exit(1)

    tx = constructor.build_transaction({
        "from": account_address,
        "nonce": nonce,
        "gas": int(estimated_gas * 1.2),
        "gasPrice": gas_price,
        "chainId": chain_id,
    })

    signed_tx = w3.eth.account.sign_transaction(tx, private_key=private_key)
    tx_hash = w3.eth.send_raw_transaction(signed_tx.raw_transaction)
    
    print(f"  - Transaction sent. Hash: {tx_hash.hex()}")
    print("  - Waiting for transaction receipt...")
    
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
    
    print(f"\n[INFO] Contract deployed successfully!")
    print(f"   - Address: {receipt.contractAddress}")
    print(f"   - Block: {receipt.blockNumber}")
    print(f"   - Gas Used: {receipt.gasUsed}")
    return receipt

def main():
    """Main execution function."""
    print("--- Starting Smart Contract Deployment ---")
    check_config()

    w3 = Web3(Web3.HTTPProvider(GANACHE_URL))
    if not w3.is_connected():
        print(f"[ERROR] Failed to connect to RPC at {GANACHE_URL}. Is Ganache running?")
        sys.exit(1)

    print(f"[SUCCESS] Connected to RPC. Chain ID: {w3.eth.chain_id}")

    try:
        balance_wei = w3.eth.get_balance(ACCOUNT_ADDRESS)
        balance_eth = w3.from_wei(balance_wei, 'ether')
        print(f"[SUCCESS] Account {ACCOUNT_ADDRESS} balance: {balance_eth:.4f} ETH")
        if balance_wei == 0:
            print("   Warning: Account has zero balance. Deployment will fail if gas is required.")
    except Exception as e:
        print(f"[ERROR] Could not get balance for account. Error: {e}")
        sys.exit(1)


    name, abi, bytecode = compile_contract(SOLIDITY_FILE)
    receipt = deploy(w3, abi, bytecode, ACCOUNT_ADDRESS, PRIVATE_KEY)

    out = {"contractName": name, "contractAddress": receipt.contractAddress, "abi": abi}
    out_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), f"deployment_details.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2)
    print(f"\n[SUCCESS] Deployment details saved to: {out_path}")
    print("--- Deployment Finished ---")

if __name__ == "__main__":
    main()