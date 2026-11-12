# Raisin Paylight Workspace

Create the most beautiful UI possible for RaisinPay based on the attached product designer and frontend specification. Light mode only.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/728bda53-b103-4994-8c6b-316983788fb6).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

For a production preview, build first and then run:

```sh
npm run build
npm run preview
```

The preview command uses Nitro/Wrangler because this project builds the server to
`.output/server/index.mjs` with the Cloudflare module preset. `vite preview` is
not compatible with that output and expects a Node server at `dist/server/server.js`.
