'use strict';
console.log('Loading function');

let aws = require('aws-sdk');
let s3 = new aws.S3({ apiVersion: '2006-03-01' });

function CSVtoArray(text) {
    var re_valid = /^\s*(?:'[^'\\]*(?:\\[\S\s][^'\\]*)*'|"[^"\\]*(?:\\[\S\s][^"\\]*)*"|[^,'"\s\\]*(?:\s+[^,'"\s\\]+)*)\s*(?:,\s*(?:'[^'\\]*(?:\\[\S\s][^'\\]*)*'|"[^"\\]*(?:\\[\S\s][^"\\]*)*"|[^,'"\s\\]*(?:\s+[^,'"\s\\]+)*)\s*)*$/;
    var re_value = /(?!\s*$)\s*(?:'([^'\\]*(?:\\[\S\s][^'\\]*)*)'|"([^"\\]*(?:\\[\S\s][^"\\]*)*)"|([^,'"\s\\]*(?:\s+[^,'"\s\\]+)*))\s*(?:,|$)/g;
    // Return NULL if input string is not well formed CSV string.
    if (!re_valid.test(text)) return null;
    var a = [];                     // Initialize array to receive values.
    text.replace(re_value, // "Walk" the string using replace with callback.
        function(m0, m1, m2, m3) {
            // Remove backslash from \' in single quoted values.
            if      (m1 !== undefined) a.push(m1.replace(/\\'/g, "'"));
            // Remove backslash from \" in double quoted values.
            else if (m2 !== undefined) a.push(m2.replace(/\\"/g, '"'));
            else if (m3 !== undefined) a.push(m3);
            return ''; // Return empty string.
        });
    // Handle special case of empty last value.
    if (/,\s*$/.test(text)) a.push('');
    return a;
}


exports.handler = (event, context, callback) => {
    //console.log('Received event:', JSON.stringify(event, null, 2));
    function uploadPart(s3, upload_param, tryNum) {
    
        s3.uploadPart(upload_param, function(err, data) {
            if (err) {
                if (tryNum < 3) {
                    console.log('Retrying upload of part: #', upload_param.PartNumber)
                    // try again
                    uploadPart(s3, upload_param, tryNum + 1);
                    callback(err, err.stack);
                } else {
                    callback(err, err.stack);
                }
            } // an error occurred
            else {
                callback(null, {ETag: data.ETag, Part: event.part});           // successful response
            }
            context.done();
        });
    }
    // Get the object from the event and show its content type
    const bucket = 'cs499rbucket';
    const key = decodeURIComponent(event.key.replace(/\+/g, ' '));
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
            console.log('body.toString()');
            var mydata = body.toString();
            console.log('split');
            mydata = mydata.split(/\n/);
            console.log('filter');
            mydata = mydata.filter(filterword(event.function));
            console.log('toString');
            mydata = mydata.join('\n');
            //var file = require('fs').createWriteStream('/path/to/file.jpg');
            //s3.getObject(params).createReadStream().pipe(file);
            var tryNum = 0;
            var upload_param = {
              Body: mydata,
              Bucket: bucket,
              Key: event.output,
              PartNumber: event.part,
              UploadId: event.uploadId
            };
            uploadPart(s3, upload_param, tryNum)
        }
    });
    
};
