import express, { json } from "express";
import dotenv from "dotenv";
import cors from "cors";
import FormData from 'form-data';
import axios from "axios";
import { ethers } from "ethers";

import { wrappedOrdinalAddress, wrappedOrdinalAbi } from "./contract.js"
import { ordinalData } from "./sample_input.js";

dotenv.config();

const port = process.env.API_PORT || 3003;
const app = express();
app.use(json());
app.use(cors());
app.use(express.urlencoded({ extended: true }));

// app.post("/mint", async (req, res) => {
app.get("/mint", async (req, res) => {
  // const ordinalData = req.body;
  const { content_type, ordinal_id, asset_content, customer_eth } = ordinalData;

  ///////////////////////// upload assets in the ipfs /////////////////////////
  let asset_data = Buffer.from( new Uint8Array(asset_content), "base64")
  const assets_hash = await saveFileToPinata(
    asset_data,
    "WrappedOrdinal_Asset_" + Date.now() + ".png",
    content_type
  )

  const metadata = {
    name: "WrappedOrdinal",
    description: "This is Wrapped Ordinal NFT Collection",
    image: `ipfs://${assets_hash.IpfsHash}`,
    attributes: [
      {
        "trait_type": "Ordinal_ID",
        "value": ordinal_id
      }
    ]
  }
  

  const metadata_hash = await saveFileToPinata(
    JSON.stringify(metadata),
    "WrappedOrdinal_Metadata_" + Date.now() + ".json",
    "application/json"
  ).catch((err) => {
      console.error(err)
  })

  console.log("metadata", metadata_hash);

  /////////////////////////////////////////////////////////////////////////////

  ///////////////////////// mint wrapped ordinal NFT //////////////////////////
  let mainnetUrl = "https://goerli.blockpi.network/v1/rpc/public";
  
  const provider = new ethers.providers.JsonRpcProvider(mainnetUrl);

  let privateKey = "33e8a8a8e4bfad17ed25b732e5d589b0c187117cad341d4e02d882f374c67743";
  let wallet = new ethers.Wallet(
    privateKey // private key
  );

  let account = wallet.connect(provider)

  const contract = new ethers.Contract(wrappedOrdinalAddress, wrappedOrdinalAbi, account)
  try {
      const options = {
        value: ethers.utils.parseUnits("0", "ether"),
        from: wallet.address,
      }

      console.log("option",options)
      const tx = await contract.mintToken(customer_eth, "ipfs://" + metadata_hash, options)
      console.log("tx", tx)
      let res = await tx.wait()
      if (res.transactionHash) {
        console.log("ok");
      }
    } catch (err) {
      // setMintStatus("Public Mint failed! Please check your wallet.")
    }
  /////////////////////////////////////////////////////////////////////////////
});

async function saveFileToPinata(fileData, fileName, filetype) {
  const pinataApiKey = "bf7ebd9ad32c11abe43c";
  const pinataSecretApiKey = "c6fa7b8b056d0cf2e467e0ebbdc38ae889b96c59f06992ae831e2a25e52e5006";

  if (!fileData) return console.warn("Error saving to pinata: No file data");
  const url = `https://api.pinata.cloud/pinning/pinFileToIPFS`;
  let data = new FormData();

  data.append("file", fileData, {filename: fileName, contentType: filetype});
  let resultOfUpload = await axios.post(url, data, {
    maxContentLength: "Infinity", //this is needed to prevent axios from erroring out with large files
    maxBodyLength: "Infinity", //this is needed to prevent axios from erroring out with large files
    headers: {
      "Content-Type": `multipart/form-data; boundary=${data._boundary}`,
      pinata_api_key: pinataApiKey,
      pinata_secret_api_key: pinataSecretApiKey,
    },
  });
  return resultOfUpload.data;
}

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
