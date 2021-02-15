:: Preserve
:: Dump the current state of the local mongodb database into a directory, pres

mongodump --uri="mongodb://localhost:27017/housing-database" -o . --out pres