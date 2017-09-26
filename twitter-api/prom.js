const twitterList = ['theonion'];
const requests = require('./requests.js');
const getTweets = requests.getTweets;
const getToken = requests.getToken;
const fn = require('./functions.js');
const finalize = fn.finalize;

function tweetProm(handle, token){
    return new Promise(function (resolve, reject){
        getTweets(handle, token, function (err, data) {
            if (err) {
                reject(err);
            } else {
                resolve (data);
            }
        });
    });
}

const tokenProm = new Promise(function(resolve, reject){
    getToken(function(err, token){
        if (err){
            reject(err);
        } else {
            resolve(token);
        }
    });
});


function twitter(){
    return tokenProm.then(function(token){
        return Promise.all(twitterList.map(function(handle){
            return tweetProm(handle, token);
        }));
    }).then(function(tweetArr) {
        return finalize(tweetArr);
    }).catch(function(err) {
        console.log(err);
    });
}

exports.twitter = twitter;
exports.tweetProm = tweetProm;
exports.tokenProm = tokenProm;
