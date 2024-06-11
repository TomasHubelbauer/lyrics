import electron from 'electron';
import timers from 'timers/promises';
import fs from 'fs';
import askSpotify from './askSpotify.js';
import promptAuthorization from './promptAuthorization.js';

// Set working directory for the production builds
process.chdir(electron.app.getPath('home'));
await fs.promises.mkdir('Lyrics', { recursive: true });
process.chdir(electron.app.getPath('home') + '/Lyrics');
await fs.promises.mkdir('lyrics', { recursive: true });

// Disable CSP warnings coming from the Spotify web which I can't control
process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';

// Enable Chromium features required by Spotify which print a warning otherwise
electron.app.commandLine.appendSwitch('--enable-features', 'ConversionMeasurement,AttributionReportingCrossAppWeb');

electron.app.on('ready', async () => {
  // Prevent "exited with signal SIGINT" to be printed to the console
  // Note that this must be in the `ready` event handler
  process.on("SIGINT", () => process.exit(0));

  let authorization = await promptAuthorization();
  let authorizationStamp = (await fs.promises.stat('token.json')).ctime;

  const display = electron.screen.getPrimaryDisplay();
  const { width, height } = display.workAreaSize;

  const window = new electron.BrowserWindow({ width, height, hasShadow: false, frame: false, transparent: true });
  window.loadFile('index.html');

  // Make the window always stay on top
  window.setAlwaysOnTop(true);

  // Prevent minimizing and maximizing
  // Note that this is redundant with `frame: false` but I still like to keep it
  window.setMaximizable(false);
  window.setMinimizable(false);

  // Make the window click-through
  window.setIgnoreMouseEvents(true);

  /** @type {'playing' | 'paused'} */
  let state;
  let position = 0;
  let duration = 0;

  /** @typedef {{ timeTag: string; words: string; }} Line */

  /** @type {({ artist: string; song: string; } & ({ error: string; } | { syncType: 'LINE_SYNCED' | 'UNSYNCED'; lines: Line[]; })) | undefined} */
  let lyrics;

  /** @type {Line | undefined} */
  let line;

  function refreshDockMenu() {
    const menu = new electron.Menu();

    if (lyrics) {
      const artistSongMenuItem = new electron.MenuItem({
        label: `${lyrics.artist} - ${lyrics.song} (${lyrics.syncType === 'LINE_SYNCED' ? 'synchronized' : 'unsynchronized'})`,
        enabled: false
      });

      menu.append(artistSongMenuItem);
    }

    const refreshTokenMenuItem = new electron.MenuItem({
      label: `Refresh token (${authorizationStamp.toLocaleTimeString()})`,
      click: async () => {
        authorization = await promptAuthorization(true);
        authorizationStamp = new Date();
        refreshDockMenu();
      }
    });

    menu.append(refreshTokenMenuItem);

    const dataPathMenuItem = new electron.MenuItem({
      label: `Open Lyrics directory (${electron.app.getPath('home')}/Lyrics)`,
      click: () => electron.shell.openPath(electron.app.getPath('home') + '/Lyrics')
    });

    menu.append(dataPathMenuItem);

    electron.app.dock.setMenu(menu);
  }

  refreshDockMenu();

  // Render current lyrics line on a fast interval for smooth updates
  setInterval(
    async () => {
      // Handle the window no longer existing after Ctrl+C while testing
      if (window.isDestroyed()) {
        process.exit(0);
      }

      if (!lyrics || ('error' in lyrics) || state !== 'playing') {
        return;
      }

      /** @type {string | null | undefined} */
      let lyric;
      switch (lyrics.syncType) {
        case 'UNSYNCED': {
          const ratio = position / duration;
          const index = ~~(lyrics.lines.length * ratio);
          const _line = lyrics.lines[index];
          if (_line !== line) {
            line = _line;
            lyric = line?.words ?? '';
          }

          break;
        }
        case 'LINE_SYNCED': {
          {
            const index = lyrics.lines.findIndex(line => line.startTimeMs >= position * 1000 + 100);
            const _line = lyrics.lines[index - 1];
            if (_line !== line) {
              line = _line;
              lyric = line?.words ?? '';
            }

            break;
          }
        }
        default: {
          throw new Error(`Unexpected sync type '${lyrics.syncType}'!`);
        }
      }

      // Advance the position by 100 ms to keep progressing until next 5 s sync
      position += .1;

      if (lyric === undefined) {
        // Keep the lyrics display as-is
        return;
      }

      // Coerce the musical note character to an empty lyric line instead
      if (lyric === '♪') {
        lyric = null;
      }

      if (lyric) {
        // Handle the window no longer existing after Ctrl+C while testing
        if (window.isDestroyed()) {
          process.exit(0);
        }

        // Escape single quotes and line breaks to make the string safe to pass
        const text = lyric.replace(/'/g, '\\\'').replace(/(\r|\n)/g, '');
        await window.webContents.executeJavaScript(`document.body.dataset.lyric = '${text}';`);
        await window.webContents.executeJavaScript(`document.body.dataset.unsynced = '${lyrics.syncType === 'UNSYNCED' ? '~' : ''}';`);
        console.log(`Flashed ${lyrics.syncType === 'LINE_SYNCED' ? 'synchronized' : 'unsynchronized'} lyric "${lyric}"`);
      }
      else {
        console.log(`Cleared ${lyrics.syncType === 'LINE_SYNCED' ? 'synchronized' : 'unsynchronized'} lyric`);
      }
    },
    100
  );

  // Check artist, song and time and fetch and update lyrics on slow interval
  while (true) {
    // Wait for 5 seconds between Spotify checks unless it is the first loop run
    if (lyrics) {
      await timers.setTimeout(5000);
    }

    /** @type {string} */
    let artist;
    try {
      artist = await askSpotify('artist of current track');
    }
    catch (error) {
      console.log('Failed to get Spotify artist: ' + error);
      continue;
    }

    /** @type {string} */
    let song;
    try {
      song = await askSpotify('name of current track');
    }
    catch (error) {
      console.log('Failed to get Spotify song: ' + error);
      continue;
    }

    // Download new lyrics if we don't already have them
    if (authorization && (lyrics?.artist !== artist || lyrics?.song !== song)) {
      const path = `lyrics/${artist} - ${song}.json`;
      try {
        await fs.promises.access(path);
        lyrics = JSON.parse(await fs.promises.readFile(path));
      }
      catch (error) {
        if (error.code !== 'ENOENT') {
          console.log(`Failed to load ${artist} - ${song}: ${error}`);
        }

        /** @type {string} */
        let id;
        try {
          // E.g.: "ID spotify:track:…"
          id = (await askSpotify('id of the current track')).split(':').at(-1).trimEnd();
        }
        catch (error) {
          console.log('Failed to get Spotify ID: ' + error);
          continue;
        }

        console.log(`Downloading ${artist} - ${song}…`);

        // Download LRC (timestamped) lyrics from the unofficial Spotify Lyrics API
        // Inspect the `open.spotify.com` developer tools `lyrics` network call to maintain this 
        const response = await fetch(`https://spclient.wg.spotify.com/color-lyrics/v2/track/${id}?format=json`, { headers: { authorization, 'app-platform': 'WebPlayer' } });
        if (response.ok) {
          const data = await response.json();

          lyrics = { artist, song, ...data.lyrics };
          await fs.promises.writeFile(path, JSON.stringify(lyrics, null, 2));

          console.log(`Downloaded ${lyrics.syncType === 'LINE_SYNCED' ? 'synchronized' : 'unsynchronized'} ${artist} - ${song}`);
        }
        else {
          lyrics = { artist, song, error: await response.text() };

          switch (response.status) {
            // Force the user to re-authenticate if the token is invalid
            case 401: {
              // Reset the field while re-authenticating to prevent multiple prompts
              authorization = undefined;
              authorization = await promptAuthorization(true);
              authorizationStamp = new Date();

              // Refresh the `Refresh token` menu item in the Dock context menu
              refreshDockMenu();

              // Reset the lyrics so they are re-tried with the new token
              lyrics = undefined;
              break;
            }

            case 404: {
              console.log(`No lyrics found for ${artist} - ${song}`);
              break;
            }

            default: {
              console.log(`Failed to download ${artist} - ${song}: ${response.status} ${response.statusText} ${lyrics.error}`);
            }
          }
        }
      }

      // Refresh the `Artist - Song` menu item in the Dock context menu
      refreshDockMenu();
    }

    try {
      const _state = await askSpotify('player state');
      if (_state !== 'playing' && _state !== 'paused') {
        throw new Error(`Unexpected player state '${_state}'!`);
      }

      if (state !== _state) {
        if (!state) {
          console.log(`Spotify is ${_state}`);
        }
        else {
          console.log(`Spotify went from ${state} to ${_state}`);
        }
      }

      state = _state;
    }
    catch (error) {
      console.log('Failed to get Spotify state: ' + error);
      continue;
    }

    try {
      position = Number(await askSpotify('player position'));
    }
    catch (error) {
      console.log('Failed to get Spotify position: ' + error);
      continue;
    }

    try {
      duration = Number(await askSpotify('duration of current track')) / 1000;
    }
    catch (error) {
      console.log('Failed to get Spotify duration: ' + error);
      continue;
    }
  }
});
