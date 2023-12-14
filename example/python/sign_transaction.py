import requests
from typing import Optional
from pydantic import BaseModel

class PostTransactionRequest(BaseModel):
    account: Optional[str] = None
    transaction: str
    broadcast: Optional[bool] = None

class PostTransactionResponse(BaseModel):
    accepted: Optional[bool]
    broadcasted: Optional[bool]
    hash: str
    transaction: str

api_url = "http://localhost:8888"
account = "IronFishSepoliaBridgeAccount"
transaction_data = "0201000000000000000100000000000000a81d1a1fb9fafd7de32c7f02115207d6fe9df1272f5b4bedbbfa1330eba88c5ce251f33a2f14f92735e562dc658a5639279ddca3d5079a6d1242b2a588a9cbf44c0094357700000000bbed7d2563391e009729619ce1644e588168bad609771f7902a28fcc14f2990900000000000000000000000000000000000000000000000000000000000000001d1a1fb9fafd7de32c7f02115207d6fe9df1272f5b4bedbbfa1330eba88c5ce29d0201000000000020afd783de90788956cd36cf3123c3fc17bcbec4dd33dda5d7d79f37726acdd55d200000000000000001203c2ad2f7f23415c86fb403604aff1fe878cefdcd58b7fbcda71a5446945db85e0020b5cffb37d793661641951e5530521f62cfed13cd6253d75db70138ee3e3627240020acab37b1462c7943dd803887ab5917bd3d28040f39af4cfbd3f9064f0b4ee5110120445378ecfa81b10e39c7fba22d99c46750236691a83af0f635a7a2947072c72100207686e804350c4d06b4183ed528bc598af24f0e398256ffb92a56517939543e5b0120979e0097a5175d1a1f97305b26c5e2da48dd0703261cd848b0244d0f720514590020a251212dc66a9569c9ca052e008910576cb911c6301d22875fe206ba5aad2c37002083a6cb2bcfb3b24c83785fa4d8b890be307fa21812facdb86d513f5858b7c17101202b79a19021be38b0da5acf88d48068a6f287f00fdac9837f8a9805e2542b9e3d0020ff533597997b61c63d47fb093eae4c51b59f4ae93133f3979efa54bd330d3e270020fdb570043817a0e25825ad16ae2384deb0a338cf27d528e6f9c39f6302317e3a00206adc247ecf34f2a0db8095b21cdbbe32cd9bfc755c869708364f486a14c3a02d01209f49d7e512d59ac648be963b9adb76e33556bf2e1de11175c716cdaef689e9210120930619e7c3359e40ec5d12e4263daecf63fbf723ad9f0880021b4ddf2cdab8480020bf6da842049a9616c4f1cc45d540cf7e2403fe0f52584aca0fdc57d2c86ebd0f00207c0249dc48969bb845b9a2e8f9838db203e8d5c4d89d6ef83187ed22d6ad7f6a00203b67a282a124f4293bb47b5c7d106892410246a00b918c699755218c1a93ef0900204c2418f9e8a93f022fdcb624101018002bb424e3c1091c7b2c1d330992fbfd3e0020c6e28dce92a251c08a9287bd2cdf7c66bb3dc87426774c0aab8462f14779ba4e0020e265216b87d411184a7ce9a59a8707c375919adff32f76f1ca8985816f31e34d002018308f8a0b41caa4cc4b695f4653edf367872ed2dbaa58daa2bdcfe2e6bad3530020c7e85ec343ded6dd4c13608482ff6379798b301735c4846ff191e55f9b2b115d00200e705181aa4dba44803f53090b9f6a2dfcbe78a35a486c902ffef2131fb110140020006f57741253bbe8852e26604b70b056bb6683b3428a18eca719f91cba3ffa000020bbe09105ad125b46e35e0b04e8b9f7587912ca3559cae172224e3d9523e77b3800202477b260dd1cde96e0e6ca809018d226d254834d53c9d236591f09bf49d196240020996af5e92e76a58480f183278e298d4f16d242a46be7e02f4b59ed77b1d9f028002008b2d75ee74a7ed40fdb379600ee30cb4a43492e5b93e54140e99efc2b174659002041b5ce5b09d5302f1de9e5a1364b9ad0a013937a829bc3d9f5d1c48d9f37d06a0020d58cf56e79fa336d0707fd8c5c80bd01e09f5ac61616de733aa443245ee2a4640020ef708460d3a9edc8eceb8b0cd86ad333af32c49bb43404a5e7d1a1a159fe83470020de4ddc2218de5e61def729040972f79f31e6c149ff6cdb35c848379c76c816230100000000000000a81d1a1fb9fafd7de32c7f02115207d6fe9df1272f5b4bedbbfa1330eba88c5ce251f33a2f14f92735e562dc658a5639279ddca3d5079a6d1242b2a588a9cbf44c010000000000000050d8ee3bb086f147c4fea641efef15012a25d4fe7cc72601082c020514f3580a66697368792066697368792066697368790000000000000000000000000000001d1a1fb9fafd7de32c7f02115207d6fe9df1272f5b4bedbbfa1330eba88c5ce200000000000000000000000000000000013e020100"

def post_transaction(url: str, request_data: PostTransactionRequest) -> PostTransactionResponse:
    json = request_data.model_dump(exclude_unset=True)
    response = requests.post(
        f"{url}/wallet/postTransaction", 
        json=json
    )
    response.raise_for_status()
    return PostTransactionResponse(**response.json()['data'])


try:
    request = PostTransactionRequest(transaction=transaction_data, account=account)
    response = post_transaction(api_url, request)
    print(f"Response: {response}")
except requests.RequestException as e:
    print(f"An error occurred: {e.response.text}")