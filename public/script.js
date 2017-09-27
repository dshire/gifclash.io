const socket = io.connect();
var ownId;

socket.on('welcome',(data) => {
    ownId = data.ownId
    $('.announce').remove();
    $('.meme').remove();
    $('.game-instance').html('<h1>TITLE OF GAME</h1><div><input type="text" placeholder=Enter Name" name="name" id="enter-name"><p class="name-button button">Enter Name</p></div>');
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
    var gamesList = '';
    if (data.gameInfo.openGames > 0){
        var games = '';
        data.games.forEach((elem) => {
            if (!elem.gameStarted){
                games += `<li class="game-item" id="${elem.gameName}">${elem.gameName}&nbsp;(${elem.currentPlayers.length}/6)</li>`;
            }
        });
        gamesList = `<h4 class="join-game">Join Game (min 3 players):</h4><ul class="games-list">${games}</ul>`;
    }
    $('.game-instance').html(`<h1>TITLE OF GAME</h1><div class="lobby"><h4 class="players-online">Players Online:&nbsp;${data.gameInfo.playersOnline}</h4><h4 class="games-number">Games Running:&nbsp;${data.gameInfo.gamesRunning}</h4><h4 class="open-games">Open Games:&nbsp;${data.gameInfo.openGames}</h4><div class="games-list-container">${gamesList}</div><p>New Game:</p><input type="text" placeholder=Enter Game Name" name="game" id="new-game"><p class="game-button button">Create Game</p></div>`);

    $('.game-button').click(() => {

        for (var i = 0; i < data.games.length; i++) {
            if (data.games[i].gameName == $('#new-game').val()) {
                console.log('duplicate room');
                return;
            }
        }
        if ($('#new-game').val()){
            socket.emit('newGameLobby', {game: $('#new-game').val()});
            $('.game-button').off();
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
            games += `<li class="game-item" id="${elem.gameName}">${elem.gameName}&nbsp;(${elem.currentPlayers.length}/6)</li>`;
        }
    });
    var gamesList = `<h4 class="join-game">Join Game (min 3 players):</h4><ul class="games-list">${games}</ul>`;

    $('.games-list-container').html(gamesList);
    $('.game-item').click((e) => {
        var gameIndex = data.games.findIndex(game => game.gameName === $(e.target).attr('id') );
        if (data.games[gameIndex].currentPlayers.length < 6) {
            for (var i = 0; i < data.games[gameIndex].currentPlayers.length; i++) {
                if (data.games[gameIndex].currentPlayers[i].id == ownId) {
                    console.log('already in room');
                    return;
                }
            }
            socket.emit('joinGame', {
                game: $(e.target).attr('id')
            });
            $(e.target).off();
        }
    });
});

socket.on('alllowGameStart', (data)=>{
    $('body').append(`<h2 class="announce meme">Click here to Start Game<br>${data.gameName}</h2>`);
    $('.announce').click(() => {socket.emit('startGame', {gameName: data.gameName});});
});

socket.on('startGame', (data) => {
    $('.announce').remove();

    var players = ``;
    data.game.currentPlayers.forEach((player) => {
        players += `<li>${player.name}: ${player.roundsWon}`;
    });

    $('.game-instance').html(`<div class="player-bar"><h4>Game: ${data.gameName}</h4><h4>First to 3 Rounds Wins</h4><h4>Players:</h4><ul class="player-score">${players}</ul></div><div class="playboard"></div><div class="player-cards"></div><div class="card-draft"><input type="text" placeholder=Enter Keyword" name="keyword" id="keyword-1"><input type="text" placeholder=Enter Keyword" name="keyword" id="keyword-2"><p class="draft-button button">Draft Cards</p></div>`);
    $('body').append(`<h2 class="announce meme">Pick your cards</h2>`);
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
    console.log(data.game);
    $('.announce').remove();
    var playerIndex = data.game.currentPlayers.findIndex(player => player.id === ownId );
    var cards = ``;
    data.game.currentPlayers[playerIndex].playerCards.forEach((e) => {
        cards += `<div class="card" id="${e.id}"><video class="gif" autoplay loop poster="${e.still}"><source src="${e.mp4}" type="video/mp4"></video></div>`;
    });
    $('.player-cards').html(cards);
    $('.card').draggable({revert: "invalid", scroll: false, zIndex: 100, containment: ".game-instance"});
    $('.playboard').droppable({
        drop: function( event, ui ) {
            console.log(ui.draggable[0]);
            $(event.target).addClass("selected");
            $('.card').draggable("destroy");
            $(ui.draggable[0]).addClass("played-card");
            socket.emit('drop', {
                cardId: $(ui.draggable[0]).attr('id'),
                gameName: data.gameName
            });
        }
    });
});


socket.on('vote', (data) => {
    $('.played-card').remove();
    var voteCards = ``;
    data.cardsPlayed.forEach((e) => {
        voteCards += `<div class="card vote" id="${e.id}"><video class="gif" autoplay loop poster="${e.still}"><source src="${e.mp4}" type="video/mp4"></video></div>`;
    });
    $('.playboard').html(voteCards);
    $('body').append(`<h2 class="announce meme">VOTE NOW</h2>`);
    $('.vote').click((e) => {
        var cardId = $(e.target).attr('id');
        console.log(cardId);
        socket.emit('playerVoted', {
            cardId,
            gameName: data.gameName
        })
        $('.vote').off('click');
        $('.announce').html(`<h2 class="announce meme">Waiting for other players</h2>`);
    });
});

socket.on('roundResult', (data) =>{
    $('.meme').remove();

    console.log('Winner: Player ' + data.winner);
    console.log(data.points)

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

    var newCardIndex = data.newCards.findIndex(card => card.player === ownId );
    var newCard = data.newCards[newCardIndex].card;
    var card = `<div class="card" id="${newCard.id}"><video class="gif" autoplay loop poster="${newCard.still}"><source src="${newCard.mp4}" type="video/mp4"></video></div>`;

    $('.player-cards').append(card);

    $('.card').draggable({revert: "invalid", scroll: false, zIndex: 100, containment: ".game-instance"});
    $('.playboard').removeClass("selected");
});

socket.on('gameOver', (data) => {
    $('.announce').remove();
    $('body').append(`<h2 class="announce meme">${data.winner}<br>WINS THE GAME</h2>`);
});
