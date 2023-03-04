# Lyrics

Lyrics is a macOS Electron-based application for displaying the current line of
lyrics of the song playing in Spotify.

It is a homage to a similar application that existed for Windows when I was a
kid and which I loved.
I don't remember its name anymore thought and was unable to find it using web
search.

## Credits

Thanks to [akashrchandran](https://github.com/akashrchandran) for running the
Spotify Lyrics API service.

## Tasks

### Make the LRC sources pluggable and look through multiple

Right now this whole show hinges on the Spotify Lyrics API service.
If Spotify ever prevents it from working or the maintainer abandonds it and it
bit rots, this whole application is over.

https://github.com/akashrchandran/spotify-lyrics-api

There should be other sources, some Reddit threads for inspiration:

- https://www.reddit.com/r/musichoarder/comments/u4oi0i/getting_synced_lyrics_lrc_lyrics_for_almost_any/
- https://www.reddit.com/r/musichoarder/comments/w7as70/synced_lyrics/

### Call Spotify directly with the hack shown in Spotify Lyrics API

https://github.com/akashrchandran/spotify-lyrics-api/blob/main/src/Spotify.php

The logic seems quite simple so I could be able to hit Spotify directly and not
have to risk the service going down.

### Fix macOS compositing issue where the window lingers imprinted into another

When a lyric is displayed and I switch windows, the old window has the lyrics
imprinted to it and the new window will have another lyrics imprinted to it once
I switch windows again.

This seems to be an issue with macOS compositing and I think the best way to fix
it will be to briefly hide and show the window each time the line changes.

Another option will be to measure the text and dynamically change the window
dimensions to make sure it forces the compositor to recompose.

I think the root cause here is definitely the transparent background.

### Give the text vertical gradient from white to whitesmoke once supported

Currently text with gradient is too hacky and would dirty up the code:
https://css-tricks.com/snippets/css/gradient-text/

Let's revisit this later and see if there is a nicer way to do it.

### Add a stroke to the text once there is nice and standard CSS for it

Right now `text-stroke` doesn't work in Electron and I do not want to add hacks
for this.

### Try to CJS entry-point hack for ESM support in the main process code

https://github.com/electron/electron/issues/21457#issuecomment-612441169

### Allow dragging the lyrics away or dismissing them for a song

This will require not making the window click-through, just transparent and cut
to the exact size of the lyrics line so it fits snugly around it and can be
dragged without stealing the pointer outside of the lyric line's hitzone.

## Notes

- Electron doesn't support ESM
  - Using `import` and setting `type` in `package.json` to `module` won't work,
    Electron will fail to load and will suggest to use dynamic `import` instead
  - Using dynamic `import` with TLA won't work because Electron doesn't support
    TLA
  - Using dynamic `import` requires `type` be unset in `package.json` BTW
  - See https://github.com/electron/electron/issues/21457
- Electron doesn't support TLA
  - I am using an IIFE with dynamic `import` to simulate something at least
    resembling ESM because TLA is not supported (to drop the need for the IIFE)
  - See https://github.com/electron/electron/issues/37492
- I have not found a good way to make the window start blurred
  - I don't want to display the menu bar when the app starts up
  - Making the window click-through partially achieves future focus return
  - Calling `blur` or `blueWebView` doesn't shed the initial focus
- Electron doesn't ship with `fetch` despite shipping with Node
  - Current Electron ships with new enough Node it should have built-in `fetch`
  - See https://github.com/electron/electron/issues/37493

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
