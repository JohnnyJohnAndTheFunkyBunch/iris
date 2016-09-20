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

function completeMultipartUpload(s3, doneParams) {
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

function uploadPart(s3, multipart, partParams, tryNum) {
  var tryNum = tryNum || 1;
  s3.uploadPart(partParams, function(multiErr, mData) {
    if (multiErr){
      console.log('multiErr, upload part error:', multiErr);
      if (tryNum < maxUploadTries) {
        console.log('Retrying upload of part: #', partParams.PartNumber)
        uploadPart(s3, multipart, partParams, tryNum + 1);
      } else {
        console.log('Failed uploading part: #', partParams.PartNumber)
      }
      return;
    }
    multipartMap.Parts[this.request.params.PartNumber - 1] = {
      ETag: mData.ETag,
      PartNumber: Number(this.request.params.PartNumber)
    };
    console.log("Completed part", this.request.params.PartNumber);
    console.log('mData', mData);
    if (--numPartsLeft > 0) return; // complete only when all parts uploaded

    var doneParams = {
      Bucket: bucket,
      Key: fileKey,
      MultipartUpload: multipartMap,
      UploadId: multipart.UploadId
    };

    console.log("Completing upload...");
    completeMultipartUpload(s3, doneParams);
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
    console.log(fn.key);
    myparams = {Bucket: 'cs499rbucket', Key: fn.key}
    mylength = 0;
    s3.headObject(myparams, function(err, data) {
      if (err) {
        console.log("ERROR GETTING METADATA");
        console.log(err. err.stack);
      }
      else {
        mylength = parseInt(data.ContentLength)
	pieces = Math.ceil(mylength/pieceSize); 

        var partNum = 0;

        multiPartParams = {
          Bucket: 'cs499rbucket',
          key : fn.Key,
          //ContentType: 'application/octet-stream'
        }
        myUploadId = "";
        s3.createMultipartUpload(multiPartParams, function(mpErr, multipart){
          if (mpErr) { console.log('Error!', mpErr); return; }
          console.log("Got upload ID", multipart.UploadId);
          myUploadId = UploadId; 
        });

        console.log("PIECES: " + pieces);
        piecesCompleted = 0;
        for (i = 0 ; i < pieces ; i++) {
          range1 = pieceSize * i;
          range2 = pieceSize * (i + 1) - 1;
          range1 = range1.toString()
          range2 = range2.toString()
          request.post(
              'https://tm8k880tf3.execute-api.us-west-2.amazonaws.com/prod/s3grab',
              { json: { function: fn.function, range: "bytes=" + range1 + "-" + range2, part: i, key: fn.key, uploadId: myUploadId} },
              function (error, response, body) {
                  if (!error && response.statusCode == 200) {
                      console.log(body);
                      piecesCompleted += 1;
                      console.log("PIECESCOmpleted: " + piecesCompleted);
                      if (piecesCompleted == pieces) {
                        console.log("Complete");
                        // merge that shit
                      }
                  } else {
                      console.log("ERROR");
                      console.log("Part" + i+1 );
                  }
              }
          );
        }
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
