
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
