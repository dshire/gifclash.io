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

var games = [];
var gameInfo = {
    gamesRunning: 0,
    openGames: 0,
    playersOnline: 0
};

var allPlayers = [];



io.on('connection', function(socket) {
    console.log(`socket with the id ${socket.id} is now connected`);
    gameInfo.playersOnline++;
    socket.to('lobby').emit('newPlayerOnline', {gameInfo});

    socket.emit('welcome',{});

    socket.on('disconnect', function() {
        console.log(`socket with the id ${socket.id} is now disconnected`);
        gameInfo.playersOnline--;
        socket.to('lobby').emit('newPlayerOnline', {gameInfo});
        var allPlayersIndex = allPlayers.findIndex(player => player.id === socket.id );
        allPlayers.splice(allPlayersIndex, 1);

        var game = getGameByPlayerId(socket.id);
        if (game >= 0) {
            console.log('check for (game) true')
            var playerIndex = games[game].currentPlayers.findIndex(player => player.id === socket.id );
            games[game].currentPlayers.splice(playerIndex, 1);
            delete games[game].currentRound[socket.id];
            if (games[game].currentPlayers.length < 1) {
                games.splice(game, 1);
                gameInfo.openGames--;
            }
            io.in('lobby').emit('newGameLobby', {
                gameInfo,
                games
            });
        }
    });

    socket.on('welcome', (data) => {
        allPlayers.push({
            id: socket.id,
            name: data.name

        });
        socket.join('lobby');
        socket.emit('lobby', {
            games,
            gameInfo
        });
    });

    socket.on('newGameLobby', (data) => {
        //leaving old game
        var game = getGameByPlayerId(socket.id);
        if (game >= 0) {
            var name = games[game].gameName;
            var playerIndex = games[game].currentPlayers.findIndex(player => player.id === socket.id );
            games[game].currentPlayers.splice(playerIndex, 1);
            delete games[game].currentRound[socket.id];
            if (games[game].currentPlayers.length < 1) {
                games.splice(game, 1);
                gameInfo.openGames--;
            }
            socket.leave(name);
        }

        games.push({
            currentPlayers: [{
                id: socket.id,
                playerCards: [],
                roundsWon: 0
            }],
            cardsPlayed: [],
            currentRound: {[socket.id]: 0},
            currentRoundCount: 0,
            gameName: data.game
        });
        gameInfo.openGames++;
        socket.join(data.game);
        io.in('lobby').emit('newGameLobby', {
            gameInfo,
            games
        });
        console.log(games[getGameByPlayerId(socket.id)].currentPlayers)
    });

    socket.on('joinGame', (data) => {
        //leaving old game
        var game = getGameByPlayerId(socket.id);
        if (game >= 0) {
            var name = games[game].gameName;
            var playerIndex = games[game].currentPlayers.findIndex(player => player.id === socket.id );
            games[game].currentPlayers.splice(playerIndex, 1);
            delete games[game].currentRound[socket.id];
            if (games[game].currentPlayers.length < 1) {
                games.splice(game, 1);
                gameInfo.openGames--;
            }
            socket.leave(name);
        }

        //joining new game
        socket.join(data.game);
        var gameIndex =  games.findIndex(game => game.gameName === data.game );
        games[gameIndex].currentPlayers.push({
            id: socket.id,
            playerCards: [],
            roundsWon: 0
        });
        games[gameIndex].currentRound[socket.id] = 0;
        io.in('lobby').emit('newGameLobby', {
            gameInfo,
            games
        });

        //check player count
        if (games[gameIndex].currentPlayers.length >= 3) {
            console.log('currentplayers > 3')
            io.in(data.game).emit('alllowGameStart', {gameName: data.game});
        }

    });

    // var trending = {
    //     uri: "http://api.giphy.com/v1/gifs/trending",
    //     qs: {
    //         api_key: 'JCju0YWAn9NjYLyaI2UBge9vCLPo3Nkz',
    //         limit: '6'
    //     },
    //     json: true
    // };
    //
    // rp(trending)
    //     .then(function (gifs) {
    //
    //         var playerIndex = currentPlayers.findIndex(player => player.id === socket.id );
    //         gifs.data.forEach((e)=> {
    //             currentPlayers[playerIndex].playerCards.push({
    //                 id: e.id,
    //                 mp4: e.images.fixed_width.mp4,
    //                 still: e.images.fixed_width.url
    //             });
    //         });
    //         socket.emit('cardDraft', currentPlayers[playerIndex].playerCards);
    //     })
    //     .catch(function (err) {
    //         console.log(err);
    //     });
    //

    socket.on('startGame', (data) => {
        io.in(data.gameName).emit('startGame', { gameName: data.game, gameInfo, games });
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
                        socket.emit('lobby', {
                            games,
                            gameInfo
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

// DB STUFF
    // socket.on('quote', (data) => {
    //     console.log(data)
    //     db.collection('quotes').findOneAndUpdate({
    //         name: data.name
    //     }, {
    //         $set: {
    //             quote: data.quote
    //         }
    //     }, (err, result) => {
    //         socket.emit('quotes', {quotes: result});
    //     })
    //     // db.collection('quotes').save(data, (err, result) => {
    //     //     if (err) return console.log(err)
    //     //
    //     //     console.log('saved to database')
    //     //     db.collection('quotes').find().toArray((err, result) => {
    //     //         if (err) return console.log(err)
    //     //         socket.emit('quotes', {quotes: result});
    //     //     })
    //     // })
    // })


});


server.listen(8080, function() {
    console.log("I'm listening.");
});


function getGameByPlayerId(id){
    for(var i =0; i < games.length; i++){
        for(var j=0; j < games[i].currentPlayers.length; j++){
            if (games[i].currentPlayers[j].id == id){
                return i;
            }
        }
    }
}
