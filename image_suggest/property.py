import requests
import os
from tqdm import tqdm
from dotenv import load_dotenv
from selenium import webdriver
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

load_dotenv()
import time

PATH = "C:\Program Files (x86)\chromedriver.exe"
driver = webdriver.Chrome(PATH)

#driver.get("https://www.google.com")
driver.get("https://rensselaer.sdgnys.com/index.aspx")
#PAbtn = driver.find_element_by_id("btnPublicAccess")
#PAbtn.click()
time.sleep(1)
try:
    element = WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.ID, "btnPublicAccess"))
    )
    element.click()
except:
    driver.quit()
time.sleep(1)
try:
    element = WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.ID, "lblSearchTitle"))
    )
    select = driver.find_element_by_id("ddlMunic")
    for option in select.find_elements_by_tag_name('option'):
        if option.text == 'City of Troy':
            option.click()
            break
    time.sleep(1)
    street_num = driver.find_element_by_id("txtStreetNum")
    street_num.send_keys("1704")
    street_num = driver.find_element_by_id("txtStreetName")
    street_num.send_keys("highland")
    time.sleep(1)
    no_results = driver.find_element_by_id("zerocount")
    if(no_results.get_attribute("style") == "display: block;"):
        print("NO PROPERTIES FOUND")
    else:
        count = driver.find_element_by_id("searchResultCount")

        print("we found "+ count.text+ " properties")
        search = driver.find_element_by_id("btnSearch")
        search.click()
        time.sleep(1)
        report = driver.find_element_by_id("btnReport")
        report.click()
        time.sleep(2)
        #image = driver.find_element_by_id("pnlPhotoView").find_element_by_tag_name("a").get_attribute("href")
except:
    print("page didn't load")
    driver.quit()

