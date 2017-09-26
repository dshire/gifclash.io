var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io').listen(server);
const bodyParser = require('body-parser');
const compression = require('compression');
var favicon = require('serve-favicon');
var uidSafe = require('uid-safe');

var rp = require('request-promise');

const prom = require('./twitter-api/prom.js');

app.use(bodyParser.urlencoded({extended: true}));

var MongoClient = require('mongodb').MongoClient;
// Connection URL
var url = 'mongodb://localhost:27017/gifcards';
var db;
// Use connect method to connect to the server
MongoClient.connect(url, function(err, database) {
    if (err) return console.log(err);
    db = database;
    app.listen(3000, () => {
        console.log('listening on 3000');
    });
});


app.use(express.static('./public'));

app.get('/',function(req,res){
    db.collection('quotes').find().toArray(function(err, results) {
        console.log(results)

        res.sendFile(__dirname+'/index.html');
    })
});

app.post('/quotes', (req, res) => {
    db.collection('quotes').save(req.body, (err, result) => {
        if (err) return console.log(err)

        console.log('saved to database')
        res.redirect('/')
    })
})

app.get('/tweets', function(req, res){
    prom.twitter(req, res).then(function(headlines){
        res.json(headlines);
        console.log(headlines);
    }).catch(function(){
        res.sendStatus(500);
    });
});

// TWITTER LINES FROM THEONION
// prom.twitter().then(function(headlines){
//     socket.emit('tweets', headlines);
//     console.log(headlines);
// }).catch(function(err){
//     console.log(err);
// });

// --------- SOCKET.IO ------------------


var currentPlayers = [];
var cardsPlayed = [];
var currentRound = {};
var currentRoundCount = 0;


io.on('connection', function(socket) {
    console.log(`socket with the id ${socket.id} is now connected`);

    socket.on('disconnect', function() {
        console.log(`socket with the id ${socket.id} is now disconnected`);
        var playerIndex = currentPlayers.findIndex(player => player.id === socket.id );
        currentPlayers.splice(playerIndex, 1);
        delete currentRound[socket.id];
    });

    var playerCards= [];
    currentPlayers.push({
        id: socket.id,
        playerCards: playerCards,
        roundsWon: 0
    });
    currentRound[socket.id] = 0;
    console.log('currentPlayers is: ' + currentPlayers);

    var trending = {
        uri: "http://api.giphy.com/v1/gifs/trending",
        qs: {
            api_key: 'JCju0YWAn9NjYLyaI2UBge9vCLPo3Nkz',
            limit: '6'
        },
        json: true
    };

    rp(trending)
        .then(function (gifs) {

            var playerIndex = currentPlayers.findIndex(player => player.id === socket.id );
            gifs.data.forEach((e)=> {
                currentPlayers[playerIndex].playerCards.push({
                    id: e.id,
                    mp4: e.images.fixed_width.mp4,
                    still: e.images.fixed_width.url
                });
            });
            socket.emit('cardDraft', currentPlayers[playerIndex].playerCards);
        })
        .catch(function (err) {
            console.log(err);
        });


    socket.on('drop',(data) => {
        console.log(data);
        var playerIndex = currentPlayers.findIndex(player => player.id === socket.id );
        var cardIndex = currentPlayers[playerIndex].playerCards.findIndex(card => card.id === data.cardId );
        cardsPlayed.push({
            id: data.cardId,
            player: socket.id,
            mp4: currentPlayers[playerIndex].playerCards[cardIndex].mp4,
            still: currentPlayers[playerIndex].playerCards[cardIndex].still
        });
        currentPlayers[playerIndex].playerCards.splice(cardIndex, 1);
        if (cardsPlayed.length > 0 && cardsPlayed.length >= currentPlayers.length) {
            console.log('vote emit');
            io.sockets.emit('vote', cardsPlayed);
            console.log('current players: ' + currentPlayers);
        }

    });

    socket.on('playerVoted', (cardId) => {
        console.log('player voted for card: ' + cardId);
        var playedCardIndex = cardsPlayed.findIndex(card => card.id === cardId);
        console.log('player ' + cardsPlayed[playedCardIndex].player + ' gets a point');
        currentRound[cardsPlayed[playedCardIndex].player]++;
        console.log(currentRound)
        currentRoundCount++;
        if (currentRoundCount >= currentPlayers.length) {
            //Check for round winner
            var keys = Object.keys(currentRound),
                largest = Math.max.apply(null, keys.map(x => currentRound[x])),
                result = keys.reduce((result, key) => { if (currentRound[key] === largest){ result.push(key); } return result; }, []);

            var winnerId = result[0];
            var tie = false;

            if (result.length > 1) {
                winnerId = result[Math.floor(Math.random() * result.length)];
                tie = true;
            }

            var points = {};
            for(var key in currentRound) {
                if(currentRound.hasOwnProperty(key)) {
                    var index = cardsPlayed.findIndex(card => card.player === key);
                    var card = cardsPlayed[index].id;
                    points[card] = currentRound[key];
                }
            }
            console.log('player ' + winnerId + ' wins the round');
            io.sockets.emit('roundResult', {
                winner: winnerId,
                points,
                tie
            });
            var playerIndex = currentPlayers.findIndex(player => player.id === winnerId );
            currentPlayers[playerIndex].roundsWon++;
            Object.keys(currentRound).forEach(player => currentRound[player] = 0);
            currentRoundCount = 0;
            cardsPlayed = [];
            if (currentPlayers[playerIndex].roundsWon >= 3) {
                setTimeout(() => {
                    io.sockets.emit('gameOver',{
                        winner: winnerId
                    });
                    setTimeout(() => {
                        io.sockets.emit('newGame',{
                            
                        });
                    }, 3000)
                }, 2000);
            } else {
                setTimeout(() => {
                    io.sockets.emit('newRound', {});
                }, 2000);

            }
        }
    });


    socket.on('quote', (data) => {
        console.log(data)
        db.collection('quotes').findOneAndUpdate({
            name: data.name
        }, {
            $set: {
                quote: data.quote
            }
        }, (err, result) => {
            socket.emit('quotes', {quotes: result});
        })
        // db.collection('quotes').save(data, (err, result) => {
        //     if (err) return console.log(err)
        //
        //     console.log('saved to database')
        //     db.collection('quotes').find().toArray((err, result) => {
        //         if (err) return console.log(err)
        //         socket.emit('quotes', {quotes: result});
        //     })
        // })
    })


});


server.listen(8080, function() {
    console.log("I'm listening.");
});
