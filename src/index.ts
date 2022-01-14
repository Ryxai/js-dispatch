import express from "express";
import config from "config";
import axios from "axios";
import bp from "body-parser";
import {Mapping} from "./main";


//Initialization
console.log("Initializing");
const port : number = config.get('port');
const app = express();
app.use(bp.json());
app.use(bp.urlencoded({extended: true}));
if (!config.has('google_auth_route')){
  throw "No auth route"
}
const googleAuthRoute : string = config.get('google_auth_route');
const googleClientID : string = config.get('google_client_id');
const googleClientSecret : string = config.get("google_client_secret");
const apiUrl : string = config.get("api_url");
const oauthSuccessRoute : string = "oauth_success";

//Logging
console.log(`Google Route: ${googleAuthRoute}`);
console.log(`Google token generator` );
console.log(`Google client id: ${googleClientID}`);
console.log(`API URL: ${apiUrl}`);

//Starting server
app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});

//Handling default public
console.log("mapping standard routes");
app.get("/",(req,res) => {
   res.sendFile(`${__dirname}/public/indx.html`);
});
app.get(`/${oauthSuccessRoute}`,(req, res) => {
  res.sendFile(`${__dirname}/public/oauth_success.html`);
});

//Importing mappings and handling public
console.log("Setting up routes for mappings from the config file");
if (!config.has('map_config')){
  throw "No configuration mapping";
}
const {mappings : route_config } : {mappings: Mapping[]} = JSON.parse(config.get("map_config"));
route_config.map(({route, file_path }) => (app.get(route, (req, res) => {
  console.log(`Request from ${req.ip} for ${file_path}`);
  res.sendFile(`${__dirname}/${file_path}`);
})));


console.log(`Setting up oauth route ${googleAuthRoute}: google`);
app.get(`/${googleAuthRoute}`, (req, res) => {
  console.log(`Oauth request from ${req.ip}`);
  const postData = {
    ...req.body,
    client_id: googleClientID,
    client_secret: googleClientSecret,
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
  }).catch((e) =>
    {res.status(500).send(e.response?.data || {message: e.message});}
  );
});

app.get("*",(req,res) => {
  res.sendFile(`${__dirname}/public/index.html`);
});
