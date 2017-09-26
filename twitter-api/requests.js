const https = require('https');


const consumerKey = require('../key.json').consumerKey;
const consumerSecret = require('../key.json').consumerSecret;


function getToken(callback) {
    const req = https.request({
        method: 'POST',
        host: 'api.twitter.com',
        path: '/oauth2/token',
        headers: {
            'Authorization': 'Basic ' + new Buffer(consumerKey + ':' + consumerSecret).toString('base64'),
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
        }
    }, function(res) {

        if (res.statusCode != 200) {
            callback(res.statusCode);
            return;
        } else {
            let body = '';
            res.on('data', chunk => body += chunk).on('end', () =>  {
                try {
                    body = JSON.parse(body);
                    callback(null, body.access_token);

                } catch (e) {
                    callback(e);
                }
            });
        }
    });
    req.write('grant_type=client_credentials');
    req.end();
}

function getTweets(handle, token, callback) {
    const req = https.request({
        method: 'GET',
        host: 'api.twitter.com',
        path: '/1.1/statuses/user_timeline.json?screen_name=' + handle + '&count=50',
        headers: {
            'Authorization': 'Bearer ' + token
        }
    }, function(res){
        let body = '';
        if (res.statusCode != 200) {
            callback(res.statusCode);
            return;
        } else {
            res.on('data', chunk => body += chunk).on('end', () => {
                try {
                    body = JSON.parse(body);
                    callback( null, body);
                } catch (e) {
                    callback (e);
                }
            });
        }

    });
    req.end();
}



exports.getTweets = getTweets;
exports.getToken = getToken;
