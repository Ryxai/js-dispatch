import express from "express";
import sign from "jsrsasign";
import config from "config";
import fs from "fs";

import {Mapping} from "./main";

console.log("Initializing");
const port : number = config.get('port');
const app = express();
const publicKey : string = config.get('publicKey');
let hash_alg : string = config.get('hash_alg');
if (!config.has('map_config')){
  throw "No configuration mapping"
}
const {mappings : route_config } : {mappings: Mapping[]} = JSON.parse(config.get("map_config"));
const files: {[file_path: string]: string} = {};
route_config.map(({file_path}) => (files[file_path.toString()] = fs.readFileSync(file_path, "utf-8")));
app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});

route_config.map(({route, file_path }) => (app.get(route, (req, res) => {
  if (route == "/"){
    res.status(200).send(files[file_path]);
  }
  else {
    const sig_text : string = req.body["auth"];
    if ('alg' in req.body) {
      hash_alg = req.body["alg"];
    }
    const pub = sign.KEYUTIL.getKey(publicKey);
    const text = `${file_path}${hash_alg}`;
    const sig = new sign.KJUR.crypto.Signature({alg: hash_alg});
    sig.init(pub);
    sig.updateString(text);
    if (sig.verify(sign.stohex(sig_text))) {
      res.send(files[file_path]);
    }
    else {
      res.status(401).send("Unauthorized");
    }
  }
})));



