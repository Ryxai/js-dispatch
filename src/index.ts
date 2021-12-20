import express from "express";
import sign from "jsrsasign";
import dotenv from "dotenv";
import fs from "fs";
import dotenvParseVariables from "dotenv-parse-variables";

import {Mapping} from "./main";

console.log("Initializing");
const dotenv_config = dotenv.config();
if (dotenv_config.error || !dotenv_config.parsed) {
  throw dotenv_config.error;
}
dotenvParseVariables(dotenv_config.parsed,{assignToProcessEnv: true, overrideProcessEnv: true});
console.log(dotenv_config.parsed);
const port = process.env.PORT;
const app = express();
const publicKey  = process.env.PUBLIC_KEY;
let hash_alg = process.env.HASH_ALG;
const {mappings : route_config } : {mappings: Mapping[]} = require('map_config.json');
const files: {[file_path: string]: string} = {};
route_config.map(({route, file_path}) => (files[file_path.toString()] = fs.readFileSync(file_path, "utf-8")));
app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});

route_config.map(({route, file_path }) => (app.get(route, (req, res) => {
  if (route == "/"){
    res.status(200).send(files[file_path]);
  }
  else {
    const sig_text = req.body["auth"];
    if ('alg' in req.body) {
      hash_alg = req.body["alg"];
    }
    if (!publicKey) {
      throw "Public key note defined";
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



