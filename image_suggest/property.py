import requests
import os
from tqdm import tqdm
from dotenv import load_dotenv
from selenium import webdriver
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.keys import Keys
load_dotenv()
import time
import lxml
import pandas as pd

PATH = "C:\Program Files (x86)\chromedriver.exe"
driver = webdriver.Chrome(PATH)

#driver.get("https://www.google.com")
driver.get("https://rensselaer.sdgnys.com/index.aspx")
#PAbtn = driver.find_element_by_id("btnPublicAccess")
#PAbtn.click()
time.sleep(1)
# Load up initial public access button page
try:
    element = WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.ID, "btnPublicAccess"))
    )
    element.click()
except:
    print("cookies issue")
    driver.quit()

time.sleep(1)

#Load search page
try:
    element = WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.ID, "lblSearchTitle"))
    )

except:
    print("search page didn't load")
    driver.quit()

# Select from drop down
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
street_num.click()
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
    # Load property page
    try:
        element = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CLASS_NAME, "reportSection"))
        )
    except:
        print("report page didn't load")
        driver.quit()
    report = driver.find_element_by_id("btnReport")
    report.click()
    try:
        element = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.ID, "photo_cell"))
        )
    except:
        print("full report page didn't load")
        driver.quit()
    
    # find all divs with classname report_section

    tables = pd.read_html(driver.page_source)
    print(len(tables))
    for table in tables:
        print(table.head())
    # table_divs = driver.find_elements_by_class_name("report_section")
    # for div in table_divs:
    #     print(div.get_attribute("id"))




    #with open('1704_highland_ave.html', 'w') as f:
    #    f.write(driver.page_source)
    #image = driver.find_element_by_id("pnlPhotoView").find_element_by_tag_name("a").get_attribute("href")
