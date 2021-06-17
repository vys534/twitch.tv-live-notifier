require("dotenv").config();

import {Client, Message, MessageEmbedOptions, TextChannel} from "discord.js";
import axios, {AxiosError, AxiosResponse} from "axios";
import * as envalid from "envalid";
import hd from "humanize-duration";
import m from "moment";

const bigIntParse = envalid.makeValidator(x => {
    return BigInt(x);
})

interface StreamData {
    isStreaming: boolean
    streamMessage: Message
    viewers: number
    peakViewers: number
    playing: string
    title: string
    durationString: string
    thumbnail: string
    language: string
    username: string
}

// interface UserData {
//     loginName: string
//     displayName: string
//     profilePhoto: string
//     userID: string
//     broadcasterType: string
//     views: number
//     description: string
// }

interface Config {
    BOT_TOKEN: string
    TWITCH_USERNAME: string
    TWITCH_CID: string
    SERVER_ID: string
    STREAMING_CHANNEL_ID: bigint
    TWITCH_SECRET: string
    PING_ROLE: string
}

interface TwitchHelixStreamDataResponse {
    id: number
    user_id: string
    user_name: string
    game_id: string
    type: string
    title: string
    viewer_count: number
    started_at: string
    language: string
    thumbnail_url: string
}

// interface TwitchHelixUserDataResponse {
//     id: string
//     login: string
//     display_name: string
//     type: string
//     broadcaster_type: string
//     description: string
//     profile_image_url: string
//     offline_image_url: string
//     view_count: number
//     email: string
// }

interface TwitchHelixOAuthResponse extends TwitchHelixOAuth {
    expires_in: number
    token_type: string
}

interface TwitchHelixOAuth {
    access_token: string
    refresh_token: string
    scope: string[]
}

class Application {
    private client: Client = new Client({
        intents: ["GUILD_MESSAGES", "GUILDS"]
    });
    private streamData: StreamData = Application.setStreamDataDefault();
    // private userData: UserData;
    private config: Config = envalid.cleanEnv(process.env, {
        BOT_TOKEN: envalid.str(),
        TWITCH_USERNAME: envalid.str(),
        TWITCH_CID: envalid.str(),
        TWITCH_SECRET: envalid.str(),
        SERVER_ID: envalid.str(),
        STREAMING_CHANNEL_ID: bigIntParse(),
        PING_ROLE: envalid.str()
    });
    private oAuthToken: string;

    private static setStreamDataDefault(): StreamData {
        return {
            isStreaming: false,
            streamMessage: null,
            viewers: 0,
            peakViewers: 0,
            playing: null,
            title: null,
            durationString: null,
            thumbnail: null,
            language: null,
            username: null
        }
    }

    private async makeGetRequest(to: string): Promise<any> {
        return axios.get(to, {
            headers: {
                "Authorization": `Bearer ${this.oAuthToken}`,
                "Client-ID": this.config.TWITCH_CID
            }
        }).then((res: AxiosResponse) => {
            return res.data
        })
            .catch(async (e: AxiosError) => {
                console.log(e);
                if (e.response) {
                    if (e.response.status === 401) {
                        // Update OAuth token, and retry the request.
                        console.log("OAUTH - Need to refresh OAuth.");
                        await this.updateOAuth(true);
                        await this.makeGetRequest(to);
                    }
                } else {
                    console.log(`ERROR - OAuth: Couldn't create GET request to ${to}.`, e);
                }
            })

    }

    private async updateOAuth(needNewToken?: boolean) {
        if (!this.oAuthToken || needNewToken) {
            try {
                console.log("OAUTH - Asking for new token.");
                const tokenResponse: TwitchHelixOAuthResponse = await axios.post(`https://id.twitch.tv/oauth2/token?client_id=${this.config.TWITCH_CID}&client_secret=${this.config.TWITCH_SECRET}&grant_type=client_credentials`).then((res: any) => {
                    console.log("OAUTH - Received token successfully.");
                    return res.data;
                });
                this.oAuthToken = tokenResponse.access_token;
            } catch (e) {
                console.log(`ERROR - OAuth: Couldn't get the OAuth token.`, e);
            }
        }
    }

    private buildStreamEmbed(streamOver?: boolean): MessageEmbedOptions {
        let desc: string;
        if (streamOver) {
            desc = `Last seen playing: **${this.streamData.playing || "Was not playing a game"}**\nPeak viewers: **${this.streamData.peakViewers.toLocaleString()}**`
        } else {
            desc = `Playing: **${this.streamData.playing || "Not playing a game"}**\nViewers: **${this.streamData.viewers.toLocaleString()}** [Peak: **${this.streamData.peakViewers.toLocaleString()}**]`
        }
        desc += `\nStream language: **${this.streamData.language}**`;
        return {
            title: `**${this.streamData.title}**`,
            url: `https://twitch.tv/${this.config.TWITCH_USERNAME}`,
            description: desc,
            color: 12910847,
            footer: {
                text: `Stream ${streamOver ? "was" : "has been"} up for: ${hd(m().unix() * 1000 - m(this.streamData.durationString).unix() * 1000, {largest: 2})}`
            }
        };
    }

