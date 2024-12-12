const status_to_string: Map<number, string> = new Map<number, string>([
	[100, "Continue"],
	[101, "Switching protocols"],
	[102, "Processing"],
	[103, "Early Hints"],
	[200, "OK"],
	[201, "Created"],
	[202, "Accepted"],
	[203, "Non-Authoritative Information"],
	[204, "No Content"],
	[205, "Reset Content"],
	[206, "Partial Content"],
	[207, "Multi-Status"],
	[208, "Already Reported"],
	[226, "IM Used"],
	[300, "Multiple Choices"],
	[301, "Moved Permanently"],
	[302, "Found (Previously 'Moved Temporarily')"],
	[303, "See Other"],
	[304, "Not Modified"],
	[305, "Use Proxy"],
	[306, "Switch Proxy"],
	[307, "Temporary Redirect"],
	[308, "Permanent Redirect"],
	[400, "Bad Request"],
	[401, "Unauthorized"],
	[402, "Payment Required"],
	[403, "Forbidden"],
	[404, "Not Found"],
	[405, "Method Not Allowed"],
	[406, "Not Acceptable"],
	[407, "Proxy Authentication Required"],
	[408, "Request Timeout"],
	[409, "Conflict"],
	[410, "Gone"],
	[411, "Length Required"],
	[412, "Precondition Failed"],
	[413, "Payload Too Large"],
	[414, "URI Too Long"],
	[415, "Unsupported Media Type"],
	[416, "Range Not Satisfiable"],
	[417, "Expectation Failed"],
	[418, "I'm a Teapot"],
	[421, "Misdirected Request"],
	[422, "Unprocessable Entity"],
	[423, "Locked"],
	[424, "Failed Dependency"],
	[425, "Too Early"],
	[426, "Upgrade Required"],
	[428, "Precondition Required"],
	[429, "Too Many Requests"],
	[431, "Request Header Fields Too Large"],
	[451, "Unavailable For Legal Reasons"],
	[500, "Internal Server Error"],
	[501, "Not Implemented"],
	[502, "Bad Gateway"],
	[503, "Service Unavailable"],
	[504, "Gateway Timeout"],
	[505, "HTTP Version Not Supported"],
	[506, "Variant Also Negotiates"],
	[507, "Insufficient Storage"],
	[508, "Loop Detected"],
	[510, "Not Extended"],
	[511, "Network Authentication Required"],
]);
export class FastRequest {
	method: string;
	path: string;
	type: string;
	body: object;
	headers: Map<string, string>;
	constructor(
		method?: string,
		path?: string,
		type?: string,
		body?: object,
		headers?: Map<string, string>,
	) {
		this.method = method || "";
		this.path = path || "/";
		this.type = type || "HTTP/1.1";
		this.body = body || {};
		this.headers = headers || new Map<string, string>();
	}
}
export class FastResponse {
	status: number;
	body: object;
	headers: Map<string, string>;
	constructor(status?: number, body?: object, headers?: Map<string, string>) {
		this.status = status || 500;
		this.body = body || {};
		this.headers = headers || new Map<string, string>();
	}
	json() {
		let response = `HTTP/1.1 ${this.status} ${
			status_to_string.get(this.status)
		}\n`;
		this.headers.forEach((value: string, key: string) => {
			response += `${key}: ${value}\n`;
		});
		response += `\n${JSON.stringify(this.body)}`;
		return response;
	}
	send(status: number, body: object, headers?: Map<string, string>) {
		this.status = status;
		this.body = body;
		if (!headers) {
			return;
		}
		this.headers = new Map([
			...Array.from(this.headers.entries()),
			...Array.from(headers.entries()),
		]);
	}
}
export class FastSession {
	request: FastRequest = new FastRequest();
	response: FastResponse = new FastResponse();
	raw_body: string;
	constructor(raw_body: string) {
		this.raw_body = raw_body;
		const parts = raw_body.replaceAll("\r", "").split("\n"); // 0 = request, 1 = header, 2 = body
		parts.forEach((value, index) => {
			if (index == 0) { // request
				const request_parts = value.split(" ");
				this.request.method = request_parts[0];
				this.request.path = request_parts[1];
				this.request.type = request_parts[2];
			} else if (index != parts.length - 1) { // headers
				if (value == "") {
					return;
				}
				const header_parts = value.split(":");
				this.request.headers.set(header_parts[0], header_parts[1]);
			} else { // body
				try {
					this.request.body = JSON.parse(value);
				} catch (_) {
					this.request.body = { value };
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

export class FastDeno {
	tcp_listener?: Deno.TcpListener;
	decoder = new TextDecoder();
	encoder = new TextEncoder();
	routes: Map<
		string,
		{
			(
				req: FastRequest,
				res: FastResponse,
				next: () => void,
			): object | void;
		}[]
	> = new Map<
		string,
		{
			(
				req: FastRequest,
				res: FastResponse,
				next: () => void,
			): object | void;
		}[]
	>();
	constructor() {}

	add_route(
		method: string,
		path: string,
		...callbacks: {
			(
				req: FastRequest,
				res: FastResponse,
				next: () => void,
			): object | void;
		}[]
	) {
		this.routes.set(`${method}_${path}`, callbacks);
	}

	async listen(port: number, address: string) {
		this.tcp_listener = Deno.listen({
			port: port,
			transport: "tcp",
			hostname: address,
		});
		while (true) {
			const client = await this.tcp_listener.accept();
			const buf = new Uint8Array(1024);
			let nobr = await client.read(buf);
			if (!nobr) {
				nobr = 0;
			}

			const buffer = this.decoder.decode(buf.slice(0, nobr));
			const session = new FastSession(buffer);
			const callbacks = this.routes.get(
				`${session.request.method}_${session.request.path}`,
			);
			if (!callbacks) {
				await client.write(
					this.encoder.encode(
						session.error(404, "Path didn't found"),
					),
				);
				client.close();
				continue;
			}
			for (let i = 0; i < callbacks.length; i++) {
				const callback = callbacks[i];
				let _continue = false;
				callback(session.request, session.response, () => {
					_continue = true;
				});
				if (!_continue) {
					break;
				}
			}
			session.response.headers.set(
				"Content-Length",
				JSON.stringify(session.response.body).length.toString(),
			);

			const response = this.encoder.encode(session.response.json());

			await client.write(response);
			client.close();
		}
	}
}
