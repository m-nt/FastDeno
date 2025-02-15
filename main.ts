import { FastDeno } from "./src/server.ts";
import { FastRequest } from "./src/request.ts";

const server = new FastDeno();

server.add_route("GET", "/hi", (req?: FastRequest) => {
	console.log(req?.body);

	return { message: "hi" };
});
server.add_route("GET", "/mamad", (req, res, next) => {
	// console.log("MIDDLEWARE");
	res.status = 300;
	next();
}, (req, res) => {
	console.log(req.body);
	
	res?.headers.set("MAMAD", "NABODI");
	res.send(200, { message: "mamad" });
});
await server.listen(6969, "0.0.0.0");
