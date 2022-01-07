import express from "express";
import sign from "jsrsasign";
import config from "config";
import fs from "fs";
import axios from "axios";
import bp from "body-parser";
import gapi from "googleapis";
import {Mapping} from "./main";


//Initialization
const pb = fs.readFileSync("key","binary");
console.log("Initializing");
const port : number = config.get('port');
const app = express();
app.use(bp.json());
app.use(bp.urlencoded({extended: true}));
const publicKey = sign.KEYUTIL.getKey(pb);
let hash_alg : string = config.get('hash_alg');
if (!config.has('google_auth_route')){
  throw "No auth route"
}
const googleAuthRoute : string = config.get('google_auth_route');
const googleClientID : string = config.get('google_client_id');
const googleClientSecret : string = config.get("google_client_secret");
const apiUrl : string = config.get("api_url");
const oauthSuccessRoute : string = "ouath_success";

//Logging
console.log(`Hash alg: ${hash_alg}`);
console.log(`Google Route: ${googleAuthRoute}`);
console.log(`Google token generator` );
console.log(`Google client id: ${googleClientID}`);
console.log(`API URL: ${apiUrl}`);

//Starting server
app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});

//Handling default public
console.log("mapping default routes")
app.get("index",(req,res) => {
  res.sendFile("index.html");
});
app.get(`${oauthSuccessRoute}`,(req, res) => {
  res.sendFile("ouath_success.html");
})

//Importing mappings and handling public
if (!config.has('map_config')){
  throw "No configuration mapping"
}
const {mappings : route_config } : {mappings: Mapping[]} = JSON.parse(config.get("map_config"));
const files: {[file_path: string]: string} = {};
route_config.map(({file_path}) => (files[file_path.toString()] = fs.readFileSync(file_path, "utf-8")));
route_config.map(({route, file_path}) => console.log(`${route}:${file_path}`));
route_config.map(({route, file_path }) => (app.post(route, (req, res) => {
  console.log(`Request for ${route} from ${req.ips.join(" ")}`);
  if (route == "/"){
    res.status(200).send(files[file_path]);
  }
  else {
    let sig_text : string = req.body.auth;
    if ('alg' in req.body) {
      hash_alg = req.body.alg;
    }
    const date : Date = new Date();
    const text = `${date.getDay()}${date.getHours()}`;
    const sig = new sign.KJUR.crypto.Signature({alg: hash_alg});
    sig.init(publicKey);
    sig.updateString(text);
    if (sig.verify(sig_text)) {
      res.send(files[file_path]);
    }
    else {
      res.status(401).send("Unauthorized");
    }
  }
})));

//Google Auth Routes


console.log("Route configurations");
console.log(`${googleAuthRoute}: google`)
app.get(googleAuthRoute, (req, res) => {
  console.log(`Oauth request from ${req.ips.join(" ")}`)
  const postData = {
    ...req.body,
    client_id: googleClientID,
    client_secret: googleClientID,
    redirect_url: `${apiUrl}/${oauthSuccessRoute}`
  };
  axios.post("https://oauth2.googleapis.com/token", postData).then((r) => {
    console.log(`Google oauth response: ${JSON.stringify(req.body)}`);
    req.body["grant_types"] === "authorization_code"
    ? axios.get(`https://www.googleapis.com/oauth2/v2/userinfo?access_token=${r.data.access_token}`).then((u) =>
        {
          res.status(200).send({...r.data,label:u.data.email})
        }):
        res.status(200).send(r.data);
  }).catch((e) => {
    res.status(500).send(e.response?.data || {message: e.message});
    });
});
console.log(`${oauthSuccessRoute}: oauth_success`);
app.get(oauthSuccessRoute,(req, res) => {
  res.sendFile(`${oauthSuccessRoute}`);
});

//Generic catch all
console.log("All others: index");
app.get("*", (req, res) =>{
  res.send("index");
});



