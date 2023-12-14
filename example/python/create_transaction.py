from typing import List, Optional
from pydantic import BaseModel
import requests

class Output(BaseModel):
    publicAddress: str
    amount: str
    memo: str
    assetId: Optional[str] = None

class Mint(BaseModel):
    assetId: Optional[str] = None
    name: Optional[str] = None
    metadata: Optional[str] = None
    value: str
    transferOwnershipTo: Optional[str] = None

class Burn(BaseModel):
    assetId: str
    value: str

class CreateTransactionRequest(BaseModel):
    account: Optional[str] = None
    outputs: List[Output]
    mints: Optional[List[Mint]] = None
    burns: Optional[List[Burn]] = None
    fee: Optional[str] = None
    feeRate: Optional[str] = None
    expiration: Optional[int] = None
    expirationDelta: Optional[int] = None
    confirmations: Optional[int] = None
    notes: Optional[List[str]] = None

class CreateTransactionResponse(BaseModel):
    transaction: str

api_url = "http://localhost:8888"
account = "IronFishSepoliaBridgeAccount"
to_address = "1d1a1fb9fafd7de32c7f02115207d6fe9df1272f5b4bedbbfa1330eba88c5ce2"
memo = "fishy fishy fishy"
amount = "1"

def create_transaction(url: str, request_data: CreateTransactionRequest) -> CreateTransactionResponse:
    json = request_data.model_dump(exclude_unset=True)
    response = requests.post(
        f"{url}/wallet/createTransaction", 
        json=json
    )
    response.raise_for_status()
    return CreateTransactionResponse(**response.json()['data'])

request_data = CreateTransactionRequest(
    account=account,
    outputs=[
        Output(publicAddress=to_address, amount=amount, memo=amount),
    ]
)
try:
    response = create_transaction(api_url, request_data)
    print(f"Transaction: {response.transaction}")
except requests.RequestException as e:
    print(f"An error occurred: {e.response.text}")
