// Simple static server with a /api/openai proxy endpoint
const http = require('http');
const fs = require('fs');
const path = require('path');
const https = require('https');

const PORT = process.env.PORT || 4071;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';

const baseDir = __dirname;

const server = http.createServer((req, res) => {
    console.log(`Request: ${req.method} ${req.url}`);

    // CORS preflight for /api/openai
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        });
        return res.end();
    }

    if (req.url === '/api/openai' && req.method === 'POST') {
        // Collect body
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            res.setHeader('Access-Control-Allow-Origin', '*');
            try {
                if (!OPENAI_KEY) {
                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                    return res.end('Server error: OPENAI_API_KEY is not set. Export your key as environment variable and restart the server.');
                }
                const { prompt } = JSON.parse(body || '{}');
                if (!prompt) {
                    res.writeHead(400, { 'Content-Type': 'text/plain' });
                    return res.end('Bad Request: missing "prompt" in JSON body.');
                }

                const payload = JSON.stringify({
                    model: OPENAI_MODEL,
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: 200,
                    temperature: 0.2
                });

                const options = {
                    hostname: 'api.openai.com',
                    path: '/v1/chat/completions',
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(payload),
                        'Authorization': 'Bearer ' + OPENAI_KEY
                    }
                };

                const req2 = https.request(options, (resp) => {
                    let data = '';
                    resp.on('data', (chunk) => data += chunk);
                    resp.on('end', () => {
                        try {
                            const json = JSON.parse(data);
                            res.writeHead(resp.statusCode, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify(json));
                        } catch (err) {
                            res.writeHead(502, { 'Content-Type': 'text/plain' });
                            res.end('Bad Gateway: invalid JSON from OpenAI');
                        }
                    });
                });

                req2.on('error', (e) => {
                    console.error('Error calling OpenAI:', e);
                    res.writeHead(502, { 'Content-Type': 'text/plain' });
                    res.end('Bad Gateway: ' + String(e.message));
                });

                req2.write(payload);
                req2.end();

            } catch (err) {
                console.error('Internal server error:', err);
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Internal Server Error: ' + String(err.message));
            }
        });
        return;
    }

    // Serve static files from base directory
    let filePath = path.join(baseDir, req.url === '/' ? 'index.html' : req.url);
    // If path is directory, try index.html
    if (filePath.endsWith(path.sep)) filePath = path.join(filePath, 'index.html');

    const ext = path.extname(filePath).toLowerCase();
    const map = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
        '.txt': 'text/plain'
    };
    const contentType = map[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            return res.end('Not found');
        }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content, 'utf-8');
    });
});

server.listen(PORT, () => {
    console.log(`Server listening at http://localhost:${PORT}`);
});
