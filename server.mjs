import https from "https";
import { readFileSync } from "fs";
import next from "next";

const dev = true;
const app = next({ dev });
const handle = app.getRequestHandler();

const options = {
  key: readFileSync("./certs/key.pem"),
  cert: readFileSync("./certs/cert.pem"),
};

app.prepare().then(() => {
  https
    .createServer(options, (req, res) => {
      handle(req, res);
    })
    .listen(3004, "0.0.0.0", () => {
      console.log("🔥 iMYNTED HTTPS running at https://192.168.1.155:3004");
    });
});
