// Exercise real Express middleware without binding a port (restricted on this host).
import { IncomingMessage, ServerResponse } from 'node:http';
import { Duplex } from 'node:stream';
export function inject(app, { method = 'GET', url = '/', body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const socket = new Duplex({ read() {}, write(_chunk, _encoding, done) { done(); } });
    const req = new IncomingMessage(socket);
    req.method = method; req.url = url;
    const text = body === undefined ? '' : JSON.stringify(body);
    req.headers = { host: 'localhost:3000', ...(body === undefined ? {} : { 'content-type': 'application/json', 'content-length': String(Buffer.byteLength(text)) }), ...headers };
    const res = new ServerResponse(req); res.assignSocket(socket);
    const chunks = []; const write = res.write.bind(res), end = res.end.bind(res);
    res.write = (chunk, ...args) => { if (chunk) chunks.push(Buffer.from(chunk)); return write(chunk, ...args); };
    res.end = (chunk, ...args) => { if (chunk) chunks.push(Buffer.from(chunk)); return end(chunk, ...args); };
    res.on('finish', () => { const text = Buffer.concat(chunks).toString(); let data; try { data = JSON.parse(text); } catch { data = text; } socket.destroy(); resolve({ status: res.statusCode, headers: res.getHeaders(), body: data }); });
    res.on('error', reject); req.push(text || null); if (text) req.push(null);
    app(req, res);
  });
}
