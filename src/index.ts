import express from "express";
import sign from "jsrsasign";
import config from "config";
import fs from "fs";
import axios from "axios";
import bp from "body-parser";
import {Mapping} from "./main";

const OAUTH_SUCCESS : string = "ouath_success.html";

const pb = fs.readFileSync("key","binary");
console.log("Initializing");
const port : number = config.get('port');
const app = express();
app.use(bp.json());
app.use(bp.urlencoded({extended: true}));
const publicKey = sign.KEYUTIL.getKey(pb);
let hash_alg : string = config.get('hash_alg');
let google_route : string = config.get('google_auth_route');
let google_client_id : string = config.get('google_client_id');
let google_client_secret : string = config.get("google_client_secret");
let api_url : string = config.get("api_url");
if (!config.has('map_config')){
  throw "No configuration mapping"
}
const {mappings : route_config } : {mappings: Mapping[]} = JSON.parse(config.get("map_config"));
const files: {[file_path: string]: string} = {};
route_config.map(({file_path}) => (files[file_path.toString()] = fs.readFileSync(file_path, "utf-8")));
app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
console.log("Route configurations");
console.log(`${google_route}: google`)
app.get(`${google_route}`, (req, res) => {
  console.log(`Oauth request from ${req.ips.join(" ")}`)
  axios.post("https://oauth2.googleapis.com/token", {
        ...req.body,
        client_id: google_client_id,
        client_secret: google_client_secret,
        redirect_url: `${api_url}/${OAUTH_SUCCESS}`
      }
  ).then((r) => {
    req.body["grant_types"] === "authorization_code"
    ? axios.get(`https://www.googleapis.com/oauth2/v2/userinfo?access_token=${r.data.access_token}`).then((u) =>
        {
          res.status(200).send({...r.data,label:u.data.email})
        }):
        res.status(200).send(r.data);
  }).catch((e) => {
    res.status(500).send(e.response?.data || {message: e.message});
    })
});
console.log(`${OAUTH_SUCCESS}: oauth_success`);
app.get(OAUTH_SUCCESS,(req, res) => {
  res.send(`${OAUTH_SUCCESS}.html`);
})
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
console.log("All others: index");
app.get("*", (req, res) =>{
  res.send("index.html");
})



