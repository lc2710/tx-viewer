const fs = require("fs")
const moment = require("moment")


module.exports = {

  
  log: function(info, err) {
    fs.appendFile('error_log.txt', '\n' + moment().format('MM/DD/YYYY HH:mm:ss') + " " + info, function (err) {
      if (err) throw err;
    });
  },


};


