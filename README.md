# Lyrics

Lyrics is a macOS Electron-based application for displaying the current line of
lyrics of the song playing in Spotify.

It is a homage to a similar application that existed for Windows when I was a
kid and which I loved.
I don't remember its name anymore thought and was unable to find it using web
search.

![](lyrics.gif)

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

### Allow dragging the lyrics away or dismissing them for a song

This will require not making the window click-through, just transparent and cut
to the exact size of the lyrics line so it fits snugly around it and can be
dragged without stealing the pointer outside of the lyric line's hitzone.

### Allow scrolling up or down while over the lyrics to adjust unsynchronized

The pace of the synchronized lyrics is linear now.
With the ability to hold up or rush the pace, it will be possible to correc the
timing issues with linear unsynchronized lyrics.
Also consider saving the changes to manually synchronized lyrics for reuse.

### Fix the second synchronized lyric update always being an empty line

I think this might be a problem with my logic.

### Report the lingering shadow issue with a minimal example

Build a repo which just shows the current time or a random number or something.

## Notes

- Electron doesn't support ESM
  - Using `import` and setting `type` in `package.json` to `module` won't work,
    Electron will fail to load and will suggest to use dynamic `import` instead
  - Using dynamic `import` with TLA won't work because Electron doesn't support
    TLA
  - Using dynamic `import` requires `type` be unset in `package.json` BTW
  - See https://github.com/electron/electron/issues/21457
  - I found a hack with an ESM Node package but decided against adding a dep
    https://github.com/electron/electron/issues/21457#issuecomment-612441169
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
