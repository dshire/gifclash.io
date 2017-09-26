socket.emit('quotes', {quotes: result});

db.quotes.find({name: 'Lindner'})
