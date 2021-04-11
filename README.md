# nys-major-capital-improvements-parser
Script for converting NYS data on major capital improvements cases to CSV files

## To convert your own NYS government issued MCI text files to CSVs: 

1. Put the .TXT files you want to convert to CSVS in the `textFiles` folder.

2. In `index.js`, go to the array `fileNames` (ca 191) and replace the default
names with the those of the files you put in `textFiles`. 

3. In the terminal, run `node index.js`

And that's it. Your new CSV files should then appear in the `csvs` folder