    // private async updateUserData() {
    //     try {
    //         const requestTo = this.userData ? `https://api.twitch.tv/helix/users?id=${this.userData.userID}` : `https://api.twitch.tv/helix/users?login=${this.config.TWITCH_USERNAME}`;
    //         const user = await this.makeGetRequest(requestTo);
    //
    //         const userData: TwitchHelixUserDataResponse = user.data[0];
    //         this.userData = {
    //             loginName: userData.login,
    //             displayName: userData.display_name,
    //             profilePhoto: userData.profile_image_url,
    //             userID: userData.id,
    //             broadcasterType: userData.broadcaster_type,
    //             views: userData.view_count,
    //             description: userData.description
    //         };
    //     }
    //     catch (e) {
    //         console.log(`Could not update user data.`, e);
    //     }
    // }
    private async updateStatistics(twitchData: TwitchHelixStreamDataResponse) {
        try {
            this.streamData.title = twitchData.title;
            this.streamData.durationString = twitchData.started_at;
            this.streamData.viewers = twitchData.viewer_count;
            // If we have more viewers than last peak viewer count, update this
            if (twitchData.viewer_count > (this.streamData.peakViewers || 0)) {
                this.streamData.peakViewers = twitchData.viewer_count
            }
            this.streamData.language = twitchData.language;
            this.streamData.thumbnail = twitchData.thumbnail_url.replace("{width}", "1280").replace("{height}", "720");
            this.streamData.username = twitchData.user_name;
            if (twitchData.game_id) {
                this.streamData.playing = await this.makeGetRequest(`https://api.twitch.tv/helix/games?id=${twitchData.game_id}`).then((r) => {
                    return r.data[0].name
                });
            } else {
                this.streamData.playing = null;
            }
        } catch (e) {
            console.log(`ERROR - Could not update stream message/statistics.`, e);
        }
    }

    private async monitorForLiveStatus() {
        const stream = await this.makeGetRequest(`https://api.twitch.tv/helix/streams?user_login=${this.config.TWITCH_USERNAME}`);
        const twitchData: TwitchHelixStreamDataResponse = stream.data[0];

        try {
            // We got no data back, so assume the streamer isn't streaming.
            if (!twitchData) {
                // Assume stream ended.
                if (this.streamData.isStreaming && this.streamData.streamMessage !== null) {
                    console.log("DEBUG - Stream ended. Cleaning up message...");
                    await this.streamData.streamMessage.edit({
                        content: `:no_entry_sign: ${this.streamData.username} has ended the stream. Tune in next time!`,
                        embeds: [
                            this.buildStreamEmbed(true)
                        ]
                    });
                    // Reset all stream data AFTER editing the message.
                    this.streamData = Application.setStreamDataDefault();
                    console.log("DEBUG - Successfully cleaned up.");
                }
                // Stream never occurred. Nothing has happened, so ignore this cycle completely.
                else {
                    return;
                }
            } else {
                // Update displayed stream data (in the embed, etc).
                await this.updateStatistics(twitchData);
                // Just update the message because they're still streaming
                if (this.streamData.isStreaming && this.streamData.streamMessage !== null) {
                    await this.streamData.streamMessage.edit({
                        content: `:red_circle: ${this.streamData.username} is currently streaming${this.streamData.playing ? ` **${this.streamData.playing}**` : ""}!`,
                        embeds: [
                            this.buildStreamEmbed(false)
                        ]
                    })
                }
                // We can assume that we've just gotten the signal that this user has started streaming.
                else {
                    console.log("DISCORD - Stream started/has already started. Attempting to send message.");
                    // Prevent this block from running again until they start streaming later.
                    this.streamData.isStreaming = true;

                    // Build and set message
                    const channelToSend = this.client.channels.cache.get(`${this.config.STREAMING_CHANNEL_ID}`) as TextChannel;
                    this.streamData.streamMessage = await channelToSend.send({
                        content: `:red_circle: ${this.config.PING_ROLE == "everyone" || this.config.PING_ROLE == "here" ? `@${this.config.PING_ROLE}` : `<@${this.config.PING_ROLE}>`}, ${this.streamData.username} is now live!${this.streamData.playing ? ` Playing: **${this.streamData.playing}**` : ""}`,
                        embeds: [
                            this.buildStreamEmbed(false)
                        ]
                    });
                    console.log("DISCORD - Stream message sent successfully.");
                }
            }
        } catch (e) {
            console.log("ERROR - Discord message: Could not send streaming message:" + e);
        }
    }

    public async start() {
        this.client.on("ready", async () => {
            console.log("DEBUG - Client just broadcasted ready event")
        });

        this.client.login(this.config.BOT_TOKEN).then(async () => {
            console.log("DEBUG - Client logged in, this is just the resolution for the promise");
            // Immediately request a new OAuth token.
            await this.updateOAuth();

            // DEPRECATED: Twitch now requires the user to consent for their data (followers, etc.). I cba to implement a front-end for this.
            // Immediately update user data to know who we are keeping track of.
            // await this.updateUserData();

            // console.log(`Tracking Twitch user ${this.userData.loginName}.\nDisplay name: ${this.userData.displayName}\nWelcome channel ID: ${this.config.WELCOME_CHANNEL_ID}\nStreaming channel ID: ${this.config.STREAMING_CHANNEL_ID}\nServer ID: ${this.config.SERVER_ID}`);
            console.log(`\nDEBUG - Streaming channel ID: ${this.config.STREAMING_CHANNEL_ID}\nDEBUG - Server ID: ${this.config.SERVER_ID}`);
            this.client.setTimeout(() => {
                // Check for live every 30 seconds thereafter
                this.client.setInterval(async () => {
                    await this.monitorForLiveStatus();
                }, 30000);
            }, 10000);
        });
    }
}

new Application().start().catch((e) => {
    console.log("ERROR - Bot: Application encountered an error:", e);
});