// sudo apt update && sudo apt install unzip
// curl -fsSL https://deno.land/install.sh | sh

// deno run --allow-all pixelwars-deno.js

// scp pixelwars-deno.js kiosk:/home/kiosk/pixelwars/main.js && ssh kiosk rc-service pixelwars restart

// http://pixelwars.internal:8080/
// https://pixelwars.xecut.me/

const width = 16 * 3, height = 9 * 3;
let changed = false;

function getColor(view, pixel) {
    return "#" + [0, 1, 2].map(i => view.getUint8(4 + 3 * pixel + i).toString(16).padStart(2, "0")).join("");
}

function setColor(view, pixel, color) {
    for (let i = 0; i < 3; i++) {
        view.setUint8(4 + 3 * pixel + i, parseInt(color.slice(1 + 2 * i, 3 + 2 * i), 16));
    }
}

let imageBuffer = new ArrayBuffer(4 + 3 * width * height);

try {
    imageBuffer = Deno.readFileSync("pixels.bin").buffer;
} catch (e) {
    console.log("Init new");
}

const imageView = new DataView(imageBuffer), clients = new Set();

imageView.setUint16(0, width);
imageView.setUint16(2, height);

setInterval(async () => {
    if (!changed) { return; }
    changed = false;

    await Deno.writeFile("pixels.bin", new Uint8Array(imageBuffer));
}, 1000);

function clientMain(width, height) {
    let ws;

    const colorPicker = document.createElement("input"), canvas = document.createElement("canvas"), ctx = canvas.getContext("2d"),
        activePointers = new Set(), colors = {}, commandBuffer = new ArrayBuffer(7), commandView = new DataView(commandBuffer),
        scale = Math.floor(Math.min(((window?.visualViewport?.height || window.innerHeight) - 60) / height), Math.min((window?.visualViewport?.width || window.innerWidth) / width)),
        subScale = scale - Math.floor(Math.max(2, scale * 2 / 25));

    document.body.style.margin = "0";
    document.body.style.textAlign = "center";

    colorPicker.type = "color";
    colorPicker.style.width = "40px";
    colorPicker.style.height = "40px";
    colorPicker.style.display = "inline-block";
    colorPicker.style.margin = "10px";
    document.body.appendChild(colorPicker);

    colorPicker.value = "#" + [0, 1, 2].map(() => Math.floor((1 + Math.random()) * 128).toString(16)).join("");

    const span = document.createElement("span");
    span.innerText = "Draw on me, go " + location.href;
    span.style.fontSize = "60px";

    document.body.appendChild(span);

    document.body.appendChild(document.createElement("br"));

    canvas.width = scale * width;
    canvas.height = scale * height;
    canvas.style.display = "inline-block";

    function onPointer({ pointerId, offsetX, offsetY }) {
        if (!activePointers.has(pointerId)) { return; }

        let x = offsetX / scale, y = offsetY / scale, color = colorPicker.value;

        if (x < 0) { x = 0; }
        if (y < 0) { y = 0; }

        if (colors[x + "," + y] == color) { return; }

        commandView.setUint16(0, x);
        commandView.setUint16(2, y);
        setColor(commandView, 0, color);

        ws.send(commandBuffer);
    }

    canvas.addEventListener("pointermove", onPointer);
    canvas.addEventListener("pointerdown", ({ pointerId, offsetX, offsetY }) => {
        activePointers.add(pointerId);
        onPointer({ pointerId, offsetX, offsetY });
    });
    canvas.addEventListener("pointerup", ({ pointerId }) => activePointers.delete(pointerId));
    canvas.addEventListener("pointercancel", ({ pointerId }) => activePointers.delete(pointerId));

    document.body.appendChild(canvas);

    function renderPixel(x, y, color) {
        ctx.fillStyle = color;
        ctx.fillRect(scale * x, scale * y, subScale, subScale);
        colors[x + "," + y] = color;
    }

    function initWs() {
        ws = new WebSocket(location.href);

        ws.onmessage = async ({ data }) => {
            const buffer = await data.arrayBuffer(), view = new DataView(buffer);

            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    renderPixel(x, y, getColor(view, x + y * width));
                }
            }

            ws.onmessage = async ({ data }) => {
                const buffer = await data.arrayBuffer(), view = new DataView(buffer);
                renderPixel(view.getUint16(0), view.getUint16(2), getColor(view, 0));
            }
        };

        ws.onclose = ws.onerror = () => {
            ws.onclose = ws.onerror = () => { };
            setTimeout(initWs, 3000);
        };
    }

    initWs();
}

Deno.serve({ port: 8080 }, req => {
    if (req.headers.get("upgrade") === "websocket") {
        const { socket, response } = Deno.upgradeWebSocket(req);

        socket.onopen = () => {
            clients.add(socket);
            socket.send(imageBuffer);
        };

        socket.onmessage = ({ data }) => {
            if (!(data instanceof ArrayBuffer) || data.byteLength != 7) { return; }

            const view = new DataView(data), x = view.getUint16(0), y = view.getUint16(2);
            if (x >= width || y >= height) { return; }

            setColor(imageView, x + y * width, getColor(view, 0));
            changed = true;

            for (const ws of clients) {
                if (ws.readyState === ws.OPEN) { ws.send(data); }
            }
        };

        socket.onerror = socket.onclose = () => clients.delete(socket);
        return response;
    }

    return new Response(`<!DOCTYPE html><html><head><meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>html, body { margin: 0; padding: 0; width: 100%; }</style></head>
        <body><script>${getColor};${setColor};${clientMain};clientMain(${width}, ${height});</script></body></html>`,
        { status: 200, headers: new Headers({ "content-type": "text/html", "cache-control": "no-store" }) });
});
