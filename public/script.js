const socket = io.connect();

socket.on('welcome',() => {
    $('.game-instance').html('<h1>TITLE OF GAME</h1><div><input type="text" placeholder=Enter Name" name="name" id="enter-name"><p class="name-button button">Enter Name</p></div>');
    $('.name-button').click(() => {
        socket.emit('welcome', {name: $('#enter-name').val()})
        $('.name-button').off();
    })
})
socket.on('lobby', (data) => {
    $('.game-instance').html('');
    var gamesList = '';
    if (data.gameInfo.openGames > 0){
        var games = '';
        data.games.forEach((elem) => {
            games += `<li class="game-item" id="${elem.gameName}">${elem.gameName}&nbsp;(${elem.currentPlayers.length}/6)</li>`
        })
        gamesList = `<h4 class="join-game">Join Game (min 3 players):</h4><ul class="games-list">${games}</ul>`
    }
    $('.game-instance').html(`<h1>TITLE OF GAME</h1><div class="lobby"><h4 class="players-online">Players Online:&nbsp;${data.gameInfo.playersOnline}</h4><h4 class="games-number">Games Running:&nbsp;${data.gameInfo.gamesRunning}</h4><h4 class="open-games">Open Games:&nbsp;${data.gameInfo.openGames}</h4><div class="games-list-container">${gamesList}</div><p>New Game:</p><input type="text" placeholder=Enter Game Name" name="game" id="new-game"><p class="game-button button">Create Game</p></div>`);

    $('.game-button').click(() => {
        socket.emit('newGameLobby', {game: $('#new-game').val()});
        $('.game-button').off();
    });
    $('.game-item').click((e) => {
        socket.emit('joinGame', {
            game: $(e.target).attr('id')
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
        games += `<li class="game-item" id="${elem.gameName}">${elem.gameName}&nbsp;(${elem.currentPlayers.length}/6)</li>`;
    });
    var gamesList = `<h4 class="join-game">Join Game (min 3 players):</h4><ul class="games-list">${games}</ul>`;

    $('.games-list-container').html(gamesList);
    $('.game-item').click((e) => {
        var gameId = data.games.findIndex(game => game.gameName === $(e.target).attr('id') );
        if (data.games[gameId].currentPlayers.length < 6) {

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
    $('.game-instance').html('<div class="playboard"></div><div class="player-cards"></div>');
});

$('.playboard').droppable({
    drop: function( event, ui ) {
        console.log(ui.draggable[0]);
        $(event.target).addClass("selected");
        $('.card').draggable("disable");
        $(ui.draggable[0]).addClass("played-card");
        socket.emit('drop', {cardId: $(ui.draggable[0]).attr('id')});
    }
});

$('#submit-btn').click(() => {
    socket.emit('quote', {name: $('#name').val(), quote: $('#quote').val()});
    $('#name').val('')
    $('#quote').val('')
});


socket.on('quotes', (data) => {
    console.log(data.quotes)
})

socket.on('tweets', (data) => {
    console.log(data)
})
socket.on('cardDraft', (data) => {
    console.log(data)
    var cards = ``;
    data.forEach((e) => {
        cards += `<div class="card" id="${e.id}"><video class="gif" autoplay loop poster="${e.still}"><source src="${e.mp4}" type="video/mp4"></video></div>`;
    });
    $('.player-cards').html(cards);
    $('.card').draggable({revert: "invalid", scroll: false, zIndex: 100});
});


socket.on('vote', (data) => {
    $('.played-card').remove();
    var voteCards = ``;
    data.forEach((e) => {
        voteCards += `<div class="card vote" id="${e.id}"><video class="gif" autoplay loop poster="${e.still}"><source src="${e.mp4}" type="video/mp4"></video></div>`;
    });
    $('.playboard').html(voteCards);

    $('.vote').click((e) => {
        var cardId = $(e.target).attr('id');
        console.log(cardId);
        socket.emit('playerVoted', cardId)
        $('.vote').off('click');
    });
});

socket.on('roundResult', (data) =>{
    console.log('Winner: Player ' + data.winner);
    console.log(data.points)
    $('.vote').each((index, card) => {
        var id = $(card).attr('id');
        var score = data.points[id];
        $(card).append(`<h3 class="card-points meme">${score}</h3>`)
    })
    $('body').append(`<h2 class="announce meme">${data.winner}<br>WINS THE ROUND</h2>`)
})


socket.on('newRound', () => {
    $('.meme').remove();
    $('.vote').remove();
    $('.card').draggable("enable");
    $('.playboard').removeClass("selected");
});

socket.on('gameOver', (data) => {
    $('.announce').remove();
    $('body').append(`<h2 class="announce meme">${data.winner}<br>WINS THE GAME</h2>`);
});

socket.on('newGame', (data) => {
    $('.announce').remove();
    $('.game-instance').html('');
});
