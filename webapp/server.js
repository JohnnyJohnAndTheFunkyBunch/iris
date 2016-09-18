var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var AWS = require('aws-sdk');
AWS.config.loadFromPath('./config.json');
AWS.config.update({region: 'us-west-2'});

var s3 = new AWS.S3();
var params = {Bucket: 'cs499rbucket', Key: 'tweet'};
var params2 = {Bucket: 'cs499rbucket'};
s3.headObject(params, function (err, data) {
  if (err) console.log(err, err.stack);
  else console.log(data.ContentLength);
});


app.get('/', function(req, res){
  res.sendfile('index.html');
});

io.on('connection', function(socket){
  console.log("someone connected");
  s3.listObjects(params2, function(err, data) {
    if (err) console.log(err, err.stack); // an error occurred
    else {
      io.emit('s3objects', data);           // successful response
    }
  });
  socket.on('filter', function(fn) {
    // check s3 meta data  
    // break down into pieces
    // send multiple post requests
/*
var request = require('request');

request.post(
    'http://www.yoursite.com/formpage',
    { json: { key: 'value' } },
    function (error, response, body) {
        if (!error && response.statusCode == 200) {
            console.log(body)
        }
    }
);
*/
  });
  socket.on('key', function(key) {
    console.log(key);
    var params = {Bucket: 'cs499rbucket', Key: key, Range: "bytes=0-5000"}; // dont hard code range later
    s3.getObject(params, function (err, data) {
      if (err) console.log(err, err.stack);
      else io.emit('value', data.Body.toString());
    });
  });
});

http.listen(3000, function(){
  console.log('listening on *:3000');
});
