'use strict';
console.log('Loading function');

let aws = require('aws-sdk');
let s3 = new aws.S3({ apiVersion: '2006-03-01' });

exports.handler = (event, context, callback) => {
    //console.log('Received event:', JSON.stringify(event, null, 2));

    // Get the object from the event and show its content type
    const bucket = 'cs499rbucket';
    const key = decodeURIComponent('tweet'.replace(/\+/g, ' '));
    const params = {
        Bucket: bucket,
        Key: key,
        Range:event.range
    };
    

    function filterword(myfunction) {
        return eval(myfunction);
    }
//function startsWith(wordToCompare) {
 //   return function(element) {
  ///      return element.indexOf(wordToCompare) === 0;
    //}
//}

    // {"function":"(function(e){return e.includes('looo')})"}
    
    s3.getObject(params, (err, data) => {
        if (err) {
            console.log(err);
            const message = `Error getting object ${key} from bucket ${bucket}. Make sure they exist and your bucket is in the same region as this function.`;
            console.log(message);
            callback(message);
        } else {
            console.log('CONTENT TYPE:', data.ContentType);
            var body = data.Body;
            var mydata = body.toString();
            mydata = mydata.split(/\n/);
            mydata = mydata.filter(filterword(event.function));
            mydata = mydata.toString();
            //var file = require('fs').createWriteStream('/path/to/file.jpg');
            //s3.getObject(params).createReadStream().pipe(file);

            var upload_param = {Bucket: bucket, Key: key+"part"+event.part, Body: mydata};
            s3.upload(upload_param, function(err, data) {
                if (err) callback(err, err.stack); // an error occurred
                else callback(null, data);           // successful response
                context.done();
            });
        }
    });
    
};
