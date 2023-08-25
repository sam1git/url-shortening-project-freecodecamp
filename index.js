require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const mongoose = require('mongoose');
const mySecret = process.env['MONGO_URI'];
const dns = require('dns');

// Basic Configuration
const port = process.env.PORT || 3000;

// Connecting to mongoose database
mongoose.connect(mySecret,{useNewUrlParser:true,useUnifiedTopology:true})
  .then(() => console.log("Database connection successful."))
  .catch((err) => console.error("Database connection error."));

app.use(cors());

app.use('/public', express.static(`${process.cwd()}/public`));

// Including use of body-parser middleware included with express
// setting extended option to true to use qs library to parse URL encoded data
app.use(express.urlencoded({extended:true}));

app.get('/', function(req, res) {
  res.sendFile(process.cwd() + '/views/index.html');
});

// URL schema
let urlSchema = new mongoose.Schema({
  url: String,
  shortUrl: {
    type: Number,
    unique: true,
    required: true}
});

// shortUrl gen key schema
let keySchema = new mongoose.Schema({key: Number})
// URL and shortUrl gen key models
let urlModel = new mongoose.model('urlModel',urlSchema);
let keyModel = new mongoose.model('keyModel',keySchema);

// Finding and setting unique key for setting shortUrl
let keyGen;
keyModel.find({})
  .then(data => {
    if (data.length == 0) {
      new keyModel({key: 1}).save()
        .then(data => {
          keyGen = 1;
          console.log(`Started gen key = ${keyGen}`);
          console.log(`Saved key data: ${data}`);
        })
        .catch(err => console.log(`Error: Could not save key and set keyGen. Error: ${err}`));
    } else if (data.length > 1) {
      console.log("keyGen could not be set. keyDB has more than one value stored.")
    } else {
      keyGen = data[0]["key"];
      console.log(`keyGen set to ${keyGen} from last stored value in DB.`)
    };
  })
  .catch(err => console.error(`Find operation on keyDB failed. Error: ${err}`));

// api endpoint for URL shortening
app.post('/api/shorturl', function(req,res) {
  let urlStr = req.body.url;
  if (urlStr.startsWith('https://') || urlStr.startsWith('http://')) {
    dnscheckStr = urlStr.split("//")[1].replace(/\/.*/,"");
  } else if (urlStr.split(":/")[1]) {
    dnscheckStr = urlStr.split(":/")[1].replace(/\/.*/,"");
  } else {
    dnscheckStr = urlStr;
  };
  dns.lookup(dnscheckStr, (err,ip) => {
    if (err) {
      res.json({"error":"Invalid URL"});
      return console.error(err);
    };
    console.log(`Resolved IP address for ${dnscheckStr} : ${ip}`)
    storeURL(urlStr,keyGen);
    res.json({original_url:urlStr,short_url: keyGen});
    updatekeyGen();
  })
});

// create new document using url Model
function storeURL(urlStr,keyGen) {
  new urlModel({
      url: urlStr,
      shortUrl: keyGen
    }).save()
        .then((data) => {
          console.log(`Saved to urlDB: ${data}`);
        })
        .catch((err) => console.error(`Could not save to urlDB. Error: ${err}`));
}

// Find and update keyGen db
function updatekeyGen() {
  keyModel.findOneAndUpdate({key:keyGen},{key:++keyGen},{new:true, useFindAndModify:false},(err,data) => {
    if (err) return console.error(err);
    console.log(`Update keyGen: ${data}`);
  })
}

// Your first API endpoint
app.get('/api/hello', function(req, res) {
  res.json({ greeting: 'hello API' });
});

app.listen(port, function() {
  console.log(`Listening on port ${port}`);
});

// forward to save url
app.get('/api/shorturl/:shorturl', (req,res) => {
  urlModel.findOne({shortUrl:req.params.shorturl})
    .then((data) => {
      console.log(data.url);
      if (data) {
        if (!data.url.startsWith('https://') && !data.url.startsWith('http://')) {
          res.redirect('https://' + data.url);
        } else {
          res.redirect(data.url);
        }
      } else {
        res.json({navigation: "URL not in database"});
      }
    })
    .catch((err) => {
      console.log(err);
    });
});