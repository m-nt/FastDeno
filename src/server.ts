import { FastRequest } from "./request.ts";
import { FastResponse } from "./response.ts";
import { FastSession } from "./session.ts";

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
