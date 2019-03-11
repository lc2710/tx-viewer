"use strict";
const express = require('express')
const Ethereum = require('../ChainViewer/ethereum')
const Bitcoin = require('../ChainViewer/bitcoin')
var cors = require('cors');
const WebSocket = require("ws")
const http = require("http")

const app = express();
app.use(cors());

app.get('/', (req, res) => res.send('Connected to ChainViewer!'))

app.get('/eth_check_tx_status', (req, res) => {

	try{
		var txHash = req.query.txHash
		Ethereum.readTransactionStatus(txHash).then( result => {res.send(result)})
	}catch(e){console.log(e)}

})

app.get('/eth_view_parameters', (req, res) => {

	try{
		var txHash = req.query.txHash
		Ethereum.findNetworkParams(txHash).then( result => {res.send(result)})
	}catch(e){console.log(e)}

})

app.get('/btc_check_tx_status', (req, res) => {

	try{
		var txHash = req.query.txHash
		Bitcoin.readTransactionStatus(txHash).then( result => {res.send(result)})
	}catch(e){console.log(e)}

})

const server = app.listen(3000, () => console.log('Webserver listening on port 3000!'))

var websocketServer = new WebSocket.Server({ server });
websocketServer.on('connection', (webSocketClient) => {

	webSocketClient.send('{ "connection" : "ok"}');
	webSocketClient.on('message', (message) => {
		if(message == "ETH"){
			Ethereum.newBlock(webSocketClient)
			console.log("EEEETH")
			webSocketClient.send('{ "connection" : "ETH"}');
		}
		else if(message == "BTC"){
			Bitcoin.newBlock(webSocketClient)
			console.log("BBBTTTCCC")
			webSocketClient.send('{ "connection" : "BTC"}');
		}
	});
});
