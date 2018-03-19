var exec = require('child_process').exec;
var path = require('path');


const DBUS_COMMAND = "bash "+__dirname+"/dbus.sh ";
const DBUS_DEST_DEFAULT = 'org.mpris.MediaPlayer2.omxplayer';

const MAX_START_ATTEMPTS = 300;

class OmxInstance {

	constructor(options) {
		this.options = options;

		if (options && typeof options.layer === 'number') {
			this.dbusDest = DBUS_DEST_DEFAULT + '_layer' + options.layer;
			this.layer = options.layer;
			console.log('setup for layered mode');
		} else {
			this.dbusDest = DBUS_DEST_DEFAULT;
			this.layer = 0;
			console.log('not layered mode');
		}
		console.log('dbus name will be', this.dbusDest);

		exec('mkfifo omxpipe'+this.layer);

		if (options && options.progressInterval) {
			console.log('custom progress interval:', options.progressInterval);
			this.progressInterval = options.progressInterval;
		} else {
			this.progressInterval = 1000;
		}

		this.progressHandler = null;

	}

	getLayer() {
		return this.layer;
	}

	cancelProgressHandlerIfActive() {
		if (this.progressHandler) {
			clearInterval(this.progressHandler);
			console.info('progressHandler cancelled');
			this.progressHandler = null;
		}
	}

	dbusCommand (command)  {
		let merge = "bash " +__dirname+"/dbus.sh " + this.dbusDest + " " + command;
		if (command != 'getplaystatus' && command !='getvolume' && command != 'getposition') { console.log('merge:', merge); }
		return merge;
	}

	resume () {
		exec(this.dbusCommand('play'), (error, stdout, stderr) => {
			if (error) console.error('resume() error:', error);
			console.log('should play/resume/restart');
		});
	}

	pause () {
		exec(this.dbusCommand('pause'), (error, stdout, stderr) => {
			if (error) console.error('pause() error:', error);
			console.log('should pause');
		});
	}

	stop (callback) {
		exec(this.dbusCommand('stop'), (error, stdout, stderr) => {
			if (error) console.error('stop() error:', error);
			console.log('should stop');
			this.cancelProgressHandlerIfActive();
			if (callback) callback();
		});
	}

	quit (callback) {
		exec(this.dbusCommand('quit'), (error, stdout, stderr) => {
			this.cancelProgressHandlerIfActive();
			if (callback) callback();
	  });
	}

	seekRelative (offset) {
		//seek offset in milliseconds; relative from current position; negative values will cause a jump back;
		exec(this.dbusCommand('seek ' +Math.round(offset*1000)), (error, stdout, stderr) => {});
	}

	setAbsolute (position) {
		//position in milliseconds from start; //positions larger than the duration will stop the player;
		exec(this.dbusCommand('setposition '+Math.round(position*1000)), (error, stdout, stderr) => {
			if (error) console.error('setAbsolute() error:', error);
		});
	}

	setVolume (volume) {
		// volume range [0.0, 1.0];
		if (volume > 0 && volume < 1.0) {
			exec(this.dbusCommand('setvolume '+volume), (error, stdout, stderr) => {});
		}
	}

	setVisibility (visible) {
		let command = visible ? 'unhidevideo' : 'hidevideo';
		exec(this.dbusCommand(command), (err, stdout, stderr) => {});
	}

	setAlpha (alpha) {
		exec(this.dbusCommand('setalpha ' + alpha), (err, stdout, stderr) => {});
	}

	getCurrentPosition () {
		return new Promise( (resolve, reject) => {
				exec(this.dbusCommand('getposition'), (error, stdout, stderr) => {
					if (error) reject();
					let position = parseInt(stdout) / 1000; // microseconds to milliseconds
					resolve(position);
				});
		});
	}

	getPlayStatus () {
		return new Promise( (resolve, reject) => {
			exec(this.dbusCommand('getplaystatus'), (error, stdout, stderr) => {
				if (error) {
					console.error('getPlayStatus() error:', error);
					reject(error);
				}
				if (stdout.indexOf('Playing') > -1) {
					resolve('playing');
				} else {
					resolve('paused');
				}
			});
		});
	}

	getDuration () {
		return new Promise( (resolve, reject) => {
			if (this.cachedDuration) {
				resolve(this.cachedDuration);
			} else {
				exec( this.dbusCommand('getduration'), (error, stdout, stderr) => {
					if (error) reject();

					let duration = parseInt(stdout) / 1000; // microseconds to milliseconds
					resolve(duration);
					this.cachedDuration = duration; // cache last known duration
				});
			}
		});
	}

	getVolume () {
		exec(this.dbusCommand('getvolume'), (error, stdout, stderr) => {
			if (error) return null;
			let volume = parseFloat(stdout);
			console.log('getVolume:', volume);
		});	}

