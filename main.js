function clientMain(width, height, anounce) {
    window.sendPixel = function (x, y, color) {
        commandView.setUint16(0, x);
        commandView.setUint16(2, y);

        setColor(commandView, 0, color);

        window.ws.send(commandBuffer);
    };

    const colorPicker = document.createElement("input"), canvas = document.createElement("canvas"), ctx = canvas.getContext("2d"),
        activePointers = new Set(), colors = {}, commandBuffer = new ArrayBuffer(7), commandView = new DataView(commandBuffer);

    const justdisplay = location.href.includes("justdisplay"),
        wHeight = window?.visualViewport?.height || window.innerHeight,
        wWidth = window?.visualViewport?.width || window.innerWidth,
        wDiff = justdisplay ? 0 : 60,
        scale = Math.floor(Math.min((wHeight - wDiff) / height), Math.min(wWidth / width)),
        subScale = scale - Math.floor(Math.max(2, scale * 2 / 25));

    document.body.style.margin = "0";
    document.body.style.textAlign = "center";

    colorPicker.type = "color";
    colorPicker.style.width = "40px";
    colorPicker.style.height = "40px";
    colorPicker.style.display = "inline-block";
    colorPicker.style.margin = "10px";
    colorPicker.value = "#" + [0, 1, 2].map(() => Math.floor((1 + Math.random()) * 128).toString(16)).join("");

    if (!justdisplay) {
        document.body.appendChild(colorPicker);

        const span = document.createElement("span");
        span.innerHTML = anounce;
        span.style.fontSize = "60px";
        document.body.appendChild(span);

        document.body.appendChild(document.createElement("br"));
    }

    canvas.width = scale * width;
    canvas.height = scale * height;
    canvas.style.display = "inline-block";

    const onPointer = ({ pointerId, offsetX, offsetY }) => {
        if (!activePointers.has(pointerId)) { return; }

        let x = Math.floor(offsetX / scale), y = Math.floor(offsetY / scale), color = colorPicker.value;

        if (x < 0) { x = 0; }
        if (y < 0) { y = 0; }

        if (colors[x + "," + y] == color) { return; }

        window.sendPixel(x, y, color);
    }

    canvas.addEventListener("pointermove", onPointer);
    canvas.addEventListener("pointerdown", ({ pointerId, offsetX, offsetY }) => {
        activePointers.add(pointerId);
        onPointer({ pointerId, offsetX, offsetY });
    });

    document.body.addEventListener("pointerup", ({ pointerId }) => activePointers.delete(pointerId));
    document.body.addEventListener("pointercancel", ({ pointerId }) => activePointers.delete(pointerId));

    document.body.appendChild(canvas);

    function renderPixel(x, y, color) {
        ctx.fillStyle = color;
        ctx.fillRect(scale * x, scale * y, subScale, subScale);
        colors[x + "," + y] = color;
    }

    function initWs() {
        window.ws = new WebSocket(location.href.replace(/^http/, "ws"));

        window.ws.onmessage = async ({ data }) => {
            const buffer = await data.arrayBuffer(), view = new DataView(buffer);

            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    renderPixel(x, y, getColor(view, x + y * width));
                }
            }

            window.ws.onmessage = async ({ data }) => {
                const buffer = await data.arrayBuffer(), view = new DataView(buffer);
                renderPixel(view.getUint16(0), view.getUint16(2), getColor(view, 0));
            }
        };

        window.ws.onclose = window.ws.onerror = () => {
            window.ws.onclose = window.ws.onerror = () => { };
            setTimeout(initWs, 3000);
        };
    }

    initWs();
}

function getColor(view, pixel) {
    return "#" + [0, 1, 2].map(i => view.getUint8(4 + 3 * pixel + i).toString(16).padStart(2, "0")).join("");
}

function setColor(view, pixel, color) {
    for (let i = 0; i < 3; i++) {
        view.setUint8(4 + 3 * pixel + i, parseInt(color.slice(1 + 2 * i, 3 + 2 * i), 16));
    }
}

const width = 16 * 3, height = 9 * 3;
let changed = false, imageBuffer = new ArrayBuffer(4 + 3 * width * height);

