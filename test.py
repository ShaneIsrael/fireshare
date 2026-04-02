import requests
import json

# The target webhook URL
webhook_url = "https://eager-hawk-15.webhook.cool"

# The data you want to send (formatted as a dictionary)
data_to_send = {
    "status": "success",
    "message": "Hello from Python script",
    "id": 12345
}

try:
    # Sending the POST request
    response = requests.post(
        webhook_url, 
        data=json.dumps(data_to_send),
        headers={'Content-Type': 'application/json'}
    )

    # Check if the request was successful
    if response.status_code == 200:
        print("Data sent successfully!")
    else:
        print(f"Failed to send data. Status code: {response.status_code}")

except Exception as e:
    print(f"An error occurred: {e}")