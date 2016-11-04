var fs = require('fs');
var schedAPI = {};

schedAPI.getSessionExport = function(done){
  var fileExists;
  fs.access(__dirname + '/session.json', function(err){
    fileExists = !err;
    if(fileExists){
      done(null,require('./session.json'));
    }else{
      generateJSON(function(){
        done(null,require('./session.json'));
      });
    }
  })

}

module.exports = schedAPI;


function generateJSON(done){
  var http = require("https");
  var config = require("./config.json");

  var options = {
    "method": "GET",
    "hostname": config.host,
    "port": null,
    "path": "/api/session/export?api_key=" + config.key + "&format=json",
    "headers": {
      "cache-control": "no-cache",
      "User-Agent": "gradeAB"
    }
  };

  var req = http.request(options, function (res) {
    var chunks = [];

    res.on("data", function (chunk) {
      chunks.push(chunk);
    });

    res.on("end", function () {
      var body = Buffer.concat(chunks);
      fs.writeFile(__dirname + '/session.json', body.toString(), function (err) {
        if (err) return console.log(err);
        done(err);
      });
    });
  });

  req.end();
}