	onProgress (callback) {
		console.log('add new progress handler for layer', this.layer);
		this.progressHandler = setInterval( () => {
			if (this.shouldBePlaying) {
				this.getPlayStatus()
				.then( (playStatus) => {
					this.getCurrentPosition()
					.then( (position) => {
						this.getDuration()
						.then( (duration) => {
							callback({ position: position, duration: duration, status: playStatus });
						});
					});
				})
				.catch( (err) => {
					console.warn('onProgress: error getting playStatus:', err);
					// do NOT send error via callback!
				});
			}
		}, this.progressInterval);
	}

	onStart (callback) {
		this.onStartCallback = callback;
	}

	onDone (callback) {
		this.onDoneCallback = callback;
	}

	isBusy() {
		return this.shouldBePlaying;
	}

	waitTillPlaying (callback) {
		console.log('waitTillPlaying()');
		this.shouldBePlaying = true;
		let initTime = Date.now();
		return new Promise( (resolve, reject) => {
			let countAttempts = 0;
			let interval = setInterval( () => {
				countAttempts++;
				exec(this.dbusCommand('getplaystatus'), (error, stdout, stderr) => {
					if (error) {
						if (countAttempts > MAX_START_ATTEMPTS) {
							console.error(`too many attempts (${countAttempts}) to get playstatus after start!`);
							this.shouldBePlaying = false;
							clearInterval(interval);
							reject(error);
						}
					} else {
						let elapsed = Date.now() - initTime;
						console.info(`getplaystatus success after ${elapsed}ms, ${countAttempts} attempts: ${stdout}`);
						clearInterval(interval);
						resolve(elapsed);
					}
				});
			}, 10);
		});
	}

	open (path, holdMode) {
		console.log('OmxInstance open() for layer #', this.layer, 'holdMode?', holdMode);
		let settings = this.options || {};
		let args = [];
		let command = 'omxplayer';

		args.push('"'+path+'"');

		if (['hdmi','local','both'].indexOf(settings.audioOutput) != -1) {
			args.push('-o');
			args.push(settings.audioOutput);
		}

		if (settings.blackBackground == true) { // defaults to false
			args.push('-b');
		}

		if (settings.backgroundARGB) {
			args.push('-b0x' + settings.backgroundARGB);
		}

		if (settings.disableKeys === true) { //defaults to  false
			args.push('--no-keys')
		}

		if (settings.blank === true) { // defaults to false
			args.push('--blank');
		}

		if (settings.disableOnScreenDisplay === true) { //defaults to  false
			args.push('--no-osd')
		}

		if (settings.disableGhostbox === true) { //defaults to  false
			args.push('--no-ghost-box');
		}

		if (settings.loop === true) { // defaults to false
			args.push('--loop');
		}

		if (settings.subtitlePath && settings.subtitlePath != "" ){
			args.push('--subtitles');
			args.push('"'+settings.subtitlePath+'"');
		}

		if (settings.startAt){
			args.push('--pos');
			args.push(''+settings.startAt+'');
		}

		if (settings.layer) {
			args.push('--layer');
			args.push(settings.layer);
		}

		if (holdMode) {
			args.push('--alpha');
			args.push(0);
		}

		args.push('--dbus_name');
		args.push(this.dbusDest);

		if (settings.aspectMode) {
			args.push('--aspect-mode');
			args.push(settings.aspectMode);
		}

		let finalOpenCommand = command+' '+args.join(' ')+' < omxpipe'+this.layer;
		console.log('finalOpenCommand:', finalOpenCommand);

		if (this.shouldBePlaying) {
			console.error('omx-layers was instructed to open, but playback is (?) already in progress');
		} else {

			exec(finalOpenCommand, (error, stdout, stderr) => {
				// This block executes on clip end...
				this.cancelProgressHandlerIfActive();
				if (this.onDoneCallback) this.onDoneCallback.apply();
				console.log('omxpipe done for layer', this.layer);
				console.log(`final output from omxplayer: \n${stdout}\n.`);
				this.shouldBePlaying = false;
				this.cachedDuration = null;
			});

			exec(' . > omxpipe'+this.layer, (error, stdout, stderr) => {
				// This block executes as soon as pipe is ready...
				this.waitTillPlaying()
					.then( (elapsed) => {
						console.info('confirmed started ok');
						if (this.onStartCallback) this.onStartCallback.apply();
						if (holdMode) {
							console.log('holdMode ON, so immediately pause and hide');
							this.pause();
							this.setVisibility(false);
						}
					})
					.catch ( () => {
						console.error('failed to confirm clip start!');
					});
			});
		}


	}

}

module.exports = OmxInstance;
