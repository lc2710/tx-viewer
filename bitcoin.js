const https = require('https');
const WebSocket = require("ws")
const error_log = require("./error_log").log
var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;

module.exports = {

 pendingList: [],
 latestBlock: 0,
 status: null,
 txHash: null,

  readTransactionStatus: function (txHash) {
    /**
     * Query status of users transaction id.
     *
     * @param {string} txHash - The user entered transaction hash.
     * @return {Promise<string>} - The status of the transaction plus additional transaction data.
    **/

    error_log("BTC readTransactionStatus: " + txHash)
    if (txHash != null) {module.exports.txHash = txHash}
    else{txHash = module.exports.txHash}
    return new Promise((resolve, reject)=>{
      if (txHash == null){resolve({'status': "no_tx_value"})}
      var req = new XMLHttpRequest();  
      req.open('GET', 'https://chain.so/api/v2/get_tx/BTC/' + txHash, true); 
      req.responseType = 'json'
      var confirmations = null;
      var timestamp = null;
      var tx_fee = null;
      req.onload = function(e) {
        if(req.status == 200)  {
          var response = JSON.parse(req.responseText)
          if(response.status == "success"){
            if(response.data.confirmations != 0){
              module.exports.status = "success"
              confirmations = response.data.confirmations
              timestamp = response.data.time
            }
            else if (response.data.confirmations == 0){
              module.exports.status = "pending"
            }
            var sum = 0
            for (var i = 0; i < response.data.inputs.length; i++) {sum = sum + response.data.inputs[i].value}
            for (var i = 0; i < response.data.outputs.length; i++) {sum = sum - response.data.outputs[i].value}
            tx_fee = Math.floor(sum * 100000000)

          }else{ module.exports.status = "no transaction found matching hash"}
        }else if (req.status == 404){
          module.exports.status = "no transaction found matching hash"
          error_log("BTC: no transaction found matching hash: " + txHash)
        }else{
          console.log("Error loading page https://chain.so/api/v2/get_tx/BTC/")
          resolve("Error loading page https://chain.so/api/v2/get_tx/BTC/")
        }
      console.log({
            "chain": "BTC",
            "status": module.exports.status,
            "timestamp": timestamp,
            "block_confirmations": confirmations,
            "tx_fee": tx_fee
          })
      resolve({
            "chain": "BTC",
            "status": module.exports.status,
            "timestamp": timestamp,
            "block_confirmations": confirmations,
            "tx_fee": tx_fee
          })
      } 
      req.send(null);
    })
  },

  newBlock: function (websocketClient) {
    /**
     * Serve block data via websocket to port 3000 when new block is added to the blockchain.
     *
     * Setup websocket connection to insight API, check incoming block notifications for pending transaction and 
     * send block/transaction data to websocket serving data on port 3000.
     *
     * @param {object} websocketClient - The websocket client serving data to port 3000.
     * @return {Promise<string>} - The status of the transaction plus additional transaction data.
    **/
    var socket = require('socket.io-client')('https://insight.bitpay.com');
    socket.on('connect', function () {
      socket.emit('subscribe', 'inv');
    });
    socket.on('disconnect', function () {
      error_log('WebSocket disconnected');
    });

    socket.on('error', e => error_log('WS Error: ' +  e));
    socket.on('end', e => {
      error_log('WS Closed, Attempting to reconnect...');
      socket.reconnect()
    });

    socket.on('block', function (data) {
      if(websocketClient.readyState === websocketClient.CLOSED){
        socket.disconnect()
        error_log("WS Connection closed!")
      }
      var req = new XMLHttpRequest();  
      req.open('GET', 'https://chain.so/api/v2/get_block/BTC/' + data, true); 
      req.responseType = 'json'
      var transaction_present = false
      req.onload = function(e) {
        if(req.status == 200)  {
          var response = JSON.parse(req.responseText)
          var transaction_present = false
          if (module.exports.status == "pending") {
            module.exports.readTransactionStatus(null).then( result => {
              if (result.status == "success"){transaction_present = true}
                websocketClient.send('{"chain": BTC, "timestamp": ' + String(response.data.time) + ', "transaction_present": ' + String(transaction_present) + ', "block_number": ' + String(response.data.block_no) + ', "hash": "' + String(response.data.blockhash) + '""}')
                console.log({       
                      "chain": "BTC", 
                      "timestamp": response.data.time,
                      "transaction_present": transaction_present,
                      "block_number": response.data.block_no,
                      "hash": response.data.blockhash
                        })
            })
          } else{
                if (websocketClient.readyState === websocketClient.OPEN){
                  websocketClient.send('{"chain": BTC, "timestamp": ' + String(response.data.time) + ', "transaction_present": ' + String(transaction_present) + ', "block_number": ' + String(response.data.block_no) + ', "hash": "' + String(response.data.blockhash) + '"}')
                }
                console.log({        
                      "chain": "BTC",
                      "timestamp": response.data.time,
                      "transaction_present": transaction_present,
                      "block_number": response.data.block_no,
                      "hash": response.data.blockhash
                        })             
          }
        } else{
          error_log("BTC Error - 404 error loading https://chain.so/api/v2/get_block/BTC/" + txHash)
        }
      }
      req.send(null);
    })
  },

};

