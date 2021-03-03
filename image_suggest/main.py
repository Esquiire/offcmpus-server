import requests
import os
from tqdm import tqdm
from dotenv import load_dotenv
load_dotenv()

API_KEY = os.getenv("GCP_API")
api_url = "https://maps.googleapis.com/maps/api/streetview?"
size = "size=665x441"
inp_address = input("What address do you want: ")
address = "&location=" + inp_address.replace(" ", "+")
#print(API_KEY)
image_request = api_url+size+address+"&key="+API_KEY
#print(image_request)

response = requests.get(image_request, stream=True)
total_size_in_bytes= int(response.headers.get('content-length', 0))
block_size = 1024 #1 Kibibyte
progress_bar = tqdm(total=total_size_in_bytes, unit='iB', unit_scale=True)

image_path = "images/" + inp_address.replace(" ","_")+".png"

with open(image_path, 'wb') as file:
    for data in response.iter_content(block_size):
        progress_bar.update(len(data))
        file.write(data)
progress_bar.close()
if total_size_in_bytes != 0 and progress_bar.n != total_size_in_bytes:
    print("ERROR, something went wrong")

