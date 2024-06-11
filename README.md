# Lyrics

Lyrics is a macOS Electron-based application for displaying the current line of
lyrics of the song playing in Spotify.

It is a homage to a similar application that existed for Windows when I was a
kid and which I loved.
I don't remember its name anymore though.
It might have been MiniLyrics, but a Google image search doesn't surface a UI
setup with transparent background and click-through behavior which I remember
having and may have just configured for myself.

![](lyrics.gif)

## Tasks

### Prevent the app from re-opening Spotify if not open or closed while it runs

It seems to be reviving it.

### Figure out automated publishing to GitHub Actions

Build for both Windows and macOS:
https://www.electronjs.org/docs/latest/tutorial/application-distribution#manual-packaging

For now I am manually using Electron Packager:
https://github.com/electron/packager

Build for Windows:

```
bunx electron-packager . Lyrics --platform win32 --arch x64 --overwrite --ignore "(builds|lyrics|node_modules|.gitignore|bun.lockb|README.md|token.json)" --out builds
```

Build for macOS:

```
bunx electron-packager . Lyrics --platform darwin --arch arm64 --overwrite --ignore "(builds|lyrics|node_modules|.gitignore|bun.lockb|README.md|token.json)" --out builds
```

Run for macOS as a user:

```
(cd builds; cd Lyrics-darwin-arm64; open Lyrics.app)
```

To see console statements:

```
./builds/Lyrics-darwin-arm64/Lyrics.app/Contents/MacOS/Lyrics
```

- `overwrite` is used to not skip previously built targets
- `ignore` is used to ignore files not a part of the application bundle

The production builds require a working directory to be set to something because
they default to `/`.

I set it to the user's home directory, create a `Lyrics` directory there and the
`lyrics` directory and `token.json` files further go there.

We can remove the `.gitignore` entries and the `lyrics` directory's `.gitkeep`
here.

### Allow dragging the lyrics away or dismissing them for a song

This will require not making the window click-through, just transparent and cut
to the exact size of the lyrics line so it fits snugly around it and can be
dragged without stealing the pointer outside of the lyric line's hitzone.

### Allow scrolling up or down while over the lyrics to adjust unsynchronized

The pace of the synchronized lyrics is linear now.
With the ability to hold up or rush the pace, it will be possible to correc the
timing issues with linear unsynchronized lyrics.
Also consider saving the changes to manually synchronized lyrics for reuse.

### Report the lingering shadow issue with a minimal example

Build a repo which just shows the current time or a random number or something.

## Notes

- The text shadow/opacity ghost remains visible even after changing the text
  - This is some sort of an issue with Electron because it is for the most part
    fixable by reloading the page (vast majority of reloads clear the shadow)
  - Clearing the text before updating it did not help
    I tried both in a single `executeJavaScript` call and split clear and update
  - Hiding and showing the window did not help
  - Resizing the window to zero and back did not help
  - Reloading the window helps for the most part so I stuck with it
  - This is an issue for both HTML and SVG based text rendering!
  - This might seem as the OS compositor because sometimes it lingers even after
    the Electron process is killed but so far it has always be a stray process

## Logs

- Followed the Advanced Installation Instructions to add Electron without the
  need to scaffold by cloning a sample repository
  https://www.electronjs.org/docs/latest/tutorial/installation
- Came up with a TLA + dynamic `import` based solution to work around the lack
  of ESM
- Made the window always stay on top
- Made the window frameless, non-minimizable and non-maximizable
- Made the window transparent
- Made the window click-through
- Styled the text to be big, white, with a glow and an outline for legibility
- Implemented logic for scraping Spotify ID for artist and title from Google
- Implemented logic for pulling lyrics using the Spotify Lyrics API on GitHub
  (https://github.com/akashrchandran/spotify-lyrics-api)
- Fixed most of the lingering shadow issue by reloading before every line change
- Made the lyrics fade into view instead of flashing in aggressively
- Swithced to SVG based rendering
  - Allows for the text fade without ugly unsupported CSS
  - Allows for an easy way to do a text outline
  - Still suffers from the shadow/opacity ghosting HTML based rendering did
- Replaced track ID web search lookup with a Spotify AppleScript command
- Rewrote to use the Spotify API directly instead of via the Heroku app
- Upgraded to latest Electron and started using ESM and TLA
- Implemented a re-authorization flow for obtaining the new token after a 401
- Switched back to CSS based rendering for the more flexible approach
  (Not everything is supported vendorless, but it is getting better.)
- Added a macOS Dock context menu with artist, song and token information
- Made the Spotify web player window wait to show to prevent refresh flashes
