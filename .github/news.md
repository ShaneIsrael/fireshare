# Fireshare News Banner
The fireshare news banner allows for admins to receive important news and updated about the project. (Updates, Breaking changes, etc.)

## Adding articles

To add an article, append a new json dictionary to the `news.json` file. The dictionary should contain the following keys:
- `date`: The date of the article in the format `MM-DD-YYYY`.
- `message`: The message of the article. This should be a string.
- `ignore_if_version`: (OPTIONAL) Set this to the string of the version that this article should be ignored for. This applies to both the set version and also future versions. (e.g. `2.0.1` will ignore this article for `2.0.1` and all future versions.)
- `ignore_after`: (OPTIONAL) Set this to the date that this article should be ignored after. This should be in the format `MM-DD-YYYY`. This will ignore the article after this date and not display it to admins.
- `critical`: boolean value that determines if the article is critical or not. If this is set to true, the article will be displayed in red. This is used for breaking changes and other important news. (e.g. `true` or `false`)

Please do not use any non-json syntax like comments in the file, as this will break the json parser. If you need to add comments, please do so in your push request or issue.


## Example

```json
[
    {
        "date": "10-01-2025",
        "message": "This is a test message. Only displayed to admins that are running server version 2.0.0 or earlier. Good for update announcements.",
        "ignore_if_version": "2.0.1",
        "ignore_after": null,
        "critical": false
    },
    {
        "date": "10-02-2025",
        "message": "This is a critical message, that will be displayed in red to all server versions indefinitely.",
        "ignore_if_version": null,
        "ignore_after": null,
        "critical": true
    },
    {
        "date": "10-03-2025",
        "message": "This is a message that will only be displayed to admins until new years day 2026. Please remember to use the US date format. (MM-DD-YYYY)",
        "ignore_if_version": null,
        "ignore_after": "01-01-2026",
        "critical": false
    }
]
```