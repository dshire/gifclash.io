var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io').listen(server);

const compression = require('compression');

app.use(express.static('./public'));

app.get('/',function(req,res){
    res.sendFile(__dirname+'/index.html');
});

server.listen(8080, function() {
    console.log("I'm listening.");
});
