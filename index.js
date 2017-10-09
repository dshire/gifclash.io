const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io').listen(server);
const rp = require('request-promise');
const prom = require('./twitter-api/prom.js');
const helmet = require('helmet');
const giphyKey = process.env.GIPHY_KEY || require('./key.json').giphyKey;
const favicon = require('serve-favicon');

app.use(helmet());

app.use(favicon(__dirname + '/public/style/favicon.ico'));

app.use(express.static('./public'));

app.get('/',function(req,res){
    res.sendFile(__dirname+'/index.html');
});

app.get('/test', function(req, res){
    res.sendFile(__dirname+'/public/test.html');
});


// --------- SOCKET.IO ------------------

var games = [];
var gameInfo = {
    gamesRunning: 0,
    openGames: 0,
    playersOnline: 0
};

var allPlayers = [];
function nameById(id){
    var playerIndex = allPlayers.findIndex(player => player.id === id );
    if (playerIndex >= 0) {
        return allPlayers[playerIndex].name;
    }
}


io.on('connection', function(socket) {
    var trendingGifs = [];
    var trending = {
        uri: "http://api.giphy.com/v1/gifs/trending",
        qs: {
            api_key: 'JCju0YWAn9NjYLyaI2UBge9vCLPo3Nkz',
            limit: '30'
        },
        json: true
    };
    rp(trending)
        .then(function (gifs) {
            gifs.data.forEach((e)=> {
                trendingGifs.push({
                    mp4: e.images.fixed_width.mp4,
                    still: e.images.fixed_width_still.url
                });
            });
            socket.emit('welcome',{ownId: socket.id, cards: trendingGifs});
        })
        .catch(function (err) {
            console.log(err);
        });

    console.log(`socket with the id ${socket.id} is now connected`);
    gameInfo.playersOnline++;
    socket.to('lobby').emit('newPlayerOnline', {gameInfo});

    // console.log(io.sockets.connected)
    socket.on('disconnect', function() {
        console.log(`socket with the id ${socket.id} is now disconnected`);
        gameInfo.playersOnline--;
        socket.to('lobby').emit('newPlayerOnline', {gameInfo});
        var allPlayersIndex = allPlayers.findIndex(player => player.id === socket.id );
        if (allPlayersIndex >= 0) {
            allPlayers.splice(allPlayersIndex, 1);
        }
        var game = getGameByPlayerId(socket.id);
        if (game >= 0) {
            var playerIndex = games[game].currentPlayers.findIndex(player => player.id === socket.id );
            games[game].currentPlayers.splice(playerIndex, 1);
            delete games[game].currentRound[socket.id];
            if (games[game].currentPlayers.length < 1) {
                games.splice(game, 1);
                if (gameInfo.openGames > 0){
                    gameInfo.openGames--;
                }
            }
            io.in('lobby').emit('newGameLobby', {
                gameInfo,
                games
            });
        }
    });

    socket.on('chatMsg', (data) => {
        var message = nameById(socket.id) + ': ' + data.message;
        io.in(data.gameName).emit('chatMsg', {
            message
        });
    });
    socket.on('generalChat', (data) => {
        var message = nameById(socket.id) + ': ' + data.message;
        io.in('lobby').emit('chatMsg', {
            message
        });
    });

    socket.on('welcome', (data) => {
        allPlayers.push({
            id: socket.id,
            name: data.name

        });
        socket.join('lobby');
        socket.emit('lobby', {
            games,
            gameInfo,
            cards: trendingGifs
        });
    });

    socket.on('newGameLobby', (data) => {
        var newGame = true;
        for (var i = 0; i < games.length; i++) {
            if (games[i].gameName == data.game) {
                // console.log('duplicate room');
                newGame = false;
                return;
            }
        }

        if (newGame) {

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
                    roundsWon: 0,
                    name: nameById(socket.id)
                }],
                cardsDrafted: [],
                cardsPlayed: [],
                currentRound: {[socket.id]: 0},
                currentRoundCount: 0,
                gameName: data.game,
                gameStarted: false,
                replacementCards: [],
                selector: 0,
                tweets: []
            });
            gameInfo.openGames++;
            socket.join(data.game);
            io.in('lobby').emit('newGameLobby', {
                gameInfo,
                games
            });
        }
    });

    socket.on('joinGame', (data) => {
        var game = getGameByPlayerId(socket.id);
        if ( game >= 0 && games[game].gameName == data.game ) {
            return;
        }
        //leaving old game
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
            roundsWon: 0,
            name: nameById(socket.id)
        });
        games[gameIndex].currentRound[socket.id] = 0;
        io.in('lobby').emit('newGameLobby', {
            gameInfo,
            games
        });

        //check player count
        if (games[gameIndex].currentPlayers.length >= 3) {
            io.in(data.game).emit('alllowGameStart', {gameName: data.game});
        }

    });


    socket.on('startGame', (data) => {

        gameInfo.openGames--;
        gameInfo.gamesRunning++;
        var gameIndex = games.findIndex(game => game.gameName === data.gameName );

        // GETTING TWITTER HEADLINES
        prom.twitter().then(function(headlines){
            games[gameIndex].tweets = headlines;
            // console.log(headlines);
        }).catch(function(err){
            console.log(err);
        });

        var trending = {
            uri: "http://api.giphy.com/v1/gifs/trending",
            qs: {
                api_key: giphyKey,
                limit: '100'
            },
            json: true
        };
        rp(trending)
            .then(function (gifs) {
                gifs.data.forEach((e)=> {
                    games[gameIndex].replacementCards.push({
                        id: e.id,
                        mp4: e.images.fixed_width.mp4,
                        still: e.images.fixed_width_still.url
                    });
                });
            })
            .catch(function (err) {
                console.log(err);
            });

        games[gameIndex].gameStarted = true;
        games[gameIndex].currentPlayers.forEach((player) => {
            let socket = io.sockets.connected[player.id];
            socket.leave('lobby');
        });

        io.in(data.gameName).emit('startGame', { gameName: data.gameName, gameInfo, game: games[gameIndex] });
        io.in('lobby').emit('newGameLobby', {
            gameInfo,
            games
        });
    });

    socket.on('draftCards', (data) => {
        var gameIndex =  games.findIndex(game => game.gameName === data.gameName );
        var playerCount = games[gameIndex].currentPlayers.length

        var key1 = {
            uri: "http://api.giphy.com/v1/gifs/search",
            qs: {
                q: data.keyword1,
                api_key: giphyKey,
                limit: '15'
            },
            json: true
        };
        var key2 = {
            uri: "http://api.giphy.com/v1/gifs/search",
            qs: {
                q: data.keyword2,
                api_key: giphyKey,
                limit: '15'
            },
            json: true
        };

        rp(key1).then(function (gifs) {
            gifs.data.forEach((e)=> {
                games[gameIndex].cardsDrafted.push({
                    id: e.id,
                    mp4: e.images.fixed_width.mp4,
                    still: e.images.fixed_width_still.url
                });
            });

            if (gifs.data.length < 15) {
                var num = 15 - gifs.data.length;
                // console.log(num + ' cards are missing from key1')
                for (var i = 0; i < num; i++){
                    var cardIndex = Math.floor(Math.random() * games[gameIndex].replacementCards.length);
                    games[gameIndex].cardsDrafted.push(games[gameIndex].replacementCards[cardIndex]);
                    games[gameIndex].replacementCards.splice(cardIndex, 1);
                }
            }

            if(games[gameIndex].cardsDrafted.length >= playerCount * 30) {
                deliverCards();
            }
        }).catch(function (err) {
            console.log(err);
        });
        rp(key2).then(function (gifs) {
            gifs.data.forEach((e)=> {
                games[gameIndex].cardsDrafted.push({
                    id: e.id,
                    mp4: e.images.fixed_width.mp4,
                    still: e.images.fixed_width_still.url
                });
            });

            if (gifs.pagination.count < 15) {
                var num = 15 - gifs.pagination.count;
                // console.log(num + ' cards are missing from key2')
                for (var i = 0; i < num; i++){
                    var cardIndex = Math.floor(Math.random() * games[gameIndex].replacementCards.length);
                    games[gameIndex].cardsDrafted.push(games[gameIndex].replacementCards[cardIndex]);
                    games[gameIndex].replacementCards.splice(cardIndex, 1);
                }
            }

            if(games[gameIndex].cardsDrafted.length >= playerCount * 30) {
                deliverCards();
            }
        }).catch(function (err) {
            console.log(err);
        });


        function deliverCards(){
            games[gameIndex].currentPlayers.forEach((player) => {
                drawCard(player);
                drawCard(player);
                drawCard(player);
                drawCard(player);
                drawCard(player);
                drawCard(player);
            });

            var tweetChoice = [];
            for (var i = 0; i < 4; i++){
                var tweetIndex = Math.floor(Math.random() * games[gameIndex].tweets.length);
                tweetChoice.push(games[gameIndex].tweets[tweetIndex]);
                games[gameIndex].tweets.splice(tweetIndex, 1);
            }

            io.in(data.gameName).emit('cardDraft', {
                gameName: data.gameName,
                gameInfo,
                game: games[gameIndex],
                tweets: tweetChoice
            });
            // console.log(games[gameIndex].cardsDrafted)
        }

        function drawCard(player){
            var cardIndex = Math.floor(Math.random() * games[gameIndex].cardsDrafted.length);
            // console.log(cardIndex)
            player.playerCards.push(games[gameIndex].cardsDrafted[cardIndex]);
            games[gameIndex].cardsDrafted.splice(cardIndex, 1);
        }
    })


    socket.on('tweet-chosen', (data) => {

        io.in(data.gameName).emit('tweet-chosen', {
            gameName: data.gameName,
            tweetText: data.tweetText,
            tweetPic: data.tweetPic
        });
    });

    socket.on('drop',(data) => {
        var gameIndex =  games.findIndex(game => game.gameName === data.gameName );
        var playerIndex = games[gameIndex].currentPlayers.findIndex(player => player.id === socket.id );
        var cardIndex = games[gameIndex].currentPlayers[playerIndex].playerCards.findIndex(card => card.id === data.cardId );
        games[gameIndex].cardsPlayed.push({
            id: data.cardId,
            text: data.cardText,
            color: data.color,
            player: socket.id,
            mp4: games[gameIndex].currentPlayers[playerIndex].playerCards[cardIndex].mp4,
            still: games[gameIndex].currentPlayers[playerIndex].playerCards[cardIndex].still
        });
        games[gameIndex].currentPlayers[playerIndex].playerCards.splice(cardIndex, 1);
        if (games[gameIndex].cardsPlayed.length > 0 && games[gameIndex].cardsPlayed.length >= games[gameIndex].currentPlayers.length) {

            io.in(data.gameName).emit('vote', {
                cardsPlayed: games[gameIndex].cardsPlayed,
                gameName: data.gameName,
                gameInfo,
                game: games[gameIndex]
            });
            // console.log('current players: ' + games[gameIndex].currentPlayers);
        }

    });

    socket.on('playerVoted', (data) => {
        // console.log('player voted for card: ' + data.cardId);
        var gameIndex =  games.findIndex(game => game.gameName === data.gameName );
        var playedCardIndex = games[gameIndex].cardsPlayed.findIndex(card => card.id === data.cardId);
        var playerVotedFor = games[gameIndex].cardsPlayed[playedCardIndex].player
        // console.log('player ' + playerVotedFor + ' gets a point');

        games[gameIndex].currentRound[playerVotedFor]++;

        games[gameIndex].currentRoundCount++;
        if (games[gameIndex].currentRoundCount >= games[gameIndex].currentPlayers.length) {
            //Check for round winner
            var keys = Object.keys(games[gameIndex].currentRound),
                largest = Math.max.apply(null, keys.map(x => games[gameIndex].currentRound[x])),
                result = keys.reduce((result, key) => { if (games[gameIndex].currentRound[key] === largest){ result.push(key); } return result; }, []);

            var winnerId = result[0];
            var tie = false;

            if (result.length > 1) {
                winnerId = result[Math.floor(Math.random() * result.length)];
                tie = true;
            }

            var points = {};
            for(var key in games[gameIndex].currentRound) {
                if(games[gameIndex].currentRound.hasOwnProperty(key)) {
                    var index = games[gameIndex].cardsPlayed.findIndex(card => card.player === key);
                    var card = games[gameIndex].cardsPlayed[index].id;
                    points[card] = games[gameIndex].currentRound[key];
                }
            }
            var winnerName = nameById(winnerId);
            var playerIndex = games[gameIndex].currentPlayers.findIndex(player => player.id === winnerId );
            if (playerIndex >= 0) {
                games[gameIndex].currentPlayers[playerIndex].roundsWon++;
                io.in(data.gameName).emit('roundResult', {
                    winner: winnerName,
                    points,
                    tie,
                    game: games[gameIndex]
                });
                Object.keys(games[gameIndex].currentRound).forEach(player => games[gameIndex].currentRound[player] = 0);
                games[gameIndex].currentRoundCount = 0;
                games[gameIndex].cardsPlayed = [];
                if (games[gameIndex].currentPlayers[playerIndex].roundsWon >= 3) {
                    setTimeout(() => {
                        io.in(data.gameName).emit('gameOver',{
                            winner: winnerName
                        });
                        if(gameInfo.gamesRunning > 0){
                            gameInfo.gamesRunning--;
                        }
                        var leavingPlayers = games[gameIndex].currentPlayers;
                        games.splice(gameIndex, 1);
                        setTimeout(() => {
                            io.in(data.gameName).emit('lobby', {
                                games,
                                gameInfo,
                                cards: trendingGifs
                            });
                            leavingPlayers.forEach((player) => {
                                let socket = io.sockets.connected[player.id];
                                socket.leave(data.gameName);
                                socket.join('lobby');
                            });

                        }, 4000);
                    }, 2000);
                } else {
                    var newCards = [];
                    games[gameIndex].currentPlayers.forEach((player) => {
                        var cardIndex = Math.floor(Math.random() * games[gameIndex].cardsDrafted.length);
                        player.playerCards.push(games[gameIndex].cardsDrafted[cardIndex]);
                        newCards.push({
                            player: player.id,
                            card: games[gameIndex].cardsDrafted[cardIndex]
                        });
                        games[gameIndex].cardsDrafted.splice(cardIndex, 1);

                    });
                    var tweetChoice = [];
                    for (var i = 0; i < 4; i++){
                        var tweetIndex = Math.floor(Math.random() * games[gameIndex].tweets.length);
                        tweetChoice.push(games[gameIndex].tweets[tweetIndex]);
                        games[gameIndex].tweets.splice(tweetIndex, 1);
                    }
                    if (games[gameIndex].selector == (games[gameIndex].currentPlayers.length - 1)) {
                        games[gameIndex].selector = 0;
                    } else {
                        games[gameIndex].selector++;
                    }
                    setTimeout(() => {
                        io.in(data.gameName).emit('newRound', {
                            newCards,
                            gameName: data.gameName,
                            gameInfo,
                            game: games[gameIndex],
                            tweets: tweetChoice
                        });
                    }, 2000);

                }
            } else {
                if(gameInfo.gamesRunning > 0){
                    gameInfo.gamesRunning--;
                }
                var leavingPlayers = games[gameIndex].currentPlayers;
                games.splice(gameIndex, 1);
                setTimeout(() => {
                    io.in(data.gameName).emit('lobby', {
                        games,
                        gameInfo,
                        cards: trendingGifs
                    });
                    leavingPlayers.forEach((player) => {
                        let socket = io.sockets.connected[player.id];
                        socket.leave(data.gameName);
                        socket.join('lobby');
                    });

                }, 4000);
            }
        }
    });

});


server.listen(process.env.PORT || 8080, function() {
    console.log('Listening on port:8080');
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
