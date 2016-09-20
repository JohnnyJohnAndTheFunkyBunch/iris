var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var AWS = require('aws-sdk');
var request = require('request');
AWS.config.loadFromPath('./config.json');
AWS.config.update({region: 'us-west-2'});

var s3 = new AWS.S3();
var params = {Bucket: 'cs499rbucket', Key: 'tweet'};
var params2 = {Bucket: 'cs499rbucket'};

var pieceSize = 1024 * 1024 * 5;

//////////////// MULTI UPLOAD STUFF

function completeMultipartUpload(s3, doneParams, startTime) {
  s3.completeMultipartUpload(doneParams, function(err, data) {
    if (err) {
      console.log("An error occurred while completing the multipart upload");
      console.log(err);
    } else {
      var delta = (new Date() - startTime) / 1000;
      console.log('Completed upload in', delta, 'seconds');
      console.log('Final upload data:', data);
    }
  });
}


///////////////////////////////


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
    var startTime = new Date();
    console.log(fn.key);
    myparams = {Bucket: 'cs499rbucket', Key: fn.key}
    mylength = 0;
    s3.headObject(myparams, function(err, data) {
      if (err) {
        console.log("ERROR GETTING METADATA");
        console.log(err. err.stack);
      }
      else {
	var multipartMap = {
	    Parts: []
	};
        mylength = parseInt(data.ContentLength)
	pieces = Math.ceil(mylength/pieceSize); 

        var partNum = 0;

        function sendLambdaRequest(myJson, numTry) {
            if (numTry > 3) {
              return;
            }
            request.post(
                'https://tm8k880tf3.execute-api.us-west-2.amazonaws.com/prod/s3grab',
                { json: myJson },
                function (error, response, body) {
                    if (!error && response.statusCode == 200) {
                        if (body.errorMessage) {
                          console.log(body);
                          return sendLambdaRequest(myJson, numTry + 1);
                        }
                        console.log("============== BODY ===========");
                        console.log(body);
                        console.log("============== END BODY ===========");
                        console.log("MyEtag: " + body.ETag);
                        //console.log(Object.keys(body));
                        console.log("Part: " + body.Part);
                        multipartMap.Parts[body.Part-1] = {
                          ETag: body.ETag,
                          PartNumber: body.Part
                        };
                        console.log(multipartMap.Parts[body.Part-1]);
                        piecesCompleted += 1;
                        console.log("PIECESCOmpleted: " + piecesCompleted);
                        if (piecesCompleted == pieces) {
                          console.log("Complete");
                          var doneParams = {
                            Bucket: 'cs499rbucket',
                            Key: fn.key + "_filtered",
                            MultipartUpload: multipartMap,
                            UploadId: myUploadId
                          };
                          console.log("========== DONE PARAMS =======");
                          console.log(doneParams);
                          console.log("========== END DONE PARAMS =======");
                          completeMultipartUpload(s3, doneParams, startTime);
                        }
                    } else {
                        console.log("ERROR");
                        console.log("Part" + body.Part );
                    }
                }
            );
        }

        multiPartParams = {
          Bucket: 'cs499rbucket',
          Key : fn.key + "_filtered"
          //ContentType: 'application/octet-stream'
        }
	console.log("My Key: " + fn.key);
        var myUploadId = "";
        s3.createMultipartUpload(multiPartParams, function(mpErr, multipart){
          if (mpErr) { console.log('Error!', mpErr); return; }
          console.log("Got upload ID", multipart.UploadId);
          myUploadId = multipart.UploadId; 

          console.log("PIECES: " + pieces);
          piecesCompleted = 0;
          for (var i = 0 ; i < pieces ; i++) {
            range1 = pieceSize * i;
            range2 = Math.min(pieceSize * (i + 1) - 1, mylength);
            range1 = range1.toString()
            range2 = range2.toString()
            myJson = { function: fn.function, range: "bytes=" + range1 + "-" + range2, part: i+1, key: fn.key, uploadId: myUploadId, output: fn.key + "_filtered"};
            sendLambdaRequest(myJson, 0);
            console.log("========= JSON ========");
            console.log(myJson);
            console.log("========= END JSON ========");
          }
        });
      }
    });
/*

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
