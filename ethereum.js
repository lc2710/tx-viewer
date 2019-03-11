var Web3 = require('web3');
const https = require('https');
const JSSoup = require('jssoup').default;
const error_log = require("./error_log").log
var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;


module.exports = {

 latestBlock: 0,
 status: null,
 txHash: null,
 web3: new Web3(new Web3.providers.HttpProvider('https://mainnet.infura.io/5rw43d1V5uFlp36zzeLJ')),
  
  readTransactionStatus: function (txHash) {
    /**
     * Query status of users transaction id.
     *
     * Currently if transaction is not found call searchPendingTransactions to see if transaction is pending.
     *
     * @param {string} txHash - The user entered transaction hash.
     * @return {Promise<string>} - The status of the transaction plus additional transaction data.
    **/

    if (txHash != null) {module.exports.txHash = txHash}
    else{txHash = module.exports.txHash}
    return new Promise((resolve, reject)=>{
      module.exports.web3.eth.getTransactionReceipt(txHash).then( result => {
        module.exports.web3.eth.getBlockNumber().then( block => {
          if (result == null){    
              module.exports.searchPendingTransactions(txHash).then(myresult =>{
                console.log({
                      "chain": "ETH",
                      "status": module.exports.status,
                      "timestamp": null,
                      "block_confirmations": null, 
                      "time_to_mine": module.exports.time_to_mine
                    })
                resolve({
                      "chain": "ETH",
                      "status": module.exports.status,
                      "timestamp": null,
                      "block_confirmations": null,
                      "time_to_mine": module.exports.time_to_mine
                    })     
                })
          }else {
            module.exports.web3.eth.getTransaction(txHash).then( transaction => {
              var confirmations = block - result.blockNumber
              module.exports.web3.eth.getBlock(result.blockNumber).then( transaction_block => {
                if (result.status == null) {  //Transaction found mined but pre byzantium fork, check for failure using gas used = gas supplied
                  if (result.gasUsed == transaction.gas) { //pre byzantium failure - in future may need to parse etherscan
                    module.exports.status = "failure"
                  }
                  else { //Pre byzantium transaction success
                    module.exports.status = "success"
                  }
                }else {
                  if (result.status == true){ //Post byzantium fork success
                    module.exports.status = "success"
                  }else if (result.status == false){ // Post byzantium fork failure
                    module.exports.status = "failure"
                  }
                }
                if (transaction_block == null) { var timestamp = null}
                else{var timestamp = transaction_block.timestamp}
                console.log({
                      "chain": "ETH",
                      "status": module.exports.status,
                      "timestamp": timestamp,
                      "block_confirmations": confirmations
                    })
                resolve({
                      "chain": "ETH",
                      "status": module.exports.status,
                      "timestamp": timestamp,
                      "block_confirmations": confirmations
                    })
              })
            })
          }
        })
      }).catch((err) => {resolve(err)
          error_log("readTransactionStatus: " + err)})
    })
  },

  newBlock: function (websocketClient) {
    /**
     * Serve block data via websocket to port 3000 when new block is added to the blockchain.
     *
     * Setup websocket connection to infura API, check incoming block notifications for pending transaction and 
     * send block/transaction data to websocket serving data on port 3000.
     *
     * @param {object} websocketClient - The websocket client serving data to port 3000.
     * @return {Promise<string>} - The status of the transaction plus additional transaction data.
    **/
    var provider = new Web3.providers.WebsocketProvider('wss://mainnet.infura.io/ws')
    var web3ws = new Web3(provider)

    provider.on('error', e => error_log('WS Error', e));
    provider.on('end', e => {
      error_log('WS Closed, Attempting to reconnect...');
      provider = new Web3.providers.WebsocketProvider('wss://mainnet.infura.io/ws');
      provider.on('connect', function () {
          error_log('WS Reconnected');
      });
      web3ws.setProvider(provider);
    });
    var subscription = web3ws.eth.subscribe('newBlockHeaders', function(error, result){
      if (!error) {
          return;
      } error_log(error);
    })
    .on("data", function(blockHeader){
      if(websocketClient.readyState === websocketClient.CLOSED){
        subscription.unsubscribe(function(error, success){
          if(success)
            error_log('WS Connection closed!');
        });
      }
      var transaction_present = false
      if (module.exports.status == "pending"){ //If tx is pending or not found run tx lookup again on every new block
        module.exports.readTransactionStatus(null).then( transactionResult => {
          if (transactionResult.status == "success" || transactionResult.status == "failure") { 
            transaction_present = true
          }
          if (websocketClient.readyState === websocketClient.OPEN){
            websocketClient.send('{"chain": ETH, "block_number": ' + String(blockHeader.number) + ', "timestamp": ' + String(blockHeader.timestamp) + ', "hash": "' + String(blockHeader.hash) + '", "transaction_present" : ' + String(transaction_present) + '}')
            console.log('{"chain": ETH, "block_number": ' + String(blockHeader.number) + ', "timestamp": ' + String(blockHeader.timestamp) + ', "hash": ' + String(blockHeader.hash) + ', "transaction_present" : ' + String(transaction_present) + '}')
          }
        })
      }else{ 
        if (websocketClient.readyState === websocketClient.OPEN){
          websocketClient.send('{"chain": ETH, "block_number": ' + String(blockHeader.number) + ', "timestamp": ' + String(blockHeader.timestamp) + ', "hash": "' + String(blockHeader.hash) + '", "transaction_present" : ' + String(transaction_present) + '}')
          console.log('{"chain": ETH, "block_number": ' + String(blockHeader.number) + ', "timestamp": ' + String(blockHeader.timestamp) + ', "hash": ' + String(blockHeader.hash) + ', "transaction_present" : ' + String(transaction_present) + '}')
        }
      }
    })
    .on("error", console.error);
  },

  searchPendingTransactions: function(txHash) {
    /**
     * Search for transaction status on etherscan.io.
     *
     * HACK - Etherscan is the only freely available site able to view almost 
     * all transactions while they are still pending. This information 
     * is not available from the API so the transaction page must be parsed
     *
     * @param {string} txHash - The user entered transaction hash.
     * @return {Promise<string>} - The status of the transaction.
    **/
    return new Promise((resolve, reject)=>{
      var req = new XMLHttpRequest();  
      req.open('GET', 'https://etherscan.io/tx/' + txHash, true);  
      req.onload = function(e) {
        if(req.status == 200)  {
          if(req.responseText.includes("startTxPendingCheck = true") == true){module.exports.status = "pending"}
            else{module.exports.status = "no transaction found matching hash"}
        }
        else{resolve("Error - 404 error loading https://etherscan.io/tx/" + txHash)}
      resolve(module.exports.status)
      }
      req.send(null);
    }).catch(function(error) {
        console.log(error);
      });
  },

  findNetworkParams: function (txHash) {
    /**
     * Find current network and transaction related parameters.
     *
     * Parameters found by querying ethgasstation API, then calling findGasPrice function 
     * which parses etherscan to get the transaction gas price.
     *
     * @param {string} txHash - The user entered transaction hash.
     * @return {Promise<string>} - The status of the transaction.
    **/
    return new Promise((resolve, reject)=>{
      var req = new XMLHttpRequest();  
      req.open('GET', 'https://ethgasstation.info/json/ethgasAPI.json', true);  
      req.onload = function(e) {
        if(req.status == 200)  {
          var response = JSON.parse(req.responseText);
          if (txHash == null){
            console.log({
              "safeLow": String(response.safeLow / 10) + " Gwei",
              "safeLowWait": String(response.safeLowWait * 60) + " secs",
              "timeToMine": null, 
              "gasPrice": null,
              "latestBlock": response.blockNum,
              "avgBlockTime": String(response.block_time) + " secs"
            })
            resolve({
              "safeLow": String(response.safeLow / 10) + " Gwei",
              "safeLowWait": String(response.safeLowWait * 60) + " secs",
              "timeToMine": null,
              "gasPrice": null,
              "latestBlock": response.blockNum,
              "avgBlockTime": String(response.block_time) + " secs"
            })
          }else{
            module.exports.web3.eth.getTransaction(txHash).then( transaction => {

              if (transaction == null){
                module.exports.findGasPrice(txHash).then( result => {
                  console.log({
                    "safeLow": String(response.safeLow / 10) + " Gwei",
                    "safeLowWait": String(response.safeLowWait * 60) + " secs",
                    "gasPrice": result.gas_price,
                    "latestBlock": response.blockNum,
                    "avgBlockTime": String(response.block_time) + " secs"
                  })
                  resolve({
                    "safeLow": String(response.safeLow / 10) + " Gwei",
                    "safeLowWait": String(response.safeLowWait * 60) + " secs",
                    "gasPrice": result.gas_price,
                    "latestBlock": response.blockNum,
                    "avgBlockTime": String(response.block_time) + " secs"
                  })
                })
              } else{                  
                console.log({
                    "safeLow": String(response.safeLow / 10) + " Gwei",
                    "safeLowWait": String(response.safeLowWait * 60) + " secs",
                    "gasPrice": String(transaction.gasPrice/1000000000) + " Gwei",
                    "latestBlock": response.blockNum,
                    "avgBlockTime": String(response.block_time) + " secs"
                })
                  resolve({
                    "safeLow": String(response.safeLow / 10) + " Gwei",
                    "safeLowWait": String(response.safeLowWait * 60) + " secs",
                    "gasPrice": String(transaction.gasPrice/1000000000) + " Gwei",
                    "latestBlock": response.blockNum,
                    "avgBlockTime": String(response.block_time) + " secs"
                })}
            })
          }
        }else{resolve('Error loading page https://ethgasstation.info/json/ethgasAPI.json')}
      }
      req.send(null);
    })
  },

  findGasPrice: function(txHash) {
    /**
     * Find transaction gas price.
     *
     * HACK - Etherscan is the only available free site able to provide
     * the transaction gas price. The information is not available through 
     * their API so the transaction page must be parsed.
     *
     * @param {string} txHash - The user entered transaction hash.
     * @return {Promise<string>} - The status of the transaction.
    **/
    return new Promise((resolve, reject)=>{

      var req = new XMLHttpRequest();  
      req.open('GET', 'https://etherscan.io/tx/' + txHash, false);   
      req.send(null);  
      if(req.status == 200)  {

        var soup = new JSSoup(req.responseText)
        mystring = soup.findAll('span')
        var  mystring_length =  mystring.length
        for (var i = 0; i < mystring_length; i++) {
          if ('attrs' in mystring[i]){
            if ('title' in mystring[i].attrs) { 
              if (mystring[i].attrs.title.includes("Estimated Transaction Confirmation Duration")){
                var hours = mystring[i].contents[0]._text
                var minutes = mystring[i].contents[0].nextElement.nextElement.nextElement._text
                var seconds = mystring[i].contents[0].nextElement.nextElement.nextElement.nextElement.nextElement.nextElement._text
                var time_to_mine = hours.replace('~&nbsp;', '') + minutes + seconds
              }
              if (mystring[i].attrs.title.includes("The price offered to the miner to purchase this amount of GAS")){
              var contents_length = mystring[i].contents.length
              var gas_price = ""
              var gas_decimal = ""
              for (var x = 0; x < contents_length; x++) {
                if (mystring[i].contents[x]._text != null){
                  if (mystring[i].contents[x]._text.includes("Ether (")){ 
                    gas_decimal = mystring[i].contents[x]._text.split("(");
                  }
                  if (mystring[i].contents[x]._text.includes("Gwei")){ 
                    gas_price = mystring[i].contents[x]._text
                  }
                }
              }
              gas_price = gas_decimal[1].replace(")", "")
              }
            }
          }
        }
        resolve({"time_to_mine": time_to_mine, 
                  "gas_price": gas_price})
      }else{resolve('Error loading page https://etherscan.io/tx/' + txHash)}
    })
  }
};


