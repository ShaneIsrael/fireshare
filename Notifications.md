## Notifications
Firesahre has a limited setup for notifications when a new video is uploaded. Primarily Discord and a Generic Webhook. Since Gaming and Discord is so ubiquitous it makes sense to have a dedicated Discord channel just for clip highlights to share with your friends. For this reason there is the Discord integration, to notify a channel when a new video has been uploaded. A similar premise has been made for the Generic Webhook. There are many notification systems, and to program them all would be an undertaking, so with the Generic Webhook, this allows what should be a means to still notify any system that can take a HTTP-POST and a JSON payload for webhooks.
### Discord
The Discord Notification integration is very simple, you just add the webhook URL to the channel you want it to be send to. You can learn how to generate a webhook URL for your Discord server and channel here: [Discord - Webhook Documentation](https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks)

Docker ENV example:

`DISCORD_WEBHOOK_URL='https://discord.com/api/webhooks/123456789/abcdefghijklmnopqrstuvwxyz'`

### Generic Webhook
For any other service you would want to send a notification to, that also supports a generic JSON payload-based webhook. Please note, you will have to set not only the POST URL but also the JSON Payload. If you do not know what this is you can learn more here:

Basically, you will need to enter valid JSON data into the "Generic Webhook JSON Payload" box on the integrations page, with the JSON payload that will work for your specific app or service. Please consult the webhook documentation for the service you are wanting to use, if they offer webhook support. For instance, the JSON data could look something like the following:

```
{
    "Title": "Fireshare",
    "message": "New Video Uploaded to Fireshare",
}
```

There is one variable avaliable that can be used in the JSON payload that can inject the video perma link. This could be useful that when you see the notification on your service you have a direct link to this new video. This can be achived using this exact format anywhere it makes sense: `[video_url]` 

Example:
```
{
    "Title": "Fireshare",
    "message": "New Video Uploaded to Fireshare [video_url]",
}
```
What this will look like send to your service as a json payload:

```
{
    "Title": "Fireshare",
    "message": "New Video Uploaded to Fireshare https://yourdomain.com/w/c415d34530d15b2892fa4a4e037b6c05",
}
```

**Syntax Note**

Please keep in mind that the json payload is not a simple string, it has key/value pairs that have string in it. This means these strings are usually wrapped in either single quotes `'` or double `"`. Meaning if you are just pasting your json via the gui, just pick one and fireshare will take care of the rest. However for Docker ENVs you need to make sure you are choosing one for the total encapuslation of the json, and then another for the actual internal json strings. 

Example:

```
GENERIC_WEBHOOK_PAYLOAD='{"Title": "Fireshare", "message": "New Video Uploaded to Fireshare [video_url]"}'
#Notice this is a sinlge line ^
```


**Full Docker ENV example:**

```
GENERIC_WEBHOOK_URL='https://webhook.com/at/endpoint12345'
GENERIC_WEBHOOK_PAYLOAD='{"Title": "Fireshare", "message": "New Video Uploaded to Fireshare [video_url]"}'
# You must have both ENVs filled in for Generic Webhook to work
```
