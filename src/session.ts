import { FastRequest } from "./request.ts";
import { FastResponse } from "./response.ts";

export class FastSession {
	request: FastRequest = new FastRequest();
	response: FastResponse = new FastResponse();
	raw_body: string;
	constructor(raw_body: string) {
		this.raw_body = raw_body;
		const parts = raw_body.replaceAll("\r", "").split("\n"); // 0 = request, 1 = header, 2 = body
        let currrent_part = 0; // 0 = request, 1 = header, 2 = body
        let body = "";
        console.log(raw_body);
		parts.forEach((value, index) => {
            if (currrent_part == 0) { // request
                const request_parts = value.split(" ");
                this.request.method = request_parts[0];
                this.request.path = request_parts[1];
                this.request.type = request_parts[2];
                currrent_part = 1;
            } else if (currrent_part == 1) { // headers
				if (value == "") {
                    currrent_part = 2;
					return;
				}
				const header_parts = value.split(":");
				this.request.headers.set(header_parts[0], header_parts[1]);
            } else if (currrent_part == 2){ // body
                body = `${body}${value}`;
            }
            if (parts.length - 1 == index) {
                
                try {
                    this.request.body = JSON.parse(body);
                } catch (_error) {
                    this.request.body = {};
                }
            }
		});
		this.response.headers = new Map<string, string>(
			[
				["Content-Type", "application/json"],
				["Connection", "keep-alive"],
				["Server", "application/json"],
				["Content-Length", "0"],
			],
		);
	}
	error(status: number, message: string) {
		this.response.body = { message };
		this.response.status = status;
		return this.response.json();
	}
}