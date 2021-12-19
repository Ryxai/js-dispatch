import express from "express";
import jsrsasign from "jsrsasign";
import dotenv from "dotenv";

console.log("Initializing");
const result = dotenv.config();
if (result.error) {
  throw result.error;
}
console.log(result.parsed);
const port = process.env.PORT
const app = express();


