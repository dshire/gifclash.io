const socket = io.connect();

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