try {
    imageBuffer = Deno.readFileSync("/data/pixels.bin").buffer;
} catch (e) {
    console.log("Init new");
}

setInterval(async () => {
    if (!changed) { return; }
    changed = false;

    await Deno.writeFile("/data/pixels.bin", new Uint8Array(imageBuffer));
    await Deno.writeFile("/data/" + Date.now() + ".bin", new Uint8Array(imageBuffer));
}, 10000);

const imageView = new DataView(imageBuffer), clients = new Set();

imageView.setUint16(0, width);
imageView.setUint16(2, height);

Deno.serve({ port: 8080 }, req => {
    const secretToken = (new URL(req.url).searchParams.get("secret_token"))
    const isRw = tokens.hasOwnProperty(secretToken);

    if (req.headers.get("upgrade") === "websocket") {
        const { socket, response } = Deno.upgradeWebSocket(req);

        socket.onopen = () => {
            clients.add(socket);
            socket.send(imageBuffer);

            if (!isRw) { socket.close(); }
        };

        socket.onmessage = ({ data }) => {
            if (!(data instanceof ArrayBuffer) || data.byteLength != 7) { return; }

            const view = new DataView(data), x = view.getUint16(0), y = view.getUint16(2);
            if (x >= width || y >= height) { return; }

            setColor(imageView, x + y * width, getColor(view, 0));
            changed = true;

            let sendData = data.slice(0, 7);

            for (const ws of clients) {
                if (ws.readyState === ws.OPEN) { ws.send(sendData); }
            }
        };

        socket.onerror = socket.onclose = () => clients.delete(socket);
        return response;
    }

    const mode = isRw ? 'read-write' : 'read-only, login via tg: <a href="https://t.me/pixelwars_xecut_bot">@pixelwars_xecut_bot</a>';

    return new Response(`<!DOCTYPE html><html><head><meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>html, body { margin: 0; padding: 0; width: 100%; }</style></head>
        <body><script>${getColor};${setColor};${clientMain};clientMain(${width}, ${height}, 'mode: ${mode}');</script></body></html>`,
        { status: 200, headers: new Headers({ "content-type": "text/html", "cache-control": "no-store" }) });
});

const gid = -1003090680785, inviteLink = "https://t.me/+mOLkz1CzGxE3Yzdi", baseUrl = "http://pixelwars.xecut.me/?secret_token=",
    telegramToken = Deno.env.get("TELEGRAM_BOT_TOKEN");

let users = {}, tokens = {}, offset = 0;

async function callApi(method, payload) {
    return await fetch(`https://api.telegram.org/bot${telegramToken}/${method}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
    }).then(r => r.json());
}

async function tgBot() {
    while (true) {
        try {
            const updates = await callApi("getUpdates", { offset, timeout: 50, allowed_updates: ["message"] });

            for (const update of updates?.result ?? []) {
                offset = update.update_id + 1;
                if (!update?.message) { continue; }

                try {
                    const { chat, from } = update?.message;

                    if (chat?.type != "private") { continue; }

                    const chatMemeber = await callApi("getChatMember", { chat_id: gid, user_id: from?.id });

                    if (["creator", "administrator", "member"].includes(chatMemeber?.result?.status)) {
                        if (!users[from.id]) {
                            const bytes = Array.from(crypto.getRandomValues(new Uint8Array(6)), b => b.toString(16).padStart(2, "0")),
                                token = bytes[0] + bytes[1] + "-" + bytes[2] + bytes[3] + "-" + bytes[4] + bytes[5];

                            tokens[token] = users[from.id] = {
                                username: from?.username,
                                firstName: from?.first_name,
                                lastName: from?.last_name,
                                token
                            };
                        }

                        await callApi("sendMessage", { chat_id: chat?.id, text: baseUrl + users[from.id].token });
                    } else {
                        await callApi("sendMessage", { chat_id: chat?.id, text: inviteLink });
                    }
                } catch (e) {
                    console.error("Update processing error: ", e.message);
                    await new Promise(r => setTimeout(r, 1500));
                }
            }
        } catch (e) {
            console.error("Polling error: ", e.message);
            await new Promise(r => setTimeout(r, 1500));
        }
    }
}

tgBot();
