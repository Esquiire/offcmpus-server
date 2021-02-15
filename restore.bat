:: Restore
:: Upload the preserted mongodb documents from the pres/ directory
mongorestore --verbose /dir:pres /drop /uri:mongodb://localhost:27017/housing-database