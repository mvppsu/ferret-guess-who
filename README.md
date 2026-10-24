# Ferret Guess Who

A two-player "Guess Who" with ferrets, built for two iPads on the same network. One small Node.js
server (WebSockets) in one Docker container; the iPads open it in Safari and add it to the Home Screen.

## How to play

1. Player 1 types a name and taps **New game**. A 4-letter room code appears.
2. Player 2 types a name and the code, then taps **Join game**.
3. Each player taps a ferret to be their **secret ferret**, then **Lock it in**.
4. Take turns asking yes/no questions **out loud** ("Is your ferret wearing a hat?"). Tap cards to flip
   ferrets down; tap again to undo. Flips are private to your iPad. Tap **End turn** when you're done.
5. On your turn, tap **Guess!**, then the ferret you think it is, and confirm. Right = you win, wrong = you lose.
6. **Play again** starts a new round in the same room (the score carries over; the other player starts).

## Deploy on Unraid

Every push to `main` builds and publishes `ghcr.io/mvppsu/ferret-guess-who:latest`
(see `.github/workflows/docker-publish.yml`), so Unraid never builds anything.

1. **Make the data folder** for your ferret photos (Unraid terminal):
   ```bash
   mkdir -p /mnt/user/appdata/ferret-guess-who/images && chown -R 99:100 /mnt/user/appdata/ferret-guess-who
   ```
2. **Add the container.** Fetch the template, then in the **Docker** tab choose **Add Container**, pick
   `ferret-guess-who` from the template list and click **Apply**:
   ```bash
   curl -o /boot/config/plugins/dockerMan/templates-user/my-ferret-guess-who.xml https://raw.githubusercontent.com/mvppsu/ferret-guess-who/main/unraid/ferret-guess-who.xml
   ```
   (Prefer Compose Manager? Use `docker-compose.yml` with **Add Stack**; it keeps data in `./data`.)
3. **Copy your photos** into `/mnt/user/appdata/ferret-guess-who/images/` (see below).
4. **On each iPad**: open Safari to `http://UNRAID-IP:8080`, tap Share, then **Add to Home Screen**.
   It opens full screen like an app. Tip: set Settings, Display & Brightness, Auto-Lock to a long time while
   playing. If an iPad sleeps the game reconnects automatically when you wake it.

To update, push to `main`, wait for the GitHub Action to finish, then in the Docker tab use
**Check for updates** / **Force update** on the container.

## Ferret photos

The 30 prompts are in [`art/PROMPTS.md`](art/PROMPTS.md). Each ferret is looked up by its file name in the
container's `/data/images/` folder (on Unraid: `/mnt/user/appdata/ferret-guess-who/images/`):

| ferret | file name (any of .webp .png .jpg) |
|---|---|
| 01 Bandit | `01-bandit.webp` (or just `01.webp`) |
| 02 Noodle | `02-noodle.webp` ... and so on |

- Missing images show a colored placeholder card listing the ferret's traits, so the game is playable before the art is done.
- No restart is needed: images are picked up the next time an iPad opens or reloads the app.
- Square images are best (cards are square). `python3 scripts/prepare_images.py <downloads-folder> [out-folder]`
  centre-crops to a square, resizes to 800 px and converts to WebP, then lists which ferrets are still missing.
- Names, traits and order live in `/data/ferrets.json` (created from `art/ferrets.json` on first start). Keep ids unique.
  The game works with any number of ferrets; 30 fits the board best (6 x 5 landscape, 5 x 6 portrait).

## Develop locally

```bash
npm install
npm start            # http://localhost:8080 (uses ./art as the data folder)
npm test             # plays full two-player games against the server
```

Open two browser windows (one private) to play against yourself.

## Layout

| path | what |
|---|---|
| `server.js` | HTTP + WebSocket server, all game rules (server-authoritative) |
| `public/` | the web app: `index.html`, `style.css`, `app.js`, manifest, icons |
| `art/ferrets.json` | the default roster; `art/PROMPTS.md` image prompts |
| `mockups/` | design mockups from planning |
| `scripts/` | icon generator, image preparation |
| `unraid/` | Unraid Docker template |
| `.github/workflows/` | builds and publishes the image to GHCR |

## Notes

- Games live in server memory. Restarting the container ends games in progress; idle rooms expire after 6 hours.
- The secret ferrets never leave the server until the game ends, so neither iPad can peek at the other's.
- Made for a trusted home network over plain HTTP. To use it away from home, put it behind a reverse proxy with HTTPS
  (the app uses `wss://` automatically when served over HTTPS).
