exports.finalize = finalize;

function compare(a, b){
    let dateA = new Date(a.created_at);
    let dateB = new Date(b.created_at);
    return dateB - dateA;
}

function filter(data){
    var arr = data.filter(function(e) {
        return e.entities.urls.length === 1;
    });
    return arr;
}

function reduce(data) {
    var results = [];
    data.forEach(function(e) {
        let source = e.user.name;
        let text = e.text.replace(e.entities.urls[0].url, '');

        try {
            if (e.entities.media && e.entities.media[0].url) {
                text = text.replace(e.entities.media[0].url, "");
            }
            // if (e.extended_entities.media && e.extended_entities.media[0].url) {
            //     text = text.replace(e.extended_entities.media[0].url, "");
            // }
        } catch(e) {
            console.log(e);
        } finally {
            results.push ({
                "text": text,
                "url": e.entities.urls[0].url
            });
        }

    });
    return results;
}

function finalize(data) {
    var concArr = [];
    while (data.length) {
        concArr = concArr.concat(data.shift());
    }

    concArr.sort(compare);
    return reduce(filter(concArr));
}
