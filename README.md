**DEPRECATION WARNING**
Please use the much more sophisticated (and stable) successor this library: [omxconductor](https://github.com/RandomStudio/omxconductor)

__

# omx-layers (Node.js)
An interface for Node.js allowing you to layer multiple [omxplayer](https://github.com/popcornmix/omxplayer) instances and control them in-process via the low-latency interprocess communication protocol, D-Bus.

You don't have to know anything about D-Bus. Just send commands using JavaScript, and the library handles the communication and logic internally.

# How to Install
```
npm install omx-layers
```
# Requirements
Remember that the `omxplayer` only works on the Raspberry Pi (and similar hardware?). Performance is great on the Pi 3.

`omxplayer` is installed by default on the "Raspbian with Desktop" version of [Raspbian](https://www.raspberrypi.org/downloads/raspbian/) but if you have installed the "Lite" version (console only) then you might need to install it manually:
```
sudo apt-get install omxplayer
```


# Examples
## Single layer only
```
const omx = require('omx-layers');

let player = new omx({
	audioOutput: 'local',
	blackBackground: true,
	disableKeys: true,
	disableOnScreenDisplay: true,
});
```
Then play a clip like this:
```
player.open('myclip.mp4');
```

## Multiple players, multiple layers
```
const omx = require('omx-layers');
let layers = [];
const numLayers = 2;

for (var i=0; i<numLayers; i++) {
	layers.push(
		new omx({
			audioOutput: 'local',
			blackBackground: true,
			disableKeys: true,
			disableOnScreenDisplay: true,
			layer: i
		})
	);
}

```
Find the clip with the layer you want, and play:
```
// Assume that an array has been set up with 2 layers.
// Let's say you wanted to play a clip on layer 2...
layer[1].open('foreground-clip.mp4');
```

## How many layers can I open?
This seems to be very dependent on file sizes, resolutions and data rates for the video files.

If your player appears to quit video files without even trying to play them, you should try to increase the memory available to the GPU using `sudo rasp-config` > Advanced Options > Memory Split. 128MB should be good; 256MB might be better.


# Options
* `audioOutput`: 'hdmi' | 'local' | 'both'
* `blackBackground`: boolean, false by default (careful enabling this when layering, or you might get strange intermittent screen blanking)
* `backgroundARGB`: a hexadecimal colour value for Alpha, Red, Green, Blue - this is an alternative to using the default black. For example, if you want a full white background, use `ffffffff` and for full red use `ffff0000`, etc. This **should only be applied to layer 1**, not higher layers, in order to avoid flickering.
* `layer`: 1-infinity (2 is probably enough!); if omitted then clips will automatically player on layer 0
* `disableOnScreenDisplay`:  boolean, false by default


# Properties
## Get duration of current track/movie in seconds
`layer.getCurrentDuration();`

## Get position of current track/movie in seconds
`layer.getCurrentPosition();`

Get current position via D-Bus (if currently playing) in milliseconds.

## Get volume as fraction of max (0.0 - 1.0)
`layer.getCurrentVolume();`

# Methods

## Open (play) a new clip
`layer.open(path, holdMode = false)`
Open and start a clip at the given path. If you try to open another clip while one is already playing, this will be logged and ignored.

If `holdMode===true`, then clip will immediately pause on load and set opacity to 0 (waiting for your command).

## Jump to point in file/seek relative to current position (-Inf to +Inf)
`layer.seekRelative(milliseconds);`

## Jump to point in file/seek relative to start point (absolute)
`layer.seekAbsolute(milliseconds);`

# Callbacks

## onStart
It may take a few milliseconds for the clip to actually start playing after you call `layer.open`. The `onStart` callback is fired once the clip has been confirmed to have actually started playback.

## onDone
This is called when the clip finishes playing (and the omxplayer instance stops/quits).

## onProgress
The `onProgress` callback is called every second (by default) or however often you need (just set `progressInterval` in settings).

The callback sends a single object containing `position`, `duration` and `playStatus` (either `playing`, `paused` or `error`).

Example:
```
layer.onProgress = (info) => {
	console.log(`layer is at ${info.position} / ${info.duration}; currently ${info.status}`);
	// will output something like: layer is at 2500 / 10000; currently playing
}
```

## Stop playing
`layer.stop();`
This seems to be the same thing as quitting! See https://github.com/popcornmix/omxplayer/issues/564

## Quit omxplayer
`layer.quit();`

## Pause omxplayer
`layer.pause();`
Pauses the clip; ignored if already paused.

## Resume playing
`layer.resume();`
Resumes a clip if paused; ignored if already playing, and will generate an error in the logs if clip is already stopped/done but is essentially ignored.

## Set volume
`layer.setVolume(vol);`
Set volume to a fraction of the max volume (0.0 - 1.0)
