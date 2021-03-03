import requests
import os
from dotenv import load_dotenv
load_dotenv()

API_KEY = os.getenv("GCP_API")
api_url = "https://maps.googleapis.com/maps/api/streetview?"
size = "size=600x600"
inp_address = input("What address do you want: ")
address = "&location=" + inp_address.replace(" ", "+")
print(API_KEY)
image_request = api_url+size+address+"&key="+API_KEY
print(image_request)

response = requests.get(image_request)
image_path = inp_address.replace(" ","_")
file = open("images/sample_image.png", "wb")
file.write(response.content)
file.close()