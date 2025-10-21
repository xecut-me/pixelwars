FROM denoland/deno:alpine

WORKDIR /app

USER deno

COPY --chown=deno:deno main.js .

CMD ["run", "--allow-all", "--watch=off", "main.js"]
