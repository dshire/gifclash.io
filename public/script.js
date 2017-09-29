(function () {


    const socket = io.connect();
    var ownId;
    function randomColor() {
        var colors = ['blue', 'red', 'green', 'white', 'black'];
        var index = Math.floor(Math.random() * colors.length);
        return colors[index];
    }

    socket.on('welcome',(data) => {
        ownId = data.ownId
        $('.announce').remove();
        $('.meme').remove();

        var cards = ``;
        data.cards.forEach((e) => {
            cards += `<div class="card background-card"><video class="gif" autoplay loop poster="${e.still}"><source src="${e.mp4}" type="video/mp4"></video><textarea class="card-text" maxlength="50" name=""></textarea></div>`;
        });
        $('.game-instance').after(`<div class="background">${cards}</div>`);

        $('.game-instance').html(`<h1>GIF CLASH</h1><div class="enter-name"><input autocomplete="off" type="text" placeholder="Name" name="name" id="enter-name"><p class="name-button button">ENTER</p></div>`);
        $('.name-button').click(() => {
            if ($('#enter-name').val()){
                socket.emit('welcome', {name: $('#enter-name').val()})
                $('.name-button').off();

            }
        })
    })
    socket.on('lobby', (data) => {
        $('.announce').remove();
        $('.meme').remove();
        $('.game-instance').html('');

        if (!$('.background').length) {
            // console.log(data)
            var cards = ``;
            data.cards.forEach((e) => {
                cards += `<div class="card background-card"><video class="gif" autoplay loop poster="${e.still}"><source src="${e.mp4}" type="video/mp4"></video><textarea class="card-text" maxlength="50" name=""></textarea></div>`;
            });
            $('.game-instance').after(`<div class="background">${cards}</div>`);
        }

        var gamesList = '';
        if (data.gameInfo.openGames > 0){
            var games = '';
            data.games.forEach((elem) => {
                if (!elem.gameStarted){
                    games += `<li class="game-item" id="${elem.gameName}">${elem.gameName}&nbsp;(${elem.currentPlayers.length}/6)</li>`;
                }
            });
            gamesList = `<h4 class="join-game">Join Game (min 3 players):</h4><div class="games-container"><ul class="games-list">${games}</ul></div>`;
        }
        $('.game-instance').html(`<h1>GIF CLASH</h1><div class="lobby"><div class="lobby-data"><h4 class="players-online">Players Online:&nbsp;${data.gameInfo.playersOnline}</h4><h4 class="games-number">Games Running:&nbsp;${data.gameInfo.gamesRunning}</h4><h4 class="open-games">Open Games:&nbsp;${data.gameInfo.openGames}</h4><div class="games-list-container">${gamesList}</div><div class="new-game-container"><input type="text" placeholder="New Game" name="game" id="new-game"><p class="game-button button">Create Game</p></div></div><div class="chat"><label for="chat-window">Chat</label><div class="chat-window" id="chat-window"><div class="chat-window-content"><ul class="chat-list"></ul></div></div><input class="chat-input" type="text" name="chat-input" value=""></div></div></div>`);

        $('.chat-input').on("keypress", function(e) {
            if (e.keyCode == 13) {
                socket.emit('generalChat', {
                    message: $('.chat-input').val(),
                    gameName: data.gameName
                });
                $('.chat-input').val('');
            }
        });

        $('.game-button').click(() => {
            var newGame = true
            for (var i = 0; i < data.games.length; i++) {
                if (data.games[i].gameName == $('#new-game').val()) {
                    newGame = false;
                    return;
                }
            }
            if (newGame && $('#new-game').val()){
                socket.emit('newGameLobby', {game: $('#new-game').val()});
                $('.new-game-container').remove();
            }
        });
        $('.game-item').click((e) => {
            var game = $(e.target).attr('id');

            socket.emit('joinGame', {
                game
            });
            $(e.target).off();
        });
    });
    socket.on('newPlayerOnline', (data) => {
        $('.players-online').html(`Players Online:&nbsp;${data.gameInfo.playersOnline}`);
    });

    socket.on('newGameLobby', (data) => {
        var games = '';
        data.games.forEach((elem) => {
            if (!elem.gameStarted){
                if (elem.currentPlayers.find(e => e.id == ownId)) {
                    games += `<li class="game-item own-game" id="${elem.gameName}">${elem.gameName}&nbsp;(${elem.currentPlayers.length}/6)</li>`;
                } else {

                    games += `<li class="game-item" id="${elem.gameName}">${elem.gameName}&nbsp;(${elem.currentPlayers.length}/6)</li>`;
                }
            }
        });
        var gamesList = `<h4 class="join-game">Join Game (min 3 players):</h4><div class="games-container"><ul class="games-list">${games}</ul></div>`;

        $('.games-number').html(`Games Running:&nbsp;${data.gameInfo.gamesRunning}`);
        $('.open-games').html(`Open Games:&nbsp;${data.gameInfo.openGames}`);
        $('.games-list-container').html(gamesList);
        $('.game-item').click((e) => {
            var gameIndex = data.games.findIndex(game => game.gameName === $(e.target).attr('id') );
            if (data.games[gameIndex].currentPlayers.length < 6) {
                var otherRoom = true;
                for (var i = 0; i < data.games[gameIndex].currentPlayers.length; i++) {
                    if (data.games[gameIndex].currentPlayers[i].id == ownId) {
                        otherRoom = false;
                        return;
                    }
                }
                if (otherRoom) {
                    socket.emit('joinGame', {
                        game: $(e.target).attr('id')
                    });
                    $(e.target).off();

                }
            }
        });
    });

    socket.on('alllowGameStart', (data)=>{
        $('body').append(`<h2 class="announce-game meme">Click here to Start Game<br>${data.gameName}</h2>`);
        $('.announce-game').click(() => {socket.emit('startGame', {gameName: data.gameName});});
    });

    socket.on('startGame', (data) => {
        $('.announce').remove();
        $('.announce-game').remove();
        $('.background').remove();

        var players = ``;
        data.game.currentPlayers.forEach((player) => {
            players += `<li class="player-item">${player.name}: ${player.roundsWon}`;
        });

        $('.game-instance').html(`<div class="game-background"><div class="game-background-layer"></div></div><div class="player-bar"><div class="game-info"><h4>Game: ${data.gameName}</h4><h4>First to 3 Rounds Wins</h4><h4>Players:</h4><ul class="player-score">${players}</ul></div><div class="chat"><label for="chat-window">Chat</label><div class="chat-window" id="chat-window"><div class="chat-window-content"><ul class="chat-list"></ul></div></div><input class="chat-input" type="text" name="chat-input" value=""></div></div><div class="vote-container"></div><div class="playboard"><div class="playboard-layer"></div></div><div class="player-cards"></div><div class="card-draft"><input type="text" placeholder="Keyword" name="keyword" id="keyword-1"><input type="text" placeholder="Keyword" name="keyword" id="keyword-2"><p class="draft-button button">Draft Cards</p></div>`);
        $('body').append(`<h2 class="announce meme">Pick your cards</h2>`);

        $('.chat-input').on("keypress", function(e) {
            if (e.keyCode == 13) {
                socket.emit('chatMsg', {
                    message: $('.chat-input').val(),
                    gameName: data.gameName
                });
                $('.chat-input').val('');
            }
        });

        $('.draft-button').click(() => {
            if ($('#keyword-1').val() && $('#keyword-2').val()){
                $('.draft-button').off();
                var key1 = $('#keyword-1').val()
                var key2 = $('#keyword-2').val()
                socket.emit('draftCards', {
                    keyword1: key1.split(' ').join('+'),
                    keyword2: key2.split(' ').join('+'),
                    gameName: data.gameName
                });
                $('.card-draft').remove();
                $('.announce').html(`<h2 class="announce meme">Waiting for other players</h2>`);
            }
        });
    });



    socket.on('cardDraft', (data) => {
        // console.log(data.game);
        $('.announce').remove();
        var playerIndex = data.game.currentPlayers.findIndex(player => player.id === ownId );
        var cards = ``;
        data.game.currentPlayers[playerIndex].playerCards.forEach((e) => {
            var color = randomColor();
            cards += `<div class="card ${color}" data-color="${color}" id="${e.id}"><video class="gif" autoplay loop poster="${e.still}"><source src="${e.mp4}" type="video/mp4"></video><textarea class="card-text" maxlength="50" name="" spellcheck="false" placeholder="Add Spice"></textarea></div>`;
        });
        $('.player-cards').html(cards);
        $('.card').draggable({revert: "invalid", scroll: false, zIndex: 100, containment: ".game-instance"});

        if (data.game.currentPlayers[data.game.selector].id == ownId) {
            var tweets = ``;

            data.tweets.forEach((tweet) => {
                tweets += `<li class="tweet-li tweet-click"><p class="tweet">${tweet.text}</p><img class="pic-choice" src="${tweet.img}" alt="image"></li>`;
            });

            $('.game-instance').append(`<div class="tweet-choice"><h2>Your turn to choose!</h2><ul>${tweets}<li class="tweet-li"><label for="t-i">Write your own:</label><input id="t-i" class="tweet-input" type="text" name="tweet-input" maxlength="100"></li></ul></div>`);

            $('.tweet-click').click((e)=> {
                $('.tweet-click').off();
                // console.log($(e.currentTarget).find('p').text())
                // console.log($(e.currentTarget).find('img').attr('src'))
                socket.emit('tweet-chosen', {
                    gameName: data.gameName,
                    tweetText: $(e.currentTarget).find('p').text(),
                    tweetPic: $(e.currentTarget).find('img').attr('src')
                });
                $('.tweet-choice').remove();
            });

            $('#t-i').on("keypress", function(e) {
                if (e.keyCode == 13) {
                    $('#t-i').off()
                    socket.emit('tweet-chosen', {
                        gameName: data.gameName,
                        tweetText: $('#t-i').val(),
                        tweetPic: null
                    });
                    $('.tweet-choice').remove();
                }
            });

        } else {
            $('body').append(`<h2 class="announce meme">WAIT FOR TOPIC</h2>`)
        }

    });

    socket.on('tweet-chosen', (data) => {
        $('.topic-modal').remove();
        $('.meme').remove();
        var img = ``;
        if (data.tweetPic){
            img = `<img class="round-pic" src="${data.tweetPic}" alt="image">`;
        }
        // console.log('img is ' + img)
        var topic = `<div class="topic-modal"><div class="round-topic"><h2 class="round-title">${data.tweetText}</h2></div>${img}</div>`;
        $('.game-instance').prepend(topic);
        // console.log('topic is ' + topic)
        $('.playboard').droppable({
            drop: function( event, ui ) {
                // console.log(ui.draggable[0]);
                $('body').append(`<h2 class="announce meme">Waiting for other players</h2>`);
                $('.card').draggable("destroy");
                $(ui.draggable[0]).addClass("played-card");
                socket.emit('drop', {
                    cardId: $(ui.draggable[0]).attr('id'),
                    cardText: $(ui.draggable[0]).find('textarea').val(),
                    gameName: data.gameName,
                    color: $(ui.draggable[0]).attr('data-color')
                });
            }
        });
    });


    socket.on('vote', (data) => {
        $('.meme').remove();
        $('.played-card').remove();
        var voteCards = ``;
        data.cardsPlayed.forEach((e) => {
            voteCards += `<div class="card vote ${e.color}" id="${e.id}"><video class="gif" autoplay loop poster="${e.still}"><source src="${e.mp4}" type="video/mp4"></video><textarea class="card-text vote-card-text" maxlength="50" readonly="yes" name="">${e.text}</textarea></div>`;
        });
        $('.vote-container').html(voteCards);
        $('body').append(`<h2 class="announce meme">VOTE NOW</h2>`);
        $('.vote').click((e) => {
            var cardId = $(e.currentTarget).attr('id');
            var cardIndex = data.cardsPlayed.findIndex(card => card.id === cardId );
            if (data.cardsPlayed[cardIndex].player == ownId) {
                $('.announce').html(`<h2 class="announce meme">Don't vote for your own card</h2>`);

            } else {

                socket.emit('playerVoted', {
                    cardId,
                    gameName: data.gameName
                });
                $('.vote').off('click');
                $('.announce').html(`<h2 class="announce meme">Waiting for other players</h2>`);
            }
        });
    });

    socket.on('roundResult', (data) =>{
        $('.meme').remove();

        // console.log('Winner: Player ' + data.winner);
        // console.log(data.points)

        var score = ``;
        data.game.currentPlayers.forEach((player) => {
            score += `<li>${player.name}: ${player.roundsWon}</li>`;
        });
        $('.player-score').html(score);
        $('.vote').each((index, card) => {
            var id = $(card).attr('id');
            var score = data.points[id];
            $(card).append(`<h3 class="card-points meme">${score}</h3>`)
        })
        $('body').append(`<h2 class="announce meme">${data.winner}<br>WINS THE ROUND</h2>`)
    })


    socket.on('newRound', (data) => {
        $('.meme').remove();
        $('.vote').remove();
        $('.tweet-choice').remove();

        var newCardIndex = data.newCards.findIndex(card => card.player === ownId );
        var newCard = data.newCards[newCardIndex].card;
        var color = randomColor();
        var card = `<div class="card ${color}" data-color="${color}" id="${newCard.id}"><video class="gif" autoplay loop poster="${newCard.still}"><source src="${newCard.mp4}" type="video/mp4"></video><textarea class="card-text" maxlength="50" name="" spellcheck="false" placeholder="Add Spice"></textarea></div>`;

        $('.player-cards').append(card);

        $('.card').draggable({revert: "invalid", scroll: false, zIndex: 100, containment: ".game-instance"});
        $('.playboard').removeClass("selected");
        $('.playboard').droppable('destroy');

        // console.log('selector is ' + data.game.selector)
        // console.log('id of selector is ' + data.game.currentPlayers[data.game.selector].id)
        if (data.game.currentPlayers[data.game.selector].id == ownId) {
            var tweets = ``;

            data.tweets.forEach((tweet) => {
                tweets += `<li class="tweet-li tweet-click"><p class="tweet">${tweet.text}</p><img class="pic-choice" src="${tweet.img}" alt="image"></li>`;
            });

            $('.game-instance').append(`<div class="tweet-choice"><h2>Your turn to choose!</h2><ul>${tweets}<li class="tweet-li"><label for="t-i">Write your own:</label><input id="t-i" class="tweet-input" type="text" name="tweet-input" maxlength="100"></li></ul></div>`);

            $('.tweet-click').click((e)=> {
                $('.tweet-click').off();

                socket.emit('tweet-chosen', {
                    gameName: data.gameName,
                    tweetText: $(e.currentTarget).find('p').text(),
                    tweetPic: $(e.currentTarget).find('img').attr('src')
                });
                $('.tweet-choice').remove();
            });

            $('#t-i').on("keypress", function(e) {
                if (e.keyCode == 13) {
                    $('#t-i').off()
                    socket.emit('tweet-chosen', {
                        gameName: data.gameName,
                        tweetText: $('#t-i').val(),
                        tweetPic: null
                    });
                    $('.tweet-choice').remove();
                }
            });

        } else {
            $('body').append(`<h2 class="announce meme">WAIT FOR TOPIC</h2>`)
        }

    });

    socket.on('gameOver', (data) => {
        $('.announce').remove();
        $('body').append(`<h2 class="announce meme">${data.winner}<br>WINS THE GAME</h2>`);
    });

    socket.on('chatMsg', (data) => {
        var message = `<li class="chat-li">${data.message}</li>`
        $('.chat-list').append(message)
        $('.chat-window-content')[0].scrollTop = $('.chat-window-content')[0].scrollHeight
    });


})();
