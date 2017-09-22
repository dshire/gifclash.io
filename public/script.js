$('.card').draggable({revert: "invalid"});
$('.playboard').droppable({
    drop: function( event, ui ) {
        $(event.target).addClass("selected");
        $(ui.draggable[0]).draggable("disable");
    }
});
