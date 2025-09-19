
import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

# --- Supabase Configuration ---
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: Supabase URL and Key must be set in a .env file.")
    exit()

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def create_tables():
    """Creates the necessary tables in the Supabase database."""
    # --- Create auditor_inspections table ---
    try:
        supabase.table("auditor_inspections").select("*").execute()
    except:
        supabase.admin.api.create_table(
            name="auditor_inspections",
            primary_keys=["batch_id"],
        )
        supabase.table("auditor_inspections").insert([{"batch_id": "dummy", "inspector_id": "dummy", "result": "dummy", "notes": "dummy", "date": "2025-01-01"}]).execute()

    # --- Create collector_collections table ---
    try:
        supabase.table("collector_collections").select("*").execute()
    except:
        supabase.admin.api.create_table(
            name="collector_collections",
            primary_keys=["farmer_batch_id"],
        )
        supabase.table("collector_collections").insert([{"farmer_batch_id": "dummy", "farmer_id": "dummy", "crop_name": "dummy", "quantity": 0, "collector_id": "dummy", "collection_date": "2025-01-01", "status": "dummy"}]).execute()

    # --- Create distributor_inventory table ---
    try:
        supabase.table("distributor_inventory").select("*").execute()
    except:
        supabase.admin.api.create_table(
            name="distributor_inventory",
            primary_keys=["batch_id"],
        )
        supabase.table("distributor_inventory").insert([{"batch_id": "dummy", "herb_type": "dummy", "quantity": 0, "storage_location": "dummy", "status": "dummy"}]).execute()

    # --- Create farmer_batches table ---
    try:
        supabase.table("farmer_batches").select("*").execute()
    except:
        supabase.admin.api.create_table(
            name="farmer_batches",
            primary_keys=["batch_id"],
        )
        supabase.table("farmer_batches").insert([{"batch_id": "dummy", "crop_type": "dummy", "quantity": 0, "harvest_date": "dummy", "farm_location": "dummy", "photo_hash": "dummy", "status": "dummy", "owner": "dummy", "timestamp": "2025-01-01"}]).execute()

    # --- Create manufacturer_products table ---
    try:
        supabase.table("manufacturer_products").select("*").execute()
    except:
        supabase.admin.api.create_table(
            name="manufacturer_products",
            primary_keys=["product_id"],
        )
        supabase.table("manufacturer_products").insert([{"product_id": "dummy", "source_batch_id": "dummy", "product_type": "dummy", "quantity_processed": 0, "wastage": 0, "processing_date": "2025-01-01", "expiry_date": "2025-01-01", "manufacturer_id": "dummy"}]).execute()

    # --- Create contracts table ---
    try:
        supabase.table("contracts").select("*").execute()
    except:
        supabase.admin.api.create_table(
            name="contracts",
            primary_keys=["name"],
        )
        supabase.table("contracts").insert([{"name": "dummy", "address": "dummy", "abi": {}}]).execute()

def insert_contract_data():
    """Inserts the deployed contract data into the contracts table."""
    with open('deployed_contracts.json', 'r') as f:
        deployed_contracts = json.load(f)
    
    for contract_name, contract_data in deployed_contracts.items():
        supabase.table('contracts').upsert({
            'name': contract_name,
            'address': contract_data['address'],
            'abi': contract_data['abi']
        }).execute()

if __name__ == "__main__":
    print("Setting up Supabase database...")
    create_tables()
    print("Tables created successfully.")
    print("Inserting contract data...")
    insert_contract_data()
    print("Contract data inserted successfully.")
