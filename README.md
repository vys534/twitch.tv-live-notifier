# Twitch.tv Live Notifier

Display streaming notifications from Twitch right in your Discord server. Live and updates every 60 seconds. Sends a message no later than 3 minutes after your stream starts. Bot originally developed for [this osu! streamer](https://twitch.tv/sriracha_rice).

## Setup & Run

You need basic knowledge of how to use the GNU/Linux command line and already have a VPS set up and running. **If you are the streamer, and you don't know how to use a VPS/command line, try finding someone who can set this up for you or learn how to set up a VPS.**

### Step 0: clone the repo and setup

- On your VPS, run the usual `git clone` of this repository. Then, `cd` into the directory.
- Run `npm i` and wait for everything to install.

### Step 1: .env setup

Create a .env file in the root project directory. This means that you should create the file where all the other files are.

![](https://i.postimg.cc/pdq6VKKW/image.png)

Copy and paste this template into your `.env` file.

```env
BOT_TOKEN=
TWITCH_USERNAME=
TWITCH_CID=
TWITCH_SECRET=
SERVER_ID=
WELCOME_CHANNEL_ID=
STREAMING_CHANNEL_ID=
PING_ROLE=
```

- `BOT_TOKEN` is your Discord bot's token. [Create a new application from here if you haven't already.](http://discordapp.com/developers/applications/me)
- `TWITCH_USERNAME` Upon starting the bot, the program will immediately request an OAuth token and make a request for the username in question. This is so that when the username changes, the ID will rename the same. **You must change this if the streamer targeted changes their username, but only on a restart/other process that will cause your bot to restart.**
- `TWITCH_CID` is your Twitch application's client ID. **Do not share this with anyone.**
- `TWITCH_SECRET` is your Twitch application's client secret. **Do not share this with anyone.**
- `SERVER_ID` is the Discord server's ID. Not a channel ID, the entire server.
    - ![](https://i.postimg.cc/50mv6Nzk/image.png)
- `WELCOME_CHANNEL_ID`: Send all welcome messages to this channel ID.
- `STREAMING_CHANNEL_ID`: Send all stream messages to this channel ID.
- `PING_ROLE`: The role ID to ping when you go live. To ping everyone, **use the value`everyone`**.

### Step 2: build & run

Now you have to build the project.

- Run `tsc` from the terminal. It will automatically build the index.js file into a `dist` directory. Don't worry, it will be created if it isn't there. Now, depending on your computer's specs, it will take a few seconds. It should never take more than a minute. 
- Okay, now you have a built `index.js` file that's ready to deploy. Next step: install `pm2` if you don't have it. **If you do, skip down to the last bullet point.**
- Install PM2 by running `npm i -g pm2`. 
- Run `pm2 start dist/index.js --name TwitchBot` **FROM THE ROOT DIRECTORY! DO NOT CD INTO /dist.** Your bot should now be running. Check `pm2 logs TwitchBot` after you do this to make sure there are no errors.

## Updating

To update the bot to the latest version, just run `git pull`.