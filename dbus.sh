#!/bin/bash

#set -x

OMXPLAYER_DBUS_ADDR="/tmp/omxplayerdbus.${USER}"
OMXPLAYER_DBUS_PID="/tmp/omxplayerdbus.${USER}.pid"
export DBUS_SESSION_BUS_ADDRESS=`cat $OMXPLAYER_DBUS_ADDR`
export DBUS_SESSION_BUS_PID=`cat $OMXPLAYER_DBUS_PID`

[ -z "$DBUS_SESSION_BUS_ADDRESS" ] && { echo "Must have DBUS_SESSION_BUS_ADDRESS" >&2; exit 1; }

case $2 in
getduration)
  duration=`dbus-send --print-reply=literal --session --reply-timeout=500 --dest=$1 /org/mpris/MediaPlayer2 org.freedesktop.DBus.Properties.Duration`
  [ $? -ne 0 ] && exit 1
  duration="$(awk '{print $2}' <<< "$duration")"
  echo $duration
  ;;

getposition)
  position=`dbus-send --print-reply=literal --session --reply-timeout=500 --dest=$1 /org/mpris/MediaPlayer2 org.freedesktop.DBus.Properties.Position`
  [ $? -ne 0 ] && exit 1
  position="$(awk '{print $2}' <<< "$position")"
  echo $position
  ;;

getplaystatus)
  playstatus=`dbus-send --print-reply=literal --session --reply-timeout=500 --dest=$1 /org/mpris/MediaPlayer2 org.freedesktop.DBus.Properties.PlaybackStatus`
  [ $? -ne 0 ] && exit 1
  playstatus="$(sed 's/^ *//;s/ *$//;' <<< "$playstatus")"
  echo $playstatus
  ;;

getvolume)
  volume=`dbus-send --print-reply=double --session --reply-timeout=500 --dest=$1 /org/mpris/MediaPlayer2 org.freedesktop.DBus.Properties.Volume`
  [ $? -ne 0 ] && exit 1
  volume="$(awk '{print $2}' <<< "$volume")"
  echo $volume
  ;;

setposition)
  dbus-send --print-reply=literal --session --dest=$1 /org/mpris/MediaPlayer2 org.mpris.MediaPlayer2.Player.SetPosition objpath:/not/used int64:$3 >/dev/null
  ;;

seek)
  dbus-send --print-reply=literal --session --dest=$1 /org/mpris/MediaPlayer2 org.mpris.MediaPlayer2.Player.Seek int64:$3 >/dev/null
  ;;

play)
  dbus-send --print-reply=literal --session --dest=$1 /org/mpris/MediaPlayer2 org.mpris.MediaPlayer2.Player.Play >/dev/null
  ;;

pause)
  dbus-send --print-reply=literal --session --dest=$1 /org/mpris/MediaPlayer2 org.mpris.MediaPlayer2.Player.Pause >/dev/null
  ;;

stop)
  dbus-send --print-reply=literal --session --dest=$1 /org/mpris/MediaPlayer2 org.mpris.MediaPlayer2.Player.Stop >/dev/null
  ;;

quit)
  dbus-send --print-reply=literal --session --dest=$1 /org/mpris/MediaPlayer2 org.mpris.MediaPlayer2.Quit
  ;;

setvolume)
  dbus-send --print-reply=literal --session --dest=$1 /org/mpris/MediaPlayer2 org.freedesktop.DBus.Properties.Volume double:$3 >/dev/null
  ;;

volumeup)
  dbus-send --print-reply=literal --session --dest=$1 /org/mpris/MediaPlayer2 org.mpris.MediaPlayer2.Player.Action int32:18 >/dev/null
  ;;

volumedown)
  dbus-send --print-reply=literal --session --dest=$1 /org/mpris/MediaPlayer2 org.mpris.MediaPlayer2.Player.Action int32:17 >/dev/null
  ;;

hidevideo)
  dbus-send --print-reply=literal --session --dest=$1 /org/mpris/MediaPlayer2 org.mpris.MediaPlayer2.Player.Action int32:28 >/dev/null
  ;;

unhidevideo)
  dbus-send --print-reply=literal --session --dest=$1 /org/mpris/MediaPlayer2 org.mpris.MediaPlayer2.Player.Action int32:29 >/dev/null
  ;;

setalpha)
	dbus-send --print-reply=literal --session --dest=$1 /org/mpris/MediaPlayer2 org.mpris.MediaPlayer2.Player.SetAlpha objpath:/not/used int64:$3 >/dev/null
	;;

*)
  echo "error"
  exit 1
  ;;

esac
